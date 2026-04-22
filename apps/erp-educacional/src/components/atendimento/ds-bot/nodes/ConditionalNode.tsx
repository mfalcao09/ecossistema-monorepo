"use client";

import { Handle, Position } from "@xyflow/react";
import type { DsBotNode } from "@/lib/atendimento/ds-bot-types";

export default function ConditionalNode({ data, selected }: { data: DsBotNode["data"]; selected?: boolean }) {
  const d = data as { logic?: "AND" | "OR"; clauses?: Array<{ left: string; op: string; right?: string | number }> };
  const clauses = d.clauses ?? [];
  return (
    <div className={`rounded-lg border-2 bg-white shadow-sm min-w-[220px] max-w-[280px] ${selected ? "border-purple-500" : "border-gray-200"}`}>
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 bg-gradient-to-r from-purple-50 to-transparent">
        <span>🔀</span>
        <span className="text-xs font-semibold text-gray-700">Condição ({d.logic ?? "AND"})</span>
      </div>
      <div className="px-3 py-2 text-xs text-gray-700 space-y-1">
        {clauses.length === 0 ? <em className="text-gray-400">sem condições</em> : null}
        {clauses.map((c, i) => (
          <div key={i} className="font-mono text-[11px]">
            <code>{c.left}</code> <code className="text-purple-600">{c.op}</code>{" "}
            {c.right !== undefined && <code>{String(c.right)}</code>}
          </div>
        ))}
      </div>
      <div className="px-3 py-1 text-[10px] text-gray-500 border-t border-gray-100 flex justify-between">
        <span className="relative">
          ✓ sim
          <Handle type="source" id="true" position={Position.Right} style={{ top: 8, right: -30 }} className="!bg-green-500" />
        </span>
        <span className="relative">
          ✗ não
          <Handle type="source" id="false" position={Position.Right} style={{ top: 24, right: -30 }} className="!bg-red-500" />
        </span>
      </div>
    </div>
  );
}
