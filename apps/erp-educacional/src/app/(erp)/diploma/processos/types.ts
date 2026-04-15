// ─── Tipos do Formulário de Diploma Digital — v2 ─────────────────────────────
// Baseado no XSD v1.05 + Aluno Digital + Premissas Marcelo 28/03/2026

// ── Campo com confiança IA ──────────────────────────────────────────────────
export interface CampoIA {
  valor: string;
  confianca: number;
}

// ── Genitor (Filiação dinâmica) ─────────────────────────────────────────────
export interface Genitor {
  id: string;
  nome: string;
  sexo: string;           // "Masculino" | "Feminino"
  nome_social?: string;
}

// ── Disciplina ──────────────────────────────────────────────────────────────
export interface Disciplina {
  id: string;
  codigo: string;
  nome: string;
  situacao: string;       // Aprovado, Reprovado, etc
  periodo?: string;
  carga_horaria: string;
  ch_hora_relogio?: string;
  nota?: string;
  conceito?: string;
  nota_ate_100?: string;
  conceito_rm?: string;
  forma_integralizada?: string;
  conceito_especifico?: string;
  etiqueta?: string;
  nome_docente?: string;
  titulacao_docente?: string;
  cpf_docente?: string;
  lattes_docente?: string;
  // Verificação anti-alucinação: true = docente veio da lista de professores (confiável)
  docente_verificado?: boolean;
  // Indicadores de completude
  campos_pendentes?: string[];
}

// ── Atividade Complementar ──────────────────────────────────────────────────
export interface AtividadeComplementar {
  id: string;
  codigo?: string;
  data_inicio?: string;
  data_fim?: string;
  data_registro?: string;
  tipo?: string;
  ch_hora_relogio?: string;
  etiqueta?: string;
  descricao?: string;
  docentes?: DocenteInfo[];
}

// ── Estágio ─────────────────────────────────────────────────────────────────
export interface Estagio {
  id: string;
  codigo_unidade_curricular?: string;
  data_inicio?: string;
  data_fim?: string;
  etiqueta?: string;
  concedente_cnpj?: string;
  concedente_razao_social?: string;
  concedente_nome_fantasia?: string;
  ch_hora_relogio?: string;
  descricao?: string;
  docentes?: DocenteInfo[];
}

// ── Docente (reutilizável) ──────────────────────────────────────────────────
export interface DocenteInfo {
  nome: string;
  titulacao?: string;
  cpf?: string;
  lattes?: string;
}

// ── Assinante ───────────────────────────────────────────────────────────────
export interface Assinante {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
}

// ── Habilitação ─────────────────────────────────────────────────────────────
export interface Habilitacao {
  id: string;
  nome: string;
  data: string;
}

// ── Área do Curso ───────────────────────────────────────────────────────────
export interface AreaCurso {
  id: string;
  codigo: string;
  nome: string;
}

// ── Ato Regulatório (reutilizável para Autorização, Reconhecimento, etc.) ───
export interface AtoRegulatorio {
  tipo?: string;
  numero?: string;
  data?: string;
  veiculo_publicacao?: string;
  numero_dou?: string;
  data_publicacao?: string;
  secao_publicacao?: string;
  pagina_publicacao?: string;
  // Processo vinculado
  processo_tipo?: string;
  processo_numero?: string;
  processo_data_cadastro?: string;
  processo_data_protocolo?: string;
}

// ── Endereço (reutilizável) ─────────────────────────────────────────────────
export interface Endereco {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  codigo_municipio?: string;
  uf?: string;
  municipio_estrangeiro?: string;
}

// ── Dados extraídos pela IA (expandido) ─────────────────────────────────────
export interface DadosExtraidos {
  // ─── Seção 1: Dados do Processo ────────────────────
  nome_processo?: CampoIA;
  curso?: CampoIA & { curso_id?: string };
  turno?: CampoIA;
  periodo_letivo?: CampoIA;
  data_colacao?: CampoIA;

  // ─── Seção 2: Dados Pessoais do Diplomado ──────────
  nome_aluno?: CampoIA;
  nome_social?: CampoIA;
  cpf?: CampoIA;
  data_nascimento?: CampoIA;
  sexo?: CampoIA;
  nacionalidade?: CampoIA;
  naturalidade?: CampoIA;
  naturalidade_municipio?: CampoIA;
  naturalidade_codigo_municipio?: CampoIA;
  naturalidade_uf?: CampoIA;
  rg?: CampoIA;
  rg_uf?: CampoIA;
  rg_orgao_expedidor?: CampoIA;
  doc_substituto_rg?: CampoIA;
  telefone?: CampoIA;
  email?: CampoIA;
  // Filiação (extraída como texto, depois convertida em Genitor[])
  filiacao_mae?: CampoIA;
  filiacao_pai?: CampoIA;

  // ─── Seção 6: Dados Acadêmicos ────────────────────
  forma_acesso?: CampoIA;
  data_ingresso?: CampoIA;
  data_conclusao?: CampoIA;
  carga_horaria_total?: CampoIA;
  carga_horaria_curso?: CampoIA;
  hora_aula?: CampoIA;
  codigo_curriculo?: CampoIA;
  situacao_enade?: CampoIA;
  enade_condicao?: CampoIA;
  enade_edicao?: CampoIA;

  // ─── Campos genéricos ─────────────────────────────
  [chave: string]: any;
}

// ── Estado completo da revisão (editável) ────────────────────────────────────
export interface EstadoRevisao {
  tipo: "individual";

