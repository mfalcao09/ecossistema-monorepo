/**
 * Serviço de Conversão PDF/A com Cache (Bug #F — Motor XML)
 *
 * Helper LAZY: só converte um documento comprobatório para PDF/A na hora
 * em que o XML do diploma vai ser gerado, e cacheia o resultado no próprio
 * registro `diploma_documentos_comprobatorios` (campo `pdfa_storage_path`).
 *
 * Fluxo:
 *   1. Carrega o registro de diploma_documentos_comprobatorios pelo id
 *   2. Se já tem pdfa_storage_path → baixa do bucket `documentos-pdfa` e retorna
 *   3. Senão → baixa o arquivo original do bucket `documentos`
 *   4. Chama o microserviço (convertDocumentToPdfA) → recebe base64 + validação
 *   5. Faz upload do PDF/A no bucket `documentos-pdfa`
 *   6. Atualiza o registro com pdfa_storage_path, sha256, tamanho, engine,
 *      validação e converted_at
 *   7. Retorna { base64, validation, metadata }
 *
 * Uso típico (no gerador XML):
 *   const { base64 } = await obterPdfABase64(ddcId, supabaseAdmin)
 *   documento.ele('ArquivoDocumento').txt(base64)
 *
 * Server-side apenas. Recebe um admin client (service_role) para conseguir
 * ler/escrever no Storage e atualizar o registro mesmo dentro de jobs/cron.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { convertDocumentToPdfA } from '@/lib/document-converter/client'

const BUCKET_ORIGEM = 'processo-arquivos'
const BUCKET_PDFA = 'documentos-pdfa'

/**
 * Limite máximo do PDF/A gerado, em bytes.
 *
 * Espelha o CHECK constraint da tabela `diploma_documentos_comprobatorios`
 * (`pdfa_tamanho_bytes <= 15 * 1024 * 1024`). Validar **antes** do upload
 * evita orfanizar blobs no Storage quando o Ghostscript gera um PDF/A grande
 * demais — o UPDATE falharia silenciosamente e a próxima chamada entraria
 * em loop de reconversão.
 *
 * Se este valor for alterado, alterar também a constraint no banco e
 * `memory/project_pdfa_edge_case_15mb.md`.
 */
export const MAX_PDFA_BYTES = 15 * 1024 * 1024

export interface PdfAResult {
  /** Conteúdo PDF/A em base64 (pronto para colar no <ArquivoDocumento>) */
  base64: string
  /** Tamanho em bytes do PDF/A */
  tamanho_bytes: number
  /** SHA256 hex do PDF/A */
  sha256: string
  /** true = veraPDF disse OK; false = veraPDF disse falha; null = veraPDF indisponível */
  validation_ok: boolean | null
  /** Lista de erros de validação (se houver) */
  validation_errors: string[]
  /** true = serviu do cache, false = converteu agora */
  cached: boolean
}

export class PdfAConversionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'PdfAConversionError'
  }
}

/**
 * Obtém o PDF/A em base64 do documento comprobatório identificado por `ddcId`.
 * Faz cache automático: na primeira chamada converte e salva; nas próximas
 * apenas baixa do Storage.
 *
 * @param ddcId    - id em diploma_documentos_comprobatorios
 * @param admin    - Supabase client com service_role
 * @param options  - { forceReconvert?: boolean } para invalidar cache
 */
