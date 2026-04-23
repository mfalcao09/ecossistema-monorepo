"use client";

import { Handle, Position } from "@xyflow/react";
import type { DsBotNode } from "@/lib/atendimento/ds-bot-types";

export default function AgentNode({
  data,
  selected,
}: {
  data: DsBotNode["data"];
  selected?: boolean;
}) {
  const d = data as { agent_id?: string; context_vars?: string[] };
  return (
    <div
      className={`rounded-lg border-2 bg-white shadow-md min-w-[200px] max-w-[280px] ${selected ? "border-fuchsia-500" : "border-fuchsia-300"}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 bg-gradient-to-r from-fuchsia-100 to-transparent">
        <span>🤖</span>
        <span className="text-xs font-semibold text-gray-700">
          DS Agente (IA)
        </span>
      </div>
      <div className="px-3 py-2 text-xs text-gray-700">
        <div className="truncate">
          agente: <code>{d.agent_id || "—"}</code>
        </div>
        {d.context_vars?.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {d.context_vars.map((v) => (
              <span
                key={v}
                className="bg-fuchsia-50 text-fuchsia-700 px-1.5 py-0.5 rounded text-[10px]"
              >
                {v}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="px-3 py-1 text-[10px] text-gray-500 border-t border-gray-100">
        hand-off (fim do bot)
      </div>
    </div>
  );
}
