export type ShapeType = "rectangle" | "ellipse" | "diamond";
export type ExcalidrawElementType = ShapeType | "arrow" | "line" | "text" | "freedraw";

export interface ExcalidrawBinding {
  elementId: string;
  focus?: number;
  gap?: number;
}

export interface ExcalidrawElement {
  id: string;
  type: ExcalidrawElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  containerId?: string | null;
  boundElements?: Array<{ id: string; type: string }> | null;
  startBinding?: ExcalidrawBinding | null;
  endBinding?: ExcalidrawBinding | null;
  isDeleted?: boolean;
}

export interface ExcalidrawFile {
  type: "excalidraw";
  version: number;
  source?: string;
  elements: ExcalidrawElement[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export interface Node {
  id: string;
  shape: ShapeType;
  label: string;
}

export interface Edge {
  id: string;
  fromId: string | null;
  toId: string | null;
  label: string;
}

export interface FloatingText {
  id: string;
  text: string;
}

export interface ParsedDiagram {
  nodes: Node[];
  edges: Edge[];
  floatingTexts: FloatingText[];
}
