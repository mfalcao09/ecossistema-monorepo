"use client";

// ============================================================
// SELEÇÃO DE DOCUMENTOS COMPROBATÓRIOS — Diploma Digital (Bug #F)
//
// Componente da secretaria para escolher quais arquivos do processo
// serão embutidos em base64 no XML DocumentacaoAcademicaRegistro
// (elemento <DocumentacaoComprobatoria><Documento>).
//
// REGRAS XSD v1.05:
// - Mínimo 1 <Documento> no <DocumentacaoComprobatoria>
// - Cada <Documento> tem 2 atributos XML: `tipo` (enum 9 valores) e
//   `observacoes` (livre até 500 chars). O corpo é o PDF/A em base64.
// - Número do documento, órgão emissor, UF e data de expedição ficam
//   como metadata INTERNA do ERP (rastreabilidade) — não vão para o XML.
//
// FLUXO:
// 1. Componente lista TODOS os arquivos do processo (processo_arquivos)
// 2. Secretaria seleciona manualmente quais serão comprobatórios (regra de negócio)
// 3. Ao selecionar, escolhe o tipo_xsd (pré-sugerido via palavras-chave)
// 4. Pode editar ou remover uma seleção a qualquer momento
// 5. A conversão PDF/A acontece LAZY no gerador XML, não aqui
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Trash2,
  Edit3,
  Check,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Info,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────

// 9 valores funcionais do enum TTipoDocumentacao do XSD v1.05
export const TIPO_XSD_VALUES = [
  "DocumentoIdentidadeDoAluno",
  "ProvaConclusaoEnsinoMedio",
  "ProvaColacao",
  "ComprovacaoEstagioCurricular",
  "CertidaoNascimento",
  "CertidaoCasamento",
  "TituloEleitor",
  "AtoNaturalizacao",
  "Outros",
] as const;
export type TipoXsd = (typeof TIPO_XSD_VALUES)[number];

const LABEL_TIPO_XSD: Record<TipoXsd, string> = {
  DocumentoIdentidadeDoAluno: "Documento de identidade do aluno",
  ProvaConclusaoEnsinoMedio: "Prova de conclusão do ensino médio",
  ProvaColacao: "Prova de colação de grau",
  ComprovacaoEstagioCurricular: "Comprovação de estágio curricular",
  CertidaoNascimento: "Certidão de nascimento",
  CertidaoCasamento: "Certidão de casamento",
  TituloEleitor: "Título de eleitor",
  AtoNaturalizacao: "Ato de naturalização",
  Outros: "Outros",
};

interface ArquivoItem {
  id: string;
  nome_original: string;
  tipo_documento: string | null;
  mime_type: string;
  tamanho_bytes: number;
  created_at: string;
  url_preview: string | null;
}

interface Selecao {
  id: string;
  arquivo_origem_id: string;
  tipo_xsd: TipoXsd;
  numero_documento: string | null;
  orgao_emissor: string | null;
  uf_emissor: string | null;
  data_expedicao: string | null;
  observacao: string | null;
  pdfa_converted_at: string | null;
  pdfa_validation_ok: boolean | null;
  selecionado_em: string;
}

interface ItemResposta {
  arquivo: ArquivoItem;
  tipo_xsd_sugerido: TipoXsd;
  selecao: Selecao | null;
  selecionado: boolean;
}

interface Resposta {
  processo_id: string;
  total_arquivos: number;
  total_selecionados: number;
  minimo_exigido: number;
  atende_minimo: boolean;
  itens: ItemResposta[];
}

interface FormState {
  tipo_xsd: TipoXsd;
  numero_documento: string;
  orgao_emissor: string;
  uf_emissor: string;
  data_expedicao: string;
  observacao: string;
}

