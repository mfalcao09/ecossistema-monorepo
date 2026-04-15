/**
 * Tipos para a Edge Function cri-matricula v1
 *
 * Sessão 145 — Bloco H Sprint 5 (US-133)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 *
 * CRI (Cartório de Registro de Imóveis) — Smart lookup + manual input
 * Since there is no public API for CRI in Brazil, this EF provides:
 *  - Manual registration of matrícula data (property registration number)
 *  - Validation of matrícula format
 *  - Duplicate checking
 *  - Storage for contract legal analysis (reference to property source)
 */

// ============================================================
// Matrícula Record — Core Model
// ============================================================

export interface MatriculaRecord {
  id: string;
  development_id: string;
  tenant_id: string;
  numero_matricula: string;
  cartorio_nome: string;
  cartorio_codigo: string;
  comarca: string;
  uf: string;
  proprietario_nome: string;
  proprietario_cpf_cnpj?: string;
  area_terreno_m2: number;
  data_registro: string; // ISO date
  averbacoes: AverbacaoItem[];
  onus: OnusItem[];
  status: "ativo" | "cancelado" | "extinto";
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Averbação — Alterações/Anotações na matrícula
// ============================================================

export interface AverbacaoItem {
  id: string;
  numero_averbacao: string;
  data: string;
  tipo: "divisao" | "desmembramento" | "remembramento" | "retificacao" | "outro";
  descricao: string;
  novas_areas?: {
    lote_numero: string;
    area_m2: number;
  }[];
}

// ============================================================
// Ônus — Gravames (hipotecas, penhoras, etc)
// ============================================================

export interface OnusItem {
  id: string;
  numero_onus: string;
  data: string;
  tipo: "hipoteca" | "penhora" | "arresto" | "caução" | "outro";
  credor_nome: string;
  valor_garantido?: number;
  data_liberacao?: string;
  descricao: string;
}

// ============================================================
// ACTIONS: Register Matrícula
// ============================================================

export interface RegisterMatriculaRequest {
  action: "register_matricula";
  development_id: string;
  numero_matricula: string;
  cartorio_nome: string;
  cartorio_codigo: string;
  comarca: string;
  uf: string;
  proprietario_nome: string;
  proprietario_cpf_cnpj?: string;
  area_terreno_m2: number;
  data_registro: string;
  averbacoes?: AverbacaoItem[];
  onus?: OnusItem[];
  observacoes?: string;
}

export interface RegisterMatriculaResult {
  ok: boolean;
  data?: MatriculaRecord;
  error?: { code: string; message: string };
}

// ============================================================
// ACTIONS: Get Matrícula
// ============================================================

export interface GetMatriculaRequest {
  action: "get_matricula";
  matricula_id: string;
}

export interface GetMatriculaResult {
  ok: boolean;
  data?: MatriculaRecord;
  error?: { code: string; message: string };
}

// ============================================================
// ACTIONS: List Matrícula(s)
// ============================================================

export interface ListMatriculasRequest {
  action: "list_matriculas";
  development_id: string;
  only_active?: boolean;
  limit?: number;
  offset?: number;
}

export interface ListMatriculasResult {
  ok: boolean;
  data?: {
    matriculas: MatriculaRecord[];
    total: number;
    offset: number;
    limit: number;
  };
  error?: { code: string; message: string };
}

// ============================================================
// ACTIONS: Validate Matrícula
// ============================================================

export interface ValidateMatriculaRequest {
  action: "validate_matricula";
  numero_matricula: string;
  cartorio_codigo: string;
  development_id?: string; // Check for duplicates within this development
}

export interface ValidateMatriculaResult {
  ok: boolean;
  data?: {
    is_valid: boolean;
    format_ok: boolean;
    duplicated: boolean;
    message: string;
    sugestao?: string;
  };
  error?: { code: string; message: string };
}

// ============================================================
// Status Labels (PT-BR)
// ============================================================

export const MATRICULA_STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  cancelado: "Cancelado",
  extinto: "Extinto",
};

export const AVERBACAO_TIPO_LABELS: Record<string, string> = {
  divisao: "Divisão",
  desmembramento: "Desmembramento",
  remembramento: "Remembramento",
  retificacao: "Retificação",
  outro: "Outro",
};

export const ONUS_TIPO_LABELS: Record<string, string> = {
  hipoteca: "Hipoteca",
  penhora: "Penhora",
  arresto: "Arresto",
  caução: "Caução",
  outro: "Outro",
};

// ============================================================
// Combined Request/Response Types
// ============================================================

export type CriMatriculaRequest =
  | RegisterMatriculaRequest
  | GetMatriculaRequest
  | ListMatriculasRequest
  | ValidateMatriculaRequest;

export type CriMatriculaResult =
  | RegisterMatriculaResult
  | GetMatriculaResult
  | ListMatriculasResult
  | ValidateMatriculaResult;
