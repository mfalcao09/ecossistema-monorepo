"use client"

import { useEffect, useState, use } from "react"
import LivePreview, {
  type LivePreviewDadosAluno,
  type LivePreviewDadosCurso,
  type LivePreviewAssinante,
} from "@/components/config/historico/LivePreview"
import type {
  DiplomaConfig,
  HistoricoColunaConfig,
  HistoricoFormatacaoRegra,
  HistoricoSecoesConfig,
} from "@/types/diploma-config"
import { DEFAULT_CAMPOS_ALUNO } from "@/types/diploma-config"

// ── Tipos locais ─────────────────────────────────────────────

interface DisciplinaReal {
  codigo: string | null
  nome: string
  periodo: string | null
  carga_horaria_aula: number | null
  carga_horaria_relogio: number | null
  nota: string | null
  nota_ate_cem: string | null
  conceito: string | null
  conceito_rm: string | null
  conceito_especifico: string | null
  situacao: string | null
  forma_integralizacao: string | null
  etiqueta: string | null
  docente_nome: string | null
  docente_titulacao: string | null
}

interface DadosHistorico {
  config: DiplomaConfig | null
  dadosAluno: LivePreviewDadosAluno
  dadosCurso: LivePreviewDadosCurso
  disciplinas: DisciplinaReal[]
  assinantes: LivePreviewAssinante[]
  codigo_verificacao?: string | null
}

// ── Defaults (iguais aos de AbaVisualHistorico/emissão) ──────

const DEFAULT_COLUNAS: HistoricoColunaConfig[] = [
  { campo: "codigo", label: "Código", visivel: true, ordem: 1, largura: 8 },
  { campo: "nome", label: "Disciplina", visivel: true, ordem: 2, largura: 30 },
  { campo: "carga_horaria_aula", label: "C.H.", visivel: true, ordem: 3, largura: 8 },
  { campo: "nota", label: "Média", visivel: true, ordem: 4, largura: 8 },
  { campo: "periodo", label: "P/Letivo", visivel: true, ordem: 5, largura: 8 },
  { campo: "situacao", label: "Sit. Fin.", visivel: true, ordem: 6, largura: 10 },
  { campo: "etiqueta", label: "Obs.", visivel: false, ordem: 7, largura: 8 },
  { campo: "conceito", label: "Conceito", visivel: false, ordem: 8, largura: 8 },
  { campo: "conceito_especifico", label: "Conc. Específico", visivel: false, ordem: 9, largura: 10 },
  { campo: "conceito_rm", label: "Conceito RM", visivel: false, ordem: 10, largura: 8 },
  { campo: "forma_integralizacao", label: "Forma Integr.", visivel: false, ordem: 11, largura: 10 },
  { campo: "docente_nome", label: "Docente", visivel: false, ordem: 12, largura: 18 },
  { campo: "docente_titulacao", label: "Titulação", visivel: false, ordem: 13, largura: 10 },
]

const DEFAULT_FORMATACAO: HistoricoFormatacaoRegra[] = []

const DEFAULT_SECOES: HistoricoSecoesConfig = {
  agrupar_por: "periodo",
  formato_cabecalho_grupo: "{numero}º Período",
  exibir_subtotal_ch: true,
  separador_visual: "linha",
  secoes_personalizadas: [],
}

// ── Página de impressão ──────────────────────────────────────
// Renderiza o LivePreview em tamanho real (210×297mm × N páginas),
// sem scale, sem dialog, sem navegação. Puppeteer headless navega
// para esta URL, aguarda `[data-print-ready="true"]` e gera PDF.

export default function PrintHistoricoPage({
  params,
}: {
  params: Promise<{ diplomaId: string }>
}) {
  const { diplomaId } = use(params)
  const [dados, setDados] = useState<DadosHistorico | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    fetch(`/api/secretaria/emissao/historico/${diplomaId}/dados`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
        }
        return res.json()
      })
      .then((data: DadosHistorico) => {
        if (!cancelado) setDados(data)
      })
      .catch((e: unknown) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Erro ao carregar")
      })
    return () => {
      cancelado = true
    }
  }, [diplomaId])

  if (erro) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif", color: "#dc2626" }}>
        <p>Erro ao carregar dados: {erro}</p>
      </div>
    )
  }

  if (!dados) {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif", color: "#666" }}>
        Carregando…
      </div>
    )
  }

  // ── Extrai config com fallbacks ──
  const cfg = dados.config
  const camposAluno = cfg?.historico_campos_aluno_config ?? DEFAULT_CAMPOS_ALUNO
  const colunas = cfg?.historico_colunas_config ?? DEFAULT_COLUNAS
  const formatacao = cfg?.historico_formatacao_condicional ?? DEFAULT_FORMATACAO
  const secoes = cfg?.historico_secoes_config ?? DEFAULT_SECOES
  const corCabecalho = cfg?.historico_cor_cabecalho ?? "#1A3A6B"
  const corLinhaAlternada = cfg?.historico_cor_linha_alternada ?? "#F5F5F5"
  const fonte = cfg?.historico_fonte ?? "Times New Roman"
  const tamanhoFonte = cfg?.historico_tamanho_fonte ?? 10
  const tamanhoFonteCabecalho = cfg?.historico_tamanho_fonte_cabecalho ?? 9
  const tamanhoFonteCorpo = cfg?.historico_tamanho_fonte_corpo ?? 7
  const timbradoRaw = cfg?.historico_arquivo_timbrado_url ?? ""
  const timbradoUrl = timbradoRaw && !timbradoRaw.toLowerCase().endsWith(".pdf")
    ? timbradoRaw
    : ""
  const margens = {
    topo: cfg?.historico_margem_topo ?? 25,
    inferior: cfg?.historico_margem_inferior ?? 20,
    esquerda: cfg?.historico_margem_esquerda ?? 20,
    direita: cfg?.historico_margem_direita ?? 20,
  }
  const textoRodape = cfg?.historico_texto_rodape ?? ""

  return (
    <>
      {/* CSS específico da impressão:
          - @page A4 sem margem (LivePreview já controla margens internas)
          - zera o gap entre páginas
          - page-break entre cada folha A4
          - remove sombra e bordas arredondadas do card (tela)
          - força cores de fundo no PDF */}
      <style>{`
        @page { size: A4; margin: 0; }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #print-root > div {
          display: block !important;
          gap: 0 !important;
        }
        #print-root > div > div {
          page-break-after: always;
          break-after: page;
          margin: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        #print-root > div > div:last-child {
          page-break-after: auto;
          break-after: auto;
        }
      `}</style>

      {/* Marcador para o Puppeteer saber que o conteúdo está pronto */}
      <div id="print-root" data-print-ready="true">
        <LivePreview
          camposAluno={camposAluno}
          colunas={colunas}
          formatacao={formatacao}
          secoes={secoes}
          disciplinas={dados.disciplinas}
          corCabecalho={corCabecalho}
          corLinhaAlternada={corLinhaAlternada}
          fonte={fonte}
          tamanhoFonte={tamanhoFonte}
          tamanhoFonteCabecalho={tamanhoFonteCabecalho}
          tamanhoFonteCorpo={tamanhoFonteCorpo}
          timbradoUrl={timbradoUrl}
          margens={margens}
          textoRodape={textoRodape}
          dadosAluno={dados.dadosAluno}
          dadosCurso={dados.dadosCurso}
          dadosAssinantes={dados.assinantes}
          codigoVerificacao={dados.codigo_verificacao ?? null}
        />
      </div>
    </>
  )
}
