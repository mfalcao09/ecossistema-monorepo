// =============================================================================
// /rvdd/[id] — Representação Visual do Diploma Digital (RVDD)
//
// Página pública de visualização e impressão do diploma.
// Acessada por:
//   - ERP (admin abre em nova aba a partir do detalhe do diploma)
//   - Portal público (link no card de verificação)
//   - E-mail enviado ao diplomado
//
// Para gerar o PDF: clique em "Imprimir / Salvar PDF" → window.print()
// CSS @media print: remove o botão, renderiza em A4 paisagem.
//
// Dados: usa buscarDiplomaCompleto() + montarVariaveisRVDD() para garantir
// que os campos são os mesmos usados na geração dos XMLs MEC.
// =============================================================================

import { notFound } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import BotaoImprimir from './BotaoImprimir'
import { buscarDiplomaCompleto } from '@/lib/diplomas/buscar-completo'
import { montarVariaveisRVDD, type ConfigIesParaRVDD } from '@/lib/diplomas/montar-variaveis-rvdd'
import type { VariaveisRVDD } from '@/types/diplomas'

// =============================================================================
// METADATA
// =============================================================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return {
    title: `Diploma Digital — FIC`,
    description: `Representação Visual do Diploma Digital — Faculdades Integradas de Cassilândia (${id.slice(0, 8).toUpperCase()})`,
  }
}

// =============================================================================
// BUSCA DE DADOS
// =============================================================================

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function buscarConfigIes(ambiente: string): Promise<ConfigIesParaRVDD | null> {
  const admin = getAdminClient()
  const { data } = await admin
    .from('diploma_config')
    .select('ies_nome, ies_sigla, ies_cnpj, municipio, uf, url_portal_diplomatizado')
    .eq('ambiente', ambiente)
    .single()

  if (!data) return null

  const row = data as Record<string, unknown>
  return {
    nome:       (row.ies_nome as string)  ?? 'Faculdades Integradas de Cassilândia',
    sigla:      (row.ies_sigla as string | null) ?? 'FIC',
    cnpj:       (row.ies_cnpj as string)  ?? '',
    municipio:  (row.municipio as string) ?? 'Cassilândia',
    uf:         (row.uf as string)        ?? 'MS',
    url_portal: (row.url_portal_diplomatizado as string | null)
      ?? process.env.NEXT_PUBLIC_APP_URL
      ?? 'https://diploma.ficcassilandia.com.br',
  }
}

// =============================================================================
// PÁGINA PRINCIPAL
// =============================================================================

