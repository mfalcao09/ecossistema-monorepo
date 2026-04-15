"use client";

import { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  GraduationCap,
  Clock,
  MapPin,
  Building2,
  ChevronRight,
  AlertCircle,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  X,
  Loader2,
  AlertTriangle,
  Info,
  Bot,
  ShieldCheck,
  FileUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Combine,
  CheckSquare,
  Square,
} from "lucide-react";
import SmartEMECInput from "@/components/ai/SmartEMECInput";
import AIAssistant from "@/components/ai/AIAssistant";

const GRAU_LABELS: Record<string, string> = {
  bacharel: "Bacharelado",
  licenciado: "Licenciatura",
  tecnologo: "Tecnólogo",
  especialista: "Especialização",
  mestre: "Mestrado",
  doutor: "Doutorado",
};

const GRAU_COLORS: Record<string, string> = {
  bacharel: "bg-blue-100 text-blue-700",
  licenciado: "bg-emerald-100 text-emerald-700",
  tecnologo: "bg-purple-100 text-purple-700",
  especialista: "bg-orange-100 text-orange-700",
  mestre: "bg-indigo-100 text-indigo-700",
  doutor: "bg-red-100 text-red-700",
};

const MODALIDADE_LABELS: Record<string, string> = {
  presencial: "Presencial",
  ead: "EaD",
  hibrido: "Híbrido",
};

const MODALIDADE_ICONS: Record<string, string> = {
  presencial: "🏫",
  ead: "💻",
  hibrido: "🔄",
};

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC",
  "SP","SE","TO",
];

interface Curso {
  id: string;
  instituicao_id: string;
  departamento_id: string;
  nome: string;
  codigo_emec: string;
  grau: string;
  titulo_conferido: string;
  descricao_habilitacao: string;
  descricao_oficial: string;
  modalidade: string;
  carga_horaria_total: number | null;
  carga_horaria_hora_relogio: number | null;
  carga_horaria_integralizada: number | null;
  carga_horaria_estagio: number | null;
  carga_horaria_atividades_complementares: number | null;
  carga_horaria_tcc: number | null;
  // Processo e-MEC
  numero_processo_emec: string;
  tipo_processo_emec: string;
  data_processo_emec: string;
  // Autorização
  tipo_autorizacao: string;
  numero_autorizacao: string;
  data_autorizacao: string;
  veiculo_publicacao_autorizacao: string;
  data_publicacao_autorizacao: string;
  secao_publicacao_autorizacao: string;
  pagina_publicacao_autorizacao: string;
  numero_dou_autorizacao: string;
  // Reconhecimento
  tipo_reconhecimento: string;
  numero_reconhecimento: string;
  data_reconhecimento: string;
  veiculo_publicacao_reconhecimento: string;
  data_publicacao_reconhecimento: string;
  secao_publicacao_reconhecimento: string;
  pagina_publicacao_reconhecimento: string;
  numero_dou_reconhecimento: string;
  // Renovação
  tipo_renovacao: string;
  numero_renovacao: string;
  data_renovacao: string;
  data_publicacao_renovacao: string;
  veiculo_publicacao_renovacao: string;
  secao_publicacao_renovacao: string;
  pagina_publicacao_renovacao: string;
  numero_dou_renovacao: string;
  unidade_certificadora: boolean;
  // Endereço
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  codigo_municipio: string;
  uf: string;
  cep: string;
  // Coordenador
  coordenador_nome: string;
  coordenador_email: string;
  coordenador_telefone: string;
  // Operacional
  vagas_autorizadas: number | null;
  periodicidade: string;
  situacao_emec: string;
  data_inicio_funcionamento: string;
  // Indicadores de qualidade
  conceito_curso: number | null;
  ano_cc: number | null;
  cpc_faixa: number | null;
  cpc_continuo: number | null;
  cpc_ano: number | null;
  enade_conceito: number | null;
  enade_ano: number | null;
  // Classificação
  cine_area_geral: string;
  cine_rotulo: string;
  codigo_grau_mec: string;
  codigo_habilitacao_mec: string;
  // Pedagógico
  objetivo_curso: string;
  periodo_divisao_turmas: string;
  numero_etapas: number | null;
  duracao_hora_aula_minutos: number | null;
  dias_letivos: number | null;
  relevancia: number | null;
  enfase: string;
  codigo_curso: string; // Código interno ERP (ex: 17034-ADM)
  instituicoes?: { nome: string; cnpj: string };
  departamentos?: { id: string; nome: string; codigo: string };
}

interface Instituicao {
  id: string;
  nome: string;
  tipo: string;
  cnpj: string;
}

interface Departamento {
  id: string;
  nome: string;
  codigo: string;
  instituicao_id: string;
  instituicoes?: { id: string; nome: string; tipo: string };
}

// ─── Tipos para importação do CSV e-MEC ───────────────────────────────────────
interface CursoImportado {
  codigo_emec: string;
  nome: string;
  grau: string;
  modalidade: string;
  situacao_emec: string;
  carga_horaria_total: number | null;
  carga_horaria_estagio: number | null;
  carga_horaria_atividades_complementares: number | null;
  carga_horaria_tcc: number | null;
  vagas_autorizadas: number | null;
  periodicidade: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  tipo_autorizacao: string;
  numero_autorizacao: string;
  data_autorizacao: string;
  tipo_reconhecimento: string;
  numero_reconhecimento: string;
  data_reconhecimento: string;
  tipo_renovacao: string;
  numero_renovacao: string;
  data_renovacao: string;
  data_publicacao_renovacao: string;
  data_inicio_funcionamento: string;
  conceito_curso: number | null;
  ano_cc: number | null;
  cpc_faixa: number | null;
  cpc_continuo: number | null;
  cpc_ano: number | null;
  enade_conceito: number | null;
  enade_ano: number | null;
  coordenador_nome: string;
  coordenador_email: string;
  coordenador_telefone: string;
  cine_rotulo: string;
  cine_area_geral: string;
  _ativo: boolean;
  // controle de seleção no modal
  _selecionado?: boolean;
  _jaExiste?: boolean;
}

// ─── Tipos para Agente IA ──────────────────────────────────────────────────
interface DivergenciaIA {
  campo: string;
  valores: Array<{ valor: unknown; fonte: string; confianca: string }>;
  valor_sugerido: unknown;
  aprovado: boolean;
  valor_escolhido?: unknown;
}

interface CursoAnalisadoIA {
  dados: Record<string, unknown>;
  fontes: string[];
  divergencias: DivergenciaIA[];
  campos_ausentes: string[];
  dados_extras: Record<string, string[]>;
  _acao: "pendente" | "criar" | "atualizar" | "ignorar";
  _selecionado: boolean;
  _match?: { id: string; nome: string } | null;
  _expandido?: boolean;
}

interface RespostaAgenteIA {
  success?: boolean;
  cursos: CursoAnalisadoIA[];
  total: number;
  para_criar: number;
  para_atualizar: number;
  total_divergencias: number;
  total_campos_extras?: number;
  duvidas: string[];
  observacoes: string[];
  erros_arquivos: string[];
}

// Etapas do wizard do Agente IA
type EtapaAgente = "upload" | "revisao" | "divergencias" | "duvidas" | "confirmacao" | "resultado";

// ─── Tipos para Merge de Cursos ─────────────────────────────────────────────
type ValorCampo = string | number | boolean | null | undefined;

interface SugestaoMerge {
  campo: string;
  label: string;
  grupo: string;
  valores: Array<{ cursoId: string; cursoNome: string; valor: ValorCampo }>;
  valor_sugerido: ValorCampo;
  fonte_sugerida: string;
  conflito: boolean;
}

interface PreviewMerge {
  cursos: Array<{
    id: string;
    nome: string;
    codigo_emec: string;
    grau: string;
    modalidade: string;
    campos_preenchidos: number;
    total_campos: number;
  }>;
  merged: Record<string, ValorCampo>;
  sugestoes: SugestaoMerge[];
  campos_com_conflito: number;
  campos_preenchidos: number;
  analise_ia: string;
}

// ─── Tipos para Auditoria IA ────────────────────────────────────────────────
interface ItemFaltando {
  campo: string;
  label: string;
  grupo: string;
  peso: string;
}

interface ResultadoAuditoria {
  id: string;
  nome: string;
  codigo_emec: string;
  grau: string;
  modalidade: string;
  faltando: ItemFaltando[];
  preenchidos: number;
  total: number;
  percentual: number;
  status: "ok" | "atencao" | "critico";
  criticosFaltando: number;
}

interface ResumoAuditoria {
  totalCursos: number;
  cursosOk: number;
  cursosAtencao: number;
  cursosCriticos: number;
  mediaCompletude: number;
}

const EMPTY_FORM = {
  instituicao_id: "",
  departamento_id: "",
  nome: "",
  codigo_emec: "",
  grau: "bacharel",
  titulo_conferido: "",
  descricao_habilitacao: "",
  descricao_oficial: "",
  modalidade: "presencial",
  carga_horaria_total: "",
  carga_horaria_hora_relogio: "",
  carga_horaria_integralizada: "",
  carga_horaria_estagio: "",
  carga_horaria_atividades_complementares: "",
  carga_horaria_tcc: "",
  // Processo e-MEC
  numero_processo_emec: "",
  tipo_processo_emec: "",
  data_processo_emec: "",
  // Autorização
  tipo_autorizacao: "",
  numero_autorizacao: "",
  data_autorizacao: "",
  veiculo_publicacao_autorizacao: "Diário Oficial da União",
  data_publicacao_autorizacao: "",
  secao_publicacao_autorizacao: "",
  pagina_publicacao_autorizacao: "",
  numero_dou_autorizacao: "",
  // Reconhecimento
  tipo_reconhecimento: "",
  numero_reconhecimento: "",
  data_reconhecimento: "",
  veiculo_publicacao_reconhecimento: "Diário Oficial da União",
  data_publicacao_reconhecimento: "",
  secao_publicacao_reconhecimento: "",
  pagina_publicacao_reconhecimento: "",
  numero_dou_reconhecimento: "",
  // Renovação
  tipo_renovacao: "",
  numero_renovacao: "",
  data_renovacao: "",
  data_publicacao_renovacao: "",
  veiculo_publicacao_renovacao: "Diário Oficial da União",
  secao_publicacao_renovacao: "",
  pagina_publicacao_renovacao: "",
  numero_dou_renovacao: "",
  unidade_certificadora: "true",
  // Endereço
  logradouro: "",
  numero: "",
  bairro: "",
  municipio: "",
  codigo_municipio: "",
  uf: "",
  cep: "",
  // Coordenador
  coordenador_nome: "",
  coordenador_email: "",
  coordenador_telefone: "",
  // Operacional
  vagas_autorizadas: "",
  periodicidade: "semestral",
  situacao_emec: "ativo",
  data_inicio_funcionamento: "",
  // Indicadores
  conceito_curso: "",
  ano_cc: "",
  cpc_faixa: "",
  cpc_continuo: "",
  cpc_ano: "",
  enade_conceito: "",
  enade_ano: "",
  // Classificação
  cine_area_geral: "",
  cine_rotulo: "",
  codigo_grau_mec: "",
  codigo_habilitacao_mec: "",
  // Pedagógico
  objetivo_curso: "",
  periodo_divisao_turmas: "semestral",
  numero_etapas: "",
  duracao_hora_aula_minutos: "",
  dias_letivos: "",
  relevancia: "1",
  enfase: "",
  // Identificação interna ERP
  codigo_curso: "",
};

