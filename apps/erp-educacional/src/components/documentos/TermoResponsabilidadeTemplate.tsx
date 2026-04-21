/**
 * TermoResponsabilidadeTemplate — Template A4 do Termo de Responsabilidade
 *
 * Usado pela rota /print/termo-responsabilidade/[id] + Puppeteer (Fase 3
 * do Snapshot Imutável). Declaração da IES assumindo responsabilidade
 * pelo conteúdo do Histórico e Diploma emitidos, assinada digitalmente
 * pelos responsáveis institucionais.
 */

'use client'

import type { SnapshotAssinante } from '@/lib/diploma/snapshot'

// ═══════════════════════════════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════════════════════════════

export interface DadosTermoResponsabilidade {
  // IES
  ies_nome: string
  ies_cnpj?: string | null
  ies_municipio: string
  ies_uf: string

  // Responsável principal (normalmente primeiro assinante)
  responsavel_nome: string
  responsavel_cargo: string
  responsavel_cpf?: string | null

  // Data da emissão
  data_emissao?: string | null // default: hoje

  // Assinantes completos (listados ao final)
  assinantes: SnapshotAssinante[]
}

export interface TermoResponsabilidadeTemplateProps {
  dados: DadosTermoResponsabilidade
  /** URL do timbrado PNG/JPG (se configurado) */
  timbradoUrl?: string | null
  /** Margens internas em mm (default 25/20/20/20) */
  margens?: { topo: number; inferior: number; esquerda: number; direita: number }
  /** Fonte base (default 'Times New Roman') */
  fonte?: string
  /** Tamanho base em pt (default 11) */
  tamanhoFonte?: number
  /** Rodapé opcional */
  textoRodape?: string | null
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function dataPorExtenso(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
    const meses = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
    ]
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
  } catch {
    return iso
  }
}

