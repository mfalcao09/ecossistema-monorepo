// ─── CAD Studio Types ─────────────────────────────────────────────────────────

export type CADTool = 'select' | 'pan' | 'line' | 'polygon' | 'text' | 'delete';

export type CADElementCategory =
  | 'lote'
  | 'quadra'
  | 'via'
  | 'area_verde'
  | 'area_institucional'
  | 'app'
  | 'reserva_legal'
  | 'area_lazer'
  | 'annotation'
  | 'line';

export interface CADElementStyle {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeDash?: number[];
}

export interface CADElement {
  id: string;
  category: CADElementCategory;
  label?: string;
  layerId: string;
  coordinates: [number, number][]; // [lng, lat] — source of truth
  closed: boolean;                 // true = polygon, false = polyline/line
  style: CADElementStyle;
  properties: {
    area_m2?: number;
    perimeter_m?: number;
    [key: string]: unknown;
  };
  createdAt: string;
}

export interface CADLayer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  order: number;
}

export interface CADSettings {
  gridSize: number;
  snapEnabled: boolean;
  snapThreshold: number;
  showGrid: boolean;
  showDimensions: boolean;
  gridUnit: 'm' | 'ft';
}

export interface CADProjectData {
  id: string;
  name: string;
  development_id: string;
  version: number;
  canvas_state: CADCanvasState;
  settings: CADSettings;
  created_at: string;
  updated_at: string;
}

export interface CADCanvasState {
  elements: CADElement[];
  layers: CADLayer[];
  viewport?: {
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  };
}

export const CATEGORY_STYLES: Record<CADElementCategory, CADElementStyle> = {
  lote:               { fill: '#3b82f6', fillOpacity: 0.15, stroke: '#1d4ed8', strokeWidth: 2 },
  quadra:             { fill: '#8b5cf6', fillOpacity: 0.10, stroke: '#6d28d9', strokeWidth: 2.5 },
  via:                { fill: '#6b7280', fillOpacity: 0.25, stroke: '#374151', strokeWidth: 2 },
  area_verde:         { fill: '#22c55e', fillOpacity: 0.30, stroke: '#15803d', strokeWidth: 1.5 },
  area_institucional: { fill: '#f59e0b', fillOpacity: 0.25, stroke: '#b45309', strokeWidth: 2 },
  app:                { fill: '#06b6d4', fillOpacity: 0.20, stroke: '#0e7490', strokeWidth: 1.5 },
  reserva_legal:      { fill: '#84cc16', fillOpacity: 0.20, stroke: '#4d7c0f', strokeWidth: 1.5 },
  area_lazer:         { fill: '#f97316', fillOpacity: 0.20, stroke: '#c2410c', strokeWidth: 1.5 },
  annotation:         { fill: 'transparent', fillOpacity: 0, stroke: '#1f2937', strokeWidth: 1 },
  line:               { fill: 'transparent', fillOpacity: 0, stroke: '#374151', strokeWidth: 2 },
};

export const DEFAULT_LAYERS: CADLayer[] = [
  { id: 'lotes',  name: 'Lotes',               color: '#3b82f6', visible: true, locked: false, order: 0 },
  { id: 'vias',   name: 'Sistema Viário',       color: '#6b7280', visible: true, locked: false, order: 1 },
  { id: 'verde',  name: 'Área Verde',           color: '#22c55e', visible: true, locked: false, order: 2 },
  { id: 'inst',   name: 'Área Institucional',   color: '#f59e0b', visible: true, locked: false, order: 3 },
  { id: 'app',    name: 'APP',                  color: '#06b6d4', visible: true, locked: false, order: 4 },
  { id: 'notas',  name: 'Anotações',            color: '#9ca3af', visible: true, locked: false, order: 5 },
];

export const DEFAULT_SETTINGS: CADSettings = {
  gridSize: 10,
  snapEnabled: true,
  snapThreshold: 12,
  showGrid: true,
  showDimensions: true,
  gridUnit: 'm',
};

export const CATEGORY_LABELS: Record<CADElementCategory, string> = {
  lote:               'Lote',
  quadra:             'Quadra',
  via:                'Via',
  area_verde:         'Área Verde',
  area_institucional: 'Área Institucional',
  app:                'APP',
  reserva_legal:      'Reserva Legal',
  area_lazer:         'Área de Lazer',
  annotation:         'Anotação',
  line:               'Linha',
};

export const CATEGORY_DEFAULT_LAYER: Record<CADElementCategory, string> = {
  lote:               'lotes',
  quadra:             'lotes',
  via:                'vias',
  area_verde:         'verde',
  area_institucional: 'inst',
  app:                'app',
  reserva_legal:      'app',
  area_lazer:         'verde',
  annotation:         'notas',
  line:               'notas',
};
