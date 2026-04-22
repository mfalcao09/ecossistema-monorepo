"use client";

import { useState } from "react";
import { NODE_CATEGORIES, NODE_LABELS, type DsBotNodeType, type NodeCategory } from "@/lib/atendimento/ds-bot-types";

const CATEGORY_ORDER: NodeCategory[] = ["bubble", "input", "logic", "flow", "contact", "message", "attendance", "agent"];

const CATEGORY_ICON: Record<NodeCategory, string> = {
  trigger: "▶️",
  bubble: "💬",
  input: "⌨️",
  logic: "🔀",
  flow: "🧭",
  contact: "🏷️",
  message: "📨",
  attendance: "🎧",
  agent: "🤖",
};

export default function NodePalette() {
  const [open, setOpen] = useState<Record<string, boolean>>({ bubble: true, input: true });

  function onDragStart(event: React.DragEvent, nodeType: DsBotNodeType) {
    event.dataTransfer.setData("application/dsbot-node-type", nodeType);
    event.dataTransfer.effectAllowed = "move";
  }

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto">
      <div className="p-3 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Componentes</h3>
        <p className="text-[11px] text-gray-500 mt-1">Arraste para o canvas</p>
      </div>
      {CATEGORY_ORDER.map((cat) => {
        const meta = NODE_CATEGORIES[cat];
        const isOpen = !!open[cat];
        return (
          <div key={cat} className="border-b border-gray-200">
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [cat]: !s[cat] }))}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              <span className="flex items-center gap-2">
                <span>{CATEGORY_ICON[cat]}</span>
                <span>{meta.label}</span>
              </span>
              <span className="text-gray-400">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className="px-2 pb-2 space-y-1">
                {meta.types.map((t) => (
                  <div
                    key={t}
                    draggable
                    onDragStart={(e) => onDragStart(e, t)}
                    className="flex items-center gap-2 px-2 py-1.5 bg-white border border-gray-200 rounded text-xs text-gray-700 cursor-grab hover:bg-gray-50 hover:border-blue-300"
                  >
                    <span className="text-sm">{CATEGORY_ICON[cat]}</span>
                    <span>{NODE_LABELS[t]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