export default async function PageRvdd({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // ── 1. Busca dados completos ───────────────────────────────────────────────
  const completo = await buscarDiplomaCompleto(id)
  if (!completo) notFound()

  // ── 2. Valida status ──────────────────────────────────────────────────────
  const statusesValidos = [
    'assinado', 'aguardando_registro', 'registrado',
    'gerando_rvdd', 'rvdd_gerado', 'publicado',
  ]
  if (!statusesValidos.includes(completo.diploma.status)) notFound()

  // ── 3. Config da IES ──────────────────────────────────────────────────────
  const configIes = await buscarConfigIes(completo.diploma.ambiente)
  if (!configIes) notFound()

  // ── 4. Monta variáveis do template ────────────────────────────────────────
  let vars: VariaveisRVDD
  try {
    vars = montarVariaveisRVDD(completo, configIes)
  } catch {
    notFound()
  }

  // ── 5. QR Code ────────────────────────────────────────────────────────────
  let qrCodeDataUrl = ''
  try {
    qrCodeDataUrl = await QRCode.toDataURL(vars.url_verificacao, {
      width: 90, margin: 1,
      color: { dark: '#1a3a6b', light: '#ffffff' },
    })
  } catch { /* QR Code é opcional */ }

  // ── 6. Hashes dos XMLs para tabela de integridade ─────────────────────────
  const xmlHashes = completo.xmls_gerados
    .filter(x => x.hash_sha256 && x.status === 'assinado')
    .map(x => ({ tipo: x.tipo, hash: x.hash_sha256! }))

  const isLegado = completo.diploma.is_legado

  // =============================================================================
  // RENDER
  // =============================================================================
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 landscape; margin: 15mm 20mm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .no-print, .print\\:hidden { display: none !important; }
        }
        body { margin: 0; background: #f3f4f6; font-family: 'Times New Roman', Times, serif; }
      `}} />

      <BotaoImprimir />

      {/* Folha A4 paisagem */}
      <div className="min-h-screen flex items-start justify-center py-8 px-4 print:p-0 print:block print:bg-white">
        <div
          className="bg-white shadow-2xl print:shadow-none"
          style={{ width: '297mm', minHeight: '210mm', padding: '18mm 22mm', boxSizing: 'border-box' }}
        >

          {/* ── CABEÇALHO ──────────────────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            borderBottom: '3px double #1a3a6b', paddingBottom: '12px', marginBottom: '18px',
          }}>
            <div>
              <h1 style={{ fontSize: '17pt', fontWeight: 'bold', color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                {vars.ies_nome}
              </h1>
              <p style={{ fontSize: '8.5pt', color: '#555', marginTop: '3px' }}>
                {vars.ies_municipio} — {vars.ies_uf}
              </p>
              {vars.ies_cnpj && (
                <p style={{ fontSize: '8.5pt', color: '#555', marginTop: '1px' }}>
                  CNPJ: {vars.ies_cnpj}
                </p>
              )}
            </div>
            <div style={{
              width: '80px', height: '80px',
              border: '2px solid #1a3a6b', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: '8pt', color: '#1a3a6b',
              textAlign: 'center', padding: '8px', fontWeight: 'bold',
            }}>
              {vars.ies_sigla ?? 'FIC'}<br />DIPLOMA<br />DIGITAL
            </div>
          </div>

          {/* ── TÍTULO ─────────────────────────────────────────────────── */}
          <div style={{ textAlign: 'center', margin: '16px 0 14px' }}>
            <h2 style={{ fontSize: '22pt', color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 'bold', margin: 0 }}>
              Diploma de {vars.grau}
            </h2>
            <p style={{ fontSize: '9.5pt', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>
              Documento Digital — Portaria MEC 554/2019 e Portaria MEC 70/2025
            </p>
            {isLegado && (
              <span style={{ fontSize: '8pt', color: '#92400e', background: '#fef3c7', padding: '2px 10px', borderRadius: '20px', marginTop: '4px', display: 'inline-block' }}>
                ★ Diploma Legado — Migrado para nova plataforma FIC
              </span>
            )}
          </div>

          {/* ── CORPO ──────────────────────────────────────────────────── */}
          <div style={{ fontSize: '11.5pt', lineHeight: '1.9', textAlign: 'justify', margin: '14px 0' }}>
            <p>
              O(A) Diretor(a) das <strong>{vars.ies_nome}</strong>, no uso de suas atribuições
              legais e em conformidade com a legislação vigente, confere o título de
            </p>

            <p style={{ fontSize: '14pt', fontWeight: 'bold', textAlign: 'center', color: '#1a3a6b', margin: '10px 0 4px' }}>
              {vars.titulo_conferido}
            </p>

            <p style={{ fontSize: '18pt', fontWeight: 'bold', textAlign: 'center', color: '#1a1a1a', margin: '4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {vars.nome}
            </p>

            {vars.nome_social && (
              <p style={{ textAlign: 'center', fontSize: '9.5pt', color: '#555', marginBottom: '10px' }}>
                Socialmente conhecido(a) como: <strong>{vars.nome_social}</strong>
              </p>
            )}

            <p>
              portador(a) do CPF <strong>{vars.cpf}</strong>,
              nascido(a) em <strong>{vars.data_nascimento}</strong>,
              natural de <strong>{vars.naturalidade}</strong>,
              nacionalidade <strong>{vars.nacionalidade}</strong>
              {vars.rg && <>, documento <strong>{vars.rg}</strong></>},
              por ter concluído com aprovação o Curso de <strong>{vars.curso_nome}</strong>,
              modalidade <strong>{vars.modalidade}</strong>
              {vars.turno && <>, turno <strong>{vars.turno}</strong></>},
              com carga horária de <strong>{vars.carga_horaria} horas</strong>.
            </p>

            {vars.ato_reconhecimento && (
              <p style={{ fontSize: '9.5pt', color: '#555', marginTop: '6px' }}>
                Curso reconhecido pela <strong>{vars.ato_reconhecimento}</strong>.
              </p>
            )}
          </div>

          {/* ── DATAS OFICIAIS ──────────────────────────────────────────── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px',
            margin: '16px 0', background: '#f8f9fb', border: '1px solid #dde3ed',
            borderRadius: '6px', padding: '14px 18px',
          }}>
            {[
              { label: 'Data de Conclusão',   valor: vars.data_conclusao ?? '—' },
              { label: 'Colação de Grau',     valor: vars.data_colacao   || '—' },
              { label: 'Expedição do Diploma', valor: vars.data_expedicao || '—' },
            ].map((item) => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '7.5pt', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#888', display: 'block' }}>
                  {item.label}
                </span>
                <span style={{ fontSize: '10pt', fontWeight: 'bold', color: '#1a3a6b', marginTop: '2px', display: 'block' }}>
                  {item.valor}
                </span>
              </div>
            ))}
          </div>

          {/* Dados de registro */}
          {(vars.numero_registro || vars.livro) && (
            <p style={{ fontSize: '9pt', color: '#555', textAlign: 'center', marginBottom: '8px' }}>
              Registrado sob o nº <strong>{vars.numero_registro ?? '—'}</strong>
              {vars.livro && <>, <strong>{vars.livro}</strong></>}
              {vars.pagina && <>, <strong>{vars.pagina}</strong></>}
              {vars.data_registro && <>, em <strong>{vars.data_registro}</strong></>}.
            </p>
          )}

          {vars.segunda_via && (
            <p style={{ textAlign: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '9pt', color: '#92400e', background: '#fef3c7', padding: '2px 10px', borderRadius: '20px' }}>
                ★ Segunda Via
              </span>
            </p>
          )}

          {/* ── ASSINATURAS ────────────────────────────────────────────── */}
          <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '12px' }}>
            <p style={{ textAlign: 'center', fontSize: '9pt', color: '#555' }}>
              Emitido em {vars.data_expedicao || '—'},
              em {vars.municipio_colacao ?? vars.ies_municipio} — {vars.uf_colacao ?? vars.ies_uf}.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '18px' }}>
              {(vars.signatarios.length > 0
                ? vars.signatarios
                : [
                    { nome: '', cargo: 'Diretor(a) Geral', cpf: null },
                    { nome: '', cargo: 'Diretor(a) Acadêmico(a)', cpf: null },
                    { nome: '', cargo: 'Secretário(a) Geral', cpf: null },
                  ]
              ).map((s, i) => (
                <div key={i} style={{ textAlign: 'center', minWidth: '160px' }}>
                  <div style={{ height: '40px', borderBottom: '1px solid #333', marginBottom: '4px' }} />
                  {s.nome && (
                    <p style={{ fontSize: '9pt', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '1px' }}>
                      {s.nome}
                    </p>
                  )}
                  <p style={{ fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.4px', color: '#666' }}>
                    {s.cargo}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── VERIFICAÇÃO / QR CODE ──────────────────────────────────── */}
          <div style={{
            marginTop: '16px', background: '#f0f4ff',
            border: '1px solid #b8c8f0', borderRadius: '6px',
            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '14px',
          }}>
            <div style={{ flexShrink: 0 }}>
              {qrCodeDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrCodeDataUrl} alt="QR Code" width={88} height={88} style={{ display: 'block' }} />
              ) : (
                <div style={{ width: '88px', height: '88px', border: '2px dashed #1a3a6b', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7pt', color: '#1a3a6b', textAlign: 'center' }}>
                  QR CODE
                </div>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1a3a6b', marginBottom: '3px', fontWeight: 'bold' }}>
                Verificação de Autenticidade
              </h4>
              <p style={{ fontSize: '8pt', color: '#444', marginBottom: '2px' }}>
                Consulte este diploma em:{' '}
                <strong style={{ color: '#1a3a6b' }}>{vars.url_verificacao}</strong>
              </p>
              <p style={{ fontFamily: 'monospace', fontSize: '10.5pt', fontWeight: 'bold', color: '#1a3a6b', letterSpacing: '2px', marginTop: '3px' }}>
                {vars.codigo_validacao}
              </p>
              {vars.codigo_emec && (
                <p style={{ fontSize: '7.5pt', color: '#666', marginTop: '2px' }}>
                  Código e-MEC: <strong>{vars.codigo_emec}</strong>
                </p>
              )}
            </div>
          </div>

          {/* ── HASHES SHA-256 ─────────────────────────────────────────── */}
          {xmlHashes.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <table style={{ width: '100%', fontSize: '7pt', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #ddd', padding: '3px 8px', background: '#f5f7fb', fontWeight: 'bold' }}>Documento XML</td>
                    <td style={{ border: '1px solid #ddd', padding: '3px 8px', background: '#f5f7fb', fontWeight: 'bold' }}>Hash SHA-256 (Integridade)</td>
                  </tr>
                  {xmlHashes.map((h, i) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #ddd', padding: '3px 8px', color: '#555' }}>{h.tipo}</td>
                      <td style={{ border: '1px solid #ddd', padding: '3px 8px', fontFamily: 'monospace', fontSize: '6.5pt', color: '#333' }}>{h.hash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── RODAPÉ LEGAL ───────────────────────────────────────────── */}
          <p style={{ fontSize: '7pt', color: '#999', textAlign: 'center', marginTop: '8px' }}>
            Emitido em conformidade com a Portaria MEC nº 554/2019, Portaria MEC nº 70/2025,
            IN SESU/MEC 01/2020 e Decreto nº 10.278/2020. XSD DiplomaDigital v{vars.versao_xsd}.
          </p>

        </div>
      </div>
    </>
  )
}