function formatarCPF(cpf: string | null | undefined): string {
  if (!cpf) return '—'
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return cpf
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function formatarCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '—'
  const clean = cnpj.replace(/\D/g, '')
  if (clean.length !== 14) return cnpj
  return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

// ═══════════════════════════════════════════════════════════════════════════
// Componente
// ═══════════════════════════════════════════════════════════════════════════

export default function TermoResponsabilidadeTemplate({
  dados,
  timbradoUrl,
  margens = { topo: 25, inferior: 20, esquerda: 20, direita: 20 },
  fonte = 'Times New Roman',
  tamanhoFonte = 11,
  textoRodape,
}: TermoResponsabilidadeTemplateProps) {
  const dataEmissao = dados.data_emissao ?? new Date().toISOString().split('T')[0]

  const temTimbrado =
    Boolean(timbradoUrl) && !timbradoUrl!.toLowerCase().endsWith('.pdf')

  return (
    <div className="flex flex-col">
      <div
        className="bg-white relative overflow-hidden"
        style={{ width: '210mm', height: '297mm' }}
      >
        {/* Timbrado */}
        {temTimbrado && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${timbradoUrl})`,
              backgroundSize: '100% 100%',
              backgroundPosition: 'center',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Conteúdo */}
        <div
          className="relative flex flex-col"
          style={{
            padding: `${margens.topo}mm ${margens.direita}mm ${margens.inferior}mm ${margens.esquerda}mm`,
            fontFamily: fonte,
            fontSize: `${tamanhoFonte}pt`,
            height: '297mm',
            color: '#1a1a1a',
          }}
        >
          {/* Título */}
          <div className="text-center mb-8">
            <h1
              className="font-bold tracking-wide"
              style={{ fontSize: `${tamanhoFonte + 5}pt` }}
            >
              TERMO DE RESPONSABILIDADE
            </h1>
            <p className="text-gray-600 mt-2" style={{ fontSize: `${tamanhoFonte - 1}pt` }}>
              Emissão de Diploma Digital — Portaria MEC nº 70/2025
            </p>
          </div>

          {/* Corpo */}
          <div
            className="leading-relaxed text-justify"
            style={{ fontSize: `${tamanhoFonte}pt`, lineHeight: 1.75 }}
          >
            <p className="mb-5">
              Pela presente, a Instituição de Ensino Superior{' '}
              <strong>{dados.ies_nome}</strong>
              {dados.ies_cnpj ? (
                <>, inscrita no CNPJ sob o nº <strong>{formatarCNPJ(dados.ies_cnpj)}</strong>,</>
              ) : (
                ','
              )}{' '}
              com sede em <strong>{dados.ies_municipio}/{dados.ies_uf}</strong>,
              neste ato representada por seu(a) <strong>{dados.responsavel_cargo}</strong>,{' '}
              <strong>{dados.responsavel_nome}</strong>
              {dados.responsavel_cpf && (
                <>, CPF nº <strong>{formatarCPF(dados.responsavel_cpf)}</strong></>
              )},
              vem formalmente <strong>DECLARAR E ASSUMIR TOTAL RESPONSABILIDADE</strong> pelo
              seguinte:
            </p>

            <p className="mb-4">
              <strong>I —</strong> Os dados cadastrais, acadêmicos e documentais
              consolidados no processo de emissão do presente Diploma Digital foram
              extraídos, validados e confirmados a partir do acervo físico e digital
              desta Instituição, sob responsabilidade exclusiva da mesma, nos termos do
              art. 11 da Portaria MEC nº 70/2025.
            </p>

            <p className="mb-4">
              <strong>II —</strong> Os XMLs oficiais (DocumentacaoAcademicaRegistro,
              HistoricoEscolarDigital e DiplomaDigital), bem como os PDFs
              complementares (Histórico Escolar e Termo de Expedição), foram gerados
              a partir de um <em>snapshot imutável</em> dos dados revisados,
              garantindo integridade e rastreabilidade desde a extração inicial até
              a assinatura digital final.
            </p>

            <p className="mb-4">
              <strong>III —</strong> A autenticidade e a integridade deste documento
              poderão ser verificadas a qualquer tempo por meio dos mecanismos de
              assinatura digital ICP-Brasil aplicados, em conformidade com a MP nº
              2.200-2/2001 e com o XSD v1.05 do MEC.
            </p>

            <p className="mb-4">
              <strong>IV —</strong> Esta IES compromete-se a manter o acervo
              acadêmico digital íntegro, acessível para verificação e disponível
              para auditorias do MEC/INEP, nos termos da IN SESu/MEC nº 05/2022 e
              legislação correlata.
            </p>

            <p className="mb-4">
              <strong>V —</strong> Quaisquer divergências identificadas
              posteriormente entre os dados emitidos e o acervo de origem são de
              responsabilidade desta Instituição, que se compromete a corrigi-las
              conforme os ritos previstos na Portaria MEC nº 70/2025, preservando
              a segurança jurídica do(a) diplomado(a).
            </p>
          </div>

          {/* Espaçador */}
          <div className="flex-1" />

          {/* Local e data */}
          <div className="text-center mb-6" style={{ fontSize: `${tamanhoFonte}pt` }}>
            <p>
              {dados.ies_municipio}/{dados.ies_uf}, {dataPorExtenso(dataEmissao)}
            </p>
          </div>

          {/* Assinantes */}
          <div
            className="border-t-2 border-gray-300 pt-4"
            style={{ fontSize: `${tamanhoFonte - 1}pt` }}
          >
            <p className="font-bold mb-3 text-gray-700">
              Assinaturas Digitais ICP-Brasil:
            </p>
            <div className="space-y-3">
              {dados.assinantes.length === 0 ? (
                <p className="text-gray-400 italic">Aguardando cadastro de signatários</p>
              ) : (
                dados.assinantes.map((a, i) => (
                  <div key={i} className="border-l-2 border-gray-200 pl-3">
                    <p className="font-semibold text-gray-800">{a.nome}</p>
                    <p className="text-gray-600">{a.cargo}</p>
                    {a.cpf && (
                      <p className="text-gray-500" style={{ fontSize: `${tamanhoFonte - 2}pt` }}>
                        CPF: {formatarCPF(a.cpf)}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {textoRodape && (
            <div
              className="text-center text-gray-500 mt-4 pt-3 border-t border-gray-200"
              style={{ fontSize: `${tamanhoFonte - 3}pt` }}
            >
              {textoRodape}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