interface Props {
  processoId: string;
  /** Callback disparado quando a lista muda (útil para contador no pai) */
  onMudou?: (resumo: { total: number; selecionados: number; atende_minimo: boolean }) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function formatData(iso: string): string {
  // Regex + noon UTC — evita drift de timezone (feedback_supabase_promiselike-like)
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const date = new Date(`${y}-${mo}-${d}T12:00:00Z`);
  return date.toLocaleDateString("pt-BR");
}

function mimeBadge(mime: string): { label: string; className: string; Icon: typeof FileText } {
  if (mime === "application/pdf") {
    return { label: "PDF", className: "bg-red-100 text-red-700", Icon: FileText };
  }
  if (mime.startsWith("image/")) {
    const ext = mime.split("/")[1]?.toUpperCase() || "IMG";
    return { label: ext, className: "bg-blue-100 text-blue-700", Icon: ImageIcon };
  }
  return { label: "FILE", className: "bg-slate-100 text-slate-700", Icon: FileIcon };
}

function formVazio(tipoSugerido: TipoXsd): FormState {
  return {
    tipo_xsd: tipoSugerido,
    numero_documento: "",
    orgao_emissor: "",
    uf_emissor: "",
    data_expedicao: "",
    observacao: "",
  };
}

function formDaSelecao(sel: Selecao): FormState {
  return {
    tipo_xsd: sel.tipo_xsd,
    numero_documento: sel.numero_documento ?? "",
    orgao_emissor: sel.orgao_emissor ?? "",
    uf_emissor: sel.uf_emissor ?? "",
    data_expedicao: sel.data_expedicao ?? "",
    observacao: sel.observacao ?? "",
  };
}

// ─── Componente principal ────────────────────────────────────────────────

export default function SelecaoComprobatorios({ processoId, onMudou }: Props) {
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroFetch, setErroFetch] = useState<string | null>(null);
  const [dialogAberto, setDialogAberto] = useState<{
    arquivoId: string;
    tipoSugerido: TipoXsd;
    modoEdicao: boolean; // true = editando seleção existente
    ddcId: string | null;
  } | null>(null);
  const [metadataAberta, setMetadataAberta] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroFetch(null);
    try {
      const res = await fetch(`/api/processos/${processoId}/documentos-comprobatorios`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Falha ${res.status} ao carregar`);
      }
      const data: Resposta = await res.json();
      setResposta(data);
      onMudou?.({
        total: data.total_arquivos,
        selecionados: data.total_selecionados,
        atende_minimo: data.atende_minimo,
      });
    } catch (err) {
      setErroFetch(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  }, [processoId, onMudou]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Header
  const header = useMemo(() => {
    if (!resposta) return null;
    const { total_arquivos, total_selecionados, atende_minimo, minimo_exigido } = resposta;
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {total_selecionados} de {total_arquivos} arquivo{total_arquivos === 1 ? "" : "s"} selecionado{total_selecionados === 1 ? "" : "s"}
          </div>
          {atende_minimo ? (
            <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-1.5 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              Mínimo XSD atendido
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              Mínimo {minimo_exigido} comprobatório exigido pelo XSD v1.05
            </div>
          )}
        </div>
        <button
          onClick={() => void carregar()}
          disabled={carregando}
          className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          Recarregar
        </button>
      </div>
    );
  }, [resposta, carregando, carregar]);

  // Loading skeleton
  if (carregando && !resposta) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-80 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  // Erro de fetch
  if (erroFetch && !resposta) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-5 w-5" />
          Erro ao carregar comprobatórios
        </div>
        <p className="mt-1 text-sm">{erroFetch}</p>
        <button
          onClick={() => void carregar()}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Empty state
  if (resposta && resposta.total_arquivos === 0) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <FileIcon className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-2 text-sm text-slate-600">
            Nenhum arquivo anexado ao processo ainda. Faça o upload dos documentos na aba anterior antes de selecionar os comprobatórios.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {resposta?.itens.map((item) => (
          <CardArquivo
            key={item.arquivo.id}
            item={item}
            onSelecionar={(arquivoId, tipoSugerido) =>
              setDialogAberto({
                arquivoId,
                tipoSugerido,
                modoEdicao: false,
                ddcId: null,
              })
            }
            onEditar={(arquivoId, tipoSugerido, ddcId) =>
              setDialogAberto({
                arquivoId,
                tipoSugerido,
                modoEdicao: true,
                ddcId,
              })
            }
            onRemover={async (ddcId) => {
              if (!confirm("Remover esta seleção? O arquivo continua no processo.")) return;
              try {
                const res = await fetch(
                  `/api/processos/${processoId}/documentos-comprobatorios?ddc_id=${ddcId}`,
                  { method: "DELETE", cache: "no-store" }
                );
                if (!res.ok) {
                  const body = await res.json().catch(() => ({}));
                  alert(body.error || `Erro ${res.status}`);
                  return;
                }
                void carregar();
              } catch (err) {
                alert(err instanceof Error ? err.message : "Erro ao remover");
              }
            }}
          />
        ))}
      </div>

      {dialogAberto && resposta && (
        <DialogSelecao
          processoId={processoId}
          estado={dialogAberto}
          selecaoAtual={
            dialogAberto.modoEdicao
              ? resposta.itens.find((i) => i.arquivo.id === dialogAberto.arquivoId)?.selecao || null
              : null
          }
          metadataAberta={metadataAberta}
          setMetadataAberta={setMetadataAberta}
          onFechar={() => setDialogAberto(null)}
          onSucesso={() => {
            setDialogAberto(null);
            void carregar();
          }}
        />
      )}
    </div>
  );
}

// ─── Card de arquivo individual ───────────────────────────────────────────

interface CardProps {
  item: ItemResposta;
  onSelecionar: (arquivoId: string, tipoSugerido: TipoXsd) => void;
  onEditar: (arquivoId: string, tipoSugerido: TipoXsd, ddcId: string) => void;
  onRemover: (ddcId: string) => void | Promise<void>;
}

function CardArquivo({ item, onSelecionar, onEditar, onRemover }: CardProps) {
  const { arquivo, tipo_xsd_sugerido, selecao, selecionado } = item;
  const badge = mimeBadge(arquivo.mime_type);

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm transition ${
        selecionado ? "border-amber-400 ring-1 ring-amber-200" : "border-slate-200"
      }`}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${badge.className}`}
              title={arquivo.mime_type}
            >
              {badge.label}
            </span>
            {selecionado && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Selecionado
              </span>
            )}
          </div>
          <p
            className="mt-1.5 truncate text-sm font-medium text-slate-900"
            title={arquivo.nome_original}
          >
            {arquivo.nome_original}
          </p>
        </div>
      </div>

      {/* Preview — usa proxy para evitar bloqueio de CSP/CORS do Supabase */}
      <div className="relative h-48 bg-slate-50">
        {arquivo.url_preview && arquivo.mime_type === "application/pdf" ? (
          <iframe
            src={`/api/storage-proxy?url=${encodeURIComponent(arquivo.url_preview)}#toolbar=0&navpanes=0`}
            title={arquivo.nome_original}
            className="h-full w-full border-0"
          />
        ) : arquivo.url_preview && arquivo.mime_type.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/storage-proxy?url=${encodeURIComponent(arquivo.url_preview)}`}
            alt={arquivo.nome_original}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <badge.Icon className="h-12 w-12" />
          </div>
        )}
        {arquivo.url_preview && (
          <a
            href={arquivo.url_preview}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-white/90 px-2 py-1 text-xs text-slate-700 shadow hover:bg-white"
          >
            <ExternalLink className="h-3 w-3" />
            Abrir
          </a>
        )}
      </div>

      {/* Metadata */}
      <div className="space-y-1 border-t border-slate-100 p-3 text-xs text-slate-600">
        <div>
          <span className="font-medium text-slate-500">Tipo (origem):</span>{" "}
          {arquivo.tipo_documento || "—"}
        </div>
        <div className="flex justify-between">
          <span>{formatBytes(arquivo.tamanho_bytes)}</span>
          <span>{formatData(arquivo.created_at)}</span>
        </div>
      </div>

      {/* Ações */}
      <div className="mt-auto border-t border-slate-100 p-3">
        {selecao ? (
          <div className="space-y-2">
            <div className="rounded-md bg-slate-50 p-2 text-xs">
              <div className="font-semibold text-slate-900">
                {LABEL_TIPO_XSD[selecao.tipo_xsd]}
              </div>
              {selecao.observacao && (
                <div className="mt-1 italic text-slate-600">&ldquo;{selecao.observacao}&rdquo;</div>
              )}
              <div className="mt-1.5 flex items-center gap-2">
                <StatusPdfA selecao={selecao} />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEditar(arquivo.id, tipo_xsd_sugerido, selecao.id)}
                className="flex flex-1 items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar
              </button>
              <button
                onClick={() => void onRemover(selecao.id)}
                className="flex items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                title="Remover seleção"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => onSelecionar(arquivo.id, tipo_xsd_sugerido)}
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Selecionar como comprobatório
          </button>
        )}
      </div>
    </div>
  );
}

function StatusPdfA({ selecao }: { selecao: Selecao }) {
  if (selecao.pdfa_validation_ok === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
        <ShieldCheck className="h-3 w-3" /> PDF/A válido
      </span>
    );
  }
  if (selecao.pdfa_validation_ok === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
        <ShieldAlert className="h-3 w-3" /> PDF/A com avisos
      </span>
    );
  }
  if (selecao.pdfa_converted_at) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
        <Info className="h-3 w-3" /> veraPDF indisponível
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
      <Clock className="h-3 w-3" /> Aguardando conversão
    </span>
  );
}

// ─── Dialog de seleção/edição ─────────────────────────────────────────────

interface DialogProps {
  processoId: string;
  estado: {
    arquivoId: string;
    tipoSugerido: TipoXsd;
    modoEdicao: boolean;
    ddcId: string | null;
  };
  selecaoAtual: Selecao | null;
  metadataAberta: boolean;
  setMetadataAberta: (b: boolean) => void;
  onFechar: () => void;
  onSucesso: () => void;
}

function DialogSelecao({
  processoId,
  estado,
  selecaoAtual,
  metadataAberta,
  setMetadataAberta,
  onFechar,
  onSucesso,
}: DialogProps) {
  const [form, setForm] = useState<FormState>(() =>
    selecaoAtual ? formDaSelecao(selecaoAtual) : formVazio(estado.tipoSugerido)
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const atualizar = useCallback(<K extends keyof FormState>(key: K, valor: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: valor }));
  }, []);

  const salvar = useCallback(async () => {
    setSalvando(true);
    setErro(null);
    try {
      // Em modo edição: DELETE + POST (a rota não tem PATCH, reaproveitamos).
      // Só deleta DEPOIS de confirmar que o POST vai ter sucesso? Não —
      // a estratégia é criar primeiro e depois deletar o antigo. Porém
      // a unique (processo_id, arquivo_origem_id) ativa sem deleted_at
      // impediria isso. Então: delete primeiro, insert depois.
      // Risco: se o POST falhar, perdemos a seleção antiga. Aceitável por
      // enquanto — num futuro refactor dá pra adicionar PATCH na rota.
      if (estado.modoEdicao && estado.ddcId) {
        const del = await fetch(
          `/api/processos/${processoId}/documentos-comprobatorios?ddc_id=${estado.ddcId}`,
          { method: "DELETE", cache: "no-store" }
        );
        if (!del.ok) {
          const body = await del.json().catch(() => ({}));
          throw new Error(body.error || `Falha ao atualizar (DELETE ${del.status})`);
        }
      }

      const payload: Record<string, unknown> = {
        arquivo_origem_id: estado.arquivoId,
        tipo_xsd: form.tipo_xsd,
        numero_documento: form.numero_documento.trim() || null,
        orgao_emissor: form.orgao_emissor.trim() || null,
        uf_emissor: form.uf_emissor.trim().toUpperCase() || null,
        data_expedicao: form.data_expedicao || null,
        observacao: form.observacao.trim() || null,
      };

      const res = await fetch(`/api/processos/${processoId}/documentos-comprobatorios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // feedback_api_error_body: nunca jogar mensagem genérica
        const msg =
          body.error ||
          (body.detalhes && JSON.stringify(body.detalhes)) ||
          `Erro ${res.status}`;
        throw new Error(msg);
      }

      onSucesso();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }, [estado, form, processoId, onSucesso]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && !salvando && onFechar()}
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {estado.modoEdicao ? "Editar seleção" : "Selecionar comprobatório"}
          </h3>
          <button
            onClick={onFechar}
            disabled={salvando}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="space-y-5 p-4">
          {/* Tipo XSD */}
          <div>
            <label className="block text-sm font-medium text-slate-900">
              Categoria funcional (XSD v1.05) <span className="text-red-500">*</span>
            </label>
            <select
              value={form.tipo_xsd}
              onChange={(e) => atualizar("tipo_xsd", e.target.value as TipoXsd)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={salvando}
            >
              {TIPO_XSD_VALUES.map((v) => (
                <option key={v} value={v}>
                  {LABEL_TIPO_XSD[v]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Esta é a categoria que vai no atributo <code>tipo</code> do elemento
              <code> &lt;Documento&gt;</code> no XML.
            </p>
          </div>

          {/* Observação (vai pro XML) */}
          <div>
            <label className="block text-sm font-medium text-slate-900">
              Observação (vai para o XML)
            </label>
            <textarea
              value={form.observacao}
              onChange={(e) => atualizar("observacao", e.target.value.slice(0, 500))}
              rows={3}
              placeholder='Ex: "Documento emitido em duplicidade por perda"'
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              disabled={salvando}
            />
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>
                Aparece como atributo <code>observacoes</code> do <code>&lt;Documento&gt;</code>.
              </span>
              <span>{form.observacao.length}/500</span>
            </div>
          </div>

          {/* Metadata interna (collapse) */}
          <div className="rounded-md border border-slate-200">
            <button
              type="button"
              onClick={() => setMetadataAberta(!metadataAberta)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4 text-slate-500" />
                Metadata interna (opcional — não vai para o XML)
              </span>
              <span className="text-xs text-slate-500">
                {metadataAberta ? "Ocultar" : "Mostrar"}
              </span>
            </button>
            {metadataAberta && (
              <div className="space-y-3 border-t border-slate-200 p-3">
                <p className="text-xs text-slate-500">
                  Estes campos ficam no banco para rastreabilidade e auditoria.
                  O XSD v1.05 não carrega estes dados no XML.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Número do documento
                    </label>
                    <input
                      type="text"
                      value={form.numero_documento}
                      maxLength={50}
                      onChange={(e) => atualizar("numero_documento", e.target.value)}
                      className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      disabled={salvando}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Órgão emissor
                    </label>
                    <input
                      type="text"
                      value={form.orgao_emissor}
                      maxLength={50}
                      onChange={(e) => atualizar("orgao_emissor", e.target.value)}
                      placeholder="SSP"
                      className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      disabled={salvando}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">UF</label>
                    <input
                      type="text"
                      value={form.uf_emissor}
                      maxLength={2}
                      onChange={(e) => atualizar("uf_emissor", e.target.value.toUpperCase())}
                      placeholder="SP"
                      className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm uppercase"
                      disabled={salvando}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Data de expedição
                    </label>
                    <input
                      type="date"
                      value={form.data_expedicao}
                      onChange={(e) => atualizar("data_expedicao", e.target.value)}
                      className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      disabled={salvando}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Erro */}
          {erro && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="flex-1">{erro}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-100 p-4">
          <button
            onClick={onFechar}
            disabled={salvando}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => void salvar()}
            disabled={salvando}
            className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Salvar seleção
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
