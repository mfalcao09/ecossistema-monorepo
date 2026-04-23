/**
 * Hook de chat — gerencia mensagens + streaming SSE do orchestrator.
 *
 * Fluxo:
 *   send(query) → cria msg user + msg assistant streaming
 *     → runAgent() SSE
 *     → assistant_message event: concatena chunks em msg.content
 *     → end: marca streaming=false
 *     → mantém session_id para follow-ups (usa /resume nas próximas)
 */

import { useCallback, useRef, useState } from "react";

import { runAgent, type OrchestratorConfig } from "../services/orchestrator";
import type {
  AssistantMessageData,
  ChatMessage,
  EndEventData,
  ErrorEventData,
  InitEventData,
  OrchestratorEvent,
} from "../types";

interface UseChatOptions {
  config: OrchestratorConfig;
}

interface UseChatResult {
  messages: ChatMessage[];
  sending: boolean;
  error: string | null;
  sessionId: string | null;
  send: (query: string) => void;
  cancel: () => void;
  reset: () => void;
}

export function useChat({ config }: UseChatOptions): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const closeRef = useRef<(() => void) | null>(null);
  const assistantIdRef = useRef<string | null>(null);

  const appendAssistantChunk = useCallback((text: string) => {
    const targetId = assistantIdRef.current;
    if (!targetId) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === targetId ? { ...m, content: m.content + text } : m,
      ),
    );
  }, []);

  const finalizeAssistant = useCallback(() => {
    const targetId = assistantIdRef.current;
    if (!targetId) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === targetId ? { ...m, streaming: false } : m)),
    );
    assistantIdRef.current = null;
  }, []);

  const handleEvent = useCallback(
    (event: OrchestratorEvent) => {
      switch (event.type) {
        case "init": {
          const data = event.data as InitEventData;
          if (data?.session_id) setSessionId(data.session_id);
          break;
        }
        case "assistant_message": {
          const data = event.data as AssistantMessageData;
          if (data?.text) appendAssistantChunk(data.text);
          if (data?.session_id) setSessionId(data.session_id);
          break;
        }
        case "end": {
          const data = event.data as EndEventData;
          if (data?.session_id) setSessionId(data.session_id);
          finalizeAssistant();
          setSending(false);
          break;
        }
        case "error": {
          const data = event.data as ErrorEventData;
          setError(data?.message ?? "Erro desconhecido");
          finalizeAssistant();
          setSending(false);
          break;
        }
        // thinking, tool_use, tool_result: por enquanto só loga
        default:
          break;
      }
    },
    [appendAssistantChunk, finalizeAssistant],
  );

  const send = useCallback(
    (query: string) => {
      if (!query.trim() || sending) return;

      setError(null);
      setSending(true);

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: query.trim(),
        createdAt: new Date().toISOString(),
      };

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "",
        streaming: true,
        createdAt: new Date().toISOString(),
      };

      assistantIdRef.current = assistantMsg.id;
      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      closeRef.current = runAgent(config, {
        query: query.trim(),
        userId: "marcelo",
        sessionId,
        onEvent: handleEvent,
        onError: (err) => {
          setError(err.message);
          finalizeAssistant();
          setSending(false);
        },
        onClose: () => {
          closeRef.current = null;
        },
      });
    },
    [config, sending, sessionId, handleEvent, finalizeAssistant],
  );

  const cancel = useCallback(() => {
    closeRef.current?.();
    finalizeAssistant();
    setSending(false);
  }, [finalizeAssistant]);

  const reset = useCallback(() => {
    cancel();
    setMessages([]);
    setError(null);
    setSessionId(null);
  }, [cancel]);

  return { messages, sending, error, sessionId, send, cancel, reset };
}
