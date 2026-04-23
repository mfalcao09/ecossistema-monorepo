"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Search,
  GraduationCap,
  Loader2,
  FileText,
  Printer,
  Download,
  Eye,
  AlertCircle,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import LivePreview, {
  type LivePreviewDadosAluno,
  type LivePreviewDadosCurso,
  type LivePreviewAssinante,
} from "@/components/config/historico/LivePreview";
import type {
  DiplomaConfig,
  HistoricoColunaConfig,
  HistoricoFormatacaoRegra,
  HistoricoSecoesConfig,
} from "@/types/diploma-config";
import { DEFAULT_CAMPOS_ALUNO } from "@/types/diploma-config";
import { fetchSeguro } from "@/lib/security/fetch-seguro";

// ── Tipos locais ─────────────────────────────────────────────

interface DiplomaResultado {
  id: string;
  diplomado_nome: string;
  diplomado_cpf: string;
  curso_nome: string;
  curso_grau: string;
  status: string;
  data_conclusao: string | null;
  is_legado: boolean;
}

interface DisciplinaReal {
  codigo: string | null;
  nome: string;
  periodo: string | null;
  carga_horaria_aula: number | null;
  carga_horaria_relogio: number | null;
  nota: string | null;
  nota_ate_cem: string | null;
  conceito: string | null;
  conceito_rm: string | null;
  conceito_especifico: string | null;
  situacao: string | null;
  forma_integralizacao: string | null;
  etiqueta: string | null;
  docente_nome: string | null;
  docente_titulacao: string | null;
}

interface DadosPrevia {
  config: DiplomaConfig | null;
  dadosAluno: LivePreviewDadosAluno;
  dadosCurso: LivePreviewDadosCurso;
  disciplinas: DisciplinaReal[];
  assinantes: LivePreviewAssinante[];
  codigo_verificacao?: string | null;
}

// ── Defaults (iguais aos de AbaVisualHistorico) ─────────────

const DEFAULT_COLUNAS: HistoricoColunaConfig[] = [
  { campo: "codigo", label: "Código", visivel: true, ordem: 1, largura: 8 },
  { campo: "nome", label: "Disciplina", visivel: true, ordem: 2, largura: 30 },
  {
    campo: "carga_horaria_aula",
    label: "C.H.",
    visivel: true,
    ordem: 3,
    largura: 8,
  },
  { campo: "nota", label: "Média", visivel: true, ordem: 4, largura: 8 },
  { campo: "periodo", label: "P/Letivo", visivel: true, ordem: 5, largura: 8 },
  {
    campo: "situacao",
    label: "Sit. Fin.",
    visivel: true,
    ordem: 6,
    largura: 10,
  },
  { campo: "etiqueta", label: "Obs.", visivel: false, ordem: 7, largura: 8 },
  {
    campo: "conceito",
    label: "Conceito",
    visivel: false,
    ordem: 8,
    largura: 8,
  },
  {
    campo: "conceito_especifico",
    label: "Conc. Específico",
    visivel: false,
    ordem: 9,
    largura: 10,
  },
  {
    campo: "conceito_rm",
    label: "Conceito RM",
    visivel: false,
    ordem: 10,
    largura: 8,
  },
  {
    campo: "forma_integralizacao",
    label: "Forma Integr.",
    visivel: false,
    ordem: 11,
    largura: 10,
  },
  {
    campo: "docente_nome",
    label: "Docente",
    visivel: false,
    ordem: 12,
    largura: 18,
  },
  {
    campo: "docente_titulacao",
    label: "Titulação",
    visivel: false,
    ordem: 13,
    largura: 10,
  },
];

const DEFAULT_FORMATACAO: HistoricoFormatacaoRegra[] = [];

const DEFAULT_SECOES: HistoricoSecoesConfig = {
  agrupar_por: "periodo",
  formato_cabecalho_grupo: "{numero}º Período",
  exibir_subtotal_ch: true,
  separador_visual: "linha",
  secoes_personalizadas: [],
};

// ── Helpers ──────────────────────────────────────────────────

function formatCPF(cpf: string) {
  const n = cpf?.replace(/\D/g, "") ?? "";
  return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") || cpf;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR");
}

