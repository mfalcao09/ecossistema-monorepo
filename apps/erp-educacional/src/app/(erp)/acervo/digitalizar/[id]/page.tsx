"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Upload, FileText, CheckCircle2, XCircle,
  Clock, AlertTriangle, Loader2, ChevronDown, ChevronUp,
  ScanLine, Hash, Calendar, MapPin, User, Briefcase,
  FileDigit, Eye, Trash2, RefreshCw, Send,
} from "lucide-react";
import type { AcervoLote } from "@/types/acervo";
import { STATUS_LOTE_LABELS, STATUS_LOTE_COR } from "@/types/acervo";
import { TIPO_DOC_LABELS } from "@/types/documentos-digitais";

// ── Tipos ──────────────────────────────────────────────────
interface DocumentoNoLote {
  id: string;
  created_at: string;
  local_digitalizacao: string;
  responsavel_nome: string;
  responsavel_cargo: string | null;
  data_documento_original: string | null;
  numero_documento_original: string | null;
  observacoes_originais: string | null;
  resolucao_dpi: number | null;
  equipamento: string | null;
  documentos_digitais: {
    id: string;
    titulo: string;
    destinatario_nome: string;
    status: string;
    arquivo_url: string | null;
    arquivo_hash_sha256: string | null;
    codigo_verificacao: string | null;
    url_verificacao: string | null;
    origem: string;
  };
}

interface FormUpload {
  arquivo: File | null;
  titulo: string;
  destinatario_nome: string;
  destinatario_cpf: string;
  numero_documento: string;
  data_documento_original: string;
  numero_documento_original: string;
  local_digitalizacao: string;
  responsavel_nome: string;
  responsavel_cargo: string;
  resolucao_dpi: string;
  equipamento: string;
  observacoes: string;
}

// ── Cores de badge ─────────────────────────────────────────
const COR_BADGE: Record<string, string> = {
  gray: "bg-gray-100 text-gray-600",
  blue: "bg-blue-50 text-blue-600",
  yellow: "bg-yellow-50 text-yellow-700",
  orange: "bg-orange-50 text-orange-700",
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-600",
};

const STATUS_DOC_LABELS: Record<string, string> = {
  aguardando_assinatura: "Aguard. Assinatura",
  assinando: "Assinando",
  assinado: "Assinado",
  publicado: "Publicado",
  erro: "Erro",
  rascunho: "Rascunho",
};

const STATUS_DOC_COR: Record<string, string> = {
  aguardando_assinatura: "yellow",
  assinando: "orange",
  assinado: "blue",
  publicado: "green",
  erro: "red",
  rascunho: "gray",
};

