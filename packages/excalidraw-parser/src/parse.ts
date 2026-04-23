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

function isShape(
  el: ExcalidrawElement,
): el is ExcalidrawElement & { type: ShapeType } {
  return (SHAPE_TYPES as string[]).includes(el.type);
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseInput(input: ExcalidrawFile | string): ExcalidrawFile {
  if (typeof input !== "string") return input;
  try {
    return JSON.parse(input) as ExcalidrawFile;
  } catch (cause) {
    throw new Error(
      `Failed to parse Excalidraw JSON: ${(cause as Error).message}`,
      { cause },
    );
  }
}

export function parseExcalidraw(input: ExcalidrawFile | string): ParsedDiagram {
  const file = parseInput(input);

  if (!file || typeof file !== "object") {
    throw new Error(`Expected Excalidraw object, got ${typeof file}`);
  }
  if (file.type !== "excalidraw") {
    throw new Error(`Expected type "excalidraw", got "${file.type}"`);
  }

  const rawElements = Array.isArray(file.elements) ? file.elements : [];
  const elements = rawElements.filter((el) => el && !el.isDeleted);

  // Pré-indexa text children por containerId em O(N) para evitar O(N²) em labelForShape
  const textByContainerId = new Map<string, ExcalidrawElement>();
  for (const el of elements) {
    if (
      el.type === "text" &&
      el.containerId &&
      !textByContainerId.has(el.containerId)
    ) {
      textByContainerId.set(el.containerId, el);
    }
  }

  const shapeIds = new Set<string>();
  for (const el of elements) {
    if (isShape(el)) shapeIds.add(el.id);
  }

  const nodes: Node[] = [];
  for (const el of elements) {
    if (!isShape(el)) continue;
    nodes.push({
      id: el.id,
      shape: el.type as ShapeType,
      label: safeText(textByContainerId.get(el.id)?.text),
    });
  }

  const edges: Edge[] = [];
  for (const el of elements) {
    if (el.type !== "arrow") continue;
    edges.push({
      id: el.id,
      fromId: el.startBinding?.elementId ?? null,
      toId: el.endBinding?.elementId ?? null,
      label: safeText(el.text),
    });
  }

  // Texto solto: text element NÃO ligado a nenhuma shape (containerId ausente OU
  // apontando para shape inexistente/deletada). Se containerId aponta pra outro
  // text, considera solto também (não há nó pai).
  const floatingTexts: FloatingText[] = [];
  for (const el of elements) {
    if (el.type !== "text") continue;
    const isBoundToShape = el.containerId && shapeIds.has(el.containerId);
    if (isBoundToShape) continue;
    const text = safeText(el.text);
    if (text.length === 0) continue;
    floatingTexts.push({ id: el.id, text });
  }

  return { nodes, edges, floatingTexts };
}
