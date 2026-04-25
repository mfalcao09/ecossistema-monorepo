"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  GraduationCap,
  User,
  BookOpen,
  FolderOpen,
  FileText,
  FileSignature,
  FileCheck2,
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Building2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  RefreshCw,
  Loader2,
  Hash,
  Calendar,
  Phone,
  Mail,
  Fingerprint,
  MapPin,
  AlertTriangle,
  Info,
  Camera,
  Package,
  Archive,
  Check,
  Trash2,
  X,
  Pencil,
  Send,
  Upload,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import {
  ModalOverrideRegra,
  type ViolacaoRegraResposta,
  type OverridePayload,
} from "@/components/diploma/ModalOverrideRegra";
import { PainelAuditoria } from "@/components/diploma/PainelAuditoria";
import { EditorFluxoAssinaturas } from "@/components/diploma/EditorFluxoAssinaturas";
import AbaSnapshot from "@/components/diploma/AbaSnapshot";
import { useAuditoria } from "@/hooks/useAuditoria";
import { fetchSeguro } from "@/lib/security/fetch-seguro";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Diplomado {
  id: string;
  nome: string;
  nome_social: string | null;
  cpf: string;
  rg: string | null;
  rg_orgao_expedidor: string | null;
  rg_uf: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  nacionalidade: string | null;
  naturalidade: string | null;
  naturalidade_uf: string | null;
  email: string | null;
  telefone: string | null;
  ra: string | null;
}
interface Curso {
  id: string;
  nome: string;
  grau: string;
  titulo: string | null;
  modalidade: string | null;
  carga_horaria: number | null;
  codigo_emec: string | null;
  habilitacao: string | null;
}
interface Processo {
  id: string;
  nome: string;
  turno: string | null;
  periodo_letivo: string | null;
}
interface XmlGerado {
  id: string;
  tipo: string;
  status: string;
  validado_xsd: boolean | null;
  erros_validacao: string[] | null;
  arquivo_url: string | null;
  hash_sha256: string | null;
  created_at: string;
}
interface ExtracaoSessao {
  id: string;
  status: string;
  confianca_geral: number | null;
  dados_extraidos: Record<string, unknown> | null;
  dados_confirmados: Record<string, unknown> | null;
  campos_faltando: string[] | null;
  created_at: string;
}
interface DocDigital {
  id: string;
  status: string;
  codigo_verificacao: string | null;
  url_verificacao: string | null;
  arquivo_url: string | null;
  publicado_em: string | null;
  assinado_em: string | null;
}
interface FluxoAssinaturaUI {
  id: string;
  ordem: number;
  status: string;
  papel: "emissora" | "registradora" | null;
  data_assinatura: string | null;
  tipo_certificado: string | null;
  assinante: {
    id: string;
    nome: string;
    cpf: string;
    cargo: string;
    outro_cargo: string | null;
    tipo_certificado: string | null;
  } | null;
}
interface DiplomaCompleto {
  id: string;
  status: string;
  data_conclusao: string | null;
  data_colacao: string | null;
  data_integralizacao: string | null;
  codigo_validacao: string | null;
  created_at: string;
  updated_at: string;
  codigo_curriculo: string | null;
  is_legado: boolean | null;
  legado_xml_dados_path: string | null;
  legado_xml_documentos_path: string | null;
  legado_rvdd_original_path: string | null;
  diplomados: Diplomado;
  cursos: Curso;
  processos_emissao: Processo | null;
}

// ── Pipeline — 6 Fases agrupadas ──────────────────────────────────────────

interface PipelineFase {
  id: string;
  label: string;
  icone: typeof Sparkles;
  cor: string; // Tailwind bg class when active
  corTexto: string; // Tailwind text class when active
  status: string[]; // All StatusDiploma values in this phase
}

// Pipeline usa os labels canônicos de @/constants/pipeline-unificado
// Acervo Digital foi incorporado em "Documentação e Acervo" (mesma etapa)
const PIPELINE: PipelineFase[] = [
  {
    id: "extracao",
    label: "Extração e Dados",
    icone: Sparkles,
    cor: "bg-violet-500",
    corTexto: "text-violet-600",
    status: ["rascunho", "validando_dados", "preenchido"],
  },
  {
    id: "xml",
    label: "XML e Assinatura",
    icone: FileSignature,
    cor: "bg-blue-500",
    corTexto: "text-blue-600",
    status: [
      "gerando_xml",
      "xml_gerado",
      "validando_xsd",
      "aguardando_assinatura_emissora",
      "em_assinatura",
      "aplicando_carimbo_tempo",
      "assinado",
    ],
  },
  {
    id: "docs",
    label: "Documentação e Acervo",
    icone: FileText,
    cor: "bg-amber-500",
    corTexto: "text-amber-600",
    // Inclui tanto docs complementares quanto acervo digital (mesma etapa no pipeline unificado)
    status: [
      "aguardando_documentos",
      "gerando_documentos",
      "documentos_assinados",
      "aguardando_digitalizacao",
      "acervo_completo",
    ],
  },
  {
    id: "registro",
    label: "Registro",
    icone: Building2,
    cor: "bg-indigo-500",
    corTexto: "text-indigo-600",
    status: [
      "aguardando_envio_registradora",
      "pronto_para_registro",
      "enviado_registradora",
      "rejeitado_registradora",
      "aguardando_registro",
      "registrado",
    ],
  },
  {
    id: "rvdd",
    label: "RVDD",
    icone: FileCheck2,
    cor: "bg-green-500",
    corTexto: "text-green-600",
    status: ["gerando_rvdd", "rvdd_gerado"],
  },
  {
    id: "publicado",
    label: "Publicado",
    icone: Globe,
    cor: "bg-emerald-500",
    corTexto: "text-emerald-600",
    status: ["publicado"],
  },
];

/** Mapa status → índice da fase no pipeline (0-5), -1 se não mapeado */
const ETAPA_IDX: Record<string, number> = {};
PIPELINE.forEach((fase, idx) => {
  fase.status.forEach((s) => {
    ETAPA_IDX[s] = idx;
  });
});
ETAPA_IDX["erro"] = -1;

const STATUS_LABEL: Record<string, string> = {
  // Etapa 0 — Extração e Dados
  rascunho: "Em preparação",
  em_extracao: "IA extraindo dados",
  validando_dados: "Validando dados",
  preenchido: "Dados confirmados",
  aguardando_revisao: "Aguardando revisão",
  // Etapa 1 — XML e Assinatura
  gerando_xml: "Gerando XML",
  xml_gerado: "XML gerado",
  validando_xsd: "Validando XML",
  aguardando_assinatura_emissora: "Aguarda assinatura",
  aguardando_assinatura: "Aguarda assinatura",
  em_assinatura: "Em assinatura",
  aplicando_carimbo_tempo: "Em assinatura",
  assinado: "XMLs assinados",
  xml_com_erros: "Erro no XML",
  // Etapa 2 — Documentação e Acervo
  aguardando_documentos: "Aguarda documentos",
  gerando_documentos: "Preparando documentos",
  documentos_assinados: "Docs assinados",
  aguardando_digitalizacao: "Aguarda digitalização",
  acervo_completo: "Acervo completo",
  // Etapa 3 — Registro
  aguardando_envio_registradora: "Pronto para envio",
  pronto_para_registro: "Pronto para registro",
  enviado_registradora: "Enviado à UFMS",
  rejeitado_registradora: "Rejeitado pela UFMS",
  aguardando_registro: "Aguarda registro",
  registrado: "Registrado",
  // Etapa 4 — RVDD
  gerando_rvdd: "Gerando RVDD",
  rvdd_gerado: "RVDD gerado",
  // Etapa 5 — Publicado
  publicado: "Publicado",
  // Erro
  erro: "Erro",
};

const STATUS_COR: Record<string, string> = {
  // Etapa 0 — Extração e Dados
  rascunho: "bg-gray-100 text-gray-600",
  em_extracao: "bg-violet-50 text-violet-700",
  validando_dados: "bg-violet-50 text-violet-700",
  preenchido: "bg-violet-50 text-violet-700",
  aguardando_revisao: "bg-amber-50 text-amber-700",
  // Etapa 1 — XML e Assinatura
  gerando_xml: "bg-blue-50 text-blue-700",
  xml_gerado: "bg-blue-50 text-blue-700",
  validando_xsd: "bg-blue-50 text-blue-700",
  aguardando_assinatura_emissora: "bg-blue-50 text-blue-700",
  aguardando_assinatura: "bg-blue-50 text-blue-700",
  em_assinatura: "bg-blue-50 text-blue-700",
  aplicando_carimbo_tempo: "bg-blue-50 text-blue-700",
  assinado: "bg-green-50 text-green-700",
  xml_com_erros: "bg-red-50 text-red-600",
  // Etapa 2 — Documentação e Acervo
  aguardando_documentos: "bg-amber-50 text-amber-700",
  gerando_documentos: "bg-amber-50 text-amber-700",
  documentos_assinados: "bg-amber-50 text-amber-700",
  aguardando_digitalizacao: "bg-amber-50 text-amber-700",
  acervo_completo: "bg-amber-50 text-amber-700",
  // Etapa 3 — Registro
  aguardando_envio_registradora: "bg-indigo-50 text-indigo-700",
  pronto_para_registro: "bg-indigo-50 text-indigo-700",
  enviado_registradora: "bg-indigo-50 text-indigo-700",
  rejeitado_registradora: "bg-red-50 text-red-600",
  aguardando_registro: "bg-indigo-50 text-indigo-700",
  registrado: "bg-indigo-50 text-indigo-700",
  // Etapa 4 — RVDD
  gerando_rvdd: "bg-emerald-50 text-emerald-700",
  rvdd_gerado: "bg-emerald-50 text-emerald-700",
  // Etapa 5 — Publicado
  publicado: "bg-emerald-50 text-emerald-700",
  // Erro
  erro: "bg-red-50 text-red-600",
};