export async function obterPdfABase64(
  ddcId: string,
  admin: SupabaseClient,
  options: { forceReconvert?: boolean } = {}
): Promise<PdfAResult> {
  // 1. Carrega registro do documento comprobatório
  const { data: ddc, error: ddcErr } = await admin
    .from('diploma_documentos_comprobatorios')
    .select(
      'id, processo_id, arquivo_origem_id, pdfa_storage_path, pdfa_sha256, pdfa_tamanho_bytes, pdfa_validation_ok, pdfa_validation_errors, deleted_at'
    )
    .eq('id', ddcId)
    .single()

  if (ddcErr || !ddc) {
    throw new PdfAConversionError(`Documento comprobatório ${ddcId} não encontrado`, ddcErr)
  }

  if (ddc.deleted_at) {
    throw new PdfAConversionError(
      `Documento comprobatório ${ddcId} foi removido (deleted_at=${ddc.deleted_at})`
    )
  }

  // 2. Cache hit: já existe PDF/A? Baixa e retorna
  if (!options.forceReconvert && ddc.pdfa_storage_path) {
    const { data: blob, error: dlErr } = await admin.storage
      .from(BUCKET_PDFA)
      .download(ddc.pdfa_storage_path)

    if (!dlErr && blob) {
      const buffer = Buffer.from(await blob.arrayBuffer())
      return {
        base64: buffer.toString('base64'),
        tamanho_bytes: ddc.pdfa_tamanho_bytes ?? buffer.length,
        sha256: ddc.pdfa_sha256 ?? createHash('sha256').update(buffer).digest('hex'),
        validation_ok: ddc.pdfa_validation_ok ?? null,
        validation_errors: Array.isArray(ddc.pdfa_validation_errors)
          ? (ddc.pdfa_validation_errors as string[])
          : [],
        cached: true,
      }
    }

    // Se download falhou, log e segue para reconverter
    console.warn(
      `[pdfa/converter-service] Cache hit mas download falhou para ${ddc.pdfa_storage_path}: ${dlErr?.message}. Reconvertendo.`
    )
  }

  // 3. Cache miss → carrega arquivo original
  const { data: arquivo, error: arqErr } = await admin
    .from('processo_arquivos')
    .select('id, nome_original, storage_path, mime_type, tamanho_bytes')
    .eq('id', ddc.arquivo_origem_id)
    .single()

  if (arqErr || !arquivo) {
    throw new PdfAConversionError(
      `Arquivo de origem ${ddc.arquivo_origem_id} não encontrado`,
      arqErr
    )
  }

  // 4. Download do arquivo original
  const { data: origemBlob, error: origemErr } = await admin.storage
    .from(BUCKET_ORIGEM)
    .download(arquivo.storage_path)

  if (origemErr || !origemBlob) {
    throw new PdfAConversionError(
      `Falha ao baixar arquivo original (${arquivo.storage_path}): ${origemErr?.message}`,
      origemErr
    )
  }

  const origemBuffer = Buffer.from(await origemBlob.arrayBuffer())

  // 5. Converte via microserviço
  let resultado
  try {
    resultado = await convertDocumentToPdfA(
      origemBuffer,
      arquivo.nome_original,
      arquivo.mime_type
    )
  } catch (err) {
    throw new PdfAConversionError(
      `Microserviço de conversão falhou: ${err instanceof Error ? err.message : String(err)}`,
      err
    )
  }

  // 6. Decodifica base64 → buffer para upload e hash
  const pdfaBuffer = Buffer.from(resultado.pdfaBase64, 'base64')
  const sha256 = createHash('sha256').update(pdfaBuffer).digest('hex')
  const pdfaPath = `${ddc.processo_id}/${ddc.id}.pdf`

  // 6.1 Fail-fast: valida tamanho ANTES do upload para evitar orfanizar blob
  // se o UPDATE for rejeitado pela constraint `pdfa_tamanho_bytes <= 15MB`.
  if (pdfaBuffer.length > MAX_PDFA_BYTES) {
    throw new PdfAConversionError(
      `PDF/A gerado excede limite de ${MAX_PDFA_BYTES} bytes ` +
        `(gerado: ${pdfaBuffer.length} bytes, ddcId: ${ddcId}). ` +
        `O PDF/A NÃO foi salvo no Storage para evitar blob órfão. ` +
        `Considere reduzir o documento de origem ou aumentar o limite na constraint.`
    )
  }

  // 7. Upload no bucket de PDF/A (upsert para idempotência)
  const { error: upErr } = await admin.storage
    .from(BUCKET_PDFA)
    .upload(pdfaPath, pdfaBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (upErr) {
    throw new PdfAConversionError(
      `Falha ao salvar PDF/A no storage (${pdfaPath}): ${upErr.message}`,
      upErr
    )
  }

  // 8. Atualiza registro com cache
  const validationOk = resultado.validation.isCompliant
  const validationErrors = [
    ...(resultado.validation.errors ?? []),
    ...(resultado.validation.warnings ?? []),
  ]

  const { error: updErr } = await admin
    .from('diploma_documentos_comprobatorios')
    .update({
      pdfa_storage_path: pdfaPath,
      pdfa_sha256: sha256,
      pdfa_tamanho_bytes: pdfaBuffer.length,
      pdfa_engine: 'ghostscript',
      pdfa_engine_version: 'gs-railway-v1',
      pdfa_converted_at: new Date().toISOString(),
      pdfa_validation_ok: validationOk,
      pdfa_validation_errors: validationErrors.length > 0 ? validationErrors : null,
    })
    .eq('id', ddcId)

  if (updErr) {
    // UPDATE falhou — apaga o blob órfão do Storage para evitar
    // (a) loop de reconversão na próxima chamada e
    // (b) acúmulo de blobs sem referência no banco.
    // Em seguida re-throw para que o caller saiba que a conversão falhou.
    const { error: delErr } = await admin.storage
      .from(BUCKET_PDFA)
      .remove([pdfaPath])

    if (delErr) {
      console.error(
        `[pdfa/converter-service] Falha ao limpar blob órfão ${pdfaPath} ` +
          `após erro de UPDATE: ${delErr.message}`
      )
    }

    throw new PdfAConversionError(
      `PDF/A salvo no Storage mas UPDATE do registro falhou ` +
        `(ddcId=${ddcId}, blob removido=${!delErr}): ${updErr.message}`,
      updErr
    )
  }

  return {
    base64: resultado.pdfaBase64,
    tamanho_bytes: pdfaBuffer.length,
    sha256,
    validation_ok: validationOk,
    validation_errors: validationErrors,
    cached: false,
  }
}

/**
 * Tipo enum TTipoDocumentacao do XSD v1.05 (9 valores funcionais).
 * Importado do route.ts via tipo `TipoXsd` — duplicamos aqui apenas para
 * desacoplar do contexto Next.js (este arquivo é puro Node, sem deps de rota).
 */
export type TipoDocumentoXsd =
  | 'DocumentoIdentidadeDoAluno'
  | 'ProvaConclusaoEnsinoMedio'
  | 'ProvaColacao'
  | 'ComprovacaoEstagioCurricular'
  | 'CertidaoNascimento'
  | 'CertidaoCasamento'
  | 'TituloEleitor'
  | 'AtoNaturalizacao'
  | 'Outros'

/**
 * Item de documento comprobatório pronto para serialização XML.
 *
 * Campos que VÃO pro XML (XSD v1.05):
 *   - tipo_xsd     → atributo `tipo` do <Documento>
 *   - observacao   → atributo `observacoes` do <Documento> (opcional)
 *   - pdfa.base64  → conteúdo (TPdfA = xs:base64Binary)
 *
 * Campos METADATA INTERNA (NÃO vão pro XML, ficam apenas para auditoria
 * e exibição no painel admin):
 *   - numero_documento, orgao_emissor, uf_emissor, data_expedicao
 */
export interface DocumentoComprobatorioParaXml {
  ddc_id: string
  // — Vão pro XML —
  tipo_xsd: TipoDocumentoXsd
  observacao: string | null
  pdfa: PdfAResult
  // — Metadata interna (apenas auditoria/painel) —
  metadata_interna: {
    numero_documento: string | null
    orgao_emissor: string | null
    uf_emissor: string | null
    data_expedicao: string | null
  }
}

/**
 * Obtém TODOS os PDF/A em base64 dos documentos comprobatórios ativos
 * de um processo. Útil para o gerador do XML que precisa embutir vários.
 *
 * Conversão é sequencial (Ghostscript é CPU-bound no microserviço).
 */
export async function obterTodosPdfABase64DoProcesso(
  processoId: string,
  admin: SupabaseClient
): Promise<DocumentoComprobatorioParaXml[]> {
  const { data: ddcs, error } = await admin
    .from('diploma_documentos_comprobatorios')
    .select(
      'id, tipo_xsd, observacao, numero_documento, orgao_emissor, uf_emissor, data_expedicao'
    )
    .eq('processo_id', processoId)
    .is('deleted_at', null)
    .order('selecionado_em', { ascending: true })

  if (error) {
    throw new PdfAConversionError(
      `Falha ao listar comprobatórios do processo ${processoId}: ${error.message}`,
      error
    )
  }

  if (!ddcs || ddcs.length === 0) {
    return []
  }

  const resultados: DocumentoComprobatorioParaXml[] = []
  for (const ddc of ddcs) {
    const pdfa = await obterPdfABase64(ddc.id as string, admin)
    resultados.push({
      ddc_id: ddc.id as string,
      tipo_xsd: ddc.tipo_xsd as TipoDocumentoXsd,
      observacao: (ddc.observacao as string | null) ?? null,
      pdfa,
      metadata_interna: {
        numero_documento: (ddc.numero_documento as string | null) ?? null,
        orgao_emissor: (ddc.orgao_emissor as string | null) ?? null,
        uf_emissor: (ddc.uf_emissor as string | null) ?? null,
        data_expedicao: (ddc.data_expedicao as string | null) ?? null,
      },
    })
  }

  return resultados
}
