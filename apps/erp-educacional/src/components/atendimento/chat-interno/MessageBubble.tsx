"use client";

import { useState } from "react";
import { CornerDownRight, Smile, Reply, MoreHorizontal, AtSign } from "lucide-react";
import { unwrapAgent, type ChatMessage, type RefItem } from "./types";

interface Props {
  message: ChatMessage;
  isMine: boolean;
  myAgentId: string;
  replyToMessage: ChatMessage | null;
  onReply: (m: ChatMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onOpenRef?: (ref: RefItem) => void;
}

const QUICK_EMOJIS = ["👍", "🔥", "❤️", "🙏", "😂", "👀", "✅"];

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function renderBody(body: string, mentions: string[]): React.ReactNode {
  // highlight @mentions (all @tokens) and #refs cosmeticamente
  const parts: React.ReactNode[] = [];
  const regex = /(@[\wÀ-ú]+(?:\s[\wÀ-ú]+)?|#\w[\w-]*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(body)) !== null) {
    if (match.index > lastIdx) {
      parts.push(body.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("@")) {
      parts.push(
        <span key={`m-${match.index}`} className="text-indigo-700 bg-indigo-50 rounded px-1 font-medium">
          {token}
        </span>,
      );
    } else {
      parts.push(
        <span key={`r-${match.index}`} className="text-amber-700 bg-amber-50 rounded px-1 font-medium">
          {token}
        </span>,
      );
    }
    lastIdx = match.index + token.length;
  }
  if (lastIdx < body.length) parts.push(body.slice(lastIdx));
  // mentions used to highlight; kept here for potential future use (e.g., only highlight if in mentions list)
  void mentions;
  return parts;
}

export default function MessageBubble({
  message,
  isMine,
  myAgentId,
  replyToMessage,
  onReply,
  onReact,
  onOpenRef,
}: Props) {
  const [showEmojis, setShowEmojis] = useState(false);
  const author = unwrapAgent(message.atendimento_agents);
  const authorName = author?.name ?? "—";
  const reactions = message.reactions ?? {};

  return (
    <div className={`group flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
      {!isMine && (
        <div className="w-7 h-7 rounded-full bg-indigo-400 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
          {authorName.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"}
        </div>
      )}

      <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[72%]`}>
        {!isMine && <p className="text-[11px] text-gray-500 font-medium mb-0.5">{authorName}</p>}

        {replyToMessage && (
          <div
            className={`mb-1 px-2 py-1 rounded text-[11px] border-l-2 ${
              isMine ? "bg-indigo-50 border-indigo-300" : "bg-gray-50 border-gray-300"
            } flex items-start gap-1`}
          >
            <CornerDownRight size={10} className="mt-0.5 flex-shrink-0 text-gray-400" />
            <div className="min-w-0">
              <p className="font-semibold text-gray-600">{unwrapAgent(replyToMessage.atendimento_agents)?.name ?? "—"}</p>
              <p className="truncate text-gray-500">{replyToMessage.body}</p>
            </div>
          </div>
        )}

        <div
          className={`relative px-3 py-2 rounded-lg text-sm whitespace-pre-wrap break-words ${
            isMine ? "bg-indigo-500 text-white" : "bg-white border border-gray-200 text-gray-900"
          }`}
        >
          {message.deleted_at ? (
            <em className={isMine ? "text-indigo-100" : "text-gray-400"}>(mensagem removida)</em>
          ) : (
            <>
              {renderBody(message.body, message.mentions)}

              {message.refs && message.refs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {message.refs.map((r) => (
                    <button
                      key={`${r.type}-${r.id}`}
                      onClick={() => onOpenRef?.(r)}
                      className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${
                        isMine ? "bg-indigo-600 hover:bg-indigo-700" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}
                      title={`Abrir ${r.type}`}
                    >
                      <span className="font-bold">
                        {r.type === "conversation" ? "💬" : r.type === "deal" ? "🎯" : "👤"}
                      </span>
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Hover actions */}
          {!message.deleted_at && (
            <div
              className={`absolute top-0 ${
                isMine ? "-left-16" : "-right-16"
              } flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity`}
            >
              <button
                onClick={() => setShowEmojis((v) => !v)}
                className="p-1 rounded bg-white border border-gray-200 text-gray-500 hover:text-gray-900 shadow-sm"
                title="Reagir"
              >
                <Smile size={11} />
              </button>
              <button
                onClick={() => onReply(message)}
                className="p-1 rounded bg-white border border-gray-200 text-gray-500 hover:text-gray-900 shadow-sm"
                title="Responder"
              >
                <Reply size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Reactions */}
        {Object.keys(reactions).length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {Object.entries(reactions).map(([emoji, ids]) => {
              const mineReacted = ids.includes(myAgentId);
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(message.id, emoji)}
                  className={`px-1.5 py-0.5 rounded-full text-[11px] flex items-center gap-0.5 border transition-colors ${
                    mineReacted
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="font-medium">{ids.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {showEmojis && (
          <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-sm p-1 flex gap-1">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  onReact(message.id, e);
                  setShowEmojis(false);
                }}
                className="text-base hover:bg-gray-100 rounded px-1"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        <p className="text-[10px] text-gray-400 mt-0.5 px-1">
          {formatTime(message.created_at)}
          {message.edited_at ? " · editada" : null}
        </p>
      </div>
    </div>
  );
}
