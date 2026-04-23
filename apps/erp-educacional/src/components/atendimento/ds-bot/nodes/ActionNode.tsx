"use client";

import { Handle, Position } from "@xyflow/react";
import type { DsBotNode } from "@/lib/atendimento/ds-bot-types";
import { NODE_LABELS } from "@/lib/atendimento/ds-bot-types";

const ACTION_ICONS: Record<string, string> = {
  flow_goto: "↪️",
  flow_back: "↩️",
  flow_end: "🏁",
  flow_wait: "⏳",
  contact_add_tag: "🏷️",
  contact_remove_tag: "🚫",
  contact_update_field: "✏️",
  message_waba_template: "📨",
  message_ds_voice: "🎙️",
  message_forward: "➡️",
  attendance_transfer_queue: "👥",
  attendance_assign_agent: "🧑‍💼",
  attendance_open_protocol: "📋",
  attendance_close: "✅",
  trigger: "▶️",
};

const CATEGORY_COLORS: Record<string, string> = {
  flow: "from-amber-50",
  contact: "from-violet-50",
  message: "from-indigo-50",
  attendance: "from-rose-50",
  trigger: "from-slate-50",
};

export default function ActionNode({
  data,
  type,
  selected,
}: {
  data: DsBotNode["data"];
  type: string;
  selected?: boolean;
}) {
  const label = NODE_LABELS[type as keyof typeof NODE_LABELS] ?? type;
  const category = type.split("_")[0];
  const gradient = CATEGORY_COLORS[category] ?? "from-gray-50";
  const isTerminal = type === "flow_end" || type === "attendance_close";
  const isTrigger = type === "trigger";

  const summary = (() => {
    const d = data as Record<string, unknown>;
    if (type === "contact_add_tag" || type === "contact_remove_tag")
      return String(d.tag ?? "");
    if (type === "contact_update_field")
      return `${d.field ?? "?"} = ${d.value ?? "?"}`;
    if (type === "message_waba_template")
      return `template:${d.template_id ?? "?"}`;
    if (type === "attendance_transfer_queue")
      return `fila:${d.queue_id ?? "?"}`;
    if (type === "attendance_assign_agent")
      return `agente:${d.agent_id ?? "?"}`;
    if (type === "attendance_open_protocol") return String(d.subject ?? "");
    if (type === "flow_wait") return `${d.timeout_seconds ?? 0}s`;
    if (type === "flow_end") return String(d.reason ?? "encerra");
    if (type === "flow_goto") return `→ ${d.target_node_id ?? "?"}`;
    return "";
  })();

  return (
    <div
      className={`rounded-lg border-2 bg-white shadow-sm min-w-[180px] max-w-[280px] ${selected ? "border-amber-500" : "border-gray-200"}`}
    >
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="!bg-gray-400"
        />
      )}
      <div
        className={`px-3 py-2 border-b border-gray-100 flex items-center gap-2 bg-gradient-to-r ${gradient} to-transparent`}
      >
        <span>{ACTION_ICONS[type] ?? "⚙️"}</span>
        <span className="text-xs font-semibold text-gray-700">{label}</span>
      </div>
      {summary ? (
        <div className="px-3 py-2 text-xs text-gray-700 break-words">
          {summary}
        </div>
      ) : null}
      {!isTerminal && (
        <Handle
          type="source"
          position={Position.Right}
          className="!bg-amber-500"
        />
      )}
    </div>
  );
}