const XML_TIPO_LABEL: Record<string, string> = {
  diploma_digital: "DiplomaDigital",
  historico_escolar: "HistoricoEscolarDigital",
  doc_academica_registro: "DocumentacaoAcademicaRegistro",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCPF(cpf: string) {
  return cpf?.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") ?? "—";
}
function formatDate(d: string | null) {
  if (!d) return "—";
  // Fix timezone: datas YYYY-MM-DD são interpretadas como UTC meia-noite,
  // causando recuo de 1 dia em UTC-3. Usamos T12:00:00 (noon) para evitar.
  const match = d.match(/^(\d{4}-\d{2}-\d{2})/);
  const safe = match ? `${match[1]}T12:00:00` : d;
  return new Date(safe).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function formatDatetime(d: string | null) {
  if (!d) return "—";
  // Para datetime completo (created_at, updated_at) usar direto — já tem timezone
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Barra de pipeline (6 fases com sub-etapas) ───────────────────────────

function PipelineVisual({ status }: { status: string }) {
  const faseAtual = ETAPA_IDX[status] ?? -1;
  const concluido = status === "publicado";
  const temErro = status === "erro";

  return (
    <div className="space-y-2">
      {/* Fases principais */}
      <div className="flex items-center gap-0">
        {PIPELINE.map((fase, idx) => {
          const Icone = fase.icone;
          const ativa = idx === faseAtual && !concluido && !temErro;
          const passada = idx < faseAtual || concluido;

          return (
            <div key={fase.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                    passada
                      ? `${fase.cor} border-transparent`
                      : ativa
                        ? `bg-white border-current ${fase.corTexto} shadow-sm`
                        : "bg-white border-gray-200"
                  }`}
                >
                  <Icone
                    size={15}
                    className={
                      passada
                        ? "text-white"
                        : ativa
                          ? fase.corTexto
                          : "text-gray-300"
                    }
                  />
                </div>
                <span
                  className={`text-[10px] font-medium text-center leading-tight max-w-[72px] ${
                    ativa
                      ? fase.corTexto
                      : passada
                        ? "text-gray-600"
                        : "text-gray-300"
                  }`}
                >
                  {fase.label}
                </span>
              </div>
              {idx < PIPELINE.length - 1 && (
                <div
                  className={`h-0.5 w-5 mx-0.5 mb-4 flex-shrink-0 transition-colors ${
                    passada ? "bg-gray-400" : "bg-gray-100"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Sub-etapa atual (dentro da fase) */}
      {!concluido && !temErro && faseAtual >= 0 && (
        <div className="flex items-center gap-1.5 ml-1">
          <div
            className={`w-1.5 h-1.5 rounded-full animate-pulse ${PIPELINE[faseAtual]?.cor ?? "bg-gray-400"}`}
          />
          <span className="text-[11px] text-gray-500">
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>
      )}

      {/* Erro */}
      {temErro && (
        <div className="flex items-center gap-1.5 ml-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span className="text-[11px] text-red-600 font-medium">
            Erro — requer intervenção manual
          </span>
        </div>
      )}
    </div>
  );
}

// ── Card de XML ────────────────────────────────────────────────────────────

function CardXml({ xml }: { xml: XmlGerado }) {
  const [expandido, setExpandido] = useState(false);
  const ok = xml.validado_xsd && xml.status !== "erro";
  const temErros = (xml.erros_validacao ?? []).length > 0;

  return (
    <div
      className={`border rounded-xl overflow-hidden ${ok ? "border-gray-200" : "border-red-200"}`}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 ${ok ? "" : "bg-red-50/40"}`}
        onClick={() => setExpandido((v) => !v)}
      >
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ok ? "bg-blue-50" : "bg-red-50"}`}
        >
          <FileText
            size={13}
            className={ok ? "text-blue-500" : "text-red-400"}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {XML_TIPO_LABEL[xml.tipo] ?? xml.tipo}
          </p>
          <p className="text-xs text-gray-400">
            {formatDatetime(xml.created_at)}
            {xml.validado_xsd === true && " · XSD v1.05 ✓"}
            {xml.validado_xsd === false && " · Falha na validação XSD"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {ok ? (
            <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">
              Válido
            </span>
          ) : (
            <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
              {temErros ? `${xml.erros_validacao!.length} erro(s)` : "Inválido"}
            </span>
          )}
          {expandido ? (
            <ChevronUp size={14} className="text-gray-400" />
          ) : (
            <ChevronDown size={14} className="text-gray-400" />
          )}
        </div>
      </div>

      {expandido && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-3">
          {xml.hash_sha256 && (
            <div>
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <Hash size={10} />
                Hash SHA-256
              </p>
              <p className="text-[10px] font-mono text-gray-600 break-all bg-gray-50 rounded px-2 py-1">
                {xml.hash_sha256}
              </p>
            </div>
          )}
          {temErros && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-2">
                Erros de validação:
              </p>
              <ul className="space-y-1">
                {xml.erros_validacao!.map((e, i) => (
                  <li
                    key={i}
                    className="text-xs text-red-600 flex items-start gap-1.5"
                  >
                    <XCircle size={11} className="flex-shrink-0 mt-0.5" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {xml.arquivo_url && (
            <a
              href={xml.arquivo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              <Download size={12} /> Baixar XML
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Painel de ações ────────────────────────────────────────────────────────

function PainelAcoes({
  diploma,
  xmls,
  docDigital,
  onAtualizar,
  onVerDocumentos,
  sessaoId,
}: {
  diploma: DiplomaCompleto;
  xmls: XmlGerado[];
  docDigital: DocDigital | null;
  onAtualizar: () => void;
  onVerDocumentos?: () => void;
  sessaoId?: string | null;
}) {
  const [executando, setExecutando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [gateAuditoriaAberto, setGateAuditoriaAberto] = useState(false);
  const [showRvddDialog, setShowRvddDialog] = useState(false);
  const router = useRouter();

  // ── Snapshot Imutável (Fase 0.6) — estado e modais ─────────────────────
  // Consolidar = gera snapshot imutável a partir das tabelas normalizadas.
  // Destravar = anula snapshot pra reconsolidar (audita em diploma_unlock_windows).
  const [snapshotConsolidado, setSnapshotConsolidado] = useState<
    boolean | null
  >(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [confirmarConsolidarAberto, setConfirmarConsolidarAberto] =
    useState(false);
  const [destravarAberto, setDestravarAberto] = useState(false);
  const [justificativaDestravar, setJustificativaDestravar] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSnapshotLoading(true);
    fetch(`/api/diplomas/${diploma.id}/snapshot`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setSnapshotConsolidado(d?.snapshot != null);
      })
      .catch(() => {
        if (!cancelled) setSnapshotConsolidado(false);
      })
      .finally(() => {
        if (!cancelled) setSnapshotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [diploma.id, diploma.updated_at]);

  // Bug #H — Estado do modal de override de regra de negócio.
  // Quando a API retorna 422 com `tipo: "regra_negocio"`, abrimos o modal.
  const [violacoesPendentes, setViolacoesPendentes] = useState<
    ViolacaoRegraResposta[]
  >([]);
  const [modalOverrideAberto, setModalOverrideAberto] = useState(false);

  // ── Auditoria de requisitos XSD ──────────────────────────────────────────
  const {
    auditoria,
    carregando: auditCarregando,
    erro: auditErro,
    auditar,
  } = useAuditoria({
    diplomaId: diploma.id,
    diplomaUpdatedAt: diploma.updated_at,
  });

  const executar = async (acao: string, fn: () => Promise<void>) => {
    setExecutando(acao);
    setErro("");
    setSucesso("");
    try {
      await fn();
      onAtualizar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setExecutando(null);
    }
  };

  // ── Handlers Snapshot (Fase 0.6) ────────────────────────────────────────
  const consolidarDados = async () => {
    setConfirmarConsolidarAberto(false);
    await executar("consolidar", async () => {
      const res = await fetchSeguro(
        `/api/diplomas/${diploma.id}/snapshot/gerar`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setSnapshotConsolidado(true);
      setSucesso("Dados consolidados — snapshot imutável criado.");
    });
  };

  const destravarSnapshot = async () => {
    const just = justificativaDestravar.trim();
    if (just.length < 20) {
      setErro("Justificativa precisa ter pelo menos 20 caracteres.");
      return;
    }
    setDestravarAberto(false);
    await executar("destravar", async () => {
      const res = await fetchSeguro(
        `/api/diplomas/${diploma.id}/snapshot/destravar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ justificativa: just }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setSnapshotConsolidado(false);
      setJustificativaDestravar("");
      setSucesso("Snapshot destravado — edite os dados e consolide novamente.");
    });
  };

  /**
   * Chamada efetiva à API gerar-xml. Aceita lista opcional de overrides
   * (Bug #H — princípio do override humano). Se o backend retornar 422
   * com `tipo: "regra_negocio"`, abre o modal de override em vez de
   * lançar erro.
   */
  const chamarGerarXml = async (overrides: OverridePayload[] = []) => {
    if (diploma.is_legado) {
      throw new Error(
        "Diploma legado — XMLs originais já importados e imutáveis pela regra do MEC. Geração não disponível.",
      );
    }
    const processoId = diploma.processos_emissao?.id;
    if (!processoId)
      throw new Error(
        "Diploma sem processo vinculado — não é possível gerar XML.",
      );

    const res = await fetchSeguro(`/api/processos/${processoId}/gerar-xml`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diploma_id: diploma.id,
        ...(overrides.length > 0 ? { overrides } : {}),
      }),
    });
    const data = await res.json();

    // Bug #H — 422 com tipo regra_negocio → abre modal de override
    if (
      res.status === 422 &&
      data?.tipo === "regra_negocio" &&
      Array.isArray(data?.violacoes)
    ) {
      setViolacoesPendentes(data.violacoes as ViolacaoRegraResposta[]);
      setModalOverrideAberto(true);
      // Sinaliza para o caller que NÃO houve sucesso, mas também não lançamos
      // erro vermelho — o modal vai cuidar do fluxo.
      return { aguardandoOverride: true } as const;
    }

    if (!res.ok) {
      // Inclui `detalhes` (ex: "RA do diplomado é obrigatório") na
      // mensagem visível — sem isso, o usuário só vê "Dados incompletos
      // para geração do XML" sem saber qual campo está faltando.
      const erroBase = data.error ?? "Erro ao gerar XML";
      const detalhes = data.detalhes ? ` — ${data.detalhes}` : "";
      throw new Error(erroBase + detalhes);
    }
    return { aguardandoOverride: false } as const;
  };

  /**
   * Gate suave: se a auditoria indica críticos, abre confirmação antes de gerar.
   * O operador pode confirmar mesmo assim (princípio do override humano).
   */
  const gerarXml = () => {
    // Se ainda não auditou, ou há críticos → abre o gate de confirmação
    if (!auditoria || !auditoria.pode_gerar_xml) {
      setGateAuditoriaAberto(true);
      return;
    }
    // Auditoria ok → gera direto
    _executarGerarXml();
  };

  // Não usa o helper `executar` porque precisa condicionar onAtualizar():
  // quando a API retorna 422 + regra_negocio, o modal de override é aberto
  // e onAtualizar NÃO deve ser chamado (chamá-lo desmontaria PainelAcoes
  // e fecharia o modal antes de o usuário ver qualquer coisa).
  const _executarGerarXml = async () => {
    setExecutando("xml");
    setErro("");
    setSucesso("");
    try {
      const resultado = await chamarGerarXml([]);
      if (!resultado.aguardandoOverride) {
        setSucesso("XMLs gerados com sucesso! Validação XSD aplicada.");
        onAtualizar(); // só atualiza quando a geração realmente concluiu
      }
      // Se aguardandoOverride: modal já aberto — não chamar onAtualizar
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setExecutando(null);
    }
  };

  /**
   * Callback do modal — confirma o override, re-chama a API com a lista
   * de overrides, e fecha o modal em caso de sucesso.
   */
  const confirmarOverride = async (overrides: OverridePayload[]) => {
    const resultado = await chamarGerarXml(overrides);
    if (!resultado.aguardandoOverride) {
      setModalOverrideAberto(false);
      setViolacoesPendentes([]);
      setSucesso("XMLs gerados com justificativa registrada na auditoria.");
      onAtualizar();
    }
  };

  const cancelarOverride = () => {
    setModalOverrideAberto(false);
    setViolacoesPendentes([]);
    setErro("Geração cancelada. Corrija os dados ou justifique a divergência.");
  };

  const publicar = () =>
    executar("publicar", async () => {
      const res = await fetchSeguro(`/api/diplomas/${diploma.id}/publicar`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao publicar");
      setSucesso("Diploma publicado! Código: " + data.codigo_verificacao);
    });

  const excluirDiploma = async () => {
    setExecutando("excluir");
    setErro("");
    try {
      const res = await fetchSeguro(`/api/diplomas/${diploma.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao excluir diploma");
      router.push("/diploma/diplomas");
    } catch (e) {
      setErro((e as Error).message);
      setConfirmandoExclusao(false);
    } finally {
      setExecutando(null);
    }
  };

  const s = diploma.status;
  const temXmlValido = xmls.some((x) => x.validado_xsd && x.status !== "erro");
  const statusPermiteEdicao = [
    "rascunho",
    "preenchido",
    "validando_dados",
    "erro",
  ].includes(s);
  // Fase 0.6: gerar XML exige snapshot consolidado.
  const podeGerarXml = statusPermiteEdicao && snapshotConsolidado === true;
  // Consolidar: snapshot ainda não criado, status edição, não-legado, auditoria ok
  const podeConsolidar =
    statusPermiteEdicao &&
    !diploma.is_legado &&
    snapshotConsolidado === false &&
    auditoria?.pode_gerar_xml === true;
  // Destravar: já consolidado E ainda não rolou assinatura/registro/publicação
  const podeDestravar =
    snapshotConsolidado === true &&
    !diploma.is_legado &&
    !["assinado", "registrado", "publicado", "rvdd_gerado"].includes(s) &&
    !temXmlValido;
  const podeAssinar =
    ["aguardando_assinatura_emissora", "xml_gerado"].includes(s) &&
    temXmlValido;
  const podePublicar = ["rvdd_gerado"].includes(s);
  const podeVerRvdd = ["rvdd_gerado", "publicado"].includes(s);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
      {/* Bug #H — Modal de override de regra de negócio */}
      <ModalOverrideRegra
        aberto={modalOverrideAberto}
        violacoes={violacoesPendentes}
        onCancelar={cancelarOverride}
        onConfirmar={confirmarOverride}
      />

      {/* Fase 0.6 — Modal: Confirmar Consolidação */}
      {confirmarConsolidarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={20} className="text-violet-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Consolidar dados?
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ação imutável — só pode ser revertida com justificativa
                </p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-1">
              <p>
                <span className="text-gray-500">Diplomado:</span>{" "}
                <span className="font-semibold text-gray-800">
                  {diploma.diplomados?.nome ?? "—"}
                </span>
              </p>
              <p>
                <span className="text-gray-500">Curso:</span>{" "}
                <span className="font-semibold text-gray-800">
                  {diploma.cursos?.nome ?? "—"}
                </span>
              </p>
            </div>

            <p className="text-xs text-gray-700 leading-relaxed">
              Após consolidar, os dados ficam <strong>imutáveis</strong>. Os
              XMLs, PDFs assinados e a RVDD serão gerados a partir deste
              snapshot. Para alterar depois, será necessário destravar com
              justificativa (ação auditada).
            </p>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmarConsolidarAberto(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={consolidarDados}
                disabled={executando !== null}
                className="px-4 py-2 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 flex items-center gap-1.5 disabled:opacity-40"
              >
                <ShieldCheck size={12} /> Consolidar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fase 0.6 — Modal: Destravar Snapshot (com justificativa) */}
      {destravarAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Unlock size={20} className="text-orange-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Destravar para edição?
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Esta ação será auditada permanentemente
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-700 leading-relaxed">
              O snapshot atual será anulado. Você poderá editar os dados e
              consolidar novamente. O motivo informado fica registrado em{" "}
              <code className="text-[10px] bg-gray-100 px-1 rounded">
                diploma_unlock_windows
              </code>
              .
            </p>

            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Justificativa <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal">
                  {" "}
                  (mínimo 20 caracteres)
                </span>
              </label>
              <textarea
                value={justificativaDestravar}
                onChange={(e) => setJustificativaDestravar(e.target.value)}
                rows={4}
                placeholder="Ex: Erro detectado no nome do diplomado após consolidação — corrigir antes da assinatura."
                className="w-full text-xs border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                {justificativaDestravar.trim().length} / mínimo 20
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setDestravarAberto(false);
                  setJustificativaDestravar("");
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={destravarSnapshot}
                disabled={
                  executando !== null ||
                  justificativaDestravar.trim().length < 20
                }
                className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 flex items-center gap-1.5 disabled:opacity-40"
              >
                <Unlock size={12} /> Destravar
              </button>
            </div>
          </div>
        </div>
      )}

      <h3 className="text-sm font-bold text-gray-900">Ações do pipeline</h3>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg flex items-start gap-2">
          <XCircle size={13} className="flex-shrink-0 mt-0.5" />
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2 rounded-lg flex items-start gap-2">
          <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" />
          {sucesso}
        </div>
      )}

      {/* ── Gate Suave — confirmação quando há críticos ───────────────── */}
      {gateAuditoriaAberto && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={15}
              className="text-amber-600 flex-shrink-0 mt-0.5"
            />
            <div>
              <p className="text-xs font-bold text-amber-800">
                {!auditoria
                  ? "Auditoria não realizada — deseja continuar mesmo assim?"
                  : `${auditoria.totais.criticos} erro(s) crítico(s) encontrado(s)`}
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                {!auditoria
                  ? "Recomendamos auditar os requisitos antes de gerar o XML para evitar erros XSD."
                  : "O XML pode ser gerado, mas provavelmente será rejeitado pelo XSD ou pela registradora. Corrija os dados ou prossiga com esta justificativa."}
              </p>
              {auditoria && auditoria.totais.criticos > 0 && (
                <ul className="mt-2 space-y-1">
                  {auditoria.grupos
                    .filter((g) => g.status === "com_erros")
                    .flatMap((g) =>
                      g.issues
                        .filter((i) => i.severidade === "critico")
                        .slice(0, 2),
                    )
                    .map((issue, idx) => (
                      <li
                        key={idx}
                        className="text-[10px] text-amber-800 flex items-start gap-1"
                      >
                        <XCircle
                          size={9}
                          className="flex-shrink-0 mt-0.5 text-red-500"
                        />
                        {issue.mensagem}
                      </li>
                    ))}
                  {auditoria.totais.criticos > 4 && (
                    <li className="text-[10px] text-amber-600 italic">
                      ... e mais {auditoria.totais.criticos - 4} erro(s). Veja
                      os detalhes na auditoria acima.
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setGateAuditoriaAberto(false)}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancelar — corrigir dados
            </button>
            <button
              onClick={() => {
                setGateAuditoriaAberto(false);
                _executarGerarXml();
              }}
              className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 flex items-center justify-center gap-1.5"
            >
              <AlertTriangle size={11} /> Gerar mesmo assim
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {/* Auditoria de Requisitos XSD — aparece antes do Gerar XMLs */}
        {["rascunho", "preenchido", "validando_dados", "erro"].includes(
          diploma.status,
        ) && (
          <PainelAuditoria
            diplomaId={diploma.id}
            sessaoId={sessaoId}
            processoId={diploma.processos_emissao?.id}
            auditoria={auditoria}
            carregando={auditCarregando}
            erro={auditErro}
            onAuditar={auditar}
            onVerDocumentos={onVerDocumentos}
          />
        )}

        {/* Fase 0.6 — Consolidar Dados (snapshot imutável) */}
        {!diploma.is_legado &&
          statusPermiteEdicao &&
          snapshotConsolidado === false && (
            <div
              className={`p-3 rounded-xl border-2 transition-all ${podeConsolidar ? "border-violet-200 bg-violet-50/30" : "border-gray-100 opacity-60"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${podeConsolidar ? "bg-violet-500" : "bg-gray-200"}`}
                  >
                    <ShieldCheck size={13} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">
                      Consolidar Dados
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Trava os dados como snapshot imutável · habilita geração
                      de XMLs
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmarConsolidarAberto(true)}
                  disabled={!podeConsolidar || executando !== null}
                  title={
                    !podeConsolidar
                      ? "Resolva os erros críticos da auditoria antes de consolidar"
                      : ""
                  }
                  className="flex-shrink-0 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {executando === "consolidar" ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={12} />
                  )}
                  {executando === "consolidar"
                    ? "Consolidando..."
                    : "Consolidar"}
                </button>
              </div>
              {!podeConsolidar &&
                snapshotLoading === false &&
                auditoria !== null &&
                !auditoria.pode_gerar_xml && (
                  <p className="text-[10px] text-amber-600 mt-2 flex items-center gap-1">
                    <AlertTriangle size={10} />
                    Resolva os erros críticos da auditoria primeiro.
                  </p>
                )}
            </div>
          )}

        {/* Fase 0.6 — Destravar Snapshot (com justificativa auditada) */}
        {podeDestravar && (
          <div className="p-3 rounded-xl border-2 border-orange-200 bg-orange-50/20 transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-orange-500">
                  <Unlock size={13} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">
                    Destravar para edição
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Anula o snapshot atual · auditado em diploma_unlock_windows
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDestravarAberto(true)}
                disabled={executando !== null}
                className="flex-shrink-0 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {executando === "destravar" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Unlock size={12} />
                )}
                Destravar
              </button>
            </div>
          </div>
        )}

        {/* Ação 1: Gerar XML */}
        <div
          className={`p-3 rounded-xl border-2 transition-all ${podeGerarXml ? "border-blue-200 bg-blue-50/30" : "border-gray-100 opacity-60"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${podeGerarXml ? "bg-blue-500" : "bg-gray-200"}`}
              >
                <FileText size={13} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">
                  Gerar XMLs (2 documentos)
                </p>
                <p className="text-[10px] text-gray-400">
                  HistóricoEscolar · DocAcadêmica (Diploma = Registradora)
                </p>
              </div>
            </div>
            <button
              onClick={gerarXml}
              disabled={!podeGerarXml || executando !== null}
              title={
                !podeGerarXml && snapshotConsolidado === false
                  ? "Consolide os dados primeiro"
                  : ""
              }
              className="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {executando === "xml" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <FileText size={12} />
              )}
              {executando === "xml" ? "Gerando..." : "Gerar"}
            </button>
          </div>
          {!podeGerarXml &&
            snapshotConsolidado === false &&
            statusPermiteEdicao && (
              <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                <AlertTriangle size={10} />
                Consolide os dados primeiro para habilitar a geração.
              </p>
            )}
          {s === "xml_com_erros" && (
            <p className="text-[10px] text-red-600 mt-2 flex items-center gap-1">
              <AlertTriangle size={10} />
              Há erros nos XMLs — corrija os dados e regenere.
            </p>
          )}
        </div>

        {/* Ação 2: Assinatura BRy — Redireciona para /diploma/assinaturas */}
        <div
          className={`p-3 rounded-xl border-2 transition-all ${podeAssinar ? "border-amber-200 bg-amber-50/30" : "border-gray-100 opacity-60"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${podeAssinar ? "bg-amber-500" : "bg-gray-200"}`}
              >
                <FileSignature size={13} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">
                  Assinatura Digital (BRy Signer)
                </p>
                <p className="text-[10px] text-gray-400">
                  Token A3 USB · XAdES AD-RA · ICP-Brasil
                </p>
              </div>
            </div>
            <Link
              href="/diploma/assinaturas"
              className={`flex-shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 flex items-center gap-1.5 ${!podeAssinar ? "opacity-40 pointer-events-none" : ""}`}
            >
              <FileSignature size={12} />
              Ir para Assinaturas
            </Link>
          </div>
        </div>

        {/* Ação 3: Publicar */}
        <div
          className={`p-3 rounded-xl border-2 transition-all ${podePublicar ? "border-emerald-200 bg-emerald-50/30" : "border-gray-100 opacity-60"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${podePublicar ? "bg-emerald-500" : "bg-gray-200"}`}
              >
                <Globe size={13} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">
                  Publicar diploma
                </p>
                <p className="text-[10px] text-gray-400">
                  Registra no acervo · Gera QR Code · Portal público
                </p>
              </div>
            </div>
            <button
              onClick={publicar}
              disabled={!podePublicar || executando !== null}
              className="flex-shrink-0 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {executando === "publicar" ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Globe size={12} />
              )}
              {executando === "publicar" ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </div>

        {/* Ação 4: Visualizar RVDD */}
        {(podeVerRvdd ||
          (diploma.is_legado && diploma.legado_rvdd_original_path)) && (
          <div className="p-3 rounded-xl border-2 border-teal-200 bg-teal-50/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-teal-500">
                  <FileCheck2 size={13} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">
                    Visualizar / Imprimir RVDD
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {diploma.is_legado
                      ? "RVDD importado do sistema anterior"
                      : "Representação visual · PDF via impressão do browser"}
                  </p>
                </div>
              </div>
              {diploma.is_legado && diploma.legado_rvdd_original_path ? (
                <button
                  onClick={() => setShowRvddDialog(true)}
                  className="flex-shrink-0 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 flex items-center gap-1.5"
                >
                  <ExternalLink size={12} /> Abrir
                </button>
              ) : (
                <a
                  href={`/rvdd/${diploma.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 flex items-center gap-1.5"
                >
                  <ExternalLink size={12} /> Abrir
                </a>
              )}
            </div>
          </div>
        )}

        {/* Dialog RVDD legado */}
        {showRvddDialog &&
          diploma.is_legado &&
          diploma.legado_rvdd_original_path && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
              <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col"
                style={{ height: "90vh" }}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <FileCheck2 size={16} className="text-teal-600" />
                    <p className="text-sm font-bold text-gray-800">
                      RVDD — Representação Visual do Diploma Digital
                    </p>
                    <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                      Legado
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/storage-proxy?path=${encodeURIComponent(diploma.legado_rvdd_original_path)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition"
                    >
                      <Download size={12} /> Baixar PDF
                    </a>
                    <button
                      onClick={() => setShowRvddDialog(false)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <iframe
                    src={`/api/storage-proxy?path=${encodeURIComponent(diploma.legado_rvdd_original_path)}`}
                    className="w-full h-full"
                    title="RVDD do diploma"
                  />
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Diploma publicado */}
      {s === "publicado" && docDigital && (
        <div className="pt-2 border-t border-gray-100 space-y-2">
          <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
            <CheckCircle2 size={13} />
            Diploma publicado em {formatDate(docDigital.publicado_em)}
          </p>
          {docDigital.codigo_verificacao && (
            <p className="text-[10px] font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded">
              Código: {docDigital.codigo_verificacao}
            </p>
          )}
          {(docDigital.url_verificacao ||
            (diploma.is_legado && diploma.codigo_validacao)) && (
            <a
              href={
                diploma.is_legado && diploma.codigo_validacao
                  ? `https://diploma.ficcassilandia.com.br?codigo=${diploma.codigo_validacao}`
                  : docDigital.url_verificacao!
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              <ExternalLink size={12} /> Ver portal de verificação
            </a>
          )}
        </div>
      )}

      {/* Zona de exclusão — apenas rascunho */}
      {s === "rascunho" && (
        <div className="pt-3 border-t border-red-100">
          {!confirmandoExclusao ? (
            <button
              onClick={() => setConfirmandoExclusao(true)}
              disabled={executando !== null}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={13} />
              Excluir diploma
            </button>
          ) : (
            <div className="space-y-2">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5 mb-1">
                  <AlertTriangle size={13} /> Tem certeza?
                </p>
                <p className="text-[10px] text-red-600">
                  Esta ação removerá o diploma permanentemente do banco. Não
                  pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmandoExclusao(false)}
                  disabled={executando === "excluir"}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  onClick={excluirDiploma}
                  disabled={executando === "excluir"}
                  className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {executando === "excluir" ? (
                    <>
                      <Loader2 size={11} className="animate-spin" />{" "}
                      Excluindo...
                    </>
                  ) : (
                    <>
                      <Trash2 size={11} /> Confirmar exclusão
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Aba Documentos Complementares (Fase 4) ─────────────────────────────────

interface DocComplementar {
  id: string;
  tipo: string;
  status: string;
  arquivo_url: string | null;
  arquivo_assinado_url: string | null;
  bry_document_id: string | null;
  gerado_em: string | null;
  assinado_em: string | null;
  created_at: string;
}

const DOC_TIPO_LABELS: Record<string, string> = {
  historico_escolar_pdf: "Histórico Escolar (PDF)",
  termo_expedicao: "Termo de Expedição",
  termo_responsabilidade: "Termo de Responsabilidade Técnica",
};

// ── Badge de status do documento complementar ──────────────────────────────
const DOC_STATUS_CONFIG: Record<string, { label: string; className: string }> =
  {
    pendente: {
      label: "Aguard. assinatura",
      className: "bg-amber-50 text-amber-700",
    },
    enviado_assinatura: {
      label: "Enviado p/ BRy",
      className: "bg-blue-50 text-blue-700",
    },
    assinado: { label: "Assinado", className: "bg-green-50 text-green-700" },
    erro: { label: "Erro", className: "bg-red-50 text-red-700" },
    gerando: { label: "Gerando...", className: "bg-gray-50 text-gray-500" },
  };

function DocStatusBadge({ status }: { status: string }) {
  const cfg = DOC_STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-gray-50 text-gray-500",
  };
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function AbaDocumentosComplementares({
  diplomaId,
  status,
  onAtualizar,
  isLegado,
}: {
  diplomaId: string;
  status: string;
  onAtualizar: () => void;
  isLegado?: boolean;
}) {
  const [docs, setDocs] = useState<DocComplementar[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const [baixandoZip, setBaixandoZip] = useState(false);
  const [xmlRegistrado, setXmlRegistrado] = useState<File | null>(null);
  const [enviandoXml, setEnviandoXml] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregar = useCallback(() => {
    setCarregando(true);
    fetch(`/api/diplomas/${diplomaId}/documentos`)
      .then((r) => r.json())
      .then((d) => setDocs(d.documentos ?? []))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [diplomaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ── Gerar 3 documentos (Histórico + Termos) ──
  const gerarDocumentos = async () => {
    setGerando(true);
    setErro("");
    setSucesso("");
    try {
      const res = await fetchSeguro(`/api/diplomas/${diplomaId}/documentos`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar documentos");
      setSucesso(
        `${data.documentos_gerados ?? 3} documentos gerados com sucesso!`,
      );
      carregar();
      onAtualizar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setGerando(false);
    }
  };

  // ── Enviar para assinatura BRy ──
  const enviarParaAssinatura = async () => {
    setAssinando(true);
    setErro("");
    setSucesso("");
    try {
      const res = await fetchSeguro(
        `/api/diplomas/${diplomaId}/documentos/assinar`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "Erro ao enviar para assinatura");
      setSucesso(
        `${data.enviados} documento(s) enviado(s) para assinatura no BRy. Os signatários serão notificados por e-mail.`,
      );
      carregar();
      onAtualizar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAssinando(false);
    }
  };

  // ── Baixar pacote ZIP ──
  const baixarPacoteZip = async () => {
    setBaixandoZip(true);
    setErro("");
    try {
      const res = await fetchSeguro(
        `/api/diplomas/${diplomaId}/pacote-registradora`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Erro ao gerar pacote",
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pacote_diploma_${diplomaId.slice(0, 8)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBaixandoZip(false);
    }
  };

  // ── Upload do XML retornado pela registradora ──
  const uploadXmlRegistrado = async () => {
    if (!xmlRegistrado) return;
    setEnviandoXml(true);
    setErro("");
    setSucesso("");
    try {
      const formData = new FormData();
      formData.append("xml", xmlRegistrado);
      const res = await fetchSeguro(
        `/api/diplomas/${diplomaId}/importar-registro`,
        { method: "POST", body: formData },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          (data as { error?: string }).error ?? "Erro ao importar XML",
        );
      setSucesso(
        "XML registrado importado com sucesso! Diploma marcado como Registrado.",
      );
      setXmlRegistrado(null);
      carregar();
      onAtualizar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviandoXml(false);
    }
  };

  // ── Flags de estado ──
  const podeGerar = [
    "assinado",
    "aguardando_documentos",
    "gerando_documentos",
    "erro",
  ].includes(status);
  const temDocsPendentes = docs.some(
    (d) => d.status === "pendente" || d.status === "erro",
  );
  const podeAssinar =
    docs.length > 0 &&
    temDocsPendentes &&
    ["aguardando_documentos"].includes(status);
  const todosAssinados =
    docs.length > 0 && docs.every((d) => d.status === "assinado");
  const podePackage =
    [
      "aguardando_documentos",
      "aguardando_envio_registradora",
      "documentos_assinados",
    ].includes(status) || todosAssinados;
  const podeUploadXml = [
    "aguardando_envio_registradora",
    "enviado_registradora",
    "aguardando_registro",
  ].includes(status);

  if (isLegado) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <FileText size={15} className="text-amber-500" />
          <p className="text-sm font-bold text-gray-800">
            Documentos Complementares
          </p>
          <span className="ml-auto text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
            Legado
          </span>
        </div>
        <div className="p-5 flex flex-col items-center text-center py-8 gap-2">
          <Archive size={32} className="text-gray-200 mb-1" />
          <p className="text-gray-500 font-medium text-sm">
            Diploma importado do sistema anterior
          </p>
          <p className="text-xs text-gray-400 max-w-xs">
            Este diploma foi emitido e registrado antes da implantação deste
            ERP. Os documentos complementares são gerados apenas para o novo
            fluxo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* ── Cabeçalho ── */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-amber-500" />
          <p className="text-sm font-bold text-gray-800">
            Documentos Complementares
          </p>
        </div>
        <div className="flex items-center gap-2">
          {podeAssinar && (
            <button
              onClick={enviarParaAssinatura}
              disabled={assinando}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {assinando ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
              {assinando ? "Enviando..." : "Enviar p/ Assinatura"}
            </button>
          )}
          {podeGerar && (
            <button
              onClick={gerarDocumentos}
              disabled={gerando}
              className="px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {gerando ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <FileText size={12} />
              )}
              {gerando ? "Gerando..." : "Gerar 3 Documentos"}
            </button>
          )}
        </div>
      </div>

      {/* ── Alertas ── */}
      {erro && (
        <div className="mx-5 mt-3 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg flex items-start gap-2">
          <XCircle size={13} className="flex-shrink-0 mt-0.5" />
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="mx-5 mt-3 bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2 rounded-lg flex items-start gap-2">
          <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" />
          {sucesso}
        </div>
      )}

      {/* ── Lista de documentos ── */}
      <div className="p-5">
        {carregando ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-8">
            <FileCheck2 size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium text-sm">
              Nenhum documento gerado ainda
            </p>
            <p className="text-xs text-gray-400 mt-1.5">
              {podeGerar
                ? 'Clique em "Gerar 3 Documentos" para criar o Histórico PDF, Termo de Expedição e Termo de Responsabilidade.'
                : "Os documentos serão gerados após a assinatura dos XMLs."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {docs.map((doc) => {
              const urlParaAbrir = doc.arquivo_assinado_url ?? doc.arquivo_url;
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <FileText size={14} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {DOC_TIPO_LABELS[doc.tipo] ?? doc.tipo}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <DocStatusBadge status={doc.status} />
                      {doc.assinado_em && (
                        <span className="text-[10px] text-gray-400">
                          · {new Date(doc.assinado_em).toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                  {urlParaAbrir && (
                    <a
                      href={urlParaAbrir}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      <Download size={12} />{" "}
                      {doc.arquivo_assinado_url ? "Assinado" : "Baixar"}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          ETAPA 3 — Pacote Registradora
          Visível quando há docs assinados ou status permite envio
          ═══════════════════════════════════════════════════════ */}
      {(podePackage || podeUploadXml) && (
        <div className="border-t border-dashed border-gray-200 mx-5 mb-5">
          <div className="flex items-center gap-2 pt-4 mb-3">
            <Package size={14} className="text-violet-500" />
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Etapa 3 — Pacote Registradora
            </p>
          </div>

          <div className="space-y-3">
            {/* Baixar ZIP */}
            {podePackage && (
              <div className="flex items-center justify-between bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Pacote ZIP
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    XMLs assinados + PDFs + manifesto para envio à registradora
                    (UFMS)
                  </p>
                </div>
                <button
                  onClick={baixarPacoteZip}
                  disabled={baixandoZip}
                  className="ml-4 flex-shrink-0 px-3 py-2 text-xs font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {baixandoZip ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Package size={12} />
                  )}
                  {baixandoZip ? "Gerando..." : "Baixar ZIP"}
                </button>
              </div>
            )}

            {/* Upload XML registrado */}
            {podeUploadXml && (
              <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                <p className="text-sm font-medium text-gray-800 mb-1">
                  XML Retornado pela Registradora
                </p>
                <p className="text-[11px] text-gray-500 mb-3">
                  Após o registro na UFMS, faça o upload do XML de retorno para
                  concluir o processo.
                </p>
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept=".xml"
                      className="hidden"
                      onChange={(e) =>
                        setXmlRegistrado(e.target.files?.[0] ?? null)
                      }
                    />
                    <div className="border border-dashed border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-500 cursor-pointer hover:bg-white transition flex items-center gap-2">
                      <Upload
                        size={13}
                        className="text-gray-400 flex-shrink-0"
                      />
                      <span className="truncate">
                        {xmlRegistrado
                          ? xmlRegistrado.name
                          : "Selecionar arquivo XML..."}
                      </span>
                    </div>
                  </label>
                  <button
                    onClick={uploadXmlRegistrado}
                    disabled={!xmlRegistrado || enviandoXml}
                    className="flex-shrink-0 px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {enviandoXml ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Upload size={12} />
                    )}
                    {enviandoXml ? "Importando..." : "Importar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aba Comprobatórios MEC (Sprint 6 — Etapa 2) ─────────────────────────────

interface ComprobatorioItem {
  id: string;
  tipo_xsd: string;
  status_pdfa: "pendente" | "convertido" | "convertido_com_aviso";
  pdfa_storage_path: string | null;
  pdfa_tamanho_bytes: number | null;
  pdfa_converted_at: string | null;
  pdfa_validation_ok: boolean | null;
  selecionado_em: string | null;
  arquivo_nome_original: string | null;
  arquivo_mime_type: string | null;
  arquivo_tamanho_bytes: number | null;
}

const TIPO_XSD_LABEL: Record<string, string> = {
  DocumentoIdentidadeDoAluno: "Doc. Identidade do Aluno",
  ProvaConclusaoEnsinoMedio: "Prova de Conclusão do Ensino Médio",
  ProvaColacao: "Prova de Colação de Grau",
  ComprovacaoEstagioCurricular: "Comprovação de Estágio Curricular",
  CertidaoNascimento: "Certidão de Nascimento",
  CertidaoCasamento: "Certidão de Casamento",
  TituloEleitor: "Título de Eleitor",
  AtoNaturalizacao: "Ato de Naturalização",
  Outros: "Outros",
};

function AbaComprobatoriosMec({
  diplomaId,
  status,
  onAtualizar,
}: {
  diplomaId: string;
  status: string;
  onAtualizar: () => void;
}) {
  const [comprobatorios, setComprobatorios] = useState<ComprobatorioItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [convertendo, setConvertendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregar = useCallback(() => {
    setCarregando(true);
    fetch(`/api/diplomas/${diplomaId}/comprobatorios`)
      .then((r) => r.json())
      .then((d) => setComprobatorios(d.comprobatorios ?? []))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [diplomaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalConvertidos = comprobatorios.filter(
    (c) => c.status_pdfa !== "pendente",
  ).length;
  const totalPendentes = comprobatorios.filter(
    (c) => c.status_pdfa === "pendente",
  ).length;
  const podeConverter = totalPendentes > 0;
  const podeConfirmar =
    status === "aguardando_documentos" && totalConvertidos > 0;

  const handleConverter = async () => {
    setConvertendo(true);
    setErro("");
    setSucesso("");
    try {
      const res = await fetchSeguro(
        `/api/diplomas/${diplomaId}/acervo/converter`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro na conversão");
      setSucesso(
        data.mensagem ?? `${data.convertidos} documento(s) convertido(s).`,
      );
      carregar();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setConvertendo(false);
    }
  };

  const handleConfirmar = async () => {
    setConfirmando(true);
    setErro("");
    setSucesso("");
    try {
      const res = await fetchSeguro(
        `/api/diplomas/${diplomaId}/comprobatorios`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "confirmar_comprobatorios" }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao confirmar acervo");
      setSucesso(
        `Acervo confirmado! ${data.comprobatorios_convertidos} comprobatório(s) prontos para envio.`,
      );
      onAtualizar();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setConfirmando(false);
    }
  };

  function tamanhoLeg(bytes: number | null): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Archive size={15} className="text-indigo-500" />
          <p className="text-sm font-bold text-gray-800">
            Comprobatórios (Acervo MEC)
          </p>
          <span className="text-[10px] text-gray-400 ml-2">
            XSD v1.05 · PDF/A obrigatório
          </span>
          {comprobatorios.length > 0 && (
            <span
              className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                totalConvertidos === comprobatorios.length
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {totalConvertidos}/{comprobatorios.length} convertidos
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {podeConverter && (
            <button
              onClick={handleConverter}
              disabled={convertendo}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {convertendo ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {convertendo ? "Convertendo..." : "Converter documentos"}
            </button>
          )}
          {podeConfirmar && (
            <button
              onClick={handleConfirmar}
              disabled={confirmando}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {confirmando ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              {confirmando ? "Confirmando..." : "Confirmar acervo"}
            </button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {erro && (
        <div className="mx-5 mt-3 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg flex items-start gap-2">
          <XCircle size={13} className="flex-shrink-0 mt-0.5" />
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="mx-5 mt-3 bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2 rounded-lg flex items-start gap-2">
          <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" />
          {sucesso}
        </div>
      )}

      {/* Conteúdo */}
      <div className="p-5">
        {carregando ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg" />
            ))}
          </div>
        ) : comprobatorios.length === 0 ? (
          <div className="text-center py-6">
            <Archive size={32} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-500 font-medium text-sm">
              Nenhum comprobatório encontrado
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Os comprobatórios são adicionados automaticamente ao criar o
              processo (arquivos com destino Acervo marcado).
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {comprobatorios.map((c) => {
              const statusIcon =
                c.status_pdfa === "convertido" ? (
                  <CheckCircle2
                    size={14}
                    className="text-emerald-500 flex-shrink-0"
                  />
                ) : c.status_pdfa === "convertido_com_aviso" ? (
                  <AlertTriangle
                    size={14}
                    className="text-amber-500 flex-shrink-0"
                  />
                ) : (
                  <Clock size={14} className="text-gray-400 flex-shrink-0" />
                );

              const statusLabel =
                c.status_pdfa === "convertido"
                  ? "PDF/A ✓"
                  : c.status_pdfa === "convertido_com_aviso"
                    ? "PDF/A ⚠"
                    : "Pendente";

              const statusClass =
                c.status_pdfa === "convertido"
                  ? "bg-emerald-50 text-emerald-700"
                  : c.status_pdfa === "convertido_com_aviso"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-gray-50 text-gray-500";

              return (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    {statusIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {TIPO_XSD_LABEL[c.tipo_xsd] ?? c.tipo_xsd}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {c.arquivo_nome_original ?? "—"}
                      {c.pdfa_tamanho_bytes
                        ? ` · PDF/A ${tamanhoLeg(c.pdfa_tamanho_bytes)}`
                        : c.arquivo_tamanho_bytes
                          ? ` · ${tamanhoLeg(c.arquivo_tamanho_bytes)}`
                          : ""}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${statusClass}`}
                  >
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Dica quando tudo está convertido mas ainda não confirmado */}
        {!carregando &&
          comprobatorios.length > 0 &&
          totalConvertidos === comprobatorios.length &&
          status === "aguardando_documentos" && (
            <div className="mt-3 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs px-3 py-2 rounded-lg flex items-start gap-2">
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              Todos os comprobatórios estão em PDF/A. Clique em{" "}
              <strong>Confirmar acervo</strong> para avançar para o envio à
              registradora.
            </div>
          )}
      </div>
    </div>
  );
}

// ── Aba Acervo Digital (Fase 5) ──────────────────────────────────────────

interface DocAcervo {
  id: string;
  tipo: string;
  status: string;
  arquivo_url: string | null;
  metadados: Record<string, unknown> | null;
  created_at: string;
}

function AbaAcervoDigital({
  diplomaId,
  status,
  onAtualizar,
}: {
  diplomaId: string;
  status: string;
  onAtualizar: () => void;
}) {
  const [docs, setDocs] = useState<DocAcervo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tipoDoc, setTipoDoc] = useState("diploma_fisico");

  const carregar = useCallback(() => {
    setCarregando(true);
    fetch(`/api/diplomas/${diplomaId}/acervo`)
      .then((r) => r.json())
      .then((d) => setDocs(d.documentos ?? []))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [diplomaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const podeUpload = [
    "aguardando_digitalizacao",
    "documentos_assinados",
    "acervo_completo",
    "erro",
  ].includes(status);
  const podeFinalizar =
    ["aguardando_digitalizacao"].includes(status) && docs.length > 0;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviando(true);
    setErro("");
    setSucesso("");
    try {
      const formData = new FormData();
      formData.append("arquivo", file);
      formData.append("tipo", tipoDoc);
      const res = await fetchSeguro(`/api/diplomas/${diplomaId}/acervo`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no upload");
      setSucesso("Documento adicionado ao acervo!");
      carregar();
      onAtualizar();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const finalizarAcervo = async () => {
    setFinalizando(true);
    setErro("");
    try {
      const res = await fetchSeguro(`/api/diplomas/${diplomaId}/acervo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "finalizar" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao finalizar");
      setSucesso(
        `Acervo finalizado com ${data.total_documentos} documento(s)!`,
      );
      onAtualizar();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setFinalizando(false);
    }
  };

  const TIPOS_ACERVO = [
    { id: "diploma_fisico", label: "Diploma físico" },
    { id: "historico_papel", label: "Histórico (papel)" },
    { id: "rg", label: "RG / Doc. identidade" },
    { id: "cpf_doc", label: "CPF" },
    { id: "certidao_nascimento", label: "Certidão de nascimento" },
    { id: "titulo_eleitor", label: "Título de eleitor" },
    { id: "comprovante_militar", label: "Certificado militar" },
    { id: "foto_3x4", label: "Foto 3x4" },
    { id: "outros", label: "Outros" },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={15} className="text-sky-500" />
          <p className="text-sm font-bold text-gray-800">
            Acervo Acadêmico Digital
          </p>
          <span className="text-[10px] text-gray-400 ml-2">
            Decreto 10.278/2020
          </span>
        </div>
        <div className="flex items-center gap-2">
          {podeFinalizar && (
            <button
              onClick={finalizarAcervo}
              disabled={finalizando}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {finalizando ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} />
              )}
              Finalizar Acervo
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="mx-5 mt-3 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg flex items-start gap-2">
          <XCircle size={13} className="flex-shrink-0 mt-0.5" />
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="mx-5 mt-3 bg-green-50 border border-green-200 text-green-700 text-xs px-3 py-2 rounded-lg flex items-start gap-2">
          <CheckCircle2 size={13} className="flex-shrink-0 mt-0.5" />
          {sucesso}
        </div>
      )}

      <div className="p-5 space-y-4">
        {/* Upload area */}
        {podeUpload && (
          <div className="border-2 border-dashed border-sky-200 rounded-xl p-4 bg-sky-50/30">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-700 mb-2">
                  Adicionar documento ao acervo
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={tipoDoc}
                    onChange={(e) => setTipoDoc(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                  >
                    {TIPOS_ACERVO.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={enviando}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {enviando ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Camera size={12} />
                    )}
                    {enviando ? "Enviando..." : "Selecionar arquivo"}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">
                  JPEG, PNG, WebP ou PDF · Máx. 10MB
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lista de documentos */}
        {carregando ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-6">
            <Archive size={32} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-500 font-medium text-sm">
              Nenhum documento no acervo
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {podeUpload
                ? "Selecione os documentos que integrarão o acervo acadêmico digital."
                : "Disponível após a assinatura dos documentos complementares."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              {docs.length} documento(s) no acervo
            </p>
            {docs.map((doc) => {
              const meta = doc.metadados as Record<string, string> | null;
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition"
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                    <Camera size={14} className="text-sky-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {doc.tipo
                        .replace("acervo_", "")
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {meta?.nome_arquivo_original ?? "—"} ·{" "}
                      {new Date(doc.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {doc.arquivo_url && (
                    <a
                      href={doc.arquivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      <Download size={12} /> Ver
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function DiplomaDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  // Ref para distinguir load inicial (mostra skeleton) de refresh de background
  // (silencioso, sem desmontar filhos). Isso evita que mensagens de erro/sucesso
  // em PainelAcoes sejam perdidas quando onAtualizar() é chamado após uma ação.
  const isInitialLoad = useRef(true);
  const [diploma, setDiploma] = useState<DiplomaCompleto | null>(null);
  const [xmls, setXmls] = useState<XmlGerado[]>([]);
  const [extracao, setExtracao] = useState<ExtracaoSessao | null>(null);
  const [docDigital, setDocDigital] = useState<DocDigital | null>(null);
  const [fluxoAssinaturas, setFluxoAssinaturas] = useState<FluxoAssinaturaUI[]>(
    [],
  );
  const [abaAtiva, setAbaAtiva] = useState<
    "dados" | "snapshot" | "xmls" | "documentos" | "acervo" | "historico"
  >("dados");
  const [expandirDados, setExpandirDados] = useState(false);
  const [editandoCurriculo, setEditandoCurriculo] = useState(false);
  const [valorCurriculo, setValorCurriculo] = useState("");
  const [salvandoCurriculo, setSalvandoCurriculo] = useState(false);

  const carregar = useCallback(() => {
    // Só mostra skeleton no load inicial — refreshes de background são silenciosos
    // para não desmontar PainelAcoes e perder estado de erro/sucesso/modal.
    const isFirst = isInitialLoad.current;
    if (isFirst) {
      setLoading(true);
      isInitialLoad.current = false;
    }
    fetch(`/api/diplomas/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        setDiploma(d.diploma);
        setXmls(d.xmls ?? []);
        setFluxoAssinaturas(d.fluxo_assinaturas ?? []);
        setExtracao(d.extracao ?? null);
        setDocDigital(d.doc_digital ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (isFirst) setLoading(false);
      });
  }, [params.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ── Salvar código do currículo via PATCH ────────────────────────────────
  const salvarCurriculo = useCallback(async () => {
    if (!diploma) return;
    setSalvandoCurriculo(true);
    try {
      const res = await fetchSeguro(`/api/diplomas/${diploma.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo_curriculo: valorCurriculo.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.erro || body.error || "Erro ao salvar código do currículo");
        return;
      }
      setDiploma((prev) =>
        prev
          ? { ...prev, codigo_curriculo: valorCurriculo.trim() || null }
          : prev,
      );
      setEditandoCurriculo(false);
    } catch {
      alert("Erro ao salvar código do currículo");
    } finally {
      setSalvandoCurriculo(false);
    }
  }, [diploma, valorCurriculo]);

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto animate-pulse space-y-4">
        <div className="h-6 bg-gray-100 rounded w-48" />
        <div className="h-24 bg-gray-100 rounded-xl" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!diploma) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <XCircle size={32} className="text-red-400 mx-auto mb-2" />
          <p className="text-red-700 font-medium">Diploma não encontrado</p>
          <Link
            href="/diploma"
            className="mt-3 inline-block text-sm text-primary-600 hover:underline"
          >
            ← Voltar para diplomas
          </Link>
        </div>
      </div>
    );
  }

  const { diplomados: al, cursos: curso, processos_emissao: proc } = diploma;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/diploma"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={14} /> Diplomas
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-700 font-medium truncate">
          {al.nome}
        </span>
      </div>

      {/* Cabeçalho do diploma */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <GraduationCap size={22} className="text-primary-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{al.nome}</h1>
              {al.nome_social && (
                <p className="text-xs text-gray-400">
                  Nome social: {al.nome_social}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                <p className="text-sm text-gray-500">
                  {curso.grau} em{" "}
                  <span className="font-medium text-gray-700">
                    {curso.nome}
                  </span>
                </p>
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_COR[diploma.status] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {STATUS_LABEL[diploma.status] ?? diploma.status}
                </span>
                {diploma.is_legado && (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Legado
                  </span>
                )}
              </div>
              {proc && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <FolderOpen size={12} className="text-gray-400" />
                  {extracao?.id ? (
                    <Link
                      href={`/diploma/processos/novo/revisao/${extracao.id}`}
                      className="text-xs text-primary-600 hover:underline"
                    >
                      {proc.nome}
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-700">{proc.nome}</span>
                  )}
                  {proc.periodo_letivo && (
                    <span className="text-xs text-gray-400">
                      · {proc.periodo_letivo}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={carregar}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Recarregar"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Pipeline visual */}
        <div className="overflow-x-auto pb-1">
          <PipelineVisual status={diploma.status} />
        </div>
      </div>

      {/* Layout 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna principal (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Abas */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit overflow-x-auto">
            {(
              [
                "dados",
                "snapshot",
                "xmls",
                "documentos",
                "acervo",
                "historico",
              ] as const
            ).map((aba) => (
              <button
                key={aba}
                onClick={() => setAbaAtiva(aba)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  abaAtiva === aba
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {aba === "dados" && "Dados"}
                {aba === "snapshot" && "Snapshot"}
                {aba === "xmls" && `XMLs (${xmls.length})`}
                {aba === "documentos" && "Documentos"}
                {aba === "acervo" && "Acervo"}
                {aba === "historico" && "Histórico"}
              </button>
            ))}
          </div>

          {/* Aba: Dados */}
          {abaAtiva === "dados" && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {/* Aviso de extração IA */}
              {extracao && (
                <div
                  className={`px-5 py-3 border-b flex items-center gap-3 ${
                    extracao.confianca_geral && extracao.confianca_geral >= 0.85
                      ? "bg-green-50 border-green-100"
                      : extracao.confianca_geral &&
                          extracao.confianca_geral >= 0.6
                        ? "bg-amber-50 border-amber-100"
                        : "bg-red-50 border-red-100"
                  }`}
                >
                  <Sparkles
                    size={15}
                    className={
                      extracao.confianca_geral &&
                      extracao.confianca_geral >= 0.85
                        ? "text-green-500"
                        : extracao.confianca_geral &&
                            extracao.confianca_geral >= 0.6
                          ? "text-amber-500"
                          : "text-red-400"
                    }
                  />
                  <p className="text-xs text-gray-700 flex-1">
                    <span className="font-semibold">Extração IA:</span>{" "}
                    confiança{" "}
                    <span className="font-bold">
                      {extracao.confianca_geral
                        ? `${Math.round(extracao.confianca_geral * 100)}%`
                        : "—"}
                    </span>
                    {extracao.campos_faltando &&
                      extracao.campos_faltando.length > 0 && (
                        <>
                          {" "}
                          · Campos ausentes:{" "}
                          {extracao.campos_faltando.join(", ")}
                        </>
                      )}
                  </p>
                  {proc && extracao?.id && (
                    <Link
                      href={`/diploma/processos/novo/revisao/${extracao.id}`}
                      className="text-xs text-primary-600 hover:underline font-medium flex-shrink-0"
                    >
                      Ver chat IA →
                    </Link>
                  )}
                </div>
              )}

              {/* Dados do diplomado */}
              <div className="p-5 space-y-5">
                <div>
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandirDados((v) => !v)}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <User size={15} className="text-gray-500" />
                      <h3 className="text-sm font-bold text-gray-800">
                        Dados pessoais
                      </h3>
                    </div>
                    {expandirDados ? (
                      <ChevronUp size={14} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={14} className="text-gray-400" />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <Campo
                      icone={<Fingerprint size={12} />}
                      label="CPF"
                      valor={formatCPF(al.cpf)}
                    />
                    <Campo
                      icone={<Calendar size={12} />}
                      label="Nascimento"
                      valor={formatDate(al.data_nascimento)}
                    />
                    <Campo
                      icone={<User size={12} />}
                      label="Sexo"
                      valor={
                        al.sexo === "M"
                          ? "Masculino"
                          : al.sexo === "F"
                            ? "Feminino"
                            : "—"
                      }
                    />
                    <Campo
                      icone={<MapPin size={12} />}
                      label="Naturalidade"
                      valor={
                        al.naturalidade
                          ? `${al.naturalidade}/${al.naturalidade_uf}`
                          : "—"
                      }
                    />

                    {expandirDados && (
                      <>
                        <Campo
                          icone={<Info size={12} />}
                          label="Nacionalidade"
                          valor={al.nacionalidade ?? "—"}
                        />
                        <Campo
                          icone={<Fingerprint size={12} />}
                          label="RG"
                          valor={
                            al.rg
                              ? `${al.rg} ${al.rg_orgao_expedidor ?? ""}/${al.rg_uf ?? ""}`
                              : "—"
                          }
                        />
                        <Campo
                          icone={<Mail size={12} />}
                          label="E-mail"
                          valor={al.email ?? "—"}
                        />
                        <Campo
                          icone={<Phone size={12} />}
                          label="Telefone"
                          valor={al.telefone ?? "—"}
                        />
                        <Campo
                          icone={<BookOpen size={12} />}
                          label="RA"
                          valor={al.ra ?? "—"}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Dados do curso */}
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen size={15} className="text-gray-500" />
                    <h3 className="text-sm font-bold text-gray-800">
                      Dados do curso
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <Campo label="Curso" valor={curso.nome} />
                    <Campo label="Grau" valor={curso.grau} />
                    <Campo label="Modalidade" valor={curso.modalidade ?? "—"} />
                    <Campo
                      label="Carga horária"
                      valor={
                        curso.carga_horaria ? `${curso.carga_horaria}h` : "—"
                      }
                    />
                    <Campo
                      label="Código EMEC"
                      valor={curso.codigo_emec ?? "—"}
                    />
                    <Campo
                      label="Habilitação"
                      valor={curso.habilitacao ?? "—"}
                    />
                    {curso.titulo && (
                      <Campo label="Título conferido" valor={curso.titulo} />
                    )}
                  </div>

                  {/* Código do currículo — editável pela secretaria */}
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-400 min-w-[120px]">
                        Código do currículo
                      </p>
                      {editandoCurriculo ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            autoFocus
                            type="text"
                            value={valorCurriculo}
                            onChange={(e) => setValorCurriculo(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") salvarCurriculo();
                              if (e.key === "Escape")
                                setEditandoCurriculo(false);
                            }}
                            placeholder="Ex: 2017.1"
                            className="flex-1 text-sm border border-blue-300 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200 max-w-[140px]"
                          />
                          <button
                            onClick={salvarCurriculo}
                            disabled={salvandoCurriculo}
                            className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
                          >
                            {salvandoCurriculo ? "..." : "Salvar"}
                          </button>
                          <button
                            onClick={() => setEditandoCurriculo(false)}
                            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <span
                            className={`text-sm font-medium ${diploma.codigo_curriculo ? "text-gray-800" : "text-red-400 italic"}`}
                          >
                            {diploma.codigo_curriculo ?? "Não preenchido"}
                          </span>
                          {!diploma.is_legado && (
                            <button
                              onClick={() => {
                                setValorCurriculo(
                                  diploma.codigo_curriculo ?? "",
                                );
                                setEditandoCurriculo(true);
                              }}
                              className="text-gray-300 hover:text-blue-500 transition ml-1"
                              title="Editar código do currículo"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          {!diploma.codigo_curriculo && (
                            <span className="text-[10px] text-red-400 bg-red-50 px-1.5 py-0.5 rounded-full">
                              Auditoria falha
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Datas do diploma */}
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar size={15} className="text-gray-500" />
                    <h3 className="text-sm font-bold text-gray-800">Datas</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <Campo
                      label="Conclusão"
                      valor={formatDate(diploma.data_conclusao)}
                    />
                    <Campo
                      label="Colação de grau"
                      valor={formatDate(diploma.data_colacao)}
                    />
                    <Campo
                      label="Integralização"
                      valor={formatDate(diploma.data_integralizacao)}
                    />
                    <Campo
                      label="Criado em"
                      valor={formatDatetime(diploma.created_at)}
                    />
                  </div>
                </div>

                {/* Código de validação */}
                {diploma.codigo_validacao && (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                      <Hash size={11} />
                      Código de validação
                    </p>
                    <p className="text-sm font-mono text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">
                      {diploma.codigo_validacao}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Aba: XMLs */}
          {abaAtiva === "xmls" && (
            <div className="space-y-3">
              {diploma.is_legado ? (
                /* Legado: exibir XMLs importados do sistema anterior */
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Archive size={15} className="text-amber-500" />
                    <p className="text-sm font-bold text-gray-800">
                      XMLs do sistema anterior
                    </p>
                    <span className="ml-auto text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                      Legado
                    </span>
                  </div>
                  <div className="p-5">
                    <p className="text-xs text-gray-500 mb-4">
                      Estes XMLs foram gerados, assinados e registrados pela
                      UFMS no sistema anterior à implantação deste ERP. São os
                      documentos finais oficiais deste diploma.
                    </p>
                    <div className="space-y-2.5">
                      {[
                        {
                          label: "HistóricoEscolarDigital",
                          sublabel:
                            "XML do Histórico Escolar — assinado pela FIC e UFMS",
                          path: diploma.legado_xml_dados_path,
                        },
                        {
                          label: "DiplomaDigital",
                          sublabel: "XML do Diploma — registrado pela UFMS",
                          path: diploma.legado_xml_documentos_path,
                        },
                      ].map(({ label, sublabel, path }) => (
                        <div
                          key={label}
                          className="flex items-center gap-3 p-3.5 border border-gray-100 rounded-xl hover:bg-gray-50 transition"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <FileText size={14} className="text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">
                              {label}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {sublabel}
                            </p>
                          </div>
                          {path ? (
                            <a
                              href={`/api/storage-proxy?path=${encodeURIComponent(path)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition"
                            >
                              <Download size={12} /> Baixar
                            </a>
                          ) : (
                            <span className="text-[10px] text-gray-300 flex-shrink-0">
                              Não disponível
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : xmls.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
                  <FileText size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">
                    Nenhum XML gerado ainda
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {["aguardando_revisao", "xml_com_erros"].includes(
                      diploma.status,
                    )
                      ? "Use o painel de ações ao lado para gerar os 2 XMLs obrigatórios."
                      : "Os XMLs serão gerados após a revisão dos dados."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-gray-500">
                      {xmls.length} arquivo{xmls.length !== 1 ? "s" : ""} gerado
                      {xmls.length !== 1 ? "s" : ""}
                      {xmls.length > 0 &&
                        xmls.filter((x) => x.validado_xsd).length ===
                          xmls.length &&
                        " · Todos válidos ✓"}
                    </p>
                    <p className="text-xs text-gray-400">
                      XSD v1.05 · Portaria MEC 70/2025
                    </p>
                  </div>
                  {xmls.map((xml) => (
                    <CardXml key={xml.id} xml={xml} />
                  ))}
                </>
              )}
            </div>
          )}

          {/* Aba: Snapshot Imutável (Fase 0.6) — fonte única dos artefatos oficiais */}
          {abaAtiva === "snapshot" && (
            <AbaSnapshot diplomaId={diploma.id} onAtualizar={carregar} />
          )}

          {/* Aba: Documentos Complementares (Fase 4) */}
          {abaAtiva === "documentos" && (
            <AbaDocumentosComplementares
              diplomaId={diploma.id}
              status={diploma.status}
              onAtualizar={carregar}
              isLegado={diploma.is_legado ?? false}
            />
          )}

          {/* Aba: Acervo Digital (Fase 5) */}
          {abaAtiva === "acervo" && (
            <div className="space-y-4">
              {/* Comprobatórios automáticos (diploma_documentos_comprobatorios) — Sprint 6 */}
              <AbaComprobatoriosMec
                diplomaId={diploma.id}
                status={diploma.status}
                onAtualizar={carregar}
              />
              {/* Uploads manuais de acervo (documentos_digitais) */}
              <AbaAcervoDigital
                diplomaId={diploma.id}
                status={diploma.status}
                onAtualizar={carregar}
              />
            </div>
          )}

          {/* Aba: Histórico */}
          {abaAtiva === "historico" && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-800">
                  Histórico de eventos
                </p>
              </div>
              <div className="p-4">
                <div className="space-y-1 text-xs text-gray-500">
                  <p className="flex items-center gap-2 py-2 border-b border-gray-50">
                    <span className="w-32 text-gray-400">Criado em</span>
                    <span className="text-gray-700">
                      {formatDatetime(diploma.created_at)}
                    </span>
                  </p>
                  <p className="flex items-center gap-2 py-2 border-b border-gray-50">
                    <span className="w-32 text-gray-400">Atualizado em</span>
                    <span className="text-gray-700">
                      {formatDatetime(diploma.updated_at)}
                    </span>
                  </p>
                  {extracao && (
                    <p className="flex items-center gap-2 py-2 border-b border-gray-50">
                      <span className="w-32 text-gray-400">Extração IA</span>
                      <span className="text-gray-700">
                        {formatDatetime(extracao.created_at)} ·{" "}
                        {extracao.status}
                      </span>
                    </p>
                  )}
                  {xmls.length > 0 && (
                    <p className="flex items-center gap-2 py-2 border-b border-gray-50">
                      <span className="w-32 text-gray-400">XMLs gerados</span>
                      <span className="text-gray-700">
                        {formatDatetime(xmls[0].created_at)}
                      </span>
                    </p>
                  )}
                  {docDigital?.assinado_em && (
                    <p className="flex items-center gap-2 py-2 border-b border-gray-50">
                      <span className="w-32 text-gray-400">Assinado</span>
                      <span className="text-emerald-600 font-medium">Sim</span>
                    </p>
                  )}
                  {docDigital?.publicado_em && (
                    <p className="flex items-center gap-2 py-2">
                      <span className="w-32 text-gray-400">Publicado em</span>
                      <span className="font-semibold text-emerald-700">
                        {formatDatetime(docDigital.publicado_em)}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Coluna lateral (1/3) */}
        <div className="space-y-4">
          <PainelAcoes
            diploma={diploma}
            xmls={xmls}
            docDigital={docDigital}
            onAtualizar={carregar}
            onVerDocumentos={() => setAbaAtiva("documentos")}
            sessaoId={extracao?.id}
          />

          {/* Resumo rápido */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Resumo</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">CPF</span>
                <span className="text-gray-700 font-mono">
                  {formatCPF(al.cpf)}
                </span>
              </div>
              {al.ra && (
                <div className="flex justify-between">
                  <span className="text-gray-400">RA</span>
                  <span className="text-gray-700">{al.ra}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-400">XMLs</span>
                {diploma.is_legado ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    Legado
                  </span>
                ) : (
                  <span
                    className={
                      xmls.length > 0 &&
                      xmls.filter((x) => x.validado_xsd).length === xmls.length
                        ? "text-green-600 font-medium"
                        : "text-gray-500"
                    }
                  >
                    {xmls.filter((x) => x.validado_xsd).length}/
                    {xmls.length || 2} válidos
                  </span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status</span>
                <span
                  className={`font-medium px-2 py-0.5 rounded-full text-[10px] ${STATUS_COR[diploma.status] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {STATUS_LABEL[diploma.status]}
                </span>
              </div>
            </div>
          </div>

          {/* Fluxo de assinaturas (editor) */}
          {diploma && (
            <EditorFluxoAssinaturas
              diplomaId={diploma.id}
              diplomaStatus={diploma.status}
            />
          )}

          {/* Atalho para o chat de extração IA */}
          {proc && extracao?.id && (
            <Link
              href={`/diploma/processos/novo/revisao/${extracao.id}`}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:shadow-sm transition-shadow group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                <FolderOpen size={15} className="text-primary-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {proc.nome}
                </p>
                <p className="text-[10px] text-gray-400">Chat IA de extração</p>
              </div>
              <ExternalLink
                size={13}
                className="text-gray-300 group-hover:text-primary-400 transition-colors"
              />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componente campo ───────────────────────────────────────────────────────
function Campo({
  label,
  valor,
  icone,
}: {
  label: string;
  valor: string;
  icone?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">
        {icone}
        {label}
      </p>
      <p className="text-sm text-gray-800">{valor}</p>
    </div>
  );
}
