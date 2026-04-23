"use client";

import { Handle, Position } from "@xyflow/react";
import type { DsBotNode } from "@/lib/atendimento/ds-bot-types";

type InputType =
  | "input_text" | "input_number" | "input_email" | "input_website"
  | "input_date" | "input_phone" | "input_button" | "input_file";

const ICONS: Record<InputType, string> = {
  input_text: "⌨️",
  input_number: "🔢",
  input_email: "📧",
  input_website: "🌐",
  input_date: "📅",
  input_phone: "📱",
  input_button: "🔘",
  input_file: "📎",
};

const LABELS: Record<InputType, string> = {
  input_text: "Texto",
  input_number: "Número",
  input_email: "E-mail",
  input_website: "Website",
  input_date: "Data",
  input_phone: "Telefone",
  input_button: "Botão",
  input_file: "Arquivo",
};

export default function InputNode({ id, data, type, selected }: { id: string; data: DsBotNode["data"]; type: string; selected?: boolean }) {
  const t = type as InputType;
  const d = data as { question?: string; variable?: string; options?: Array<{ id: string; label: string }> };
  return (
    <div className={`rounded-lg border-2 bg-white shadow-sm min-w-[220px] max-w-[300px] ${selected ? "border-emerald-500" : "border-gray-200"}`}>
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-transparent">
        <span>{ICONS[t] ?? "⌨️"}</span>
        <span className="text-xs font-semibold text-gray-700">Pergunta — {LABELS[t] ?? "Texto"}</span>
      </div>
      <div className="px-3 py-2 text-sm text-gray-800">
        <div className="break-words">{d.question || <em className="text-gray-400">sem pergunta</em>}</div>
        {d.variable && <div className="text-xs text-emerald-600 mt-1">→ {`{{${d.variable}}}`}</div>}
      </div>
      {t === "input_button" && d.options && d.options.length > 0 ? (
        <div className="px-3 py-2 border-t border-gray-100 space-y-1 relative">
          {d.options.map((opt) => (
            <div key={opt.id} className="relative text-xs bg-emerald-50 border border-emerald-100 rounded px-2 py-1">
              {opt.label}
              <Handle
                type="source"
                id={opt.id}
                position={Position.Right}
                style={{ top: "50%", right: -6 }}
                className="!bg-emerald-500"
              />
            </div>
          ))}
        </div>
      ) : (
        <Handle type="source" position={Position.Right} className="!bg-emerald-500" />
      )}
    </div>
  );
}
