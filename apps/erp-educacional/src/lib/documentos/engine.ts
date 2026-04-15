// ============================================================
// ENGINE DE DOCUMENTOS DIGITAIS — FIC ERP
// Serviço central para emissão, assinatura e verificação
// de todos os documentos institucionais
// ============================================================

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminSupabase } from '@supabase/supabase-js'
import type {
  CriarDocumentoInput,
  DocumentoDigital,
  RegistrarArquivoInput,
  RegistrarAssinaturaInput,
  StatusDocDigital,
  VerificacaoPublica,
} from '@/types/documentos-digitais'

// Admin client para operações sem autenticação (portal público)
// cache: 'no-store' evita que Next.js Data Cache sirva dados obsoletos
function getAdminClientEngine() {
  return createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (url: RequestInfo | URL, init?: RequestInit) =>
          fetch(url, { ...init, cache: 'no-store' }),
      },
    }
  )
}

// ── URL base para verificação pública ─────────────────────
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://diploma.ficcassilandia.com.br'
}

// ── Mascarar CPF para exibição pública ────────────────────
function mascararCpf(cpf: string | null): string | null {
  if (!cpf) return null
  const limpo = cpf.replace(/\D/g, '')
  if (limpo.length !== 11) return '***.***.***-**'
  return `${limpo.slice(0, 3)}.***.***.${limpo.slice(-2)}`
}

// ── Registrar novo documento na engine ────────────────────
// Chame esta função ao iniciar qualquer emissão de documento.
// Retorna o documento criado com código de verificação único.
export async function registrarDocumento(
  input: CriarDocumentoInput
): Promise<{ sucesso: boolean; documento?: DocumentoDigital; erro?: string }> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('documentos_digitais')
      .insert({
        tipo: input.tipo,
        referencia_id: input.referencia_id ?? null,
        referencia_tabela: input.referencia_tabela ?? null,
        diplomado_id: input.diplomado_id ?? null,
        destinatario_nome: input.destinatario_nome,
        destinatario_cpf: input.destinatario_cpf ?? null,
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        numero_documento: input.numero_documento ?? null,
        ies_id: input.ies_id ?? null,
        metadata: input.metadata ?? null,
        status: 'pendente',
      })
      .select()
      .single()

    if (error) throw error

    const doc = data as DocumentoDigital

    // Define URL de verificação
    const urlVerificacao = `${getBaseUrl()}/verificar/${doc.codigo_verificacao}`
    await supabase
      .from('documentos_digitais')
      .update({ url_verificacao: urlVerificacao })
      .eq('id', doc.id)

    // Log de criação
    await registrarLog(doc.id, 'criado', null, 'pendente', {
      tipo: input.tipo,
      titulo: input.titulo,
    })

    return { sucesso: true, documento: { ...doc, url_verificacao: urlVerificacao } }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return { sucesso: false, erro: msg }
  }
}

// ── Atualizar status do documento ─────────────────────────
export async function atualizarStatus(
  documentoId: string,
  novoStatus: StatusDocDigital,
  detalhes?: string
): Promise<void> {
  const supabase = await createClient()

  const { data: atual } = await supabase
    .from('documentos_digitais')
    .select('status')
    .eq('id', documentoId)
    .single()

  const statusAntes = (atual?.status ?? null) as StatusDocDigital | null

  await supabase
    .from('documentos_digitais')
    .update({
      status: novoStatus,
      status_detalhes: detalhes ?? null,
      ...(novoStatus === 'publicado' ? { publicado_em: new Date().toISOString() } : {}),
    })
    .eq('id', documentoId)

  await registrarLog(documentoId, `status_alterado_para_${novoStatus}`, statusAntes, novoStatus, {
    detalhes,
  })
}

// ── Registrar arquivo PDF gerado ──────────────────────────
// Chame após gerar o PDF do documento.
export async function registrarArquivo(input: RegistrarArquivoInput): Promise<void> {
  const supabase = await createClient()

  await supabase
    .from('documentos_digitais')
    .update({
      arquivo_url: input.arquivo_url,
      arquivo_hash_sha256: input.arquivo_hash_sha256,
      arquivo_tamanho_bytes: input.arquivo_tamanho_bytes,
      status: 'aguardando_assinatura',
    })
    .eq('id', input.documento_id)

  await registrarLog(
    input.documento_id,
    'arquivo_gerado',
    'gerando',
    'aguardando_assinatura',
    { arquivo_url: input.arquivo_url, hash: input.arquivo_hash_sha256 }
  )
}