const STATUS_LABEL: Record<string, string> = {
  assinado: "XMLs assinados",
  aguardando_documentos: "Aguarda documentos",
  documentos_assinados: "Docs assinados",
  registrado: "Registrado",
  rvdd_gerado: "RVDD gerado",
  publicado: "Publicado",
};

// ── Componente Principal ─────────────────────────────────────

export default function EmissaoHistoricoPage() {
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [resultados, setResultados] = useState<DiplomaResultado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  // Estado do dialog de prévia (modo real com LivePreview)
  const [previaAberta, setPreviaAberta] = useState(false);
  const [previaCarregandoId, setPreviaCarregandoId] = useState<string | null>(
    null,
  );
  const [previaNome, setPreviaNome] = useState("");
  const [previaDiplomaId, setPreviaDiplomaId] = useState<string | null>(null);
  const [dadosPrevia, setDadosPrevia] = useState<DadosPrevia | null>(null);
  // Toggle "papel já timbrado" — oculta o timbrado digital no preview e no PDF
  const [ocultarTimbrado, setOcultarTimbrado] = useState(false);

  const buscar = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResultados([]);
      return;
    }
    setCarregando(true);
    setErro("");
    try {
      const params = new URLSearchParams({ search: q });
      const res = await fetch(`/api/diplomas?${params}`);
      const data = await res.json();
      const lista: DiplomaResultado[] = Array.isArray(data)
        ? data
        : (data.diplomas ?? []);
      setResultados(lista);
    } catch {
      setErro("Erro ao buscar. Tente novamente.");
      setResultados([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaAtiva(busca);
      buscar(busca);
    }, 400);
    return () => clearTimeout(timer);
  }, [busca, buscar]);

  // Abre prévia em dialog com LivePreview + dados reais
  const abrirPrevia = async (diplomaId: string, nomeAluno: string) => {
    setPreviaCarregandoId(diplomaId);
    setPreviaNome(nomeAluno);
    setPreviaDiplomaId(diplomaId);
    setErro("");
    try {
      const res = await fetch(
        `/api/secretaria/emissao/historico/${diplomaId}/dados`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Erro ao carregar dados",
        );
      }
      const data: DadosPrevia = await res.json();
      setDadosPrevia(data);
      setPreviaAberta(true);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setPreviaCarregandoId(null);
    }
  };

  const fecharPrevia = () => {
    setPreviaAberta(false);
    setDadosPrevia(null);
    setPreviaDiplomaId(null);
    setOcultarTimbrado(false);
  };

  // Loading states para os botões de download/print
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);

  // ── Salvar PDF direto — via Puppeteer server-side ──
  // Chama o endpoint /pdf que renderiza o histórico com Chromium headless
  // e devolve o PDF com texto selecionável (vetorial, não imagem).
  // Fidelidade 100% com o preview e tamanho de arquivo compacto.
  const salvarPdfDireto = async (diplomaId: string) => {
    if (baixandoPdf) return;
    setBaixandoPdf(true);
    setErro("");
    try {
      const res = await fetchSeguro(
        `/api/secretaria/emissao/historico/${diplomaId}/pdf`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ semTimbrado: ocultarTimbrado }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Erro ao gerar PDF",
        );
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `historico_${previaNome.replace(/\s+/g, "_").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar PDF");
    } finally {
      setBaixandoPdf(false);
    }
  };

  // ── Imprimir direto — iframe escondido + contentWindow.print() ──
  // Abre o diálogo de impressão do Chrome na mesma página (sem nova aba).
  const imprimirDireto = () => {
    if (imprimindo) return;
    setImprimindo(true);
    try {
      const el = document.getElementById("preview-historico-emissao");
      if (!el) throw new Error("Preview não encontrado");

      // innerHTML pula o wrapper com transform:scale(0.85)
      const content = el.innerHTML;

      // Clona todos os <link> e <style> da página atual
      const stylesheets = Array.from(
        document.querySelectorAll('link[rel="stylesheet"], style'),
      )
        .map((s) => s.outerHTML)
        .join("");

      // Cria iframe escondido
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.setAttribute("aria-hidden", "true");
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument;
      if (!doc) throw new Error("Falha ao criar iframe");

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Histórico Escolar — ${previaNome}</title>
            <base href="${window.location.origin}/" />
            ${stylesheets}
            <style>
              @page { size: A4; margin: 0; }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: white;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              body > div { display: block !important; gap: 0 !important; }
              body > div > div {
                page-break-after: always;
                break-after: page;
                margin: 0 !important;
                box-shadow: none !important;
                border-radius: 0 !important;
              }
              body > div > div:last-child {
                page-break-after: auto;
                break-after: auto;
              }
            </style>
          </head>
          <body>${content}</body>
        </html>
      `);
      doc.close();

      // Aguarda estilos carregarem, abre diálogo, depois remove o iframe
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.error("[imprimir] print falhou:", err);
        } finally {
          // Remove iframe após um tempo (dá margem para o diálogo do Chrome)
          setTimeout(() => {
            iframe.remove();
            setImprimindo(false);
          }, 1000);
        }
      }, 800);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao imprimir");
      setImprimindo(false);
    }
  };

  // ── Extrai config com fallbacks seguros ──
  const cfg = dadosPrevia?.config;
  const camposAluno =
    cfg?.historico_campos_aluno_config ?? DEFAULT_CAMPOS_ALUNO;
  const colunas = cfg?.historico_colunas_config ?? DEFAULT_COLUNAS;
  const formatacao =
    cfg?.historico_formatacao_condicional ?? DEFAULT_FORMATACAO;
  const secoes = cfg?.historico_secoes_config ?? DEFAULT_SECOES;
  const corCabecalho = cfg?.historico_cor_cabecalho ?? "#1A3A6B";
  const corLinhaAlternada = cfg?.historico_cor_linha_alternada ?? "#F5F5F5";
  const fonte = cfg?.historico_fonte ?? "Times New Roman";
  const tamanhoFonte = cfg?.historico_tamanho_fonte ?? 10;
  const tamanhoFonteCabecalho = cfg?.historico_tamanho_fonte_cabecalho ?? 9;
  const tamanhoFonteCorpo = cfg?.historico_tamanho_fonte_corpo ?? 7;
  // Espelha lógica do AbaVisualHistorico: timbrados PDF legados não são
  // renderizáveis como background — trata como vazio (sem timbrado).
  // Toggle "ocultarTimbrado" também força vazio (papel já é timbrado).
  const timbradoRaw = cfg?.historico_arquivo_timbrado_url ?? "";
  const timbradoUrl = ocultarTimbrado
    ? ""
    : timbradoRaw && !timbradoRaw.toLowerCase().endsWith(".pdf")
      ? timbradoRaw
      : "";
  const margens = {
    topo: cfg?.historico_margem_topo ?? 25,
    inferior: cfg?.historico_margem_inferior ?? 20,
    esquerda: cfg?.historico_margem_esquerda ?? 20,
    direita: cfg?.historico_margem_direita ?? 20,
  };
  const textoRodape = cfg?.historico_texto_rodape ?? "";

  return (
    <>
      {/* ── Dialog de Prévia (LivePreview com dados reais) ── */}
      {previaAberta && dadosPrevia && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={fecharPrevia}
        >
          <div
            className="relative bg-gray-100 rounded-2xl shadow-2xl w-[95vw] max-w-[960px] h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <FileText size={16} className="text-amber-500" />
                Histórico Escolar Digital
                <span className="text-xs font-normal text-gray-500 ml-1">
                  · {previaNome}
                </span>
              </h2>
              <div className="flex items-center gap-3">
                {/* Toggle: Papel já timbrado — oculta o timbrado digital */}
                <label
                  className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-700 hover:text-gray-900"
                  title="Quando marcado, o PDF/impressão sai sem o timbrado digital — útil para imprimir em folha A4 já timbrada fisicamente."
                >
                  <input
                    type="checkbox"
                    checked={ocultarTimbrado}
                    onChange={(e) => setOcultarTimbrado(e.target.checked)}
                    disabled={baixandoPdf || imprimindo}
                    className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400 focus:ring-offset-0 disabled:opacity-50"
                  />
                  <span>Papel já timbrado</span>
                </label>
                <div className="h-5 w-px bg-gray-200" />
                <button
                  onClick={() =>
                    previaDiplomaId && salvarPdfDireto(previaDiplomaId)
                  }
                  disabled={baixandoPdf || imprimindo || !previaDiplomaId}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Baixar PDF direto para o computador (texto selecionável)"
                >
                  {baixandoPdf ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Gerando
                      PDF...
                    </>
                  ) : (
                    <>
                      <Download size={13} /> Salvar PDF
                    </>
                  )}
                </button>
                <button
                  onClick={imprimirDireto}
                  disabled={baixandoPdf || imprimindo}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Abrir diálogo de impressão"
                >
                  {imprimindo ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />{" "}
                      Preparando...
                    </>
                  ) : (
                    <>
                      <Printer size={13} /> Imprimir
                    </>
                  )}
                </button>
                <button
                  onClick={fecharPrevia}
                  className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Preview A4 — escalado para caber na dialog */}
            <div className="flex-1 overflow-auto p-4">
              <div className="flex justify-center">
                <div
                  id="preview-historico-emissao"
                  style={{
                    transform: "scale(0.85)",
                    transformOrigin: "top center",
                  }}
                >
                  <LivePreview
                    camposAluno={camposAluno}
                    colunas={colunas}
                    formatacao={formatacao}
                    secoes={secoes}
                    disciplinas={dadosPrevia.disciplinas}
                    corCabecalho={corCabecalho}
                    corLinhaAlternada={corLinhaAlternada}
                    fonte={fonte}
                    tamanhoFonte={tamanhoFonte}
                    tamanhoFonteCabecalho={tamanhoFonteCabecalho}
                    tamanhoFonteCorpo={tamanhoFonteCorpo}
                    timbradoUrl={timbradoUrl}
                    margens={margens}
                    textoRodape={textoRodape}
                    dadosAluno={dadosPrevia.dadosAluno}
                    dadosCurso={dadosPrevia.dadosCurso}
                    dadosAssinantes={dadosPrevia.assinantes}
                    codigoVerificacao={dadosPrevia.codigo_verificacao ?? null}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Conteúdo da página ── */}
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap size={22} className="text-amber-500" />
            <h1 className="text-xl font-bold text-gray-900">
              Histórico Escolar Digital
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            Busque o aluno pelo nome, CPF ou RA para emitir o histórico escolar.
          </p>
        </div>

        {/* Busca */}
        <div className="relative mb-6">
          <Search size={17} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou RA..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            autoFocus
          />
          {carregando && (
            <Loader2
              size={15}
              className="absolute right-3.5 top-3 text-amber-400 animate-spin"
            />
          )}
        </div>

        {/* Erro */}
        {erro && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
            <AlertCircle size={15} /> {erro}
            <button
              onClick={() => setErro("")}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        )}

        {/* Estado vazio inicial */}
        {!buscaAtiva && !carregando && (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <User size={24} className="text-amber-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">
              Digite o nome ou CPF do aluno
            </p>
            <p className="text-xs text-gray-400 mt-1">
              O sistema buscará diplomas cadastrados
            </p>
          </div>
        )}

        {/* Sem resultados */}
        {buscaAtiva && !carregando && resultados.length === 0 && !erro && (
          <div className="text-center py-16">
            <p className="text-sm font-medium text-gray-600">
              Nenhum resultado encontrado
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Tente buscar por nome completo ou CPF exato
            </p>
          </div>
        )}

        {/* Resultados */}
        {resultados.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
            {resultados.map((diploma) => (
              <div
                key={diploma.id}
                className="flex items-center gap-4 px-5 py-4"
              >
                <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <GraduationCap size={16} className="text-amber-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {diploma.diplomado_nome}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatCPF(diploma.diplomado_cpf)} · {diploma.curso_nome} ·{" "}
                    {diploma.curso_grau}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Conclusão: {formatDate(diploma.data_conclusao)} ·{" "}
                    <span className="text-amber-600">
                      {STATUS_LABEL[diploma.status] ?? diploma.status}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() =>
                      abrirPrevia(diploma.id, diploma.diplomado_nome)
                    }
                    disabled={previaCarregandoId === diploma.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {previaCarregandoId === diploma.id ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />{" "}
                        Abrindo...
                      </>
                    ) : (
                      <>
                        <Eye size={13} /> Prévia & Imprimir
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-6">
          O visual do histórico é definido em{" "}
          <a
            href="/secretaria/configuracoes/documentos"
            className="text-amber-600 hover:underline"
          >
            Configurações → Modelos de Documentos
          </a>
        </p>
      </div>
    </>
  );
}
