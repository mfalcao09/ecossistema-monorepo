/**
 * Tipos para a Edge Function memorial-descritivo v1
 *
 * Sessão 145 — Bloco H Sprint 5 (US-130)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

// ============================================================
// Vertex & Boundary
// ============================================================

export interface VertexCoordinate {
  id: string;
  label: string;
  lat: number;
  lng: number;
  utm_e?: number;
  utm_n?: number;
  utm_zone?: string;
}

export interface BoundarySegment {
  from_vertex: string;
  to_vertex: string;
  azimuth_degrees: number;
  distance_m: number;
  confrontation: string;
}

// ============================================================
// ACTION: generate
// ============================================================

export interface GenerateMemorialParams {
  development_id: string;
  lot_id?: string;
  property_name: string;
  municipality: string;
  state: string;
  comarca: string;
  registration_number?: string;
  cns_code?: string;
  owner_name: string;
  owner_cpf_cnpj: string;
  vertices: VertexCoordinate[];
  boundary_segments?: BoundarySegment[];
  total_area_m2: number;
  perimeter_m: number;
  datum?: string;
  meridiano_central?: string;
  responsible_technician?: string;
  crea_cau?: string;
  art_rrt?: string;
  additional_notes?: string;
}

export interface GenerateMemorialResult {
  data?: {
    id: string;
    property_name: string;
    municipality: string;
    state: string;
    total_area_m2: number;
    perimeter_m: number;
    vertex_count: number;
    segment_count: number;
    memorial_text: string;
    memorial_html: string;
    technical_data: Record<string, unknown>;
    status: string;
    created_at: string;
  };
  error?: { code: string; message: string };
}

// ============================================================
// ACTION: get_memorial
// ============================================================

export interface GetMemorialParams {
  memorial_id: string;
}

export interface MemorialRecord {
  id: string;
  development_id: string;
  lot_id: string | null;
  property_name: string;
  municipality: string;
  state: string;
  comarca: string;
  owner_name: string;
  owner_cpf_cnpj: string;
  total_area_m2: number;
  perimeter_m: number;
  vertex_count: number;
  memorial_text: string;
  memorial_html: string;
  technical_data: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface GetMemorialResult {
  data?: MemorialRecord;
  error?: { code: string; message: string };
}

// ============================================================
// ACTION: list_memorials
// ============================================================

export interface ListMemorialsParams {
  development_id: string;
  limit?: number;
}

export interface MemorialSummary {
  id: string;
  property_name: string;
  municipality: string;
  state: string;
  total_area_m2: number;
  perimeter_m: number;
  vertex_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ListMemorialsResult {
  data?: {
    memorials: MemorialSummary[];
    count: number;
  };
  error?: { code: string; message: string };
}

// ============================================================
// Status labels PT-BR
// ============================================================

export const MEMORIAL_STATUS_LABELS: Record<string, string> = {
  generated: "Gerado",
  reviewed: "Revisado",
  approved: "Aprovado",
  submitted: "Protocolado",
  registered: "Registrado",
};

export const MEMORIAL_STATUS_COLORS: Record<string, string> = {
  generated: "#f59e0b",
  reviewed: "#3b82f6",
  approved: "#22c55e",
  submitted: "#8b5cf6",
  registered: "#10b981",
};

// ============================================================
// Brazilian states for select
// ============================================================

export const BRAZILIAN_STATES = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;
