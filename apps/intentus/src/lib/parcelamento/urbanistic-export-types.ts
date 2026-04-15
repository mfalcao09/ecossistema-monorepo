/**
 * Tipos para a Edge Function urbanistic-project-export v1
 *
 * Sessão 143 — Bloco H Sprint 3 (US-131)
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */

// ============================================================
// US-131: Pré-projeto urbanístico DXF
// ============================================================

export interface GenerateDxfRequest {
  action: "generate_dxf";
  development_id: string;
  nome?: string;
  municipio?: string;
  uf?: string;
  area_total_m2?: number;
  convert_to_dwg?: boolean;
}

export interface DxfFileInfo {
  filename: string;
  content_base64: string;
  size_bytes: number;
  format: string;
}

export interface DwgFileInfo {
  filename: string;
  content_base64: string;
  format: string;
}

export interface LayoutSummary {
  lotes: number;
  quadras: number;
  vias: number;
  apps: number;
  areas_verdes: number;
  areas_institucionais: number;
  area_total_m2: number;
}

export interface GenerateDxfResult {
  ok: boolean;
  data?: {
    dxf: DxfFileInfo;
    dwg: DwgFileInfo | null;
    layout_summary: LayoutSummary;
    layers: string[];
    nota: string;
  };
  error?: { code: string; message: string };
}

// ============================================================
// PDF Layout (dados para renderização no frontend)
// ============================================================

export interface GeneratePdfLayoutRequest {
  action: "generate_pdf_layout";
  development_id: string;
  nome?: string;
  municipio?: string;
  uf?: string;
  area_total_m2?: number;
}

export interface QuadroAreas {
  area_total_m2: number;
  area_lotes_m2: number;
  area_vias_m2: number;
  area_app_m2: number;
  area_verde_m2: number;
  area_institucional_m2: number;
  pct_area_util: number;
  pct_area_verde: number;
}

export interface GeneratePdfLayoutResult {
  ok: boolean;
  data?: {
    layout: unknown; // ParcelamentoLayout completo
    quadro_areas: QuadroAreas;
    nota: string;
  };
  error?: { code: string; message: string };
}