export default function CursosPage() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"dados" | "atos" | "complementar" | "endereco" | "diploma">("dados");
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);

  // ─── Estados de importação CSV ─────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importando, setImportando] = useState(false);
  const [cursosImportados, setCursosImportados] = useState<CursoImportado[]>([]);
  const [importInstituicaoId, setImportInstituicaoId] = useState("");
  const [importErros, setImportErros] = useState<string[]>([]);
  const [importResultado, setImportResultado] = useState<{ ok: number; erros: number } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // ─── Estados Agente IA ──────────────────────────────────────────────────────
  const [showAgente, setShowAgente] = useState(false);
  const [agenteLoading, setAgenteLoading] = useState(false);
  const [agenteSalvando, setAgenteSalvando] = useState(false);
  const [agenteEtapa, setAgenteEtapa] = useState<EtapaAgente>("upload");
  const [agenteResposta, setAgenteResposta] = useState<RespostaAgenteIA | null>(null);
  const [cursosAgente, setCursosAgente] = useState<CursoAnalisadoIA[]>([]);
  const [agenteResultado, setAgenteResultado] = useState<{ sucesso: number; erros: number } | null>(null);
  const [agenteErro, setAgenteErro] = useState("");
  const [agenteInstituicaoId, setAgenteInstituicaoId] = useState("");
  const [agenteArquivos, setAgenteArquivos] = useState<File[]>([]);
  const [agenteDivIdx, setAgenteDivIdx] = useState(0); // índice da divergência atual no wizard
  const [agenteInstrucao, setAgenteInstrucao] = useState(""); // orientação opcional para a IA antes de processar
  const agenteInputRef = useRef<HTMLInputElement>(null);

  // ─── Estados Auditoria IA ───────────────────────────────────────────────────
  const [showAuditoria, setShowAuditoria] = useState(false);
  const [auditoriaLoading, setAuditoriaLoading] = useState(false);
  const [auditoriaResultados, setAuditoriaResultados] = useState<ResultadoAuditoria[]>([]);
  const [auditoriaResumo, setAuditoriaResumo] = useState<ResumoAuditoria | null>(null);
  const [auditoriaAnaliseIA, setAuditoriaAnaliseIA] = useState("");
  const [auditoriaExpandido, setAuditoriaExpandido] = useState<string | null>(null);

  // ─── Estados Merge de Cursos ────────────────────────────────────────────────
  const [mergeAtivo, setMergeAtivo] = useState(false); // modo de seleção múltipla
  const [mergeSelecionados, setMergeSelecionados] = useState<string[]>([]); // ids selecionados
  const [showMerge, setShowMerge] = useState(false); // modal de merge
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeSalvando, setMergeSalvando] = useState(false);
  const [mergePreview, setMergePreview] = useState<PreviewMerge | null>(null);
  const [mergeEtapa, setMergeEtapa] = useState<"comparacao" | "revisao" | "resultado">("comparacao");
  const [mergeDadosFinais, setMergeDadosFinais] = useState<Record<string, ValorCampo>>({});
  const [mergeResultado, setMergeResultado] = useState<{ curso_nome: string; deletados: number } | null>(null);

  useEffect(() => {
    fetchCursos();
    fetchInstituicoes();
    fetchDepartamentos();
  }, []);

  async function fetchCursos() {
    try {
      const res = await fetch("/api/cursos");
      const data = await res.json();
      setCursos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar cursos:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchInstituicoes() {
    try {
      const res = await fetch("/api/instituicoes");
      const data = await res.json();
      setInstituicoes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar instituições:", err);
    }
  }

  async function fetchDepartamentos() {
    try {
      const res = await fetch("/api/departamentos");
      const data = await res.json();
      setDepartamentos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar departamentos:", err);
    }
  }

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleEMECData(data: {
    nome?: string;
    grau?: string;
    titulo_conferido?: string;
    modalidade?: string;
    carga_horaria_total?: number;
  }) {
    setForm((prev) => ({
      ...prev,
      nome: data.nome || prev.nome,
      grau: data.grau || prev.grau,
      titulo_conferido: data.titulo_conferido || prev.titulo_conferido,
      modalidade: data.modalidade || prev.modalidade,
      carga_horaria_total: data.carga_horaria_total?.toString() || prev.carga_horaria_total,
    }));
    setAiMessage(
      "Dados preenchidos automaticamente. Verifique e complete as informações de reconhecimento e endereço."
    );
    setTimeout(() => setAiMessage(""), 6000);
  }

  function handleEdit(curso: Curso) {
    setEditingId(curso.id);
    // Sanitiza campos nulos para string vazia (evita crash em inputs controlados)
    setForm({
      instituicao_id: curso.instituicao_id ?? "",
      departamento_id: curso.departamento_id ?? "",
      nome: curso.nome ?? "",
      codigo_emec: curso.codigo_emec ?? "",
      grau: curso.grau ?? "bacharel",
      titulo_conferido: curso.titulo_conferido ?? "",
      descricao_habilitacao: curso.descricao_habilitacao ?? "",
      descricao_oficial: curso.descricao_oficial ?? "",
      modalidade: curso.modalidade ?? "presencial",
      carga_horaria_total: curso.carga_horaria_total?.toString() ?? "",
      carga_horaria_hora_relogio: curso.carga_horaria_hora_relogio?.toString() ?? "",
      carga_horaria_integralizada: curso.carga_horaria_integralizada?.toString() ?? "",
      carga_horaria_estagio: curso.carga_horaria_estagio?.toString() ?? "",
      carga_horaria_atividades_complementares: curso.carga_horaria_atividades_complementares?.toString() ?? "",
      carga_horaria_tcc: curso.carga_horaria_tcc?.toString() ?? "",
      // Processo e-MEC
      numero_processo_emec: curso.numero_processo_emec ?? "",
      tipo_processo_emec: curso.tipo_processo_emec ?? "",
      data_processo_emec: curso.data_processo_emec ?? "",
      // Autorização
      tipo_autorizacao: curso.tipo_autorizacao ?? "",
      numero_autorizacao: curso.numero_autorizacao ?? "",
      data_autorizacao: curso.data_autorizacao ?? "",
      veiculo_publicacao_autorizacao: curso.veiculo_publicacao_autorizacao ?? "Diário Oficial da União",
      data_publicacao_autorizacao: curso.data_publicacao_autorizacao ?? "",
      secao_publicacao_autorizacao: curso.secao_publicacao_autorizacao?.toString() ?? "",
      pagina_publicacao_autorizacao: curso.pagina_publicacao_autorizacao?.toString() ?? "",
      numero_dou_autorizacao: curso.numero_dou_autorizacao ?? "",
      // Reconhecimento
      tipo_reconhecimento: curso.tipo_reconhecimento ?? "",
      numero_reconhecimento: curso.numero_reconhecimento ?? "",
      data_reconhecimento: curso.data_reconhecimento ?? "",
      veiculo_publicacao_reconhecimento: curso.veiculo_publicacao_reconhecimento ?? "Diário Oficial da União",
      data_publicacao_reconhecimento: curso.data_publicacao_reconhecimento ?? "",
      secao_publicacao_reconhecimento: curso.secao_publicacao_reconhecimento?.toString() ?? "",
      pagina_publicacao_reconhecimento: curso.pagina_publicacao_reconhecimento?.toString() ?? "",
      numero_dou_reconhecimento: curso.numero_dou_reconhecimento ?? "",
      // Renovação
      tipo_renovacao: curso.tipo_renovacao ?? "",
      numero_renovacao: curso.numero_renovacao ?? "",
      data_renovacao: curso.data_renovacao ?? "",
      data_publicacao_renovacao: curso.data_publicacao_renovacao ?? "",
      veiculo_publicacao_renovacao: curso.veiculo_publicacao_renovacao ?? "Diário Oficial da União",
      secao_publicacao_renovacao: curso.secao_publicacao_renovacao?.toString() ?? "",
      pagina_publicacao_renovacao: curso.pagina_publicacao_renovacao?.toString() ?? "",
      numero_dou_renovacao: curso.numero_dou_renovacao ?? "",
      unidade_certificadora: curso.unidade_certificadora !== false ? "true" : "false",
      // Endereço
      logradouro: curso.logradouro ?? "",
      numero: curso.numero ?? "",
      bairro: curso.bairro ?? "",
      municipio: curso.municipio ?? "",
      codigo_municipio: curso.codigo_municipio ?? "",
      uf: curso.uf ?? "",
      cep: curso.cep ?? "",
      // Coordenador
      coordenador_nome: curso.coordenador_nome ?? "",
      coordenador_email: curso.coordenador_email ?? "",
      coordenador_telefone: curso.coordenador_telefone ?? "",
      // Operacional
      vagas_autorizadas: curso.vagas_autorizadas?.toString() ?? "",
      periodicidade: curso.periodicidade ?? "semestral",
      situacao_emec: curso.situacao_emec ?? "ativo",
      data_inicio_funcionamento: curso.data_inicio_funcionamento ?? "",
      // Indicadores
      conceito_curso: curso.conceito_curso?.toString() ?? "",
      ano_cc: curso.ano_cc?.toString() ?? "",
      cpc_faixa: curso.cpc_faixa?.toString() ?? "",
      cpc_continuo: curso.cpc_continuo?.toString() ?? "",
      cpc_ano: curso.cpc_ano?.toString() ?? "",
      enade_conceito: curso.enade_conceito?.toString() ?? "",
      enade_ano: curso.enade_ano?.toString() ?? "",
      // Classificação
      cine_area_geral: curso.cine_area_geral ?? "",
      cine_rotulo: curso.cine_rotulo ?? "",
      codigo_grau_mec: curso.codigo_grau_mec ?? "",
      codigo_habilitacao_mec: curso.codigo_habilitacao_mec ?? "",
      // Pedagógico
      objetivo_curso: curso.objetivo_curso ?? "",
      periodo_divisao_turmas: curso.periodo_divisao_turmas ?? "semestral",
      numero_etapas: curso.numero_etapas?.toString() ?? "",
      duracao_hora_aula_minutos: curso.duracao_hora_aula_minutos?.toString() ?? "",
      dias_letivos: curso.dias_letivos?.toString() ?? "",
      relevancia: curso.relevancia?.toString() ?? "1",
      enfase: curso.enfase ?? "",
      // Identificação interna ERP
      codigo_curso: curso.codigo_curso ?? "",
    });
    setActiveTab("dados");
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Deseja realmente excluir este curso?")) return;
    const res = await fetch(`/api/cursos/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchCursos();
    } else {
      const err = await res.json().catch(() => ({}));
      alert("Erro ao excluir: " + (err.error ?? "desconhecido"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const toInt = (v: string) => (v ? parseInt(v) || null : null);
      const toFloat = (v: string) => (v ? parseFloat(v) || null : null);
      const payload = {
        ...form,
        // Cargas horárias
        carga_horaria_total: toInt(form.carga_horaria_total),
        carga_horaria_hora_relogio: toInt(form.carga_horaria_hora_relogio),
        carga_horaria_integralizada: toInt(form.carga_horaria_integralizada),
        carga_horaria_estagio: toInt(form.carga_horaria_estagio),
        carga_horaria_atividades_complementares: toInt(form.carga_horaria_atividades_complementares),
        carga_horaria_tcc: toInt(form.carga_horaria_tcc),
        // Publicação DOU
        secao_publicacao_autorizacao: toInt(form.secao_publicacao_autorizacao),
        pagina_publicacao_autorizacao: toInt(form.pagina_publicacao_autorizacao),
        secao_publicacao_reconhecimento: toInt(form.secao_publicacao_reconhecimento),
        pagina_publicacao_reconhecimento: toInt(form.pagina_publicacao_reconhecimento),
        secao_publicacao_renovacao: toInt(form.secao_publicacao_renovacao),
        pagina_publicacao_renovacao: toInt(form.pagina_publicacao_renovacao),
        // Unidade certificadora (boolean)
        unidade_certificadora: form.unidade_certificadora === "true",
        // Operacional
        vagas_autorizadas: toInt(form.vagas_autorizadas),
        // Indicadores
        conceito_curso: toInt(form.conceito_curso),
        ano_cc: toInt(form.ano_cc),
        cpc_faixa: toInt(form.cpc_faixa),
        cpc_continuo: toFloat(form.cpc_continuo),
        cpc_ano: toInt(form.cpc_ano),
        enade_conceito: toInt(form.enade_conceito),
        enade_ano: toInt(form.enade_ano),
        // Pedagógico
        numero_etapas: toInt(form.numero_etapas),
        duracao_hora_aula_minutos: toInt(form.duracao_hora_aula_minutos),
        dias_letivos: toInt(form.dias_letivos),
        relevancia: toInt(form.relevancia) ?? 1,
        // Código interno ERP — null quando vazio
        codigo_curso: form.codigo_curso.trim() || null,
      };

      const url = editingId ? `/api/cursos/${editingId}` : "/api/cursos";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setShowForm(false);
        fetchCursos();
        setAiMessage(editingId ? "Curso atualizado com sucesso!" : "Curso cadastrado com sucesso!");
        setTimeout(() => setAiMessage(""), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        setAiMessage(`Erro ao salvar: ${err.error ?? "desconhecido"}`);
        setTimeout(() => setAiMessage(""), 6000);
      }
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setAiMessage("Erro inesperado ao salvar.");
      setTimeout(() => setAiMessage(""), 6000);
    } finally {
      setSaving(false);
    }
  }

  // ─── Funções de importação CSV ─────────────────────────────────────────────
  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportErros([]);
    setImportResultado(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/cursos/importar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao processar CSV");

      // Marca todos como selecionados por padrão; marca os já existentes
      const codigosExistentes = new Set(cursos.map(c => c.codigo_emec));
      const lista: CursoImportado[] = (data.cursos as CursoImportado[]).map(c => ({
        ...c,
        _selecionado: !codigosExistentes.has(c.codigo_emec),
        _jaExiste: codigosExistentes.has(c.codigo_emec),
      }));
      setCursosImportados(lista);
      setImportErros(data.erros ?? []);
      // Pré-seleciona a primeira emissora disponível
      if (!importInstituicaoId && emissoras.length > 0) {
        setImportInstituicaoId(emissoras[0].id);
      }
    } catch (err) {
      setImportErros([String(err)]);
    } finally {
      setImportLoading(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  }

  function toggleCursoImport(idx: number) {
    setCursosImportados(prev => prev.map((c, i) => i === idx ? { ...c, _selecionado: !c._selecionado } : c));
  }

  function toggleTodosCursos(sel: boolean) {
    setCursosImportados(prev => prev.map(c => ({ ...c, _selecionado: c._jaExiste ? false : sel })));
  }

  async function confirmarImportacao() {
    if (!importInstituicaoId) { alert("Selecione a instituição para vincular os cursos."); return; }
    const selecionados = cursosImportados.filter(c => c._selecionado && !c._jaExiste);
    if (!selecionados.length) { alert("Nenhum curso novo selecionado."); return; }
    setImportando(true);
    let ok = 0; let erros = 0;
    for (const c of selecionados) {
      // Monta payload compatível com a tabela cursos
      const payload: Record<string, unknown> = {
        instituicao_id: importInstituicaoId,
        nome: c.nome,
        codigo_emec: c.codigo_emec,
        grau: c.grau,
        modalidade: c.modalidade,
        carga_horaria_total: c.carga_horaria_total,
        carga_horaria_estagio: c.carga_horaria_estagio,
        carga_horaria_atividades_complementares: c.carga_horaria_atividades_complementares,
        carga_horaria_tcc: c.carga_horaria_tcc,
        logradouro: c.logradouro || null,
        numero: c.numero || null,
        bairro: c.bairro || null,
        municipio: c.municipio || null,
        uf: c.uf || null,
        // Autorização
        tipo_autorizacao: c.tipo_autorizacao || null,
        numero_autorizacao: c.numero_autorizacao || null,
        data_autorizacao: c.data_autorizacao || null,
        // Reconhecimento
        tipo_reconhecimento: c.tipo_reconhecimento || null,
        numero_reconhecimento: c.numero_reconhecimento || null,
        data_reconhecimento: c.data_reconhecimento || null,
        // Renovação
        tipo_renovacao: c.tipo_renovacao || null,
        numero_renovacao: c.numero_renovacao || null,
        data_renovacao: c.data_renovacao || null,
        data_publicacao_renovacao: c.data_publicacao_renovacao || null,
        // Operacional
        vagas_autorizadas: c.vagas_autorizadas,
        periodicidade: c.periodicidade || null,
        situacao_emec: c.situacao_emec || "ativo",
        data_inicio_funcionamento: c.data_inicio_funcionamento || null,
        // Indicadores
        conceito_curso: c.conceito_curso,
        ano_cc: c.ano_cc,
        cpc_faixa: c.cpc_faixa,
        cpc_continuo: c.cpc_continuo,
        cpc_ano: c.cpc_ano,
        enade_conceito: c.enade_conceito,
        enade_ano: c.enade_ano,
        // Coordenador
        coordenador_nome: c.coordenador_nome || null,
        coordenador_email: c.coordenador_email || null,
        coordenador_telefone: c.coordenador_telefone || null,
        // Classificação
        cine_area_geral: c.cine_area_geral || null,
        cine_rotulo: c.cine_rotulo || null,
        ativo: c._ativo,
      };
      // Remove nulls
      Object.keys(payload).forEach(k => { if (payload[k] === null || payload[k] === "") delete payload[k]; });
      const r = await fetch("/api/cursos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      r.ok ? ok++ : erros++;
    }
    setImportResultado({ ok, erros });
    setImportando(false);
    if (ok > 0) fetchCursos();
  }

  function fecharImport() {
    setShowImport(false);
    setCursosImportados([]);
    setImportErros([]);
    setImportResultado(null);
    setImportInstituicaoId("");
  }

  // ─── Funções Agente IA ──────────────────────────────────────────────────────
  function handleAgenteArquivosSelecionados(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setAgenteArquivos(prev => {
      const novos = files.filter(f => !prev.some(p => p.name === f.name && p.size === f.size));
      return [...prev, ...novos].slice(0, 25);
    });
    if (agenteInputRef.current) agenteInputRef.current.value = "";
  }

  function removerArquivo(idx: number) {
    setAgenteArquivos(prev => prev.filter((_, i) => i !== idx));
  }

  async function processarArquivosIA() {
    if (agenteArquivos.length === 0) return;
    setAgenteLoading(true);
    setAgenteErro("");
    setAgenteResposta(null);
    setCursosAgente([]);
    setAgenteDivIdx(0);

    // Envia em lotes de 3 arquivos para não estourar o limite de 4.5MB do Vercel
    const LOTE_FRONTEND = 3;
    const todosCursos: CursoAnalisadoIA[] = [];
    const todasDuvidas: string[] = [];
    const todasObservacoes: string[] = [];
    const todosErros: string[] = [];
    let totalDivergencias = 0;

    try {
      for (let i = 0; i < agenteArquivos.length; i += LOTE_FRONTEND) {
        const lote = agenteArquivos.slice(i, i + LOTE_FRONTEND);
        const fd = new FormData();
        for (const f of lote) fd.append("files", f);
        if (agenteInstituicaoId) fd.append("instituicao_id", agenteInstituicaoId);
        if (agenteInstrucao.trim()) fd.append("instrucao_usuario", agenteInstrucao.trim());

        const res = await fetch("/api/cursos/ai-processar", { method: "POST", body: fd });

        // Trata respostas não-JSON (ex: 413 Request Entity Too Large do Vercel)
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          if (res.status === 413) {
            setAgenteErro(`Arquivo(s) muito grande(s): ${lote.map(f => f.name).join(", ")}. Reduza o tamanho ou envie menos arquivos por vez.`);
            return;
          }
          setAgenteErro(`Erro inesperado ao processar lote ${Math.floor(i / LOTE_FRONTEND) + 1} (HTTP ${res.status}). Verifique os arquivos e tente novamente.`);
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          setAgenteErro(data.error ?? `Erro ao processar lote ${Math.floor(i / LOTE_FRONTEND) + 1}`);
          return;
        }

        // Acumula resultados de todos os lotes
        if (Array.isArray(data.cursos)) todosCursos.push(...data.cursos);
        if (Array.isArray(data.duvidas)) todasDuvidas.push(...data.duvidas);
        if (Array.isArray(data.observacoes)) todasObservacoes.push(...data.observacoes);
        if (Array.isArray(data.erros_arquivos)) todosErros.push(...data.erros_arquivos);
        totalDivergencias += (data.total_divergencias ?? 0);
      }

      // Consolida resposta unificada
      const respostaFinal: RespostaAgenteIA = {
        cursos: todosCursos,
        total: todosCursos.length,
        para_criar: todosCursos.filter(c => c._acao === "criar").length,
        para_atualizar: todosCursos.filter(c => c._acao === "atualizar").length,
        total_divergencias: totalDivergencias,
        duvidas: Array.from(new Set(todasDuvidas)).slice(0, 10),
        observacoes: todasObservacoes,
        erros_arquivos: todosErros,
        success: true,
      };

      setAgenteResposta(respostaFinal);
      const cursosComFlagsUI = todosCursos.map(c => ({
        ...c,
        _selecionado: true,
        _expandido: false,
      }));
      setCursosAgente(cursosComFlagsUI);

      // Decide próxima etapa
      if (respostaFinal.duvidas.length > 0) {
        setAgenteEtapa("duvidas");
      } else if (totalDivergencias > 0) {
        setAgenteEtapa("divergencias");
      } else {
        setAgenteEtapa("revisao");
      }
    } catch (err) {
      setAgenteErro(String(err));
    } finally {
      setAgenteLoading(false);
    }
  }

  function resolverDivergencia(cursoIdx: number, divIdx: number, valorEscolhido: unknown) {
    setCursosAgente(prev => prev.map((c, ci) => {
      if (ci !== cursoIdx) return c;
      const novasDivs = c.divergencias.map((d, di) => {
        if (di !== divIdx) return d;
        return { ...d, aprovado: true, valor_escolhido: valorEscolhido };
      });
      // Atualiza o dado com o valor escolhido
      const novoDados = { ...c.dados, [c.divergencias[divIdx].campo]: valorEscolhido };
      return { ...c, divergencias: novasDivs, dados: novoDados };
    }));
  }

  // Coleta todas as divergências pendentes de todos os cursos para o wizard
  function getDivergenciasPendentes(): Array<{ cursoIdx: number; divIdx: number; div: DivergenciaIA; nomeCurso: string }> {
    const lista: Array<{ cursoIdx: number; divIdx: number; div: DivergenciaIA; nomeCurso: string }> = [];
    cursosAgente.forEach((c, ci) => {
      c.divergencias.forEach((d, di) => {
        if (!d.aprovado) {
          lista.push({ cursoIdx: ci, divIdx: di, div: d, nomeCurso: String(c.dados.nome || `Curso ${ci + 1}`) });
        }
      });
    });
    return lista;
  }

  async function confirmarAgente() {
    const selecionados = cursosAgente.filter((c) => c._selecionado && c._acao !== "ignorar");
    if (!selecionados.length) { alert("Nenhum curso selecionado."); return; }
    setAgenteSalvando(true);
    try {
      const res = await fetch("/api/cursos/ai-processar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursos: selecionados,
          instituicao_id: agenteInstituicaoId || emissoras[0]?.id,
        }),
      });
      const data = await res.json();
      setAgenteResultado({ sucesso: data.sucesso ?? 0, erros: data.erros ?? 0 });
      setAgenteEtapa("resultado");
      if ((data.sucesso ?? 0) > 0) fetchCursos();
    } catch (err) {
      setAgenteErro(String(err));
    } finally {
      setAgenteSalvando(false);
    }
  }

  function fecharAgente() {
    setShowAgente(false);
    setCursosAgente([]);
    setAgenteErro("");
    setAgenteResultado(null);
    setAgenteInstituicaoId("");
    setAgenteArquivos([]);
    setAgenteResposta(null);
    setAgenteEtapa("upload");
    setAgenteInstrucao("");
    setAgenteDivIdx(0);
  }

  // ─── Funções Auditoria IA ───────────────────────────────────────────────────
  async function rodarAuditoria(modo: "simples" | "completo") {
    setAuditoriaLoading(true);
    setAuditoriaResultados([]);
    setAuditoriaResumo(null);
    setAuditoriaAnaliseIA("");
    try {
      const res = await fetch("/api/cursos/auditoria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo, instituicao_id: emissoras[0]?.id || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Erro ao realizar auditoria");
        return;
      }
      setAuditoriaResultados(data.cursos ?? []);
      setAuditoriaResumo(data.resumo ?? null);
      setAuditoriaAnaliseIA(data.analise_ia ?? "");
    } catch (err) {
      alert(String(err));
    } finally {
      setAuditoriaLoading(false);
    }
  }

  // ─── Funções Merge ──────────────────────────────────────────────────────────
  function toggleMergeAtivo() {
    setMergeAtivo(!mergeAtivo);
    setMergeSelecionados([]);
  }

  function toggleMergeSelecionado(id: string) {
    setMergeSelecionados((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function abrirMerge() {
    if (mergeSelecionados.length < 2) return;
    setShowMerge(true);
    setMergeEtapa("comparacao");
    setMergePreview(null);
    setMergeDadosFinais({});
    setMergeResultado(null);
    setMergeLoading(true);

    try {
      const res = await fetch("/api/cursos/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: mergeSelecionados, modo: "preview" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro no preview");
      setMergePreview(data);
      // Inicializa dados finais com os valores sugeridos
      const dadosIniciais: Record<string, ValorCampo> = { ...data.merged };
      setMergeDadosFinais(dadosIniciais);
    } catch (err) {
      console.error(err);
      setAiMessage("Erro ao carregar preview do merge.");
      setTimeout(() => setAiMessage(""), 4000);
      setShowMerge(false);
    } finally {
      setMergeLoading(false);
    }
  }

  async function salvarMerge() {
    if (!mergePreview) return;
    setMergeSalvando(true);
    try {
      const res = await fetch("/api/cursos/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: mergeSelecionados,
          modo: "salvar",
          dados_finais: mergeDadosFinais,
          ids_deletar: mergeSelecionados.filter(
            (id) => id !== mergePreview.cursos[0].id
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar merge");
      setMergeResultado({ curso_nome: data.curso_nome, deletados: data.deletados });
      setMergeEtapa("resultado");
      await fetchCursos();
      setMergeAtivo(false);
      setMergeSelecionados([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiMessage(`Erro ao mesclar: ${msg}`);
      setTimeout(() => setAiMessage(""), 5000);
    } finally {
      setMergeSalvando(false);
    }
  }

  function fecharMerge() {
    setShowMerge(false);
    setMergePreview(null);
    setMergeEtapa("comparacao");
    setMergeDadosFinais({});
    setMergeResultado(null);
  }

  const emissoras = instituicoes.filter(
    (i) => i.tipo === "emissora" || i.tipo === "registradora"
  );
  const hasInstituicoes = emissoras.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cursos</h1>
          <p className="text-gray-500 mt-1">
            Gerencie os cursos que emitem diplomas digitais
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              if (!hasInstituicoes) {
                setAiMessage("Você precisa cadastrar pelo menos uma instituição antes. Vá em Cadastro → Instituições primeiro.");
                setTimeout(() => setAiMessage(""), 6000);
                return;
              }
              setShowImport(true);
            }}
            className="flex items-center gap-2 border border-gray-300 hover:border-primary-400 hover:bg-primary-50 text-gray-700 hover:text-primary-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <FileSpreadsheet size={16} />
            Importar CSV e-MEC
          </button>
          <button
            onClick={() => {
              if (!hasInstituicoes) {
                setAiMessage("Você precisa cadastrar pelo menos uma instituição antes. Vá em Cadastro → Instituições primeiro.");
                setTimeout(() => setAiMessage(""), 6000);
                return;
              }
              setShowAgente(true);
            }}
            className="flex items-center gap-2 border border-violet-300 hover:border-violet-500 hover:bg-violet-50 text-violet-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Bot size={16} />
            Agente IA
          </button>
          {/* Botão Mesclar — aparece sempre, destaque quando ativo */}
          {cursos.length >= 2 && (
            <button
              onClick={toggleMergeAtivo}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                mergeAtivo
                  ? "bg-teal-600 border-teal-600 text-white hover:bg-teal-700"
                  : "border-teal-300 hover:border-teal-500 hover:bg-teal-50 text-teal-700"
              }`}
            >
              <Combine size={16} />
              {mergeAtivo ? "Cancelar Mescla" : "Mesclar Cursos"}
            </button>
          )}
          <button
            onClick={() => {
              if (cursos.length === 0) {
                setAiMessage("Nenhum curso cadastrado para auditar ainda.");
                setTimeout(() => setAiMessage(""), 4000);
                return;
              }
              setShowAuditoria(true);
            }}
            className="flex items-center gap-2 border border-amber-300 hover:border-amber-500 hover:bg-amber-50 text-amber-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <ShieldCheck size={16} />
            Auditoria IA
          </button>
          <button
            onClick={() => {
              if (!hasInstituicoes) {
                setAiMessage("Você precisa cadastrar pelo menos uma instituição antes de criar cursos. Vá em Cadastro → Instituições primeiro.");
                setTimeout(() => setAiMessage(""), 6000);
                return;
              }
              setForm({ ...EMPTY_FORM, instituicao_id: emissoras[0]?.id || "" });
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={18} />
            Novo Curso
          </button>
        </div>
      </div>

      {/* Banner modo Mesclar */}
      {mergeAtivo && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Combine size={20} className="text-teal-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-teal-800">
                Modo Mesclar — Selecione os cursos para combinar
              </p>
              <p className="text-xs text-teal-600 mt-0.5">
                {mergeSelecionados.length === 0
                  ? "Clique nos cursos que deseja mesclar (mínimo 2)"
                  : `${mergeSelecionados.length} curso(s) selecionado(s)`}
              </p>
            </div>
          </div>
          {mergeSelecionados.length >= 2 && (
            <button
              onClick={abrirMerge}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
            >
              <Combine size={16} />
              Mesclar {mergeSelecionados.length} cursos
            </button>
          )}
        </div>
      )}

      {/* AI Message Banner */}
      {aiMessage && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center gap-3">
          <Sparkles size={20} className="text-primary-500 shrink-0" />
          <p className="text-sm text-primary-700">{aiMessage}</p>
        </div>
      )}

      {/* Alerta: sem instituições */}
      {!loading && !hasInstituicoes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800">
              Configure as instituições primeiro
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              Para cadastrar cursos, é necessário ter pelo menos uma instituição cadastrada.
            </p>
            <a
              href="/cadastro/ies"
              className="inline-flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900 mt-2"
            >
              Ir para Instituições <ChevronRight size={14} />
            </a>
          </div>
        </div>
      )}

      {/* Resumo */}
      {!loading && cursos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-primary-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Resumo</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{cursos.length}</p>
              <p className="text-xs text-gray-500">Total de Cursos</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {cursos.filter((c) => c.grau === "bacharel").length}
              </p>
              <p className="text-xs text-gray-500">Bacharelados</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-emerald-600">
                {cursos.filter((c) => c.grau === "licenciado").length}
              </p>
              <p className="text-xs text-gray-500">Licenciaturas</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {cursos.filter((c) => c.grau === "tecnologo").length}
              </p>
              <p className="text-xs text-gray-500">Tecnólogos</p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Cursos */}
      {!loading && cursos.length > 0 && (
        <div className="space-y-3">
          {cursos.map((curso) => {
            const isMergeSelecionado = mergeSelecionados.includes(curso.id);
            return (
            <div
              key={curso.id}
              onClick={mergeAtivo ? () => toggleMergeSelecionado(curso.id) : undefined}
              className={`bg-white rounded-xl border p-5 transition-all ${
                mergeAtivo
                  ? isMergeSelecionado
                    ? "border-teal-400 bg-teal-50 shadow-sm cursor-pointer ring-2 ring-teal-300"
                    : "border-gray-200 hover:border-teal-300 hover:bg-teal-50/30 cursor-pointer"
                  : "border-gray-200 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Checkbox visível no modo merge */}
                  {mergeAtivo ? (
                    <div className={`p-1 rounded-lg ${isMergeSelecionado ? "text-teal-600" : "text-gray-300"}`}>
                      {isMergeSelecionado
                        ? <CheckSquare size={24} />
                        : <Square size={24} />
                      }
                    </div>
                  ) : (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <BookOpen size={24} className="text-gray-600" />
                  </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{curso.nome}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          GRAU_COLORS[curso.grau] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {GRAU_LABELS[curso.grau] || curso.grau}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                        {MODALIDADE_ICONS[curso.modalidade]}{" "}
                        {MODALIDADE_LABELS[curso.modalidade] || curso.modalidade}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {curso.instituicoes && (
                        <span className="flex items-center gap-1">
                          <Building2 size={14} />
                          {curso.instituicoes.nome}
                        </span>
                      )}
                      {curso.carga_horaria_total && (
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {curso.carga_horaria_total}h
                        </span>
                      )}
                      {curso.municipio && (
                        <span className="flex items-center gap-1">
                          <MapPin size={14} />
                          {curso.municipio}/{curso.uf}
                        </span>
                      )}
                      {curso.codigo_emec && (
                        <span className="flex items-center gap-1">
                          <GraduationCap size={14} />
                          E-MEC: {curso.codigo_emec}
                        </span>
                      )}
                      {curso.departamentos && (
                        <span className="flex items-center gap-1 text-indigo-600">
                          <Building2 size={14} />
                          {curso.departamentos.codigo ? `${curso.departamentos.codigo} — ` : ""}{curso.departamentos.nome}
                        </span>
                      )}
                    </div>
                    {curso.titulo_conferido && (
                      <p className="text-xs text-gray-400 mt-1">
                        Título: {curso.titulo_conferido}
                      </p>
                    )}
                  </div>
                </div>
                {/* Código do Curso + Ações */}
                <div className="flex items-center gap-3 shrink-0">
                  {curso.codigo_curso ? (
                    <span className="hidden sm:inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-teal-700 font-mono font-semibold text-xs px-2.5 py-1.5 rounded-lg" title="Código do curso no ERP">
                      {curso.codigo_curso}
                    </span>
                  ) : (
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg" title="Código do curso pendente">
                      <AlertTriangle size={11} />
                      Cód. pendente
                    </span>
                  )}
                </div>
                {/* Ações — ocultas no modo merge */}
                {!mergeAtivo && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(curso)}
                      title="Editar curso"
                      className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(curso.id)}
                      title="Excluir curso"
                      className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && cursos.length === 0 && hasInstituicoes && !showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">
            Nenhum curso cadastrado
          </h3>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Cadastre os cursos que emitirão diplomas digitais. A IA vai ajudar
            buscando dados no E-MEC automaticamente.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-2 border border-primary-300 hover:bg-primary-50 text-primary-700 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <FileSpreadsheet size={16} />
              Importar CSV do e-MEC
            </button>
            <button
              onClick={() => { setForm({ ...EMPTY_FORM, instituicao_id: emissoras[0]?.id || "" }); setShowForm(true); }}
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Sparkles size={16} />
              Cadastrar com ajuda da IA
            </button>
          </div>
        </div>
      )}

      {/* Formulário Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-40 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingId ? "Editar Curso" : "Novo Curso"}
                </h2>
                <p className="text-sm text-gray-500">
                  {editingId ? "Atualize os dados do curso abaixo" : "Digite o nome e a IA sugere grau, carga horária e título"}
                </p>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            <div className="border-b px-6 flex gap-0 overflow-x-auto">
              {[
                { key: "dados", label: "Dados do Curso" },
                { key: "atos", label: "Atos Oficiais" },
                { key: "complementar", label: "Complementar" },
                { key: "endereco", label: "Endereço" },
                { key: "diploma", label: "Diploma Digital" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.key
                      ? "border-primary-500 text-primary-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {activeTab === "dados" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Instituição <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.instituicao_id}
                        onChange={(e) => {
                          handleChange("instituicao_id", e.target.value);
                          // Limpa o departamento ao trocar a instituição
                          handleChange("departamento_id", "");
                        }}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Selecione a instituição...</option>
                        {emissoras.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Departamento
                      </label>
                      <select
                        value={form.departamento_id}
                        onChange={(e) => handleChange("departamento_id", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        disabled={!form.instituicao_id}
                      >
                        <option value="">
                          {form.instituicao_id
                            ? departamentos.filter(d => d.instituicao_id === form.instituicao_id).length === 0
                              ? "Nenhum departamento cadastrado"
                              : "Sem departamento específico"
                            : "Selecione a instituição primeiro"}
                        </option>
                        {departamentos
                          .filter(d => d.instituicao_id === form.instituicao_id)
                          .map(dep => (
                            <option key={dep.id} value={dep.id}>
                              {dep.codigo ? `${dep.codigo} — ` : ""}{dep.nome}
                            </option>
                          ))}
                      </select>
                      {form.instituicao_id && departamentos.filter(d => d.instituicao_id === form.instituicao_id).length === 0 && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <AlertCircle size={11} />
                          Cadastre departamentos em <a href="/cadastro/departamentos" className="underline hover:text-amber-800">Cadastro → Departamentos</a>
                        </p>
                      )}
                    </div>
                  </div>

                  <SmartEMECInput
                    codigoValue={form.codigo_emec}
                    nomeValue={form.nome}
                    onCodigoChange={(v) => handleChange("codigo_emec", v)}
                    onDataFetched={handleEMECData}
                  />

                  {/* Código do Curso — identificador interno ERP */}
                  <div className={`rounded-xl border p-4 ${form.codigo_curso ? "border-teal-300 bg-teal-50/40" : "border-amber-200 bg-amber-50/40"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <GraduationCap size={14} className={form.codigo_curso ? "text-teal-600" : "text-amber-500"} />
                      <label className="text-sm font-semibold text-gray-800">
                        Código do Curso
                        {!form.codigo_curso && <span className="ml-2 text-xs font-normal text-amber-600">⏳ Pendente</span>}
                      </label>
                    </div>
                    <input
                      type="text"
                      value={form.codigo_curso}
                      onChange={(e) => handleChange("codigo_curso", e.target.value.toUpperCase())}
                      placeholder="Ex: 17034-ADM"
                      maxLength={30}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                      Identificador único usado no histórico escolar, diploma digital e demais módulos do ERP.
                      Sugestão: <span className="font-mono">{form.codigo_emec ? `${form.codigo_emec}-` : "EMEC-"}SIGLA</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Nome do Curso <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.nome}
                        onChange={(e) => handleChange("nome", e.target.value)}
                        required
                        placeholder="Ex: Administração, Direito, Pedagogia..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Grau Acadêmico <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.grau}
                        onChange={(e) => handleChange("grau", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="bacharel">Bacharelado</option>
                        <option value="licenciado">Licenciatura</option>
                        <option value="tecnologo">Tecnólogo</option>
                        <option value="especialista">Especialização</option>
                        <option value="mestre">Mestrado</option>
                        <option value="doutor">Doutorado</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Modalidade <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.modalidade}
                        onChange={(e) => handleChange("modalidade", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="presencial">Presencial</option>
                        <option value="ead">EaD (Educação a Distância)</option>
                        <option value="hibrido">Híbrido</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Título Conferido
                      </label>
                      <input
                        type="text"
                        value={form.titulo_conferido}
                        onChange={(e) => handleChange("titulo_conferido", e.target.value)}
                        placeholder="Ex: Bacharel em Administração"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Descrição Oficial do Curso
                        <span className="ml-1 text-xs text-gray-400 font-normal">(como aparece no diploma)</span>
                      </label>
                      <input
                        type="text"
                        value={form.descricao_oficial}
                        onChange={(e) => handleChange("descricao_oficial", e.target.value)}
                        placeholder="Ex: Bacharelado em Administração"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Descrição Oficial da Habilitação
                        <span className="ml-1 text-xs text-gray-400 font-normal">(campo XML do diploma — obrigatório)</span>
                      </label>
                      <input
                        type="text"
                        value={form.descricao_habilitacao}
                        onChange={(e) => handleChange("descricao_habilitacao", e.target.value)}
                        placeholder="Ex: Bacharel em Educação Física"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Carga Horária Total (h/aula)
                      </label>
                      <input
                        type="number"
                        value={form.carga_horaria_total}
                        onChange={(e) => handleChange("carga_horaria_total", e.target.value)}
                        placeholder="Ex: 3000"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Carga Horária (hora-relógio)
                      </label>
                      <input
                        type="number"
                        value={form.carga_horaria_hora_relogio}
                        onChange={(e) => handleChange("carga_horaria_hora_relogio", e.target.value)}
                        placeholder="Ex: 2500"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "atos" && (
                <div className="space-y-6">
                  {/* Helper DOU */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle size={14} className="text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700">Os dados de publicação no DOU são obrigatórios para geração do Diploma Digital (Portaria MEC 554/2019).</p>
                  </div>

                  {/* Processo e-MEC */}
                  <section>
                    <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wide mb-4">Processo e-MEC</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de Processo</label>
                        <input type="text" value={form.tipo_processo_emec} onChange={(e) => handleChange("tipo_processo_emec", e.target.value)} placeholder="Ex: Reconhecimento" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Número do Processo</label>
                        <input type="text" value={form.numero_processo_emec} onChange={(e) => handleChange("numero_processo_emec", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Data</label>
                        <input type="date" value={form.data_processo_emec} onChange={(e) => handleChange("data_processo_emec", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                  </section>

                  {/* Autorização */}
                  <section className="border border-gray-100 rounded-xl p-4 space-y-4">
                    <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wide">Autorização</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo</label>
                        <input type="text" value={form.tipo_autorizacao} onChange={(e) => handleChange("tipo_autorizacao", e.target.value)} placeholder="Ex: Portaria" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Número</label>
                        <input type="text" value={form.numero_autorizacao} onChange={(e) => handleChange("numero_autorizacao", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Data do Ato</label>
                        <input type="date" value={form.data_autorizacao} onChange={(e) => handleChange("data_autorizacao", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Publicação no DOU</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Veículo</label>
                        <input type="text" value={form.veiculo_publicacao_autorizacao} onChange={(e) => handleChange("veiculo_publicacao_autorizacao", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Publicação</label>
                        <input type="date" value={form.data_publicacao_autorizacao} onChange={(e) => handleChange("data_publicacao_autorizacao", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Seção</label>
                        <input type="number" value={form.secao_publicacao_autorizacao} onChange={(e) => handleChange("secao_publicacao_autorizacao", e.target.value)} placeholder="1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Página</label>
                        <input type="number" value={form.pagina_publicacao_autorizacao} onChange={(e) => handleChange("pagina_publicacao_autorizacao", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Número DOU</label>
                        <input type="text" value={form.numero_dou_autorizacao} onChange={(e) => handleChange("numero_dou_autorizacao", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                  </section>

                  {/* Reconhecimento */}
                  <section className="border border-gray-100 rounded-xl p-4 space-y-4">
                    <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wide">Reconhecimento do Curso</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo</label>
                        <input type="text" value={form.tipo_reconhecimento} onChange={(e) => handleChange("tipo_reconhecimento", e.target.value)} placeholder="Ex: Portaria" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Número</label>
                        <input type="text" value={form.numero_reconhecimento} onChange={(e) => handleChange("numero_reconhecimento", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Data do Ato</label>
                        <input type="date" value={form.data_reconhecimento} onChange={(e) => handleChange("data_reconhecimento", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Publicação no DOU</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Veículo</label>
                        <input type="text" value={form.veiculo_publicacao_reconhecimento} onChange={(e) => handleChange("veiculo_publicacao_reconhecimento", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Publicação</label>
                        <input type="date" value={form.data_publicacao_reconhecimento} onChange={(e) => handleChange("data_publicacao_reconhecimento", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Seção</label>
                        <input type="number" value={form.secao_publicacao_reconhecimento} onChange={(e) => handleChange("secao_publicacao_reconhecimento", e.target.value)} placeholder="1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Página</label>
                        <input type="number" value={form.pagina_publicacao_reconhecimento} onChange={(e) => handleChange("pagina_publicacao_reconhecimento", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Número DOU</label>
                        <input type="text" value={form.numero_dou_reconhecimento} onChange={(e) => handleChange("numero_dou_reconhecimento", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                  </section>

                  {/* Renovação */}
                  <section className="border border-gray-100 rounded-xl p-4 space-y-4">
                    <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wide">Renovação de Reconhecimento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo</label>
                        <input type="text" value={form.tipo_renovacao} onChange={(e) => handleChange("tipo_renovacao", e.target.value)} placeholder="Ex: Portaria" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Número</label>
                        <input type="text" value={form.numero_renovacao} onChange={(e) => handleChange("numero_renovacao", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Data do Ato</label>
                        <input type="date" value={form.data_renovacao} onChange={(e) => handleChange("data_renovacao", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">Publicação no DOU</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Veículo</label>
                        <input type="text" value={form.veiculo_publicacao_renovacao} onChange={(e) => handleChange("veiculo_publicacao_renovacao", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Data de Publicação</label>
                        <input type="date" value={form.data_publicacao_renovacao} onChange={(e) => handleChange("data_publicacao_renovacao", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Seção</label>
                        <input type="number" value={form.secao_publicacao_renovacao} onChange={(e) => handleChange("secao_publicacao_renovacao", e.target.value)} placeholder="1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Página</label>
                        <input type="number" value={form.pagina_publicacao_renovacao} onChange={(e) => handleChange("pagina_publicacao_renovacao", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Número DOU</label>
                        <input type="text" value={form.numero_dou_renovacao} onChange={(e) => handleChange("numero_dou_renovacao", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        id="unidade_certificadora"
                        checked={form.unidade_certificadora === "true"}
                        onChange={(e) => handleChange("unidade_certificadora", e.target.checked ? "true" : "false")}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <label htmlFor="unidade_certificadora" className="text-sm text-gray-700">Minha instituição é a unidade certificadora</label>
                    </div>
                  </section>
                </div>
              )}

              {activeTab === "complementar" && (
                <div className="space-y-6">
                  {/* Coordenador */}
                  <section>
                    <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wide mb-4">Coordenador do Curso</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Nome</label>
                        <input type="text" value={form.coordenador_nome} onChange={(e) => handleChange("coordenador_nome", e.target.value)} placeholder="Nome completo do coordenador" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Telefone</label>
                        <input type="text" value={form.coordenador_telefone} onChange={(e) => handleChange("coordenador_telefone", e.target.value)} placeholder="(67) 99999-9999" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">E-mail</label>
                        <input type="email" value={form.coordenador_email} onChange={(e) => handleChange("coordenador_email", e.target.value)} placeholder="coordenador@fic.edu.br" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                  </section>

                  {/* Dados Operacionais */}
                  <section>
                    <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wide mb-4">Dados Operacionais</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Situação no e-MEC</label>
                        <select value={form.situacao_emec} onChange={(e) => handleChange("situacao_emec", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                          <option value="ativo">Ativo</option>
                          <option value="em_extincao">Em Extinção</option>
                          <option value="extinto">Extinto</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Periodicidade</label>
                        <select value={form.periodicidade} onChange={(e) => handleChange("periodicidade", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                          <option value="semestral">Semestral</option>
                          <option value="anual">Anual</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Vagas Autorizadas</label>
                        <input type="number" value={form.vagas_autorizadas} onChange={(e) => handleChange("vagas_autorizadas", e.target.value)} placeholder="Ex: 50" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Início Funcionamento</label>
                        <input type="date" value={form.data_inicio_funcionamento} onChange={(e) => handleChange("data_inicio_funcionamento", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                  </section>

                  {/* Cargas Horárias Complementares */}
                  <section>
                    <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wide mb-4">Cargas Horárias Detalhadas</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">CH Estágio (h)</label>
                        <input type="number" value={form.carga_horaria_estagio} onChange={(e) => handleChange("carga_horaria_estagio", e.target.value)} placeholder="Ex: 400" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">CH Ativ. Complementares (h)</label>
                        <input type="number" value={form.carga_horaria_atividades_complementares} onChange={(e) => handleChange("carga_horaria_atividades_complementares", e.target.value)} placeholder="Ex: 100" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">CH TCC (h)</label>
                        <input type="number" value={form.carga_horaria_tcc} onChange={(e) => handleChange("carga_horaria_tcc", e.target.value)} placeholder="Ex: 80" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                  </section>

                  {/* Indicadores de Qualidade */}
                  <section>
                    <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wide mb-4">Indicadores de Qualidade (INEP)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Conceito CC</label>
                        <input type="number" value={form.conceito_curso} onChange={(e) => handleChange("conceito_curso", e.target.value)} min="1" max="5" placeholder="1–5" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Ano CC</label>
                        <input type="number" value={form.ano_cc} onChange={(e) => handleChange("ano_cc", e.target.value)} placeholder="Ex: 2022" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">CPC Faixa</label>
                        <input type="number" value={form.cpc_faixa} onChange={(e) => handleChange("cpc_faixa", e.target.value)} min="1" max="5" placeholder="1–5" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">CPC Contínuo</label>
                        <input type="number" step="0.01" value={form.cpc_continuo} onChange={(e) => handleChange("cpc_continuo", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Ano CPC</label>
                        <input type="number" value={form.cpc_ano} onChange={(e) => handleChange("cpc_ano", e.target.value)} placeholder="Ex: 2022" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">ENADE Conceito</label>
                        <input type="number" value={form.enade_conceito} onChange={(e) => handleChange("enade_conceito", e.target.value)} min="1" max="5" placeholder="1–5" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Ano ENADE</label>
                        <input type="number" value={form.enade_ano} onChange={(e) => handleChange("enade_ano", e.target.value)} placeholder="Ex: 2022" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                  </section>

                  {/* Classificação CINE/MEC */}
                  <section>
                    <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wide mb-4">Classificação CINE / MEC</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Área Geral (CINE)</label>
                        <input type="text" value={form.cine_area_geral} onChange={(e) => handleChange("cine_area_geral", e.target.value)} placeholder="Ex: Saúde e bem-estar" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Rótulo CINE</label>
                        <input type="text" value={form.cine_rotulo} onChange={(e) => handleChange("cine_rotulo", e.target.value)} placeholder="Ex: 091" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Código do Grau (MEC)</label>
                        <input type="text" value={form.codigo_grau_mec} onChange={(e) => handleChange("codigo_grau_mec", e.target.value)} placeholder="Consultar tabela MEC" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Código da Habilitação (MEC)</label>
                        <input type="text" value={form.codigo_habilitacao_mec} onChange={(e) => handleChange("codigo_habilitacao_mec", e.target.value)} placeholder="Consultar tabela MEC" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                  </section>

                  {/* Dados Pedagógicos */}
                  <section>
                    <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wide mb-4">Dados Pedagógicos</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Período de Turmas</label>
                        <select value={form.periodo_divisao_turmas} onChange={(e) => handleChange("periodo_divisao_turmas", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                          <option value="semestral">Semestral</option>
                          <option value="anual">Anual</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Nº de Etapas</label>
                        <input type="number" value={form.numero_etapas} onChange={(e) => handleChange("numero_etapas", e.target.value)} placeholder="Ex: 8" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Duração Hora-Aula (min)</label>
                        <input type="number" value={form.duracao_hora_aula_minutos} onChange={(e) => handleChange("duracao_hora_aula_minutos", e.target.value)} placeholder="Ex: 50" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Dias Letivos</label>
                        <input type="number" value={form.dias_letivos} onChange={(e) => handleChange("dias_letivos", e.target.value)} placeholder="Ex: 200" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Relevância (ordem)</label>
                        <input type="number" value={form.relevancia} onChange={(e) => handleChange("relevancia", e.target.value)} placeholder="Ex: 1" min="1" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Ênfase do Curso</label>
                        <input type="text" value={form.enfase} onChange={(e) => handleChange("enfase", e.target.value)} placeholder="Ex: Gestão Empresarial" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Objetivo do Curso</label>
                      <textarea value={form.objetivo_curso} onChange={(e) => handleChange("objetivo_curso", e.target.value)} rows={3} placeholder="Descreva o objetivo geral do curso..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                    </div>
                  </section>
                </div>
              )}

              {activeTab === "endereco" && (
                <div>
                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <Sparkles size={14} className="text-primary-500" />
                    <p className="text-xs text-primary-700">
                      Preencha apenas se o endereço do curso for diferente do endereço da instituição.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Logradouro</label>
                      <input type="text" value={form.logradouro} onChange={(e) => handleChange("logradouro", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Número</label>
                      <input type="text" value={form.numero} onChange={(e) => handleChange("numero", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Bairro</label>
                      <input type="text" value={form.bairro} onChange={(e) => handleChange("bairro", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Município</label>
                      <input type="text" value={form.municipio} onChange={(e) => handleChange("municipio", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">UF</label>
                      <select value={form.uf} onChange={(e) => handleChange("uf", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                        <option value="">Selecione...</option>
                        {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">CEP</label>
                      <input type="text" value={form.cep} onChange={(e) => handleChange("cep", e.target.value)} placeholder="00000-000" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Código Município (IBGE)</label>
                      <input type="text" value={form.codigo_municipio} onChange={(e) => handleChange("codigo_municipio", e.target.value)} placeholder="Ex: 5002407" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "diploma" && (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-3">
                    <GraduationCap size={20} className="text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-blue-800 text-sm">Diploma Digital — Status do Curso</h3>
                      <p className="text-xs text-blue-700 mt-1">
                        Esta seção exibe o status de conformidade do curso para emissão de Diploma Digital
                        conforme a Portaria MEC 554/2019 e IN SESU 1/2020.
                      </p>
                    </div>
                  </div>

                  {/* Checklist de completude */}
                  <section>
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Conformidade para Emissão</h3>
                    <div className="space-y-2">
                      {[
                        { label: "Código e-MEC preenchido", ok: !!form.codigo_emec },
                        { label: "Nome oficial do curso", ok: !!form.nome },
                        { label: "Grau e título conferido", ok: !!form.titulo_conferido },
                        { label: "Modalidade definida", ok: !!form.modalidade },
                        { label: "Ato de autorização (número e data)", ok: !!(form.numero_autorizacao && form.data_autorizacao) },
                        { label: "Publicação DOU da autorização (data + número)", ok: !!(form.data_publicacao_autorizacao && form.numero_dou_autorizacao) },
                        { label: "Ato de reconhecimento (número e data)", ok: !!(form.numero_reconhecimento && form.data_reconhecimento) },
                        { label: "Publicação DOU do reconhecimento (data + número)", ok: !!(form.data_publicacao_reconhecimento && form.numero_dou_reconhecimento) },
                        { label: "Carga horária total", ok: !!form.carga_horaria_total },
                      ].map((item) => (
                        <div key={item.label} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg ${item.ok ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.ok ? "bg-green-500" : "bg-red-400"}`} />
                          <span className={`text-sm ${item.ok ? "text-green-800" : "text-red-700"}`}>{item.label}</span>
                          <span className={`ml-auto text-xs font-semibold ${item.ok ? "text-green-600" : "text-red-500"}`}>{item.ok ? "✓ OK" : "Pendente"}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Descrição da habilitação */}
                  <section>
                    <h3 className="text-sm font-bold text-primary-600 uppercase tracking-wide mb-4">Textos Oficiais para o Diploma</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Descrição Oficial da Habilitação
                          <span className="ml-1 text-xs text-gray-400 font-normal">(campo obrigatório no XML do diploma)</span>
                        </label>
                        <input
                          type="text"
                          value={form.descricao_habilitacao}
                          onChange={(e) => handleChange("descricao_habilitacao", e.target.value)}
                          placeholder="Ex: Bacharel em Educação Física"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Descrição Oficial do Curso
                          <span className="ml-1 text-xs text-gray-400 font-normal">(como aparecerá no diploma)</span>
                        </label>
                        <input
                          type="text"
                          value={form.descricao_oficial}
                          onChange={(e) => handleChange("descricao_oficial", e.target.value)}
                          placeholder="Ex: Bacharelado em Educação Física"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  </section>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Itens pendentes devem ser preenchidos nas abas correspondentes (Dados do Curso e Atos Oficiais) antes de emitir diplomas para este curso.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex gap-2">
                  {activeTab !== "dados" && (
                    <button
                      type="button"
                      onClick={() => {
                        const order = ["dados", "atos", "complementar", "endereco", "diploma"] as const;
                        const idx = order.indexOf(activeTab);
                        if (idx > 0) setActiveTab(order[idx - 1]);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Anterior
                    </button>
                  )}
                  {activeTab !== "diploma" && (
                    <button
                      type="button"
                      onClick={() => {
                        const order = ["dados", "atos", "complementar", "endereco", "diploma"] as const;
                        const idx = order.indexOf(activeTab);
                        if (idx < order.length - 1) setActiveTab(order[idx + 1]);
                      }}
                      className="px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      Próximo
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}
                    className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !form.nome || !form.instituicao_id}
                    className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    {saving ? "Salvando..." : editingId ? "Atualizar Curso" : "Salvar Curso"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal de Importação CSV e-MEC ──────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl">
            {/* Header */}
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <FileSpreadsheet size={20} className="text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Importar cursos do e-MEC</h2>
                  <p className="text-sm text-gray-500">Faça upload do CSV exportado do e-MEC para importar todos os cursos da FIC</p>
                </div>
              </div>
              <button onClick={fecharImport} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Resultado da importação */}
              {importResultado && (
                <div className={`rounded-xl p-4 flex items-center gap-3 ${importResultado.erros === 0 ? "bg-green-50 border border-green-200" : "bg-amber-50 border border-amber-200"}`}>
                  <CheckCircle2 size={20} className={importResultado.erros === 0 ? "text-green-600" : "text-amber-500"} />
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{importResultado.ok} curso{importResultado.ok !== 1 ? "s" : ""} importado{importResultado.ok !== 1 ? "s" : ""} com sucesso!</p>
                    {importResultado.erros > 0 && <p className="text-xs text-amber-700">{importResultado.erros} curso(s) falharam. Tente novamente individualmente.</p>}
                  </div>
                  <button onClick={fecharImport} className="ml-auto text-sm font-medium text-primary-600 hover:underline">Fechar</button>
                </div>
              )}

              {/* Instrução de como exportar */}
              {cursosImportados.length === 0 && !importLoading && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-700 space-y-1">
                      <p className="font-semibold">Como exportar o CSV do e-MEC:</p>
                      <ol className="list-decimal ml-4 space-y-0.5">
                        <li>Acesse <strong>emec.mec.gov.br</strong> → Consulta de IES</li>
                        <li>Pesquise pela FIC (código 1606)</li>
                        <li>Clique em &quot;Cursos&quot; e depois em &quot;Exportar CSV&quot;</li>
                        <li>Faça upload do arquivo aqui</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}

              {/* Área de upload do CSV */}
              {cursosImportados.length === 0 && (
                <div
                  onClick={() => csvInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-primary-400 rounded-xl p-10 text-center cursor-pointer transition-colors group"
                >
                  {importLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={32} className="text-primary-500 animate-spin" />
                      <p className="text-sm text-gray-500">Processando CSV...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Upload size={32} className="text-gray-300 group-hover:text-primary-400 transition-colors" />
                      <div>
                        <p className="font-semibold text-gray-700">Clique para selecionar o arquivo CSV</p>
                        <p className="text-sm text-gray-400 mt-1">Arquivo exportado do e-MEC (.csv) — separador ponto e vírgula</p>
                      </div>
                    </div>
                  )}
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleCSVUpload}
                  />
                </div>
              )}

              {/* Erros de parse */}
              {importErros.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-red-500" />
                    <p className="text-xs font-semibold text-red-700">{importErros.length} linha(s) não puderam ser lidas:</p>
                  </div>
                  <ul className="text-xs text-red-600 space-y-0.5 max-h-20 overflow-auto">
                    {importErros.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              {/* Pré-visualização dos cursos */}
              {cursosImportados.length > 0 && !importResultado && (
                <>
                  {/* Seleção de instituição */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Vincular à instituição:</label>
                    <select
                      value={importInstituicaoId}
                      onChange={e => setImportInstituicaoId(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Selecione...</option>
                      {emissoras.map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* Legenda + controles */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" /> Novo — será importado</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-300 inline-block" /> Já existe no sistema</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> Extinto no e-MEC</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button onClick={() => toggleTodosCursos(true)} className="text-primary-600 hover:underline">Selecionar novos</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => toggleTodosCursos(false)} className="text-gray-500 hover:underline">Desmarcar todos</button>
                    </div>
                  </div>

                  {/* Tabela de cursos */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="w-10 px-3 py-2 text-center text-xs text-gray-500">#</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-500 font-semibold">Curso</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-500 font-semibold">Grau</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-500 font-semibold">Situação</th>
                          <th className="px-3 py-2 text-right text-xs text-gray-500 font-semibold">C.H.</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-500 font-semibold">Reconhecimento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cursosImportados.map((c, i) => (
                          <tr
                            key={i}
                            onClick={() => !c._jaExiste && toggleCursoImport(i)}
                            className={`transition-colors ${c._jaExiste ? "opacity-50 cursor-not-allowed bg-gray-50" : "cursor-pointer hover:bg-gray-50"} ${c._selecionado && !c._jaExiste ? "bg-green-50" : ""} ${!c._ativo && !c._jaExiste ? "bg-amber-50" : ""}`}
                          >
                            <td className="px-3 py-2 text-center">
                              {c._jaExiste ? (
                                <span title="Já existe no sistema">
                                  <CheckCircle2 size={14} className="text-gray-400 mx-auto" />
                                </span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={!!c._selecionado}
                                  onChange={() => toggleCursoImport(i)}
                                  onClick={e => e.stopPropagation()}
                                  className="accent-primary-500"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-800">{c.nome}</p>
                              <p className="text-xs text-gray-400">E-MEC: {c.codigo_emec} · {c.cine_area_geral}</p>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${GRAU_COLORS[c.grau] ?? "bg-gray-100 text-gray-600"}`}>
                                {GRAU_LABELS[c.grau] ?? c.grau}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${c.situacao_emec.toLowerCase().includes("atividade") ? "bg-green-100 text-green-700" : c.situacao_emec.toLowerCase().includes("extin") ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                                {c.situacao_emec}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">{c.carga_horaria_total ? `${c.carga_horaria_total}h` : "—"}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {c.tipo_reconhecimento && c.numero_reconhecimento ? `${c.tipo_reconhecimento} nº ${c.numero_reconhecimento}` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Rodapé com contagem */}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <p>
                      <span className="font-semibold text-green-600">{cursosImportados.filter(c => c._selecionado && !c._jaExiste).length}</span> selecionado(s) para importar ·{" "}
                      <span className="text-gray-400">{cursosImportados.filter(c => c._jaExiste).length} já existem</span>
                    </p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => { setCursosImportados([]); setImportErros([]); }} className="text-gray-500 hover:text-gray-700 text-sm">
                        ← Trocar arquivo
                      </button>
                      <button
                        onClick={confirmarImportacao}
                        disabled={importando || !importInstituicaoId || cursosImportados.filter(c => c._selecionado && !c._jaExiste).length === 0}
                        className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        {importando ? <><Loader2 size={14} className="animate-spin" /> Importando...</> : <><Upload size={14} /> Importar selecionados</>}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL — AGENTE IA (Wizard com múltiplos arquivos + análise cruzada)
      ═══════════════════════════════════════════════════════════════════ */}
      {showAgente && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">

            {/* ── Cabeçalho fixo ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Bot size={20} className="text-violet-600" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Agente IA — Processamento de Cursos</h2>
                  <p className="text-xs text-gray-500">
                    {agenteEtapa === "upload" && "Suba um ou mais arquivos com dados dos cursos"}
                    {agenteEtapa === "duvidas" && "A IA tem dúvidas sobre os dados — responda para continuar"}
                    {agenteEtapa === "divergencias" && "Dados conflitantes entre arquivos — escolha qual manter"}
                    {agenteEtapa === "revisao" && "Revise o que será importado antes de confirmar"}
                    {agenteEtapa === "confirmacao" && "Confirmação final antes de salvar"}
                    {agenteEtapa === "resultado" && "Importação concluída"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Indicador de etapa */}
                {agenteEtapa !== "upload" && agenteEtapa !== "resultado" && (
                  <div className="flex items-center gap-1.5">
                    {(["duvidas", "divergencias", "revisao", "confirmacao"] as EtapaAgente[]).map((e) => (
                      <div key={e} className={`w-2 h-2 rounded-full transition-colors ${agenteEtapa === e ? "bg-violet-500" : "bg-gray-200"}`} />
                    ))}
                  </div>
                )}
                <button onClick={fecharAgente} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* ── Conteúdo scrollável ── */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">

              {/* Erro global */}
              {agenteErro && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Erro ao processar</p>
                    <p className="text-xs text-red-600 mt-0.5">{agenteErro}</p>
                    <button onClick={() => { setAgenteErro(""); setAgenteEtapa("upload"); }} className="text-xs underline text-red-500 mt-2">
                      Tentar novamente
                    </button>
                  </div>
                </div>
              )}

              {/* ══ ETAPA 1: UPLOAD ══ */}
              {agenteEtapa === "upload" && !agenteLoading && (
                <div className="space-y-5">
                  {/* Seleção de instituição */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Vincular à instituição</label>
                    <select
                      value={agenteInstituicaoId}
                      onChange={e => setAgenteInstituicaoId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="">Selecione a instituição (para cursos novos)</option>
                      {emissoras.map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* Zona de drop/upload */}
                  <label className="flex flex-col items-center justify-center w-full min-h-[140px] border-2 border-dashed border-violet-300 rounded-xl cursor-pointer hover:border-violet-500 hover:bg-violet-50 transition-all group">
                    <div className="flex flex-col items-center gap-2 py-5">
                      <FileUp size={30} className="text-violet-300 group-hover:text-violet-500 transition-colors" />
                      <div className="text-center">
                        <p className="font-semibold text-gray-700">Clique para adicionar arquivos</p>
                        <p className="text-xs text-gray-400 mt-1">CSV, TXT, JSON, XML, imagens (PNG, JPG, PDF) · Até 25 arquivos</p>
                        <p className="text-xs text-violet-500 font-medium mt-1">A IA compara e cruza os dados de todos os arquivos</p>
                      </div>
                    </div>
                    <input
                      ref={agenteInputRef}
                      type="file"
                      multiple
                      accept=".csv,.txt,.json,.xml,.png,.jpg,.jpeg,.gif,.webp,.pdf"
                      className="hidden"
                      onChange={handleAgenteArquivosSelecionados}
                    />
                  </label>

                  {/* Lista de arquivos selecionados */}
                  {agenteArquivos.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Arquivos selecionados ({agenteArquivos.length}/25)</p>
                      {agenteArquivos.map((f, i) => (
                        <div key={i} className="flex items-center justify-between bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileSpreadsheet size={14} className="text-violet-500 shrink-0" />
                            <p className="text-sm text-gray-700 truncate">{f.name}</p>
                            <p className="text-xs text-gray-400 shrink-0">({(f.size / 1024).toFixed(0)} KB)</p>
                          </div>
                          <button onClick={() => removerArquivo(i)} className="text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-2">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Orientação para a IA (opcional, antes de processar) ── */}
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-violet-500 shrink-0" />
                      <p className="text-sm font-semibold text-gray-700">Orientação para a IA <span className="font-normal text-gray-400">(opcional)</span></p>
                    </div>
                    <textarea
                      value={agenteInstrucao}
                      onChange={e => setAgenteInstrucao(e.target.value)}
                      placeholder={"Ex: Os cursos nestas imagens são Administração e Direito\nEx: Ignore os modais abertos — foque nos dados principais\nEx: Periodicidade é semestral para todos os cursos"}
                      rows={3}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white resize-none"
                    />
                    <p className="text-xs text-gray-400">Contexto adicional que ajuda a IA a extrair os dados corretamente já na primeira tentativa.</p>
                  </div>
                </div>
              )}

              {/* Loading */}
              {agenteLoading && (
                <div className="flex flex-col items-center gap-4 py-16">
                  <Loader2 size={40} className="text-violet-500 animate-spin" />
                  <div className="text-center">
                    <p className="font-semibold text-gray-700">IA analisando {agenteArquivos.length} arquivo(s)...</p>
                    <p className="text-xs text-gray-400 mt-1">Extraindo dados, cruzando informações e identificando divergências</p>
                  </div>
                </div>
              )}

              {/* ══ ETAPA 2: DÚVIDAS DA IA ══ */}
              {agenteEtapa === "duvidas" && agenteResposta && (
                <div className="space-y-4">
                  {/* Dúvidas identificadas */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle size={16} className="text-amber-600" />
                      <p className="font-semibold text-amber-800 text-sm">A IA identificou {agenteResposta.duvidas.length} ponto(s) que precisam de esclarecimento</p>
                    </div>
                    <div className="space-y-3">
                      {agenteResposta.duvidas.map((duvida, i) => (
                        <div key={i} className="bg-white border border-amber-100 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <span className="text-amber-600 font-bold text-xs shrink-0 mt-0.5">{i + 1}.</span>
                            <p className="text-sm text-gray-700">{duvida}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Observações por arquivo */}
                  {agenteResposta.observacoes.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Observações da extração</p>
                      {agenteResposta.observacoes.map((obs, i) => (
                        <p key={i} className="text-xs text-gray-600">{obs}</p>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-400">Estas dúvidas são apenas informativas. A IA usou o melhor dado disponível. Você poderá editar individualmente na próxima etapa.</p>
                </div>
              )}

              {/* ══ ETAPA 3: DIVERGÊNCIAS ══ */}
              {agenteEtapa === "divergencias" && (() => {
                const divsPendentes = getDivergenciasPendentes();
                const divAtual = divsPendentes[agenteDivIdx];
                const totalDivs = divsPendentes.length;

                if (!divAtual) return (
                  <div className="text-center py-8">
                    <CheckCircle2 size={32} className="text-green-500 mx-auto mb-3" />
                    <p className="font-semibold text-gray-700">Todas as divergências resolvidas!</p>
                  </div>
                );

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">
                        Divergência {agenteDivIdx + 1} de {totalDivs}
                      </p>
                      <div className="flex gap-1">
                        {Array.from({ length: totalDivs }).map((_, i) => (
                          <div key={i} className={`w-2 h-2 rounded-full ${i < agenteDivIdx ? "bg-green-400" : i === agenteDivIdx ? "bg-violet-500" : "bg-gray-200"}`} />
                        ))}
                      </div>
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                      <div>
                        <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide">Curso</p>
                        <p className="font-semibold text-gray-900">{divAtual.nomeCurso}</p>
                      </div>
                      <div>
                        <p className="text-xs text-orange-500 font-semibold uppercase tracking-wide">Campo em conflito</p>
                        <p className="font-mono text-sm bg-orange-100 px-2 py-1 rounded text-orange-800 inline-block">{divAtual.div.campo}</p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 font-semibold">Escolha qual valor usar:</p>
                        {divAtual.div.valores.map((v, vi) => (
                          <button
                            key={vi}
                            onClick={() => {
                              resolverDivergencia(divAtual.cursoIdx, divAtual.divIdx, v.valor);
                              if (agenteDivIdx < totalDivs - 1) {
                                setAgenteDivIdx(i => i + 1);
                              } else {
                                setAgenteEtapa("revisao");
                              }
                            }}
                            className="w-full text-left flex items-start gap-3 border border-gray-200 hover:border-violet-400 hover:bg-violet-50 rounded-xl p-3 transition-colors group"
                          >
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-violet-500 shrink-0 mt-0.5 flex items-center justify-center">
                              <div className="w-2.5 h-2.5 rounded-full bg-transparent group-hover:bg-violet-500 transition-colors" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 text-sm break-words">{String(v.valor)}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-400">Fonte: {v.fonte}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${v.confianca === "alta" ? "bg-green-100 text-green-700" : v.confianca === "media" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                                  {v.confianca === "alta" ? "Alta confiança" : v.confianca === "media" ? "Média confiança" : "Baixa confiança"}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                        {/* Opção de pular / deixar em branco */}
                        <button
                          onClick={() => {
                            resolverDivergencia(divAtual.cursoIdx, divAtual.divIdx, null);
                            if (agenteDivIdx < totalDivs - 1) {
                              setAgenteDivIdx(i => i + 1);
                            } else {
                              setAgenteEtapa("revisao");
                            }
                          }}
                          className="w-full text-left flex items-center gap-3 border border-dashed border-gray-300 hover:border-gray-400 rounded-xl p-3 transition-colors text-gray-400 hover:text-gray-600"
                        >
                          <X size={14} className="shrink-0" />
                          <span className="text-sm">Deixar este campo em branco por enquanto</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ══ ETAPA 4: REVISÃO GERAL ══ */}
              {agenteEtapa === "revisao" && (
                <div className="space-y-4">
                  {/* Painel de resumo */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-gray-900">{agenteResposta?.total ?? 0}</p>
                      <p className="text-xs text-gray-500">Cursos</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-emerald-600">{agenteResposta?.para_criar ?? 0}</p>
                      <p className="text-xs text-emerald-600">Novos</p>
                    </div>
                    <div className="bg-violet-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-violet-600">{agenteResposta?.para_atualizar ?? 0}</p>
                      <p className="text-xs text-violet-600">Atualizações</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-amber-600">{agenteResposta?.total_campos_extras ?? 0}</p>
                      <p className="text-xs text-amber-600">Sem campo</p>
                    </div>
                  </div>

                  {/* Lista de cursos */}
                  <div className="space-y-2">
                    {cursosAgente.map((c, idx) => {
                      const nome = String(c.dados.nome || `Curso ${idx + 1}`);
                      const camposPreenchidos = Object.keys(c.dados).filter(k => !k.startsWith("_") && c.dados[k] !== null && c.dados[k] !== undefined && c.dados[k] !== "").length;
                      const temExtras = Object.keys(c.dados_extras).length > 0;
                      const temAusentes = c.campos_ausentes.length > 0;

                      return (
                        <div key={idx} className={`border rounded-xl overflow-hidden transition-colors ${!c._selecionado ? "opacity-50" : ""} ${c._acao === "criar" ? "border-emerald-200" : "border-violet-200"}`}>
                          <div className="flex items-center gap-3 px-4 py-3">
                            <input
                              type="checkbox"
                              checked={c._selecionado}
                              onChange={() => setCursosAgente(prev => prev.map((x, i) => i === idx ? { ...x, _selecionado: !x._selecionado } : x))}
                              className="rounded shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-gray-900 text-sm truncate">{nome}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${c._acao === "criar" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"}`}>
                                  {c._acao === "criar" ? "Criar novo" : `Atualizar: ${c._match?.nome || ""}`}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="text-xs text-gray-400">{camposPreenchidos} campos</span>
                                {c.fontes.length > 1 && <span className="text-xs text-blue-500">{c.fontes.length} fontes</span>}
                                {temAusentes && <span className="text-xs text-amber-600">⚠ {c.campos_ausentes.length} ausente(s)</span>}
                                {temExtras && <span className="text-xs text-orange-500">📌 {Object.keys(c.dados_extras).length} sem campo</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={c._acao}
                                onChange={e => setCursosAgente(prev => prev.map((x, i) => i === idx ? { ...x, _acao: e.target.value as CursoAnalisadoIA["_acao"] } : x))}
                                className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400"
                              >
                                <option value="criar">Criar novo</option>
                                <option value="atualizar" disabled={!c._match}>Atualizar</option>
                                <option value="ignorar">Ignorar</option>
                              </select>
                              <button
                                onClick={() => setCursosAgente(prev => prev.map((x, i) => i === idx ? { ...x, _expandido: !x._expandido } : x))}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {c._expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>
                          </div>

                          {/* Expandido: ausentes + extras */}
                          {c._expandido && (
                            <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50 space-y-3">
                              {/* Campos ausentes */}
                              {temAusentes && (
                                <div>
                                  <p className="text-xs font-semibold text-amber-600 mb-1.5">⚠ Campos relevantes não encontrados nos arquivos:</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {c.campos_ausentes.map(ca => (
                                      <span key={ca} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{ca}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Dados sem campo */}
                              {temExtras && (
                                <div>
                                  <p className="text-xs font-semibold text-orange-600 mb-1.5">📌 Dados encontrados que não têm campo correspondente no sistema:</p>
                                  <div className="space-y-1">
                                    {Object.entries(c.dados_extras).map(([campo, valores]) => (
                                      <div key={campo} className="flex items-start gap-2 text-xs">
                                        <span className="font-mono bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded shrink-0">{campo}</span>
                                        <span className="text-gray-500">{valores.join(" · ")}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-xs text-gray-400 mt-1">Estes dados não serão salvos (não há campo correspondente). Considere criar campos personalizados futuramente.</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Erros de arquivo */}
                  {(agenteResposta?.erros_arquivos?.length ?? 0) > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-red-600 mb-1">Problemas em alguns arquivos:</p>
                      {agenteResposta!.erros_arquivos.map((e, i) => (
                        <p key={i} className="text-xs text-red-500">{e}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══ ETAPA 5: RESULTADO ══ */}
              {agenteEtapa === "resultado" && agenteResultado && (
                <div className="text-center py-10 space-y-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${agenteResultado.erros === 0 ? "bg-green-100" : "bg-amber-100"}`}>
                    <CheckCircle2 size={32} className={agenteResultado.erros === 0 ? "text-green-600" : "text-amber-600"} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">{agenteResultado.sucesso} curso(s) salvo(s)</p>
                    {agenteResultado.erros > 0 && (
                      <p className="text-sm text-red-500 mt-1">{agenteResultado.erros} com erro</p>
                    )}
                  </div>
                  <button onClick={fecharAgente} className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors">
                    Fechar
                  </button>
                </div>
              )}
            </div>

            {/* ── Rodapé com navegação ── */}
            {!agenteLoading && agenteEtapa !== "resultado" && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 rounded-b-2xl">
                <button
                  onClick={() => {
                    if (agenteEtapa === "upload") fecharAgente();
                    else if (agenteEtapa === "duvidas") setAgenteEtapa("upload");
                    else if (agenteEtapa === "divergencias") setAgenteEtapa("duvidas");
                    else if (agenteEtapa === "revisao") {
                      setAgenteEtapa(getDivergenciasPendentes().length > 0 ? "divergencias" : "duvidas");
                      setAgenteDivIdx(0);
                    }
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  ← Voltar
                </button>

                <div className="flex items-center gap-3">
                  {agenteEtapa === "upload" && (
                    <button
                      onClick={processarArquivosIA}
                      disabled={agenteArquivos.length === 0 || !agenteInstituicaoId}
                      className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      <Sparkles size={16} />
                      {agenteArquivos.length === 0 ? "Selecione arquivos" : !agenteInstituicaoId ? "Selecione a instituição" : `Processar ${agenteArquivos.length} arquivo(s)`}
                    </button>
                  )}

                  {agenteEtapa === "duvidas" && (
                    <button
                      onClick={() => {
                        if ((agenteResposta?.total_divergencias ?? 0) > 0) {
                          setAgenteDivIdx(0);
                          setAgenteEtapa("divergencias");
                        } else {
                          setAgenteEtapa("revisao");
                        }
                      }}
                      className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      Entendido, continuar →
                    </button>
                  )}

                  {agenteEtapa === "divergencias" && (
                    <button
                      onClick={() => setAgenteEtapa("revisao")}
                      className="flex items-center gap-2 border border-violet-300 hover:bg-violet-50 text-violet-700 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      Pular restantes → Revisão
                    </button>
                  )}

                  {agenteEtapa === "revisao" && (
                    <button
                      onClick={confirmarAgente}
                      disabled={agenteSalvando || cursosAgente.filter(c => c._selecionado && c._acao !== "ignorar").length === 0}
                      className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      {agenteSalvando
                        ? <><Loader2 size={14} className="animate-spin" /> Salvando...</>
                        : <><CheckCircle2 size={14} /> Confirmar e salvar {cursosAgente.filter(c => c._selecionado && c._acao !== "ignorar").length} curso(s)</>
                      }
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL — AUDITORIA IA: Análise de completude dos cursos
      ═══════════════════════════════════════════════════════════════════ */}
      {showAuditoria && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <ShieldCheck size={20} className="text-amber-600" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Auditoria IA — Completude dos Cursos</h2>
                  <p className="text-xs text-gray-500">A IA analisa quais informações relevantes estão faltando em cada curso</p>
                </div>
              </div>
              <button onClick={() => { setShowAuditoria(false); setAuditoriaResultados([]); setAuditoriaResumo(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {/* Sem resultados ainda — tela inicial */}
              {auditoriaResultados.length === 0 && !auditoriaLoading && (
                <div className="text-center py-10 space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto">
                    <BarChart3 size={32} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">Análise de conformidade</h3>
                    <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
                      A auditoria verifica {cursos.length} curso(s) cadastrado(s) e identifica campos obrigatórios para o Diploma Digital faltando em cada um.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => rodarAuditoria("simples")}
                      className="flex items-center gap-2 border border-amber-300 hover:bg-amber-50 text-amber-700 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      <ShieldCheck size={16} />
                      Auditoria Rápida
                    </button>
                    <button
                      onClick={() => rodarAuditoria("completo")}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Sparkles size={16} />
                      Auditoria Completa com IA
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">A auditoria completa usa IA para dar recomendações personalizadas por curso</p>
                </div>
              )}

              {/* Loading */}
              {auditoriaLoading && (
                <div className="flex flex-col items-center gap-4 py-12">
                  <Loader2 size={36} className="text-amber-500 animate-spin" />
                  <p className="text-sm font-medium text-gray-700">Analisando cursos...</p>
                  <p className="text-xs text-gray-400">A IA está verificando cada campo obrigatório</p>
                </div>
              )}

              {/* Resultados */}
              {auditoriaResultados.length > 0 && auditoriaResumo && (
                <>
                  {/* Cards de resumo */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-gray-900">{auditoriaResumo.totalCursos}</p>
                      <p className="text-xs text-gray-500">Total</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{auditoriaResumo.cursosOk}</p>
                      <p className="text-xs text-green-600">Completos</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-amber-600">{auditoriaResumo.cursosAtencao}</p>
                      <p className="text-xs text-amber-600">Atenção</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{auditoriaResumo.cursosCriticos}</p>
                      <p className="text-xs text-red-600">Críticos</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{auditoriaResumo.mediaCompletude}%</p>
                      <p className="text-xs text-blue-600">Completude média</p>
                    </div>
                  </div>

                  {/* Análise IA (se disponível) */}
                  {auditoriaAnaliseIA && (
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={14} className="text-violet-600" />
                        <p className="text-sm font-semibold text-violet-800">Análise da IA</p>
                      </div>
                      <p className="text-sm text-violet-700 whitespace-pre-wrap">{auditoriaAnaliseIA}</p>
                    </div>
                  )}

                  {/* Lista por curso */}
                  <div className="space-y-2">
                    {auditoriaResultados.map((resultado) => (
                      <div key={resultado.id} className={`border rounded-xl overflow-hidden ${resultado.status === "ok" ? "border-green-200" : resultado.status === "atencao" ? "border-amber-200" : "border-red-200"}`}>
                        {/* Cabeçalho do curso */}
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                          onClick={() => setAuditoriaExpandido(auditoriaExpandido === resultado.id ? null : resultado.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${resultado.status === "ok" ? "bg-green-500" : resultado.status === "atencao" ? "bg-amber-500" : "bg-red-500"}`} />
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">{resultado.nome}</p>
                              <p className="text-xs text-gray-400">{resultado.codigo_emec || "sem código"} · {resultado.grau}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            {/* Barra de progresso */}
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${resultado.percentual >= 80 ? "bg-green-500" : resultado.percentual >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                  style={{ width: `${resultado.percentual}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-gray-600 w-8">{resultado.percentual}%</span>
                            </div>
                            {resultado.faltando.length > 0 && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${resultado.status === "critico" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                {resultado.faltando.length} campo(s) faltando
                              </span>
                            )}
                            {auditoriaExpandido === resultado.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                          </div>
                        </button>

                        {/* Detalhes expandidos */}
                        {auditoriaExpandido === resultado.id && (
                          <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
                            {resultado.faltando.length === 0 ? (
                              <p className="text-sm text-green-600 py-3 flex items-center gap-2">
                                <CheckCircle2 size={16} /> Todos os campos relevantes estão preenchidos!
                              </p>
                            ) : (
                              <div className="pt-3 space-y-3">
                                {/* Agrupa por peso */}
                                {(["crítico", "importante", "recomendado"] as const).map(peso => {
                                  const campos = resultado.faltando.filter(f => f.peso === peso);
                                  if (campos.length === 0) return null;
                                  return (
                                    <div key={peso}>
                                      <p className={`text-xs font-bold uppercase tracking-wide mb-1.5 ${peso === "crítico" ? "text-red-600" : peso === "importante" ? "text-amber-600" : "text-gray-500"}`}>
                                        {peso === "crítico" ? "🔴 Crítico" : peso === "importante" ? "🟡 Importante" : "⚪ Recomendado"}
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {campos.map(f => (
                                          <span key={f.campo} className={`text-xs px-2 py-1 rounded-lg ${peso === "crítico" ? "bg-red-100 text-red-700" : peso === "importante" ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-600"}`}>
                                            {f.label}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                                <button
                                  onClick={() => {
                                    const curso = cursos.find(c => c.id === resultado.id);
                                    if (curso) { handleEdit(curso); setShowAuditoria(false); }
                                  }}
                                  className="mt-2 text-xs text-primary-600 hover:text-primary-800 underline font-medium"
                                >
                                  → Editar este curso para preencher os campos
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Botão para nova auditoria */}
                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      onClick={() => rodarAuditoria("simples")}
                      className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      Refazer auditoria rápida
                    </button>
                    <button
                      onClick={() => rodarAuditoria("completo")}
                      className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 underline"
                    >
                      <Sparkles size={14} /> Auditoria completa com IA
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <AIAssistant
        context="cursos"
        placeholder="Pergunte sobre cursos e diplomas..."
        suggestions={[
          "O que é código E-MEC?",
          "Qual a carga horária mínima?",
          "Diferença entre grau e título?",
        ]}
      />

      {/* ─── Modal Merge de Cursos ─────────────────────────────────────────────── */}
      {showMerge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-teal-100 p-2 rounded-lg">
                  <Combine size={20} className="text-teal-600" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Mesclar Cursos</h2>
                  <p className="text-xs text-gray-500">
                    {mergeEtapa === "comparacao" && "Comparando campos e resolvendo conflitos"}
                    {mergeEtapa === "revisao" && "Revise os dados do curso mesclado"}
                    {mergeEtapa === "resultado" && "Mescla concluída com sucesso"}
                  </p>
                </div>
              </div>
              <button onClick={fecharMerge} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Progresso */}
            {mergeEtapa !== "resultado" && (
              <div className="px-6 pt-4 shrink-0">
                <div className="flex items-center gap-2">
                  {(["comparacao", "revisao"] as const).map((etapa, idx) => (
                    <div key={etapa} className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                        mergeEtapa === etapa ? "bg-teal-100 text-teal-700" : idx < ["comparacao","revisao"].indexOf(mergeEtapa) ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                      }`}>
                        {idx < ["comparacao","revisao"].indexOf(mergeEtapa) ? <CheckCircle2 size={12} /> : <span className="w-4 h-4 rounded-full border text-center leading-3 inline-flex items-center justify-center text-xs border-current">{idx+1}</span>}
                        {etapa === "comparacao" ? "Comparar" : "Revisar"}
                      </div>
                      {idx < 1 && <ChevronRight size={12} className="text-gray-300" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

              {/* Loading */}
              {mergeLoading && (
                <div className="flex flex-col items-center gap-4 py-16">
                  <Loader2 size={36} className="text-teal-500 animate-spin" />
                  <p className="text-sm font-medium text-gray-700">Analisando cursos...</p>
                  <p className="text-xs text-gray-400">A IA está identificando os melhores valores para cada campo</p>
                </div>
              )}

              {/* Etapa: Comparação */}
              {!mergeLoading && mergeEtapa === "comparacao" && mergePreview && (
                <>
                  {/* Cursos selecionados */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mergePreview.cursos.map((c, idx) => (
                      <div key={c.id} className={`border rounded-xl p-3 ${idx === 0 ? "border-teal-300 bg-teal-50" : "border-gray-200"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {idx === 0 && <span className="text-xs bg-teal-600 text-white px-1.5 py-0.5 rounded font-medium">Base</span>}
                          <p className="text-sm font-semibold text-gray-800 truncate">{c.nome}</p>
                        </div>
                        <p className="text-xs text-gray-500">{c.codigo_emec ? `E-MEC: ${c.codigo_emec}` : "sem código"} · {GRAU_LABELS[c.grau] || c.grau}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-400 rounded-full" style={{ width: `${Math.round((c.campos_preenchidos/c.total_campos)*100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{Math.round((c.campos_preenchidos/c.total_campos)*100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Resumo */}
                  <div className="flex flex-wrap gap-3">
                    <div className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-center">
                      <p className="text-lg font-bold text-teal-700">{mergePreview.campos_preenchidos}</p>
                      <p className="text-xs text-teal-600">Campos com dados</p>
                    </div>
                    <div className={`${mergePreview.campos_com_conflito > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"} border rounded-lg px-3 py-2 text-center`}>
                      <p className={`text-lg font-bold ${mergePreview.campos_com_conflito > 0 ? "text-amber-700" : "text-green-700"}`}>{mergePreview.campos_com_conflito}</p>
                      <p className={`text-xs ${mergePreview.campos_com_conflito > 0 ? "text-amber-600" : "text-green-600"}`}>Conflitos</p>
                    </div>
                  </div>

                  {/* Análise IA */}
                  {mergePreview.analise_ia && (
                    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={14} className="text-violet-600" />
                        <p className="text-sm font-semibold text-violet-800">Análise da IA sobre os conflitos</p>
                      </div>
                      <p className="text-sm text-violet-700 whitespace-pre-wrap">{mergePreview.analise_ia}</p>
                    </div>
                  )}

                  {/* Campos com conflito — para o usuário resolver */}
                  {mergePreview.sugestoes.filter(s => s.conflito).length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-500" />
                        Campos com valores diferentes — escolha o correto:
                      </p>
                      {mergePreview.sugestoes.filter(s => s.conflito).map((sugestao) => {
                        const valorAtual = mergeDadosFinais[sugestao.campo];
                        return (
                          <div key={sugestao.campo} className="border border-amber-200 rounded-xl p-4 bg-amber-50/30">
                            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">{sugestao.label}</p>
                            <div className="flex flex-wrap gap-2">
                              {sugestao.valores.filter(v => v.valor !== null && v.valor !== undefined && v.valor !== "").map((v) => (
                                <button
                                  key={`${sugestao.campo}-${String(v.valor)}`}
                                  onClick={() => setMergeDadosFinais(prev => ({ ...prev, [sugestao.campo]: v.valor }))}
                                  className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-all ${
                                    String(valorAtual) === String(v.valor)
                                      ? "border-teal-400 bg-teal-50 text-teal-800 font-medium"
                                      : "border-gray-200 bg-white text-gray-700 hover:border-teal-300"
                                  }`}
                                >
                                  <div>
                                    <p className="font-medium">{String(v.valor)}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{v.cursoNome}</p>
                                  </div>
                                  {String(valorAtual) === String(v.valor) && <CheckCircle2 size={14} className="text-teal-600 shrink-0 mt-0.5" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Campos sem conflito — resumo colapsado */}
                  {mergePreview.sugestoes.filter(s => !s.conflito && s.valor_sugerido !== null && s.valor_sugerido !== undefined && s.valor_sugerido !== "").length > 0 && (
                    <details className="border border-gray-200 rounded-xl">
                      <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl">
                        ✅ {mergePreview.sugestoes.filter(s => !s.conflito && s.valor_sugerido !== null && s.valor_sugerido !== undefined && s.valor_sugerido !== "").length} campos sem conflito — clique para ver
                      </summary>
                      <div className="px-4 pb-3 pt-1 grid grid-cols-2 md:grid-cols-3 gap-2">
                        {mergePreview.sugestoes.filter(s => !s.conflito && s.valor_sugerido !== null && s.valor_sugerido !== undefined && s.valor_sugerido !== "").map((s) => (
                          <div key={s.campo} className="text-xs bg-gray-50 rounded-lg p-2">
                            <p className="text-gray-400 font-medium">{s.label}</p>
                            <p className="text-gray-700 mt-0.5 truncate">{String(s.valor_sugerido)}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}

              {/* Etapa: Revisão */}
              {!mergeLoading && mergeEtapa === "revisao" && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Info size={14} className="text-blue-600" />
                      <p className="text-sm font-semibold text-blue-800">Como a mescla funciona</p>
                    </div>
                    <p className="text-sm text-blue-700">
                      O curso mais completo será mantido e atualizado com os melhores dados dos demais. Os outros {(mergePreview?.cursos.length || 1) - 1} curso(s) serão removidos.
                    </p>
                  </div>

                  {mergePreview && (
                    <div className="space-y-3">
                      <div className="border border-teal-300 bg-teal-50 rounded-xl p-4">
                        <p className="text-xs text-teal-600 font-bold uppercase tracking-wide mb-1">Curso que será mantido (base)</p>
                        <p className="font-semibold text-teal-900">{mergePreview.cursos[0]?.nome}</p>
                        <p className="text-xs text-teal-700">E-MEC: {mergePreview.cursos[0]?.codigo_emec || "—"}</p>
                      </div>

                      {mergePreview.cursos.slice(1).map((c) => (
                        <div key={c.id} className="border border-red-200 bg-red-50 rounded-xl p-4">
                          <p className="text-xs text-red-500 font-bold uppercase tracking-wide mb-1">Curso que será removido</p>
                          <p className="font-semibold text-red-800">{c.nome}</p>
                          <p className="text-xs text-red-600">E-MEC: {c.codigo_emec || "—"}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-700">Esta ação não pode ser desfeita. Confirme apenas se tiver certeza.</p>
                  </div>
                </div>
              )}

              {/* Resultado */}
              {mergeEtapa === "resultado" && mergeResultado && (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="bg-green-100 p-4 rounded-full">
                    <CheckCircle2 size={40} className="text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Mescla concluída!</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      O curso <strong>{mergeResultado.curso_nome}</strong> foi atualizado com os melhores dados.
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {mergeResultado.deletados} registro(s) duplicado(s) removido(s).
                    </p>
                  </div>
                  <button
                    onClick={fecharMerge}
                    className="mt-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>

            {/* Footer com ações */}
            {!mergeLoading && mergeEtapa !== "resultado" && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between shrink-0">
                <button
                  onClick={mergeEtapa === "comparacao" ? fecharMerge : () => setMergeEtapa("comparacao")}
                  className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                >
                  {mergeEtapa === "comparacao" ? "Cancelar" : "← Voltar"}
                </button>

                {mergeEtapa === "comparacao" && (
                  <button
                    onClick={() => setMergeEtapa("revisao")}
                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    Revisar e confirmar
                    <ChevronRight size={16} />
                  </button>
                )}

                {mergeEtapa === "revisao" && (
                  <button
                    onClick={salvarMerge}
                    disabled={mergeSalvando}
                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    {mergeSalvando ? (
                      <><Loader2 size={16} className="animate-spin" /> Mesclando...</>
                    ) : (
                      <><Combine size={16} /> Confirmar Mescla</>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