// ── Card de documento já no lote ──────────────────────────
function CardDocumento({ meta, onRemover }: { meta: DocumentoNoLote; onRemover?: () => void }) {
  const [expandido, setExpandido] = useState(false);
  const doc = meta.documentos_digitais;
  const cor = STATUS_DOC_COR[doc.status] ?? "gray";

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpandido((v) => !v)}
      >
        {/* Ícone de status */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          doc.status === "publicado" ? "bg-green-50" :
          doc.status === "erro" ? "bg-red-50" : "bg-teal-50"
        }`}>
          {doc.status === "publicado" ? (
            <CheckCircle2 size={15} className="text-green-500" />
          ) : doc.status === "erro" ? (
            <XCircle size={15} className="text-red-400" />
          ) : (
            <Clock size={15} className="text-teal-500" />
          )}
        </div>

        {/* Dados principais */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{doc.titulo}</p>
          <p className="text-xs text-gray-400 truncate">{doc.destinatario_nome}</p>
        </div>

        {/* Badge status */}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${COR_BADGE[cor]}`}>
          {STATUS_DOC_LABELS[doc.status] ?? doc.status}
        </span>

        {/* Expandir */}
        {expandido ? (
          <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
        )}
      </div>

      {expandido && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
          {/* Metadados Decreto 10.278/2020 */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {doc.arquivo_hash_sha256 && (
              <div className="col-span-2">
                <p className="text-gray-400 mb-0.5 flex items-center gap-1"><Hash size={10} />Hash SHA-256</p>
                <p className="font-mono text-gray-600 text-[10px] break-all">{doc.arquivo_hash_sha256}</p>
              </div>
            )}
            <div>
              <p className="text-gray-400 mb-0.5 flex items-center gap-1"><MapPin size={10} />Local digitalização</p>
              <p className="text-gray-700">{meta.local_digitalizacao}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-0.5 flex items-center gap-1"><User size={10} />Responsável</p>
              <p className="text-gray-700">{meta.responsavel_nome}</p>
              {meta.responsavel_cargo && <p className="text-gray-400">{meta.responsavel_cargo}</p>}
            </div>
            {meta.data_documento_original && (
              <div>
                <p className="text-gray-400 mb-0.5 flex items-center gap-1"><Calendar size={10} />Data do doc original</p>
                <p className="text-gray-700">{new Date(meta.data_documento_original + "T12:00:00").toLocaleDateString("pt-BR")}</p>
              </div>
            )}
            {meta.numero_documento_original && (
              <div>
                <p className="text-gray-400 mb-0.5 flex items-center gap-1"><FileDigit size={10} />Nº documento original</p>
                <p className="text-gray-700">{meta.numero_documento_original}</p>
              </div>
            )}
            {meta.resolucao_dpi && (
              <div>
                <p className="text-gray-400 mb-0.5">Resolução</p>
                <p className="text-gray-700">{meta.resolucao_dpi} DPI</p>
              </div>
            )}
            {meta.equipamento && (
              <div>
                <p className="text-gray-400 mb-0.5">Equipamento</p>
                <p className="text-gray-700">{meta.equipamento}</p>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 pt-1">
            {doc.arquivo_url && (
              <a
                href={doc.arquivo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                <Eye size={12} /> Ver arquivo
              </a>
            )}
            {doc.url_verificacao && (
              <a
                href={doc.url_verificacao}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                <CheckCircle2 size={12} /> Verificar autenticidade
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulário de upload de um arquivo ───────────────────
function FormularioUpload({
  lote,
  onSucesso,
}: {
  lote: AcervoLote;
  onSucesso: (doc: DocumentoNoLote) => void;
}) {
  const [form, setForm] = useState<FormUpload>({
    arquivo: null,
    titulo: "",
    destinatario_nome: "",
    destinatario_cpf: "",
    numero_documento: "",
    data_documento_original: "",
    numero_documento_original: "",
    local_digitalizacao: lote.local_digitalizacao_padrao ?? "Secretaria FIC — Cassilândia/MS",
    responsavel_nome: lote.responsavel_padrao_nome ?? "",
    responsavel_cargo: lote.responsavel_padrao_cargo ?? "Assistente de Secretaria",
    resolucao_dpi: "300",
    equipamento: "",
    observacoes: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [progresso, setProgresso] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setForm((prev) => ({ ...prev, arquivo: f }));
    if (f && !form.titulo) {
      // Sugere título baseado no nome do arquivo
      const nome = f.name.replace(/\.pdf$/i, "").replace(/_/g, " ").replace(/-/g, " ");
      setForm((prev) => ({ ...prev, arquivo: f, titulo: nome }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.arquivo) { setErro("Selecione um arquivo PDF."); return; }
    if (!form.titulo || !form.destinatario_nome) {
      setErro("Título e nome do destinatário são obrigatórios.");
      return;
    }

    setErro("");
    setEnviando(true);
    setProgresso(0);

    try {
      const fd = new FormData();
      fd.append("arquivo", form.arquivo);
      fd.append("tipo", lote.tipo);
      fd.append("titulo", form.titulo);
      fd.append("destinatario_nome", form.destinatario_nome);
      if (form.destinatario_cpf) fd.append("destinatario_cpf", form.destinatario_cpf);
      if (form.numero_documento) fd.append("numero_documento", form.numero_documento);
      fd.append("lote_id", lote.id);
      fd.append("local_digitalizacao", form.local_digitalizacao);
      fd.append("responsavel_nome", form.responsavel_nome);
      if (form.responsavel_cargo) fd.append("responsavel_cargo", form.responsavel_cargo);
      if (form.data_documento_original) fd.append("data_documento_original", form.data_documento_original);
      if (form.numero_documento_original) fd.append("numero_documento_original", form.numero_documento_original);
      if (form.observacoes) fd.append("observacoes_originais", form.observacoes);
      if (form.resolucao_dpi) fd.append("resolucao_dpi", form.resolucao_dpi);
      if (form.equipamento) fd.append("equipamento", form.equipamento);

      // Simula progresso de upload
      const interval = setInterval(() => {
        setProgresso((p) => Math.min(p + 15, 85));
      }, 200);

      const res = await fetch("/api/acervo/upload", { method: "POST", body: fd });
      clearInterval(interval);
      setProgresso(100);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro no upload");

      // Monta um DocumentoNoLote simulado para atualizar a lista imediatamente
      const novoDoc: DocumentoNoLote = {
        id: data.documento_id,
        created_at: new Date().toISOString(),
        local_digitalizacao: form.local_digitalizacao,
        responsavel_nome: form.responsavel_nome,
        responsavel_cargo: form.responsavel_cargo || null,
        data_documento_original: form.data_documento_original || null,
        numero_documento_original: form.numero_documento_original || null,
        observacoes_originais: form.observacoes || null,
        resolucao_dpi: form.resolucao_dpi ? parseInt(form.resolucao_dpi) : null,
        equipamento: form.equipamento || null,
        documentos_digitais: {
          id: data.documento_id,
          titulo: form.titulo,
          destinatario_nome: form.destinatario_nome,
          status: "aguardando_assinatura",
          arquivo_url: data.arquivo_url,
          arquivo_hash_sha256: data.hash_sha256,
          codigo_verificacao: data.codigo_verificacao,
          url_verificacao: null,
          origem: "digitalizado",
        },
      };

      onSucesso(novoDoc);

      // Resetar formulário, mantendo metadados padrão
      setForm((prev) => ({
        ...prev,
        arquivo: null,
        titulo: "",
        destinatario_nome: "",
        destinatario_cpf: "",
        numero_documento: "",
        data_documento_original: "",
        numero_documento_original: "",
        observacoes: "",
      }));
      if (fileRef.current) fileRef.current.value = "";
      setProgresso(0);
    } catch (err) {
      setErro((err as Error).message);
      setProgresso(0);
    } finally {
      setEnviando(false);
    }
  };

  const set = (field: keyof FormUpload) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
          <XCircle size={15} className="flex-shrink-0 mt-0.5" />
          {erro}
        </div>
      )}

      {/* Área de drop de arquivo */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">
          Arquivo PDF <span className="text-red-500">*</span>
        </label>
        <label
          htmlFor="arquivo-input"
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-6 py-8 cursor-pointer transition-colors ${
            form.arquivo
              ? "border-teal-300 bg-teal-50"
              : "border-gray-200 hover:border-teal-300 hover:bg-teal-50/30"
          }`}
        >
          {form.arquivo ? (
            <>
              <FileText size={28} className="text-teal-500" />
              <p className="text-sm font-semibold text-teal-700">{form.arquivo.name}</p>
              <p className="text-xs text-teal-500">
                {(form.arquivo.size / 1024 / 1024).toFixed(2)} MB · Clique para trocar
              </p>
            </>
          ) : (
            <>
              <Upload size={28} className="text-gray-300" />
              <p className="text-sm text-gray-500 font-medium">Clique ou arraste um PDF aqui</p>
              <p className="text-xs text-gray-400">Apenas arquivos PDF (máx. 50 MB)</p>
            </>
          )}
        </label>
        <input
          id="arquivo-input"
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleArquivo}
        />
      </div>

      {/* Dados do documento */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dados do documento</p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Título do documento <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            placeholder="Ex: Histórico Escolar — João da Silva"
            value={form.titulo}
            onChange={set("titulo")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nome do aluno / titular <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Nome completo"
              value={form.destinatario_nome}
              onChange={set("destinatario_nome")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">CPF do titular</label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="000.000.000-00"
              value={form.destinatario_cpf}
              onChange={set("destinatario_cpf")}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nº do documento digital</label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Gerado automaticamente se vazio"
              value={form.numero_documento}
              onChange={set("numero_documento")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nº doc. físico original</label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Nº constante no papel"
              value={form.numero_documento_original}
              onChange={set("numero_documento_original")}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Data do documento original</label>
          <input
            type="date"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            value={form.data_documento_original}
            onChange={set("data_documento_original")}
          />
        </div>
      </div>

      {/* Metadados Decreto 10.278/2020 */}
      <div className="space-y-3 border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Metadados obrigatórios — Decreto 10.278/2020
        </p>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
            <MapPin size={11} />Local de digitalização
          </label>
          <input
            type="text"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            value={form.local_digitalizacao}
            onChange={set("local_digitalizacao")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <User size={11} />Responsável pela digitalização
            </label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Nome completo"
              value={form.responsavel_nome}
              onChange={set("responsavel_nome")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
              <Briefcase size={11} />Cargo
            </label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              value={form.responsavel_cargo}
              onChange={set("responsavel_cargo")}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Resolução do scanner (DPI)</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              value={form.resolucao_dpi}
              onChange={set("resolucao_dpi")}
            >
              <option value="200">200 DPI</option>
              <option value="300">300 DPI (recomendado)</option>
              <option value="400">400 DPI</option>
              <option value="600">600 DPI</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Equipamento utilizado</label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Ex: HP ScanJet Pro 3500"
              value={form.equipamento}
              onChange={set("equipamento")}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Observações sobre o original</label>
          <textarea
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            placeholder="Estado de conservação, rasuras, carimbos, etc."
            value={form.observacoes}
            onChange={set("observacoes")}
          />
        </div>
      </div>

      {/* Barra de progresso */}
      {enviando && progresso > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Enviando arquivo e calculando hash SHA-256...</span>
            <span>{progresso}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-teal-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
      )}

      {/* Botão submit */}
      <button
        type="submit"
        disabled={enviando || !form.arquivo}
        className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50"
      >
        {enviando ? (
          <><Loader2 size={16} className="animate-spin" /> Enviando...</>
        ) : (
          <><Upload size={16} /> Enviar arquivo ao lote</>
        )}
      </button>
    </form>
  );
}

// ── Página principal ───────────────────────────────────────
export default function LoteDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [lote, setLote] = useState<AcervoLote | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoNoLote[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [alterandoStatus, setAlterandoStatus] = useState(false);

  const carregarLote = useCallback(() => {
    setLoading(true);
    fetch(`/api/acervo/lotes/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setErro(d.error); return; }
        setLote(d.lote);
        setDocumentos(d.documentos ?? []);
      })
      .catch(() => setErro("Erro ao carregar lote"))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => { carregarLote(); }, [carregarLote]);

  const handleDocumentoCriado = (doc: DocumentoNoLote) => {
    setDocumentos((prev) => [doc, ...prev]);
    // Atualiza contador do lote localmente
    setLote((prev) => prev ? { ...prev, total_docs: (prev.total_docs ?? 0) + 1 } : prev);
  };

  const handleConcluirLote = async () => {
    if (!lote) return;
    setAlterandoStatus(true);
    try {
      await fetch(`/api/acervo/lotes/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "aguardando_assinatura" }),
      });
      setLote((prev) => prev ? { ...prev, status: "aguardando_assinatura" } : prev);
    } catch {}
    finally { setAlterandoStatus(false); }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-64" />
          <div className="h-4 bg-gray-100 rounded w-40" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (erro || !lote) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <XCircle size={32} className="text-red-400 mx-auto mb-2" />
          <p className="text-red-700 font-medium">{erro || "Lote não encontrado"}</p>
          <Link href="/acervo/digitalizar" className="mt-3 inline-block text-sm text-teal-600 hover:underline">
            ← Voltar para lotes
          </Link>
        </div>
      </div>
    );
  }

  const corStatus = STATUS_LOTE_COR[lote.status] ?? "gray";
  const corBadge: Record<string, string> = {
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-50 text-blue-600",
    yellow: "bg-yellow-50 text-yellow-700",
    orange: "bg-orange-50 text-orange-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-600",
  };

  const podeEnviarParaAssinatura = lote.status === "em_andamento" || lote.status === "rascunho";
  const loteConcluido = lote.status === "concluido" || lote.status === "aguardando_assinatura";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div>
        <Link
          href="/acervo/digitalizar"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3 transition-colors"
        >
          <ArrowLeft size={14} /> Todos os lotes
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900">{lote.nome}</h1>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${corBadge[corStatus] ?? corBadge.gray}`}>
                {STATUS_LOTE_LABELS[lote.status]}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {TIPO_DOC_LABELS[lote.tipo as keyof typeof TIPO_DOC_LABELS]}
              {lote.periodo_referencia && ` · ${lote.periodo_referencia}`}
              {" · "}{lote.total_docs ?? 0} documento{(lote.total_docs ?? 0) !== 1 ? "s" : ""}
            </p>
            {lote.descricao && <p className="text-xs text-gray-400 mt-1">{lote.descricao}</p>}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={carregarLote}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Recarregar"
            >
              <RefreshCw size={15} />
            </button>
            {podeEnviarParaAssinatura && (lote.total_docs ?? 0) > 0 && (
              <button
                onClick={handleConcluirLote}
                disabled={alterandoStatus}
                className="flex items-center gap-2 bg-teal-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {alterandoStatus ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
                Enviar para assinatura
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Aviso se lote já foi encaminhado */}
      {loteConcluido && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Lote encaminhado para assinatura.</span>{" "}
            Novos arquivos não podem ser adicionados. Para adicionar mais documentos, crie um novo lote.
          </p>
        </div>
      )}

      {/* Layout em 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* Coluna esquerda — formulário de upload */}
        {!loteConcluido ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <ScanLine size={18} className="text-teal-600" />
              <h2 className="text-sm font-bold text-gray-900">Adicionar documento ao lote</h2>
            </div>
            <FormularioUpload lote={lote} onSucesso={handleDocumentoCriado} />
          </div>
        ) : (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2">
            <Send size={24} className="text-gray-300" />
            <p className="text-sm text-gray-500 font-medium">Lote encaminhado</p>
            <p className="text-xs text-gray-400">Não é possível adicionar novos arquivos</p>
            <Link
              href="/acervo/digitalizar"
              className="mt-2 text-xs text-teal-600 hover:underline font-medium"
            >
              Criar novo lote →
            </Link>
          </div>
        )}

        {/* Coluna direita — lista de documentos */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">
              Documentos no lote
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({documentos.length})
              </span>
            </h2>
          </div>

          {documentos.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
              <FileText size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhum documento adicionado ainda</p>
              <p className="text-xs text-gray-300 mt-1">Use o formulário ao lado para adicionar PDFs</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {documentos.map((meta) => (
                <CardDocumento key={meta.id} meta={meta} />
              ))}
            </div>
          )}

          {/* Resumo do lote */}
          {documentos.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 mt-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resumo do lote</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900">{lote.total_docs ?? 0}</p>
                  <p className="text-xs text-gray-400">Total</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-teal-600">{lote.processados ?? 0}</p>
                  <p className="text-xs text-gray-400">Processados</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-500">{lote.com_erro ?? 0}</p>
                  <p className="text-xs text-gray-400">Com erro</p>
                </div>
              </div>
              {(lote.total_docs ?? 0) > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progresso geral</span>
                    <span>{Math.round(((lote.processados ?? 0) / (lote.total_docs ?? 1)) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-teal-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.round(((lote.processados ?? 0) / (lote.total_docs ?? 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Aviso metadados obrigatórios */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Cada arquivo recebe automaticamente <strong>hash SHA-256</strong> e
              metadados do <strong>Decreto 10.278/2020</strong>. A assinatura
              ICP-Brasil é aplicada ao encaminhar o lote.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
