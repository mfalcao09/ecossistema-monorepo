import type { ParsedDiagram } from "./types.js";

function nodeById(parsed: ParsedDiagram, id: string | null): string {
  if (!id) return "(sem âncora)";
  const n = parsed.nodes.find((x) => x.id === id);
  if (!n) return `(?${id.slice(0, 6)})`;
  return n.label || `(sem rótulo ${n.shape})`;
}

export function toMarkdown(parsed: ParsedDiagram, title = "Diagrama Excalidraw"): string {
  const lines: string[] = [`# ${title}`, ""];

  lines.push(`## Formas (${parsed.nodes.length})`, "");
  if (parsed.nodes.length === 0) {
    lines.push("_nenhuma forma rotulável_", "");
  } else {
    for (const n of parsed.nodes) {
      const label = n.label || "(sem rótulo)";
      lines.push(`- **${label}** _(${n.shape})_`);
    }
    lines.push("");
  }

  lines.push(`## Conexões (${parsed.edges.length})`, "");
  if (parsed.edges.length === 0) {
    lines.push("_nenhuma seta_", "");
  } else {
    for (const e of parsed.edges) {
      const from = nodeById(parsed, e.fromId);
      const to = nodeById(parsed, e.toId);
      const label = e.label ? ` — _${e.label}_` : "";
      lines.push(`- ${from} → ${to}${label}`);
    }
    lines.push("");
  }

  if (parsed.floatingTexts.length > 0) {
    lines.push(`## Notas soltas (${parsed.floatingTexts.length})`, "");
    for (const t of parsed.floatingTexts) {
      lines.push(`- ${t.text}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
