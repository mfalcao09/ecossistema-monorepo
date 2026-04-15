"use client";

import { useState, useEffect, useRef } from "react";
import {
  Building2, Plus, Pencil, Trash2, Sparkles, ChevronRight, ChevronDown,
  CheckCircle2, MapPin, FileText, Settings2, UserCog, AlertTriangle,
  Clock, BadgeCheck, Upload, X, Loader2, Save, RefreshCw, PlusCircle,
  AlertCircle, Calendar, ExternalLink, Paperclip,
} from "lucide-react";
import SmartCNPJInput from "@/components/ai/SmartCNPJInput";
import SmartCodigoMECInput from "@/components/ai/SmartCodigoMECInput";
import type { MECVinculoData } from "@/components/ai/SmartCodigoMECInput";
import AIAssistant from "@/components/ai/AIAssistant";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Credenciamento {
  id?: string;
  tipo: "credenciamento" | "recredenciamento";
  vigente: boolean;
  tipo_ato: string;
  numero: string;
  data: string;
  veiculo_publicacao: string;
  numero_dou: string;
  data_publicacao_dou: string;
  secao_dou: string;
  pagina_dou: string;
  data_vencimento: string;
  alerta_renovacao_dias: number;
  observacoes: string;
  arquivo_url: string;
}

interface Diretor {
  id?: string;
  cargo: string;
  cargo_ordem: number;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  ato_nomeacao: string;
  ato_arquivo_url: string;
  ativo: boolean;
}

interface CampoAdicional {
  chave: string;
  label: string;
  bloco: string;
  tipo: "texto" | "data" | "numero" | "url";
  valor: string;
  obrigatorio: boolean;
}

interface Instituicao {
  id: string;
  tipo: "emissora";
  nome: string;
  cnpj: string;
  codigo_mec: string;
  razao_social: string;
  nome_secretaria: string;
  ato_secretaria: string;
  ato_estabelecimento: string;
  // Mantenedora embedded
  mantenedora_nome: string;
  mantenedora_cnpj: string;
  mantenedora_razao_social: string;
  mantenedora_codigo_mec: string;
  // Endereço
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  codigo_municipio_mec: string;
  uf: string;
  cep: string;
  pais: string;
  latitude: string;
  longitude: string;
  // Extras
  organograma_url: string;
  campos_adicionais_schema: CampoAdicional[];
  ativo: boolean;
}

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC",
  "SP","SE","TO",
];

const CARGOS_PADRAO = [
  { cargo: "Diretor Geral", ordem: 0 },
  { cargo: "Diretor Acadêmico", ordem: 1 },
  { cargo: "Diretor Financeiro", ordem: 2 },
];

const EMPTY_FORM: Omit<Instituicao, "id"> = {
  tipo: "emissora",
  nome: "", cnpj: "", codigo_mec: "", razao_social: "",
  nome_secretaria: "", ato_secretaria: "", ato_estabelecimento: "",
  mantenedora_nome: "", mantenedora_cnpj: "", mantenedora_razao_social: "", mantenedora_codigo_mec: "",
  logradouro: "", numero: "", complemento: "", bairro: "",
  municipio: "", codigo_municipio_mec: "", uf: "", cep: "", pais: "Brasil",
  latitude: "", longitude: "",
  organograma_url: "",
  campos_adicionais_schema: [],
  ativo: true,
};

const EMPTY_CRED: Credenciamento = {
  tipo: "credenciamento", vigente: true,
  tipo_ato: "Portaria", numero: "", data: "",
  veiculo_publicacao: "DOU", numero_dou: "", data_publicacao_dou: "",
  secao_dou: "", pagina_dou: "",
  data_vencimento: "", alerta_renovacao_dias: 180, observacoes: "", arquivo_url: "",
};

const EMPTY_DIRETOR: Omit<Diretor, "id"> = {
  cargo: "", cargo_ordem: 99, nome: "", cpf: "", email: "",
  telefone: "", ato_nomeacao: "", ato_arquivo_url: "", ativo: true,
};