  // Seção 1: Processo
  nome: string;                  // Auto: {CPF} - {NOME} — readonly
  curso_id: string;
  turno: string;
  periodo_letivo: string;
  data_colacao: string;
  observacoes: string;

  // Seção 2: Dados Pessoais
  nome_aluno: string;
  nome_social: string;
  cpf: string;
  data_nascimento: string;
  sexo: string;
  nacionalidade: string;
  naturalidade_municipio: string;
  naturalidade_codigo_municipio: string;
  naturalidade_uf: string;
  rg_numero: string;
  rg_uf: string;
  rg_orgao_expedidor: string;
  doc_substituto_rg: string;
  telefone: string;
  email: string;
  genitores: Genitor[];

  // Seção 6: Dados Acadêmicos
  forma_acesso: string;
  data_ingresso: string;
  data_conclusao: string;
  situacao_discente: string;     // Auto: "Formado"
  codigo_curriculo: string;
  carga_horaria_curso: string;
  carga_horaria_integralizada: string;
  hora_aula: string;
  data_emissao_historico: string;
  hora_emissao_historico: string;

  // ENADE
  enade_situacao: string;  // "CursoSelecionado" | "CursoNaoSelecionado"
  enade_condicao: string;  // "Regular" | "Irregular" (só quando curso selecionado)
  enade_edicao: string;    // Ano da edição (= ano de conclusão)
  enade_condicao_nao_habilitados: string; // legado — mantido para compatibilidade

  // Áreas
  nome_para_areas: string;
  areas: AreaCurso[];

  // Seção 7: Disciplinas
  disciplinas: Disciplina[];

  // Seção 8: Atividades Complementares
  atividades_complementares: AtividadeComplementar[];

  // Seção 9: Estágio
  estagios: Estagio[];

  // Seção 10: Assinantes
  ecnpj_emissora: string;
  assinantes_diploma: Assinante[];

  // Seção 11: Decisão Judicial
  decisao_judicial: boolean;
  dj_numero_processo: string;
  dj_nome_juiz: string;
  dj_decisao: string;
  dj_declaracoes: string;

  // Seção 12: Habilitações
  habilitacoes: Habilitacao[];
}

// ── Dados do Curso (auto-preenchidos do cadastro) ────────────────────────────
export interface DadosCursoCadastro {
  id: string;
  nome: string;
  codigo_emec?: string;
  modalidade?: string;
  titulo_conferido?: string;
  grau_conferido?: string;
  outro_titulo?: string;
  endereco?: Endereco;
  polo?: { nome?: string; codigo_emec?: string; endereco?: Endereco };
  autorizacao?: AtoRegulatorio;
  reconhecimento?: AtoRegulatorio;
  renovacao_reconhecimento?: AtoRegulatorio;
  carga_horaria?: string;
  hora_aula?: string;
  codigo_curriculo?: string;
  habilitacoes?: Habilitacao[];
  areas?: AreaCurso[];
}

// ── Dados da IES Emissora (auto-preenchidos do cadastro) ─────────────────────
export interface DadosEmissoraCadastro {
  nome?: string;
  codigo_mec?: string;
  cnpj?: string;
  endereco?: Endereco;
  credenciamento?: AtoRegulatorio;
  recredenciamento?: AtoRegulatorio;
  renovacao_recredenciamento?: AtoRegulatorio;
  mantenedora?: {
    razao_social?: string;
    cnpj?: string;
    endereco?: Endereco;
  };
  termo_responsabilidade?: {
    nome?: string;
    cpf?: string;
    cargo?: string;
  };
  ecnpj?: string;
}

// ── Curso simples (dropdown) ─────────────────────────────────────────────────
export interface Curso {
  id: string;
  nome: string;
  grau: string;
}

// ── Estado inicial da revisão ────────────────────────────────────────────────
export const REVISAO_INICIAL: EstadoRevisao = {
  tipo: "individual",
  nome: "",
  curso_id: "",
  turno: "Matutino",
  periodo_letivo: "",
  data_colacao: "",
  observacoes: "",
  nome_aluno: "",
  nome_social: "",
  cpf: "",
  data_nascimento: "",
  sexo: "",
  nacionalidade: "Brasileira",
  naturalidade_municipio: "",
  naturalidade_codigo_municipio: "",
  naturalidade_uf: "",
  rg_numero: "",
  rg_uf: "",
  rg_orgao_expedidor: "",
  doc_substituto_rg: "",
  telefone: "",
  email: "",
  genitores: [{ id: "gen-1", nome: "", sexo: "Feminino", nome_social: "" }],
  forma_acesso: "",
  data_ingresso: "",
  data_conclusao: "",
  situacao_discente: "Formado",
  codigo_curriculo: "",
  carga_horaria_curso: "",
  carga_horaria_integralizada: "",
  hora_aula: "",
  data_emissao_historico: new Date().toISOString().split("T")[0],
  hora_emissao_historico: new Date().toTimeString().slice(0, 5),
  enade_situacao: "",
  enade_condicao: "",
  enade_edicao: "",
  enade_condicao_nao_habilitados: "",
  nome_para_areas: "",
  areas: [],
  disciplinas: [],
  atividades_complementares: [],
  estagios: [],
  ecnpj_emissora: "",
  assinantes_diploma: [],
  decisao_judicial: false,
  dj_numero_processo: "",
  dj_nome_juiz: "",
  dj_decisao: "",
  dj_declaracoes: "",
  habilitacoes: [],
};
