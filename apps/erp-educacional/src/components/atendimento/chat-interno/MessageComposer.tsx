"use client";

/**
 * Composer do chat interno:
 *   - textarea auto-grow
 *   - autocomplete @nome      (mentions → agent_ids)
 *   - autocomplete #termo     (refs → conversation|deal|contact)
 *   - envia com Enter (Shift+Enter = newline)
 *   - reply-to (mostrado acima do campo, com X para cancelar)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, X, CornerDownRight, AtSign, Hash } from "lucide-react";
import type { RefItem } from "./types";

type AutocompleteItem = {
  type: "agent" | "conversation" | "deal" | "contact";
  id: string;
  label: string;
  sublabel?: string;
};

interface ReplyTarget {
  id: string;
  body: string;
  authorName: string;
}

interface Props {
  onSend: (data: { body: string; mentions: string[]; refs: RefItem[]; replyToId: string | null }) => Promise<void> | void;
  onTyping?: () => void;
  replyTo: ReplyTarget | null;
  clearReply: () => void;
}

type Trigger = { char: "@" | "#"; start: number; query: string };

export default function MessageComposer({ onSend, onTyping, replyTo, clearReply }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [refKind, setRefKind] = useState<"conversation" | "deal" | "contact">("conversation");
  const [autocomplete, setAutocomplete] = useState<AutocompleteItem[]>([]);
  const [mentions, setMentions] = useState<Map<string, { id: string; label: string }>>(new Map());
  const [refs, setRefs] = useState<RefItem[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [text]);

  // Detecta trigger ao digitar
  const updateTrigger = useCallback((value: string, caret: number) => {
    // procura para trás a partir do caret até espaço/newline
    let i = caret - 1;
    while (i >= 0 && !/\s/.test(value[i])) i--;
    const tokenStart = i + 1;
    const token = value.slice(tokenStart, caret);
    if (token.length >= 1 && (token[0] === "@" || token[0] === "#")) {
      setTrigger({ char: token[0] as "@" | "#", start: tokenStart, query: token.slice(1) });
      return;
    }
    setTrigger(null);
    setAutocomplete([]);
  }, []);

  // Busca autocomplete
  useEffect(() => {
    if (!trigger) return;
    const kind = trigger.char === "@" ? "agent" : refKind;
    const q = trigger.query.trim();
    if (q.length === 0) {
      setAutocomplete([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/atendimento/team-chats/search?q=${encodeURIComponent(q)}&kind=${kind}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) {
          setAutocomplete([]);
          return;
        }
        const body = (await res.json()) as { items?: AutocompleteItem[] };
        setAutocomplete(body.items ?? []);
      } catch {
        /* aborted */
      }
    }, 150);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [trigger, refKind]);

  const insertToken = useCallback(
    (item: AutocompleteItem) => {
      if (!trigger) return;
      const before = text.slice(0, trigger.start);
      const caret = textareaRef.current?.selectionStart ?? text.length;
      const after = text.slice(caret);
      const inserted = trigger.char + item.label + " ";
      const nextText = before + inserted + after;
      setText(nextText);
      if (trigger.char === "@" && item.type === "agent") {
        setMentions((prev) => new Map(prev).set(item.label, { id: item.id, label: item.label }));
      }
      if (trigger.char === "#" && item.type !== "agent") {
        setRefs((prev) => [
          ...prev.filter((r) => !(r.type === item.type && r.id === item.id)),
          { type: item.type as RefItem["type"], id: item.id, label: item.label },
        ]);
      }
      setTrigger(null);
      setAutocomplete([]);
      // restore focus
      setTimeout(() => {
        textareaRef.current?.focus();
        const pos = before.length + inserted.length;
        textareaRef.current?.setSelectionRange(pos, pos);
      }, 0);
    },
    [trigger, text],
  );

  const handleSubmit = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      // Filtra mentions que ainda estão presentes no texto
      const activeMentions: string[] = [];
      for (const [label, m] of mentions.entries()) {
        if (text.includes("@" + label)) activeMentions.push(m.id);
      }
      const activeRefs = refs.filter((r) => text.includes("#" + r.label));
      await onSend({ body, mentions: activeMentions, refs: activeRefs, replyToId: replyTo?.id ?? null });
      setText("");
      setMentions(new Map());
      setRefs([]);
      clearReply();
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3 relative">
      {replyTo && (
        <div className="mb-2 flex items-start gap-2 p-2 bg-indigo-50 border-l-2 border-indigo-500 rounded">
          <CornerDownRight size={14} className="text-indigo-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-indigo-700">
              Respondendo a {replyTo.authorName}
            </p>
            <p className="text-xs text-gray-600 truncate">{replyTo.body}</p>
          </div>
          <button onClick={clearReply} className="text-gray-400 hover:text-gray-700">
            <X size={14} />
          </button>
        </div>
      )}

      {autocomplete.length > 0 && trigger && (
        <div className="absolute bottom-full left-4 right-4 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-20">
          <div className="sticky top-0 bg-gray-50 border-b border-gray-100 px-3 py-1.5 text-[10px] font-bold uppercase text-gray-500 flex items-center gap-1">
            {trigger.char === "@" ? <><AtSign size={10} /> Mencionar atendente</> : <><Hash size={10} /> Referenciar {refKind}</>}
            {trigger.char === "#" && (
              <div className="ml-auto flex gap-1">
                {(["conversation", "deal", "contact"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setRefKind(k)}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      refKind === k ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {k === "conversation" ? "conversa" : k === "deal" ? "deal" : "contato"}
                  </button>
                ))}
              </div>
            )}
          </div>
          {autocomplete.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => insertToken(item)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-indigo-50 border-b border-gray-50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                {item.sublabel && <p className="text-xs text-gray-500 truncate">{item.sublabel}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            updateTrigger(e.target.value, e.target.selectionStart);
            onTyping?.();
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={(e) => {
            const t = e.currentTarget;
            updateTrigger(t.value, t.selectionStart);
          }}
          onClick={(e) => {
            const t = e.currentTarget;
            updateTrigger(t.value, t.selectionStart);
          }}
          placeholder="Escreva uma mensagem... (@ menciona, # referencia)"
          rows={1}
          className="flex-1 resize-none border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-300 leading-relaxed"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || sending}
          className="p-2.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Enviar (Enter)"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