// ─── Utilitários ──────────────────────────────────────────────────────────────
function formatCNPJ(v: string) {
  const n = v.replace(/\D/g, "");
  if (n.length !== 14) return v;
  return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
function formatCPF(v: string) {
  const n = v.replace(/\D/g, "").slice(0, 11);
  return n.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function formatCEP(v: string) {
  const n = v.replace(/\D/g, "").slice(0, 8);
  return n.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}
function formatTel(v: string) {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return v;
}

function diasParaVencer(data: string): number | null {
  if (!data) return null;
  const diff = new Date(data).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── FormSection ──────────────────────────────────────────────────────────────
function FormSection({ title, icon: Icon, children, defaultOpen = true, cor = "text-blue-600" }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean; cor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border border-gray-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className={cor} />
          <h3 className={`text-sm font-bold uppercase tracking-wide ${cor}`}>{title}</h3>
        </div>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </section>
  );
}

// ─── Componente de Credenciamento ─────────────────────────────────────────────
function CredenciamentoCard({
  cred, index, onChange, onRemove, isLast, hasRecredenciamentoVigente,
}: {
  cred: Credenciamento; index: number; onChange: (idx: number, field: string, val: string | boolean | number) => void;
  onRemove: (idx: number) => void; isLast: boolean;
  hasRecredenciamentoVigente: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dias = diasParaVencer(cred.data_vencimento);
  const vencido = dias !== null && dias < 0;
  const alerta = dias !== null && dias >= 0 && dias <= 180;
  const vencimentoDesabilitado = cred.tipo === "credenciamento" && hasRecredenciamentoVigente;

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Se já tem ID real, passa; senão usa índice como chave temporária
      if (cred.id && !String(cred.id).startsWith("new_")) {
        fd.append("credenciamento_id", String(cred.id));
      } else {
        fd.append("temp_key", `new_${index}_${Date.now()}`);
      }
      const res = await fetch("/api/credenciamentos/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Falha no upload");
      const { url } = await res.json();
      onChange(index, "arquivo_url", url);
    } catch {
      alert("Erro ao fazer upload. Tente novamente.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className={`border rounded-xl p-4 mb-3 ${
      vencido ? "border-red-200 bg-red-50/30" : alerta ? "border-amber-200 bg-amber-50/30" : "border-gray-200 bg-white"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            cred.tipo === "credenciamento" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
          }`}>
            {cred.tipo === "credenciamento" ? "Credenciamento" : "Recredenciamento"}
          </span>
          {cred.vigente && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Vigente</span>
          )}
          {vencido && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={10} /> Vencido</span>}
          {alerta && !vencido && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock size={10} /> Vence em {dias} dias</span>}
        </div>
        <div className="flex items-center gap-2">
          {!cred.vigente && (
            <button type="button" onClick={() => onChange(index, "vigente", true)}
              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
              Definir como vigente
            </button>
          )}
          {!isLast && (
            <button type="button" onClick={() => onRemove(index)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <select value={cred.tipo} onChange={e => onChange(index, "tipo", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none">
            <option value="credenciamento">Credenciamento</option>
            <option value="recredenciamento">Recredenciamento</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo de Ato</label>
          <input value={cred.tipo_ato} onChange={e => onChange(index, "tipo_ato", e.target.value)}
            placeholder="Portaria, Resolução..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Número</label>
          <input value={cred.numero} onChange={e => onChange(index, "numero", e.target.value)}
            placeholder="Ex: 1606" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data do Ato</label>
          <input type="date" value={cred.data} onChange={e => onChange(index, "data", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
        </div>
        <div>
          <label className={`block text-xs mb-1 flex items-center gap-1 ${vencimentoDesabilitado ? "text-gray-300" : "text-gray-500"}`}>
            <Calendar size={11} /> Vencimento / Prazo
            {vencimentoDesabilitado && (
              <span className="ml-1 text-xs text-amber-500 font-medium">(controlado pelo recredenciamento vigente)</span>
            )}
          </label>
          <input type="date" value={cred.data_vencimento} onChange={e => onChange(index, "data_vencimento", e.target.value)}
            disabled={vencimentoDesabilitado}
            title={vencimentoDesabilitado ? "Há um recredenciamento vigente — o controle de prazo é feito por ele" : undefined}
            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors ${
              vencimentoDesabilitado
                ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
                : "border-gray-300 focus:ring-2 focus:ring-blue-400"
            }`} />
        </div>
        <div>
          <label className={`block text-xs mb-1 ${vencimentoDesabilitado ? "text-gray-300" : "text-gray-500"}`}>
            Alertar (dias antes)
          </label>
          <input type="number" value={cred.alerta_renovacao_dias} onChange={e => onChange(index, "alerta_renovacao_dias", Number(e.target.value))}
            disabled={vencimentoDesabilitado}
            min={30} max={730}
            title={vencimentoDesabilitado ? "Há um recredenciamento vigente — o alerta é controlado por ele" : undefined}
            className={`w-full px-3 py-2 border rounded-lg text-sm outline-none transition-colors ${
              vencimentoDesabilitado
                ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
                : "border-gray-300 focus:ring-2 focus:ring-blue-400"
            }`} />
        </div>
      </div>

      {/* Dados DOU */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Publicação no DOU</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Veículo</label>
            <input value={cred.veiculo_publicacao} onChange={e => onChange(index, "veiculo_publicacao", e.target.value)}
              placeholder="DOU" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nº DOU</label>
            <input value={cred.numero_dou} onChange={e => onChange(index, "numero_dou", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data Publicação</label>
            <input type="date" value={cred.data_publicacao_dou} onChange={e => onChange(index, "data_publicacao_dou", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Seção</label>
              <input value={cred.secao_dou} onChange={e => onChange(index, "secao_dou", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Página</label>
              <input value={cred.pagina_dou} onChange={e => onChange(index, "pagina_dou", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Upload do documento oficial (DOU/portaria) */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Paperclip size={13} className="text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500 shrink-0">Documento oficial:</span>
            {cred.arquivo_url ? (
              <a
                href={cred.arquivo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline truncate"
              >
                <ExternalLink size={11} className="shrink-0" />
                <span className="truncate">
                  {decodeURIComponent(cred.arquivo_url.split("/").pop() ?? "Ver arquivo")}
                </span>
              </a>
            ) : (
              <span className="text-xs text-gray-400 italic">Nenhum arquivo anexado</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {cred.arquivo_url && (
              <button
                type="button"
                onClick={() => onChange(index, "arquivo_url", "")}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
                title="Remover referência ao arquivo"
              >
                <X size={13} />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <><Loader2 size={12} className="animate-spin" />Enviando…</>
              ) : (
                <><Upload size={12} />{cred.arquivo_url ? "Substituir" : "Anexar PDF / imagem"}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente de Diretor ────────────────────────────────────────────────────
function DiretorCard({
  diretor, index, onChange, onRemove, cargosExistentes,
}: {
  diretor: Diretor; index: number; onChange: (idx: number, field: string, val: string) => void;
  onRemove: (idx: number) => void; cargosExistentes: string[];
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 mb-3 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">{index + 1}</span>
          <input value={diretor.cargo} onChange={e => onChange(index, "cargo", e.target.value)}
            placeholder="Nome do cargo (ex: Diretor Geral)"
            className="text-sm font-semibold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-400 outline-none px-1 w-52" />
        </div>
        <button type="button" onClick={() => onRemove(index)}
          className="p-1 text-gray-300 hover:text-red-500 transition-colors">
          <X size={15} />
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Nome completo</label>
          <input value={diretor.nome} onChange={e => onChange(index, "nome", e.target.value)}
            placeholder="Nome completo do diretor"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">CPF</label>
          <input value={diretor.cpf} onChange={e => onChange(index, "cpf", formatCPF(e.target.value))}
            placeholder="000.000.000-00"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Telefone</label>
          <input value={diretor.telefone} onChange={e => onChange(index, "telefone", formatTel(e.target.value))}
            placeholder="(00) 00000-0000"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">E-mail</label>
          <input type="email" value={diretor.email} onChange={e => onChange(index, "email", e.target.value)}
            placeholder="email@fic.edu.br"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Ato de Nomeação</label>
          <input value={diretor.ato_nomeacao} onChange={e => onChange(index, "ato_nomeacao", e.target.value)}
            placeholder="Ex: Portaria n. 789/2024"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
        </div>
      </div>
    </div>
  );
}

// Converte todos os campos null de uma instituição para string vazia
// evitando crashes em componentes que chamam .replace() em valores null
function sanitizeInstituicao(inst: Instituicao): Omit<Instituicao, "id"> {
  const STRING_FIELDS: (keyof Omit<Instituicao, "id" | "ativo" | "campos_adicionais_schema">)[] = [
    "tipo", "nome", "cnpj", "codigo_mec", "razao_social",
    "nome_secretaria", "ato_secretaria", "ato_estabelecimento",
    "mantenedora_nome", "mantenedora_cnpj", "mantenedora_razao_social", "mantenedora_codigo_mec",
    "logradouro", "numero", "complemento", "bairro",
    "municipio", "codigo_municipio_mec", "uf", "cep", "pais",
    "latitude", "longitude", "organograma_url",
  ];
  const sanitized = { ...inst } as Record<string, unknown>;
  for (const field of STRING_FIELDS) {
    if (sanitized[field] === null || sanitized[field] === undefined) {
      sanitized[field] = "";
    }
  }
  sanitized.campos_adicionais_schema = inst.campos_adicionais_schema ?? [];
  return sanitized as Omit<Instituicao, "id">;
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function IESPage() {
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Instituicao, "id">>(EMPTY_FORM);
  const [credenciamentos, setCredenciamentos] = useState<Credenciamento[]>([{ ...EMPTY_CRED }]);
  const [diretores, setDiretores] = useState<Diretor[]>(
    CARGOS_PADRAO.map(c => ({ ...EMPTY_DIRETOR, cargo: c.cargo, cargo_ordem: c.ordem }))
  );
  const [novoCampoDialog, setNovoCampoDialog] = useState(false);
  const [novoCampo, setNovoCampo] = useState<CampoAdicional>({
    chave: "", label: "", bloco: "Dados Gerais", tipo: "texto", valor: "", obrigatorio: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mecPreview, setMecPreview] = useState<MECVinculoData | null>(null);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [novoCargo, setNovoCargo] = useState("");
  const [showNovoCargo, setShowNovoCargo] = useState(false);

  useEffect(() => { fetchInstituicoes(); }, []);

  async function fetchInstituicoes() {
    try {
      const data = await fetch("/api/instituicoes").then(r => r.json());
      // Filtra só unidades de ensino (emissora) — sem registradora/mantenedora avulsa
      setInstituicoes(Array.isArray(data) ? data.filter((i: Instituicao) => i.tipo === "emissora" || !i.tipo) : []);
    } catch { /* silencia */ } finally { setLoading(false); }
  }

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // ── CEP automático ──────────────────────────────────────────────────────────
  async function handleCEP(cep: string) {
    const limpo = cep.replace(/\D/g, "");
    handleChange("cep", formatCEP(cep));
    if (limpo.length !== 8) return;
    setBuscandoCEP(true);
    try {
      const data = await fetch(`/api/cep/${limpo}`).then(r => r.json());
      if (!data.error) {
        setForm(prev => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          municipio: data.municipio || prev.municipio,
          uf: data.uf || prev.uf,
          pais: "Brasil",
          codigo_municipio_mec: data.codigo_municipio_mec || prev.codigo_municipio_mec,
        }));
      }
    } catch { /* silencia */ } finally { setBuscandoCEP(false); }
  }

  // ── CNPJ ────────────────────────────────────────────────────────────────────
  function handleCNPJData(data: { nome: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; municipio?: string; uf?: string; cep?: string; }) {
    setForm(prev => ({
      ...prev,
      nome: data.nome || prev.nome,
      logradouro: data.logradouro || prev.logradouro,
      numero: data.numero || prev.numero,
      complemento: data.complemento || prev.complemento,
      bairro: data.bairro || prev.bairro,
      municipio: data.municipio || prev.municipio,
      uf: data.uf || prev.uf,
      cep: data.cep ? formatCEP(data.cep) : prev.cep,
    }));
  }

  // ── MEC ─────────────────────────────────────────────────────────────────────
  function handleMECData(data: MECVinculoData) {
    setMecPreview(data);
    const ies = data.ies;
    if (ies) {
      setForm(prev => ({
        ...prev,
        nome: ies.nome || prev.nome,
        codigo_mec: String(ies.codigo_mec || prev.codigo_mec),
        logradouro: ies.logradouro || prev.logradouro,
        numero: ies.numero || prev.numero,
        bairro: ies.bairro || prev.bairro,
        municipio: ies.municipio || prev.municipio,
        uf: ies.uf || prev.uf,
        cep: ies.cep ? formatCEP(ies.cep) : prev.cep,
        mantenedora_nome: data.mantenedora?.nome || prev.mantenedora_nome,
        mantenedora_cnpj: data.mantenedora?.cnpj ? formatCNPJ(data.mantenedora.cnpj) : prev.mantenedora_cnpj,
      }));
    }
  }

  // ── Credenciamentos ─────────────────────────────────────────────────────────
  function handleCredChange(idx: number, field: string, val: string | boolean | number) {
    setCredenciamentos(prev => prev.map((c, i) => {
      if (i !== idx) return field === "vigente" && val === true ? { ...c, vigente: false } : c;
      return { ...c, [field]: val };
    }));
  }
  function addCredenciamento() {
    setCredenciamentos(prev => [...prev, { ...EMPTY_CRED, tipo: "recredenciamento", vigente: false }]);
  }
  function removeCredenciamento(idx: number) {
    setCredenciamentos(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Diretores ────────────────────────────────────────────────────────────────
  function handleDiretorChange(idx: number, field: string, val: string) {
    setDiretores(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  }
  function removeDiretor(idx: number) {
    setDiretores(prev => prev.filter((_, i) => i !== idx));
  }
  function addCargo() {
    if (!novoCargo.trim()) return;
    setDiretores(prev => [...prev, { ...EMPTY_DIRETOR, cargo: novoCargo.trim(), cargo_ordem: prev.length }]);
    setNovoCargo("");
    setShowNovoCargo(false);
  }

  // ── Campos adicionais ────────────────────────────────────────────────────────
  function addCampoAdicional() {
    if (!novoCampo.chave || !novoCampo.label) return;
    setForm(prev => ({
      ...prev,
      campos_adicionais_schema: [...(prev.campos_adicionais_schema || []), { ...novoCampo }],
    }));
    setNovoCampo({ chave: "", label: "", bloco: "Dados Gerais", tipo: "texto", valor: "", obrigatorio: false });
    setNovoCampoDialog(false);
  }

  // ── Salvar ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const url = editingId ? `/api/instituicoes/${editingId}` : "/api/instituicoes";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tipo: "emissora" }),
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.error);

      const iesId = editingId || saved.id;

      // Salva credenciamentos
      // Determina se há algum recredenciamento vigente na lista atual
      const temRecredVigente = credenciamentos.some(c => c.tipo === "recredenciamento" && c.vigente);

      for (const cred of credenciamentos) {
        // Um credenciamento só é considerado "em branco" se não tem nenhum dado preenchido
        const temDados = cred.numero || cred.data || cred.data_vencimento ||
          cred.numero_dou || cred.data_publicacao_dou || cred.tipo_ato !== "Portaria" ||
          cred.observacoes || cred.arquivo_url;

        if (!temDados && !cred.id) continue; // ignora cards completamente vazios sem ID

        // Se há recredenciamento vigente, o credenciamento original fica com vigente: false
        const vigente = temRecredVigente && cred.tipo === "credenciamento" ? false : cred.vigente;
        const payload = { ...cred, vigente, instituicao_id: iesId };

        if (cred.id) {
          const r = await fetch(`/api/credenciamentos/${cred.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error("Erro ao salvar credenciamento: " + (e.error ?? r.status)); }
        } else {
          const r = await fetch("/api/credenciamentos", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error("Erro ao criar credenciamento: " + (e.error ?? r.status)); }
        }
      }

      // Salva diretores
      for (const dir of diretores) {
        if (dir.nome || dir.cpf || dir.email) {
          if (dir.id) {
            const r = await fetch(`/api/diretores/${dir.id}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...dir, instituicao_id: iesId }),
            });
            if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error("Erro ao salvar diretor: " + (e.error ?? r.status)); }
          } else {
            const r = await fetch("/api/diretores", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...dir, instituicao_id: iesId }),
            });
            if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error("Erro ao criar diretor: " + (e.error ?? r.status)); }
          }
        }
      }

      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setCredenciamentos([{ ...EMPTY_CRED }]);
      setDiretores(CARGOS_PADRAO.map(c => ({ ...EMPTY_DIRETOR, cargo: c.cargo, cargo_ordem: c.ordem })));
      fetchInstituicoes();
    } catch (err) {
      alert("Erro ao salvar: " + (err instanceof Error ? err.message : String(err)));
    } finally { setSaving(false); }
  }

  async function handleEdit(inst: Instituicao) {
    setEditingId(inst.id);
    setForm(sanitizeInstituicao(inst)); // null → "" em todos os campos string
    setShowForm(true); // abre o form imediatamente, sem esperar as APIs

    // Carrega credenciamentos e diretores em segundo plano
    try {
      const [credsRes, dirsRes] = await Promise.all([
        fetch(`/api/credenciamentos?instituicao_id=${inst.id}`),
        fetch(`/api/diretores?instituicao_id=${inst.id}`),
      ]);
      const creds = credsRes.ok ? await credsRes.json() : [];
      const dirs = dirsRes.ok ? await dirsRes.json() : [];
      setCredenciamentos(Array.isArray(creds) && creds.length ? creds : [{ ...EMPTY_CRED }]);
      setDiretores(Array.isArray(dirs) && dirs.length ? dirs : CARGOS_PADRAO.map(c => ({ ...EMPTY_DIRETOR, cargo: c.cargo, cargo_ordem: c.ordem })));
    } catch {
      // Falha silenciosa — usa valores padrão já setados
      setCredenciamentos([{ ...EMPTY_CRED }]);
      setDiretores(CARGOS_PADRAO.map(c => ({ ...EMPTY_DIRETOR, cargo: c.cargo, cargo_ordem: c.ordem })));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esta unidade de ensino?")) return;
    await fetch(`/api/instituicoes/${id}`, { method: "DELETE" });
    fetchInstituicoes();
  }

  // Campos adicionais agrupados por bloco
  const camposSchema: CampoAdicional[] = form.campos_adicionais_schema || [];
  const blocos = Array.from(new Set(camposSchema.map(c => c.bloco)));

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 size={22} className="text-blue-500" />
            Unidades de Ensino (IES)
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cadastre e gerencie as IES emissoras com suas mantenedoras e credenciamentos
          </p>
        </div>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); setCredenciamentos([{ ...EMPTY_CRED }]); setDiretores(CARGOS_PADRAO.map(c => ({ ...EMPTY_DIRETOR, cargo: c.cargo, cargo_ordem: c.ordem }))); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors">
            <Plus size={16} /> Nova Instituição
          </button>
        )}
      </div>

      {/* ── FORMULÁRIO ─────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">
              {editingId ? "Editar Unidade de Ensino" : "Nova Unidade de Ensino"}
            </h2>
            <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
          </div>

          <div className="p-6 space-y-4">

            {/* ── DADOS DA UNIDADE DE ENSINO ── */}
            <FormSection title="Dados da Unidade de Ensino" icon={Building2} cor="text-blue-600">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                <Sparkles size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  <strong>Dica IA:</strong> Digite o <strong>Código MEC</strong> e clique em Buscar.
                  Preencheremos os dados da unidade <strong>e da mantenedora vinculada</strong> automaticamente.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Código MEC *</label>
                  <SmartCodigoMECInput
                    value={form.codigo_mec}
                    onChange={v => handleChange("codigo_mec", v)}
                    onDataFetched={handleMECData}
                  />
                </div>
                <div>
                  <SmartCNPJInput
                    value={form.cnpj}
                    onChange={v => handleChange("cnpj", v)}
                    onDataFetched={handleCNPJData}
                    label="CNPJ (opcional)"
                    required={false}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Nome da Instituição *</label>
                  <input value={form.nome} onChange={e => handleChange("nome", e.target.value)}
                    placeholder="Nome da unidade de ensino"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Razão Social</label>
                  <input value={form.razao_social} onChange={e => handleChange("razao_social", e.target.value)}
                    placeholder="Razão social completa"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Nome da Secretaria</label>
                  <input value={form.nome_secretaria} onChange={e => handleChange("nome_secretaria", e.target.value)}
                    placeholder="Nome completo da secretaria"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Ato Oficial da Secretaria</label>
                  <input value={form.ato_secretaria} onChange={e => handleChange("ato_secretaria", e.target.value)}
                    placeholder="Ex: Portaria n. 123/2024"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Ato Oficial do Estabelecimento</label>
                  <input value={form.ato_estabelecimento} onChange={e => handleChange("ato_estabelecimento", e.target.value)}
                    placeholder="Ex: Portaria MEC n. 456/2020"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
              </div>
            </FormSection>

            {/* ── MANTENEDORA ── */}
            <FormSection title="Mantenedora" icon={CheckCircle2} cor="text-emerald-600" defaultOpen={false}>
              <p className="text-xs text-gray-500 mb-4">
                A mantenedora é mencionada em documentos oficiais mas não é obrigatória para o funcionamento da IES.
                Se usar o Código MEC acima, os dados serão preenchidos automaticamente.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Nome da Mantenedora</label>
                  <input value={form.mantenedora_nome} onChange={e => handleChange("mantenedora_nome", e.target.value)}
                    placeholder="Nome da mantenedora"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">CNPJ da Mantenedora</label>
                  <input value={form.mantenedora_cnpj} onChange={e => handleChange("mantenedora_cnpj", formatCNPJ(e.target.value))}
                    placeholder="00.000.000/0001-00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Razão Social da Mantenedora</label>
                  <input value={form.mantenedora_razao_social} onChange={e => handleChange("mantenedora_razao_social", e.target.value)}
                    placeholder="Razão social completa"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Código MEC da Mantenedora</label>
                  <input value={form.mantenedora_codigo_mec} onChange={e => handleChange("mantenedora_codigo_mec", e.target.value)}
                    placeholder="Código MEC"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
              </div>
            </FormSection>

            {/* ── CREDENCIAMENTOS ── */}
            <FormSection title="Credenciamento / Recredenciamento" icon={BadgeCheck} cor="text-violet-600">
              {(() => {
                // Há recredenciamento vigente? Se sim, os campos de vencimento dos credenciamentos originais são desativados
                const hasRecredenciamentoVigente = credenciamentos.some(
                  c => c.tipo === "recredenciamento" && c.vigente
                );
                return credenciamentos.map((cred, idx) => (
                  <CredenciamentoCard
                    key={idx} cred={cred} index={idx}
                    onChange={handleCredChange} onRemove={removeCredenciamento}
                    isLast={credenciamentos.length === 1}
                    hasRecredenciamentoVigente={hasRecredenciamentoVigente}
                  />
                ));
              })()}

              <button type="button" onClick={addCredenciamento}
                className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 font-medium mt-2 transition-colors">
                <PlusCircle size={15} /> Adicionar recredenciamento anterior
              </button>
            </FormSection>

            {/* ── DIRETORES ── */}
            <FormSection title="Diretores e Corpo Administrativo" icon={UserCog} cor="text-blue-600">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                <Sparkles size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  <strong>IA:</strong> Faça upload do organograma institucional (PDF, imagem) para que a IA leia a estrutura e os cargos automaticamente.
                </p>
              </div>

              {/* Upload organograma */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 mb-4 text-center hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer"
                onClick={() => {/* TODO: upload organograma */}}>
                <Upload size={20} className="mx-auto text-gray-400 mb-1" />
                <p className="text-sm text-gray-500">Upload do organograma (PDF ou imagem)</p>
                <p className="text-xs text-gray-400 mt-0.5">A IA extrai os cargos e estrutura automaticamente</p>
              </div>

              {diretores.map((dir, idx) => (
                <DiretorCard key={idx} diretor={dir} index={idx}
                  onChange={handleDiretorChange} onRemove={removeDiretor}
                  cargosExistentes={diretores.map(d => d.cargo)} />
              ))}

              {/* Adicionar cargo personalizado */}
              {showNovoCargo ? (
                <div className="flex items-center gap-2 mt-2">
                  <input value={novoCargo} onChange={e => setNovoCargo(e.target.value)}
                    placeholder="Nome do cargo (ex: Pró-Reitor de Extensão)"
                    onKeyDown={e => e.key === "Enter" && addCargo()}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                  <button type="button" onClick={addCargo}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Adicionar</button>
                  <button type="button" onClick={() => setShowNovoCargo(false)}
                    className="p-2 text-gray-400 hover:text-gray-600"><X size={15} /></button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowNovoCargo(true)}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium mt-2 transition-colors">
                  <PlusCircle size={15} /> Criar novo cargo de direção
                </button>
              )}
            </FormSection>

            {/* ── ENDEREÇO ── */}
            <FormSection title="Endereço" icon={MapPin} cor="text-teal-600" defaultOpen={false}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                    CEP {buscandoCEP && <Loader2 size={11} className="animate-spin text-blue-500" />}
                  </label>
                  <input value={form.cep}
                    onChange={e => handleCEP(e.target.value)}
                    placeholder="00000-000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">País</label>
                  <input value={form.pais} onChange={e => handleChange("pais", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">UF</label>
                  <select value={form.uf} onChange={e => handleChange("uf", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                    <option value="">Selecione...</option>
                    {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Município</label>
                  <input value={form.municipio} onChange={e => handleChange("municipio", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">
                    Cod. Município MEC
                    <span className="ml-1 text-gray-400 font-normal">(IBGE 7 dígitos)</span>
                  </label>
                  <input value={form.codigo_municipio_mec} onChange={e => handleChange("codigo_municipio_mec", e.target.value)}
                    placeholder="Ex: 5203939"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Bairro</label>
                  <input value={form.bairro} onChange={e => handleChange("bairro", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-gray-500 mb-1.5">Logradouro</label>
                  <input value={form.logradouro} onChange={e => handleChange("logradouro", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Número</label>
                  <input value={form.numero} onChange={e => handleChange("numero", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Complemento</label>
                  <input value={form.complemento} onChange={e => handleChange("complemento", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Latitude</label>
                  <input value={form.latitude} onChange={e => handleChange("latitude", e.target.value)}
                    placeholder="Ex: -19.1234"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Longitude</label>
                  <input value={form.longitude} onChange={e => handleChange("longitude", e.target.value)}
                    placeholder="Ex: -51.7321"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                </div>
              </div>
            </FormSection>

            {/* ── CAMPOS ADICIONAIS ── */}
            <FormSection title="Campos Adicionais" icon={Settings2} cor="text-gray-600" defaultOpen={false}>
              <p className="text-xs text-gray-500 mb-4">
                Adicione campos personalizados ao cadastro desta IES de acordo com suas necessidades específicas.
              </p>

              {/* Campos existentes */}
              {blocos.map(bloco => (
                <div key={bloco} className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{bloco}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {camposSchema.filter(c => c.bloco === bloco).map((campo, idx) => (
                      <div key={campo.chave}>
                        <label className="block text-xs text-gray-500 mb-1">{campo.label}{campo.obrigatorio && " *"}</label>
                        <input
                          type={campo.tipo === "data" ? "date" : campo.tipo === "numero" ? "number" : campo.tipo === "url" ? "url" : "text"}
                          value={campo.valor}
                          onChange={e => {
                            const newSchema = [...camposSchema];
                            newSchema[idx] = { ...campo, valor: e.target.value };
                            setForm(prev => ({ ...prev, campos_adicionais_schema: newSchema }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Botão + dialog para novo campo */}
              <button type="button" onClick={() => setNovoCampoDialog(true)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium border border-dashed border-gray-300 px-3 py-2 rounded-lg hover:border-gray-400 transition-colors mt-2">
                <PlusCircle size={15} /> Adicionar campo personalizado
              </button>

              {novoCampoDialog && (
                <div className="mt-4 border border-blue-200 bg-blue-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-blue-800 mb-3">Novo Campo Personalizado</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nome do campo (label) *</label>
                      <input value={novoCampo.label}
                        onChange={e => setNovoCampo(p => ({ ...p, label: e.target.value, chave: e.target.value.toLowerCase().replace(/\s+/g, "_") }))}
                        placeholder="Ex: Número do Parecer CNE"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Em qual bloco aparece?</label>
                      <select value={novoCampo.bloco} onChange={e => setNovoCampo(p => ({ ...p, bloco: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                        <option>Dados Gerais</option>
                        <option>Credenciamento</option>
                        <option>Mantenedora</option>
                        <option>Endereço</option>
                        <option>Outros</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tipo de conteúdo</label>
                      <select value={novoCampo.tipo} onChange={e => setNovoCampo(p => ({ ...p, tipo: e.target.value as CampoAdicional["tipo"] }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 outline-none">
                        <option value="texto">Texto livre</option>
                        <option value="data">Data</option>
                        <option value="numero">Número</option>
                        <option value="url">Link / URL</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input type="checkbox" id="obrigatorio" checked={novoCampo.obrigatorio}
                        onChange={e => setNovoCampo(p => ({ ...p, obrigatorio: e.target.checked }))}
                        className="rounded" />
                      <label htmlFor="obrigatorio" className="text-sm text-gray-600">Campo obrigatório</label>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={addCampoAdicional}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                      Adicionar campo
                    </button>
                    <button type="button" onClick={() => setNovoCampoDialog(false)}
                      className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </FormSection>

          </div>

          {/* Botões de ação */}
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)}
              className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !form.nome}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <><Save size={14} /> Salvar Instituição</>}
            </button>
          </div>
        </div>
      )}

      {/* ── LISTA DE IES ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : instituicoes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma unidade de ensino cadastrada.</p>
          <p className="text-xs mt-1">Clique em &quot;Nova Instituição&quot; para começar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {instituicoes.map(inst => {
            return (
              <div key={inst.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start justify-between hover:border-blue-200 hover:shadow-sm transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{inst.nome}</p>
                    {inst.razao_social && <p className="text-xs text-gray-400 mt-0.5">{inst.razao_social}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {inst.codigo_mec && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">MEC: {inst.codigo_mec}</span>
                      )}
                      {inst.cnpj && (
                        <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">{inst.cnpj}</span>
                      )}
                      {inst.municipio && inst.uf && (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <MapPin size={10} /> {inst.municipio}/{inst.uf}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleEdit(inst)}
                    className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDelete(inst.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assistente IA flutuante */}
      <AIAssistant context="instituicoes" />
    </div>
  );
}