// ── Registrar assinatura concluída ────────────────────────
// Chame após receber confirmação de assinatura da API BRy.
export async function registrarAssinatura(
  input: RegistrarAssinaturaInput
): Promise<void> {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = {
    assinado_em: new Date().toISOString(),
    assinatura_provedor: input.assinatura_provedor,
    assinatura_detalhes: input.assinatura_detalhes,
    status: 'assinado',
    status_detalhes: null,
  }

  if (input.carimbo_tempo_url) {
    updateData.carimbo_tempo_url = input.carimbo_tempo_url
  }
  if (input.arquivo_url_assinado) {
    updateData.arquivo_url = input.arquivo_url_assinado
  }
  if (input.arquivo_hash_assinado) {
    updateData.arquivo_hash_sha256 = input.arquivo_hash_assinado
  }

  await supabase
    .from('documentos_digitais')
    .update(updateData)
    .eq('id', input.documento_id)

  await registrarLog(
    input.documento_id,
    'assinado',
    'assinando',
    'assinado',
    {
      provedor: input.assinatura_provedor,
      signatarios: input.assinatura_detalhes.signatarios?.length ?? 0,
    }
  )
}

// ── Publicar documento ────────────────────────────────────
// Torna o documento publicamente verificável.
export async function publicarDocumento(documentoId: string): Promise<void> {
  await atualizarStatus(documentoId, 'publicado')
}

