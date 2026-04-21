import type {
  Edge,
  ExcalidrawElement,
  ExcalidrawFile,
  FloatingText,
  Node,
  ParsedDiagram,
  ShapeType,
} from "./types.js";

const SHAPE_TYPES: ShapeType[] = ["rectangle", "ellipse", "diamond"];

function isShape(el: ExcalidrawElement): el is ExcalidrawElement & { type: ShapeType } {
  return (SHAPE_TYPES as string[]).includes(el.type);
}

function labelForShape(el: ExcalidrawElement, all: ExcalidrawElement[]): string {
  const textChild = all.find(
    (t) => t.type === "text" && t.containerId === el.id && !t.isDeleted,
  );
  return (textChild?.text ?? "").trim();
}

function labelForArrow(el: ExcalidrawElement): string {
  return (el.text ?? "").trim();
}

export function parseExcalidraw(input: ExcalidrawFile | string): ParsedDiagram {
  const file: ExcalidrawFile = typeof input === "string" ? JSON.parse(input) : input;
  if (file.type !== "excalidraw") {
    throw new Error(`Expected type "excalidraw", got "${file.type}"`);
  }

  const elements = file.elements.filter((el) => !el.isDeleted);
  const shapeIds = new Set(elements.filter(isShape).map((el) => el.id));

  const nodes: Node[] = elements.filter(isShape).map((el) => ({
    id: el.id,
    shape: el.type as ShapeType,
    label: labelForShape(el, elements),
  }));

  const edges: Edge[] = elements
    .filter((el) => el.type === "arrow")
    .map((el) => ({
      id: el.id,
      fromId: el.startBinding?.elementId ?? null,
      toId: el.endBinding?.elementId ?? null,
      label: labelForArrow(el),
    }));

  const containedTextIds = new Set(
    elements
      .filter((el) => el.type === "text" && el.containerId && shapeIds.has(el.containerId))
      .map((el) => el.id),
  );

  const floatingTexts: FloatingText[] = elements
    .filter((el) => el.type === "text" && !containedTextIds.has(el.id))
    .map((el) => ({ id: el.id, text: (el.text ?? "").trim() }))
    .filter((t) => t.text.length > 0);

  return { nodes, edges, floatingTexts };
}
