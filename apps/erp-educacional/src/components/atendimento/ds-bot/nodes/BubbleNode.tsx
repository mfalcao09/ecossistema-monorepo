"use client";

import { Handle, Position } from "@xyflow/react";
import type { DsBotNode } from "@/lib/atendimento/ds-bot-types";

type BubbleType = "bubble_text" | "bubble_image" | "bubble_video" | "bubble_audio" | "bubble_embed";

const ICONS: Record<BubbleType, string> = {
  bubble_text: "💬",
  bubble_image: "🖼️",
  bubble_video: "🎬",
  bubble_audio: "🎙️",
  bubble_embed: "🔗",
};

const LABELS: Record<BubbleType, string> = {
  bubble_text: "Texto",
  bubble_image: "Imagem",
  bubble_video: "Vídeo",
  bubble_audio: "Áudio",
  bubble_embed: "Embed",
};

export default function BubbleNode({ data, type, selected }: { data: DsBotNode["data"]; type: string; selected?: boolean }) {
  const t = type as BubbleType;
  const d = data as { text?: string; url?: string; caption?: string };
  return (
    <div className={`rounded-lg border-2 bg-white shadow-sm min-w-[200px] max-w-[280px] ${selected ? "border-blue-500" : "border-gray-200"}`}>
      <Handle type="target" position={Position.Left} className="!bg-gray-400" />
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 bg-gradient-to-r from-sky-50 to-transparent">
        <span>{ICONS[t] ?? "💬"}</span>
        <span className="text-xs font-semibold text-gray-700">{LABELS[t] ?? "Bolha"}</span>
      </div>
      <div className="px-3 py-2 text-sm text-gray-800 break-words">
        {t === "bubble_text" ? (d.text || <em className="text-gray-400">sem texto</em>) : null}
        {t === "bubble_image" || t === "bubble_video" ? (
          <>
            <div className="text-xs text-gray-500 truncate">{d.url || "sem URL"}</div>
            {d.caption && <div className="text-xs mt-1">{d.caption}</div>}
          </>
        ) : null}
        {t === "bubble_audio" ? <div className="text-xs text-gray-500 truncate">{d.url || "sem URL"}</div> : null}
        {t === "bubble_embed" ? <div className="text-xs text-gray-500 truncate">{d.url || "sem URL"}</div> : null}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-sky-500" />
    </div>
  );
}
