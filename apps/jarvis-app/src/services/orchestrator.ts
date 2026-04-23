/**
 * Cliente SSE do orchestrator.
 *
 * O orchestrator (FastAPI em apps/orchestrator) expõe:
 *   POST /agents/{agent_id}/run    — inicia nova sessão
 *   POST /agents/{agent_id}/resume — retoma sessão existente
 *
 * Ambos retornam text/event-stream com eventos SSE nomeados:
 *   init, thinking, tool_use, tool_result, assistant_message, end
 *
 * React Native não tem EventSource nativo. Usamos `react-native-sse`
 * (que suporta POST body — o nativo só aceita GET).
 */

import EventSource from "react-native-sse";

import type { OrchestratorEvent, OrchestratorEventType } from "../types";

const EVENT_TYPES: OrchestratorEventType[] = [
  "init",
  "thinking",
  "tool_use",
  "tool_result",
  "assistant_message",
  "end",
  "error",
];

export interface OrchestratorConfig {
  /** Base URL do orchestrator, ex: http://192.168.0.8:8000 */
  baseUrl: string;
  /** Bearer token — owner_<xxx> ou JWT. */
  token: string;
  /** Agent ID, default `claudinho`. */
  agentId?: string;
}

export interface RunOptions {
  query: string;
  userId?: string;
  sessionId?: string | null;
  context?: Record<string, unknown>;
  onEvent: (event: OrchestratorEvent) => void;
  onError?: (error: Error) => void;
  /** Chamado ao final (event=end ou falha). */
  onClose?: () => void;
}

/**
 * Abre stream SSE contra POST /agents/:id/run (ou /resume se sessionId).
 * Retorna função para cancelar o stream.
 */
export function runAgent(
  config: OrchestratorConfig,
  options: RunOptions,
): () => void {
  const agentId = config.agentId ?? "claudinho";
  const resuming = Boolean(options.sessionId);

  const endpoint = resuming
    ? `${config.baseUrl}/agents/${agentId}/resume`
    : `${config.baseUrl}/agents/${agentId}/run`;

  const body = resuming
    ? JSON.stringify({
        session_id: options.sessionId,
        message: options.query,
      })
    : JSON.stringify({
        query: options.query,
        user_id: options.userId ?? "marcelo",
        session_id: options.sessionId ?? null,
        context: options.context ?? {},
      });

  // react-native-sse exige que os nomes de eventos custom sejam declarados como
  // type parameter para o EventSource<T> — senão addEventListener só aceita os
  // default ('message'|'open'|'close'|'error').
  const es = new EventSource<OrchestratorEventType>(endpoint, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body,
    // Reabre automaticamente se conexão cair no meio.
    pollingInterval: 0,
  });

  const close = () => {
    es.removeAllEventListeners();
    es.close();
    options.onClose?.();
  };

  es.addEventListener("error", (evt: unknown) => {
    // react-native-sse emite 'error' tanto pra HTTP 4xx/5xx quanto pra network failures.
    const message = extractErrorMessage(evt);
    options.onError?.(new Error(message));
    close();
  });

  for (const type of EVENT_TYPES) {
    es.addEventListener(type, (evt: unknown) => {
      const data = parseEventData((evt as { data?: string })?.data);
      options.onEvent({ type, data });
      if (type === "end") {
        close();
      }
    });
  }

  return close;
}

function parseEventData(raw: string | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { text: raw };
  }
}

function extractErrorMessage(evt: unknown): string {
  if (!evt || typeof evt !== "object") return "Stream error";
  const record = evt as Record<string, unknown>;
  const message = record.message;
  if (typeof message === "string") return message;
  const xhrStatus = record.xhrStatus;
  if (typeof xhrStatus === "number") {
    return `HTTP ${xhrStatus}`;
  }
  return "Stream error";
}