// ── Verificação pública ───────────────────────────────────
// Chamada pela página /verificar/[codigo] e pelo portal.
// Usa buscarDiplomaPorCodigo para ler das tabelas corretas
// (diplomas + diplomados + cursos + fluxo_assinaturas).
export async function verificarDocumento(
  codigoVerificacao: string
): Promise<VerificacaoPublica> {
  try {
    // Import dinâmico evita acoplamento circular entre lib/documentos e lib/diplomas
    const { buscarDiplomaPorCodigo } = await import('@/lib/diplomas/buscar-completo')
    const completo = await buscarDiplomaPorCodigo(codigoVerificacao, true)

    if (!completo) {
      return {
        valido: false,
        erro: 'Documento não encontrado. Verifique o código ou QR Code.',
      }
    }

    // IES Emissora e Registradora — dados vêm do próprio diploma (extraídos do XML)
    // Sem fallback inventado: se o campo está NULL, é porque o XML não tinha.
    const iesEmissoraNome = completo.diploma.emissora_nome ?? null
    const iesEmissoraCodigo = completo.diploma.emissora_codigo_mec ?? null
    const iesRegistradoraNome = completo.diploma.registradora_nome ?? null
    const iesRegistradoraCodigo = completo.diploma.registradora_codigo_mec ?? null

    // Mapear signatários (fluxo_assinaturas × assinantes)
    const cargoLabels: Record<string, string> = {
      reitor: 'Reitor(a)',
      reitor_exercicio: 'Reitor(a) em Exercício',
      responsavel_registro: 'Responsável pelo Registro',
      coordenador_curso: 'Coordenador(a) de Curso',
      subcoordenador_curso: 'Subcoordenador(a) de Curso',
      coordenador_exercicio: 'Coordenador(a) em Exercício',
      chefe_registro: 'Chefe de Registro',
      chefe_registro_exercicio: 'Chefe de Registro em Exercício',
      secretario_decano: 'Secretário(a) / Decano(a)',
    }

    const signatarios = completo.fluxo_assinaturas
      .filter(f => f.status === 'assinado' && f.data_assinatura)
      .sort((a, b) => a.ordem - b.ordem)
      .map(f => {
        const assinante = completo.assinantes.find(a => a.id === f.assinante_id)
        const cargoEnum = assinante?.cargo ?? ''
        const cargoDisplay = assinante?.outro_cargo
          || cargoLabels[cargoEnum]
          || cargoEnum
        return {
          nome: assinante?.nome ?? '',
          cargo: cargoDisplay,
          cpf_cnpj: assinante?.cpf ?? '',
          tipo_certificado: f.tipo_certificado ?? assinante?.tipo_certificado ?? 'ICP-Brasil A3',
          assinado_em: f.data_assinatura!,
        }
      })

    const assinaturaDetalhes = signatarios.length > 0 ? { signatarios } : null

    // Montar reconhecimento do curso
    const reconhecimento = completo.curso?.numero_reconhecimento
      ? `${completo.curso.tipo_reconhecimento ?? 'Ato'} ${completo.curso.numero_reconhecimento}`
      : null

    return {
      valido: true,
      documento: {
        // Dados do Diploma
        tipo: 'diploma',
        status: 'publicado',
        destinatario_nome: completo.diplomado?.nome_social ?? completo.diplomado?.nome ?? '',
        destinatario_cpf_mascarado: mascararCpf(completo.diplomado?.cpf ?? null),
        codigo_validacao: completo.diploma.codigo_validacao ?? codigoVerificacao,
        numero_registro: completo.diploma.numero_registro,
        titulo_conferido: completo.diploma.titulo_conferido,

        // Dados do Curso
        titulo: completo.curso?.nome ?? completo.diploma.titulo_conferido ?? 'Diploma',
        grau: completo.curso?.grau ?? null,
        modalidade: completo.curso?.modalidade ?? null,
        carga_horaria_total: completo.curso?.carga_horaria_total ?? null,
        codigo_emec_curso: completo.curso?.codigo_emec ?? null,
        reconhecimento,

        // IES — dados do próprio diploma (extraídos do XML, sem achismo)
        ies_emissora_nome: iesEmissoraNome,
        ies_emissora_codigo_mec: iesEmissoraCodigo,
        ies_registradora_nome: iesRegistradoraNome,
        ies_registradora_codigo_mec: iesRegistradoraCodigo,

        // Datas e Registro
        data_ingresso: completo.diploma.data_ingresso,
        data_conclusao: completo.diploma.data_conclusao,
        data_colacao_grau: completo.diploma.data_colacao_grau,
        data_expedicao: completo.diploma.data_expedicao,
        data_registro: completo.diploma.data_registro,
        data_publicacao: completo.diploma.data_publicacao,
        forma_acesso: completo.diploma.forma_acesso,

        // Assinatura
        assinado_em: completo.diploma.data_expedicao,
        publicado_em: completo.diploma.data_publicacao,
        assinatura_detalhes: assinaturaDetalhes,

        // URLs
        rvdd_url: completo.diploma.pdf_url,
        xml_url: completo.diploma.xml_url,
        xml_historico_url: completo.xmls_gerados
          ?.find(x => x.tipo === 'HistoricoEscolarDigital')?.arquivo_url
          // Fallback para legados: montar URL pública a partir do path relativo
          ?? (completo.diploma.legado_xml_dados_path
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documentos-digitais/${completo.diploma.legado_xml_dados_path}`
            : null),
        qrcode_url: completo.diploma.qrcode_url,

        // Compatibilidade
        ies_nome: iesEmissoraNome,
        numero_documento: completo.diploma.numero_registro,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return { valido: false, erro: msg }
  }
}

// ── Buscar documentos de um diplomado ─────────────────────
export async function listarDocumentosDiplomado(
  diplomadoId: string
): Promise<DocumentoDigital[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('documentos_digitais')
    .select('*')
    .eq('diplomado_id', diplomadoId)
    .order('created_at', { ascending: false })

  return (data ?? []) as DocumentoDigital[]
}

// ── Log interno ───────────────────────────────────────────
async function registrarLog(
  documentoId: string,
  evento: string,
  statusAntes: StatusDocDigital | null,
  statusDepois: StatusDocDigital | null,
  detalhes?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('documentos_digitais_log').insert({
      documento_id: documentoId,
      evento,
      status_antes: statusAntes,
      status_depois: statusDepois,
      detalhes: detalhes ?? null,
    })
  } catch {
    // Log nunca deve quebrar o fluxo principal
    console.error('[DocumentosEngine] Falha ao registrar log:', evento, documentoId)
  }
}
