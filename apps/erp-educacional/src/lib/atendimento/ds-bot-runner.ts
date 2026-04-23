/**
 * DS Bot — Runner (máquina de estados).
 *
 * Responsabilidades:
 *   - Encontrar bot que dispara para uma mensagem/evento entrante.
 *   - Iniciar execução (ds_bot_executions row) e rodar primeiro node.
 *   - Retomar execução (ao receber input do contato).
 *   - Executar node atual, avaliar transições, agendar await/end.
 *
 * NÃO lida com I/O Meta — os side-effects vêm como lista (`SideEffect[]`) que
 * o webhook/route chamador processa via send-message.
 *
 * Server-only (usa createAdminClient).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  executeNodeHandler,
  type ExecuteNodeResult,
} from "@/lib/atendimento/ds-bot-actions";
import type {
  DsBotFlow,
  DsBotNode,
  DsBotEdge,
  DsBotExecutionContext,
  DsBotHistoryEntry,
  ConditionalClause,
  ConditionalNode,
  TriggerMatchInput,
  SideEffect,
  NodeExecutionResult,
} from "@/lib/atendimento/ds-bot-types";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function nowIso(): string {
  return new Date().toISOString();
}

function getStartNodeId(flow: DsBotFlow, fallback?: string | null): string | null {
  if (fallback && flow.nodes.find((n) => n.id === fallback)) return fallback;
  const trigger = flow.nodes.find((n) => n.type === "trigger");
  if (trigger) return trigger.id;
  return flow.nodes[0]?.id ?? null;
}

function findNode(flow: DsBotFlow, id: string | null | undefined): DsBotNode | null {
  if (!id) return null;
  return flow.nodes.find((n) => n.id === id) ?? null;
}

function outgoingEdges(flow: DsBotFlow, sourceId: string): DsBotEdge[] {
  return flow.edges.filter((e) => e.source === sourceId);
}

function nextFromEdge(
  flow: DsBotFlow,
  sourceId: string,
  sourceHandle?: string | null,
): string | null {
  const edges = outgoingEdges(flow, sourceId);
  if (sourceHandle !== undefined && sourceHandle !== null) {
    const match = edges.find((e) => (e.sourceHandle ?? null) === sourceHandle);
    if (match) return match.target;
  }
  // fallback: primeira edge sem handle específico
  const neutral = edges.find((e) => !e.sourceHandle);
  return neutral?.target ?? edges[0]?.target ?? null;
}

// ──────────────────────────────────────────────────────────────
// Conditional evaluation (PUBLIC — testável unit)
// ──────────────────────────────────────────────────────────────
export function resolveRef(
  ref: string | number | undefined,
  variables: Record<string, unknown>,
  context: { channel?: string } = {},
): unknown {
  if (typeof ref !== "string") return ref;
  if (ref.startsWith("var.")) {
    return variables[ref.slice(4)];
  }
  if (ref.startsWith("context.")) {
    return (context as Record<string, unknown>)[ref.slice(8)];
  }
  return ref;
}

export function evaluateClause(
  clause: ConditionalClause,
  variables: Record<string, unknown>,
  context: { channel?: string } = {},
): boolean {
  const left = resolveRef(clause.left, variables, context);
  const right = resolveRef(clause.right, variables, context);

  switch (clause.op) {
    case "eq":           return String(left) === String(right);
    case "neq":          return String(left) !== String(right);
    case "gt":           return Number(left) > Number(right);
    case "gte":          return Number(left) >= Number(right);
    case "lt":           return Number(left) < Number(right);
    case "lte":          return Number(left) <= Number(right);
    case "contains":     return String(left ?? "").includes(String(right ?? ""));
    case "not_contains": return !String(left ?? "").includes(String(right ?? ""));
    case "starts_with":  return String(left ?? "").startsWith(String(right ?? ""));
    case "ends_with":    return String(left ?? "").endsWith(String(right ?? ""));
    case "is_empty":     return left === undefined || left === null || String(left).trim() === "";
    case "is_not_empty": return !(left === undefined || left === null || String(left).trim() === "");
    default:             return false;
  }
}

export function evaluateConditional(
  node: ConditionalNode,
  variables: Record<string, unknown>,
  context: { channel?: string } = {},
): boolean {
  const { logic, clauses } = node.data;
  if (!clauses || clauses.length === 0) return true;
  if (logic === "OR") {
    return clauses.some((c) => evaluateClause(c, variables, context));
  }
  return clauses.every((c) => evaluateClause(c, variables, context));
}

// ──────────────────────────────────────────────────────────────
// Trigger matching
// ──────────────────────────────────────────────────────────────
export interface TriggeredBot {
  id: string;
  flow: DsBotFlow;
  start_node_id: string | null;
  version: number;
}

export async function findTriggeredBot(
  input: TriggerMatchInput,
  client = createAdminClient(),
): Promise<TriggeredBot | null> {
  const { data, error } = await client
    .from("ds_bots")
    .select("id, flow_json, start_node_id, version, trigger_type, trigger_value, channels, enabled")
    .eq("enabled", true);

  if (error || !data) return null;

  for (const bot of data) {
    // Canal precisa bater (se `channels` não está vazio)
    if (bot.channels?.length && !bot.channels.includes(input.channel)) continue;

    let match = false;
    switch (bot.trigger_type) {
      case "new_conversation":
        match = input.is_new_conversation;
        break;
      case "keyword": {
        const kw = (bot.trigger_value ?? "").toLowerCase().trim();
        match = !!kw && !!input.message_text && input.message_text.toLowerCase().includes(kw);
        break;
      }
      case "tag_added":
        match = !!input.added_tag && input.added_tag === bot.trigger_value;
        break;
      case "manual":
        match = false; // manual = só via /execute API
        break;
    }
    if (match) {
      return {
        id: bot.id,
        flow: bot.flow_json as DsBotFlow,
        start_node_id: bot.start_node_id,
        version: bot.version,
      };
    }
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// Start execution
// ──────────────────────────────────────────────────────────────
export interface StartExecutionOptions {
  bot: TriggeredBot;
  conversation_id: string | null;
  contact_id: string | null;
  channel: string;
  initial_variables?: Record<string, unknown>;
}

export interface RunStepResult {
  execution_id: string;
  status: "running" | "awaiting" | "completed" | "aborted" | "error";
  current_node_id: string | null;
  side_effects: SideEffect[];
  variables: Record<string, unknown>;
  error?: string;
}

export async function startExecution(
  opts: StartExecutionOptions,
  client = createAdminClient(),
): Promise<RunStepResult> {
  const { bot, conversation_id, contact_id, channel, initial_variables = {} } = opts;
  const start = getStartNodeId(bot.flow, bot.start_node_id);

  const { data, error } = await client
    .from("ds_bot_executions")
    .insert({
      bot_id: bot.id,
      version: bot.version,
      conversation_id,
      contact_id,
      channel,
      current_node_id: start,
      awaiting_input: false,
      variables: initial_variables,
      history: [],
      status: "running",
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      execution_id: "",
      status: "error",
      current_node_id: null,
      side_effects: [],
      variables: initial_variables,
      error: error?.message ?? "Falha ao criar execução",
    };
  }

  return runUntilAwait(data.id, bot.flow, {
    conversation_id,
    contact_id,
    channel,
    variables: initial_variables,
    history: [],
  }, client);
}

// ──────────────────────────────────────────────────────────────
// Resume execution (user input recebido)
// ──────────────────────────────────────────────────────────────
export async function resumeExecution(
  execution_id: string,
  user_input: string,
  client = createAdminClient(),
): Promise<RunStepResult> {
  const { data: exec, error } = await client
    .from("ds_bot_executions")
    .select("id, bot_id, current_node_id, awaiting_input, variables, history, status, channel, conversation_id, contact_id")
    .eq("id", execution_id)
    .single();

  if (error || !exec) {
    return { execution_id, status: "error", current_node_id: null, side_effects: [], variables: {}, error: error?.message ?? "Execução não encontrada" };
  }
  if (exec.status !== "running" && exec.status !== "awaiting") {
    return { execution_id, status: exec.status, current_node_id: exec.current_node_id, side_effects: [], variables: exec.variables ?? {}, error: "Execução não-ativa" };
  }

  const { data: bot, error: botErr } = await client
    .from("ds_bots")
    .select("flow_json")
    .eq("id", exec.bot_id)
    .single();
  if (botErr || !bot) {
    return { execution_id, status: "error", current_node_id: null, side_effects: [], variables: {}, error: "Bot não encontrado" };
  }

  const flow = bot.flow_json as DsBotFlow;
  const current = findNode(flow, exec.current_node_id);
  if (!current) {
    await client.from("ds_bot_executions").update({ status: "error", error: "current_node_id inválido", completed_at: nowIso() }).eq("id", execution_id);
    return { execution_id, status: "error", current_node_id: null, side_effects: [], variables: exec.variables ?? {}, error: "current_node_id inválido" };
  }

  // Guarda input em variável do input-node atual
  const variables = { ...(exec.variables ?? {}) } as Record<string, unknown>;
  const history = [...(exec.history ?? [])] as DsBotHistoryEntry[];
  let sourceHandle: string | null | undefined = undefined;
  let processed_input: unknown = user_input;

  if (current.type.startsWith("input_")) {
    const data = current.data as { variable?: string; options?: Array<{ id: string; value: string; label: string }> };
    if (current.type === "input_button" && data.options) {
      const match = data.options.find(
        (o) => o.id === user_input || o.value === user_input || o.label.toLowerCase() === user_input.toLowerCase(),
      );
      sourceHandle = match?.id ?? null;
      processed_input = match?.value ?? user_input;
    }
    if (current.type === "input_number") processed_input = Number(user_input);
    if (data.variable) variables[data.variable] = processed_input;
  }

  history.push({ node_id: current.id, at: nowIso(), event: "input_received", payload: { user_input, processed_input } });

  const next_id = nextFromEdge(flow, current.id, sourceHandle ?? null);

  await client
    .from("ds_bot_executions")
    .update({
      current_node_id: next_id,
      awaiting_input: false,
      variables,
      history,
      status: next_id ? "running" : "completed",
      completed_at: next_id ? null : nowIso(),
    })
    .eq("id", execution_id);

  if (!next_id) {
    return { execution_id, status: "completed", current_node_id: null, side_effects: [], variables };
  }

  return runUntilAwait(execution_id, flow, {
    conversation_id: exec.conversation_id,
    contact_id: exec.contact_id,
    channel: exec.channel,
    variables,
    history,
  }, client);
}

// ──────────────────────────────────────────────────────────────
// runUntilAwait — executa nodes sequencialmente até precisar aguardar
// ──────────────────────────────────────────────────────────────
interface MiniContext {
  conversation_id: string | null;
  contact_id: string | null;
  channel: string;
  variables: Record<string, unknown>;
  history: DsBotHistoryEntry[];
}

const MAX_STEPS_PER_CYCLE = 100; // guard contra loops

async function runUntilAwait(
  execution_id: string,
  flow: DsBotFlow,
  ctx: MiniContext,
  client: ReturnType<typeof createAdminClient>,
): Promise<RunStepResult> {
  const effects: SideEffect[] = [];
  let current = await readCurrentNodeId(execution_id, client);
  let variables = { ...ctx.variables };
  let history = [...ctx.history];

  for (let i = 0; i < MAX_STEPS_PER_CYCLE; i++) {
    if (!current) {
      await client.from("ds_bot_executions")
        .update({ status: "completed", completed_at: nowIso(), variables, history })
        .eq("id", execution_id);
      return { execution_id, status: "completed", current_node_id: null, side_effects: effects, variables };
    }

    const node = findNode(flow, current);
    if (!node) {
      await client.from("ds_bot_executions")
        .update({ status: "error", error: `Node ${current} não encontrado`, completed_at: nowIso(), variables, history })
        .eq("id", execution_id);
      return { execution_id, status: "error", current_node_id: current, side_effects: effects, variables, error: "Node não encontrado" };
    }

    history.push({ node_id: node.id, at: nowIso(), event: "entered" });

    const execCtx: DsBotExecutionContext = {
      bot_id: "", // não usado dentro dos handlers
      execution_id,
      conversation_id: ctx.conversation_id,
      contact_id: ctx.contact_id,
      channel: ctx.channel,
      variables,
      history,
    };

    const res: NodeExecutionResult = await dispatchNode(node, flow, execCtx);

    if (res.kind === "error") {
      await client.from("ds_bot_executions")
        .update({ status: "error", error: res.error, completed_at: nowIso(), variables, history })
        .eq("id", execution_id);
      return { execution_id, status: "error", current_node_id: current, side_effects: effects, variables, error: res.error };
    }

    if (res.side_effects?.length) effects.push(...res.side_effects);

    if (res.kind === "await") {
      history.push({ node_id: node.id, at: nowIso(), event: "awaiting" });
      await client.from("ds_bot_executions")
        .update({ status: "awaiting", awaiting_input: true, current_node_id: current, variables, history })
        .eq("id", execution_id);
      return { execution_id, status: "awaiting", current_node_id: current, side_effects: effects, variables };
    }

    if (res.kind === "end") {
      await client.from("ds_bot_executions")
        .update({ status: "completed", completed_at: nowIso(), current_node_id: current, variables, history })
        .eq("id", execution_id);
      return { execution_id, status: "completed", current_node_id: current, side_effects: effects, variables };
    }

    if (res.kind === "handoff") {
      history.push({ node_id: node.id, at: nowIso(), event: "completed", payload: { handoff_agent_id: res.agent_id } });
      await client.from("ds_bot_executions")
        .update({ status: "completed", completed_at: nowIso(), current_node_id: current, variables, history })
        .eq("id", execution_id);
      return { execution_id, status: "completed", current_node_id: current, side_effects: effects, variables };
    }

    // next
    current = res.next_node_id;
  }

  await client.from("ds_bot_executions")
    .update({ status: "error", error: "Max steps excedido (loop?)", completed_at: nowIso(), variables, history })
    .eq("id", execution_id);
  return { execution_id, status: "error", current_node_id: current, side_effects: effects, variables, error: "Max steps excedido" };
}

async function readCurrentNodeId(
  execution_id: string,
  client: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const { data } = await client
    .from("ds_bot_executions")
    .select("current_node_id")
    .eq("id", execution_id)
    .single();
  return data?.current_node_id ?? null;
}

// ──────────────────────────────────────────────────────────────
// dispatchNode — trata nodes de controle de fluxo aqui,
// delega side-effect-only para executeNodeHandler.
// ──────────────────────────────────────────────────────────────
async function dispatchNode(
  node: DsBotNode,
  flow: DsBotFlow,
  ctx: DsBotExecutionContext,
): Promise<NodeExecutionResult> {
  // Trigger — só passa pra next
  if (node.type === "trigger") {
    return { kind: "next", next_node_id: nextFromEdge(flow, node.id) };
  }

  // Conditional — avalia e escolhe saída
  if (node.type === "conditional") {
    const truthy = evaluateConditional(node as ConditionalNode, ctx.variables, { channel: ctx.channel });
    const next = nextFromEdge(flow, node.id, truthy ? "true" : "false");
    return { kind: "next", next_node_id: next };
  }

  // Flow nodes (controle)
  if (node.type === "flow_end") {
    return { kind: "end", reason: (node.data as { reason?: string }).reason };
  }
  if (node.type === "flow_goto") {
    const target = (node.data as { target_node_id?: string }).target_node_id;
    return { kind: "next", next_node_id: target ?? null };
  }
  if (node.type === "flow_back") {
    const last = [...ctx.history].reverse().find((h) => h.node_id !== node.id && h.event === "entered");
    return { kind: "next", next_node_id: last?.node_id ?? nextFromEdge(flow, node.id) };
  }
  if (node.type === "flow_wait") {
    return { kind: "await" }; // retomada por /resume ou timeout externo
  }

  // Agent hand-off — S10 plugs aqui
  if (node.type === "agent_handoff") {
    const agent_id = (node.data as { agent_id: string }).agent_id;
    return { kind: "handoff", agent_id };
  }

  // Inputs — produzem bubble (question) e awaitam
  if (node.type.startsWith("input_")) {
    const data = node.data as { question?: string };
    const effects: SideEffect[] = [];
    if (data.question) effects.push({ type: "send_text", text: interpolate(data.question, ctx.variables) });
    return { kind: "await", side_effects: effects };
  }

  // Bubbles + ações: delega pro actions module (stateless)
  const handlerRes: ExecuteNodeResult = await executeNodeHandler(node, ctx);
  if (handlerRes.kind === "error") return handlerRes;
  return { kind: "next", next_node_id: nextFromEdge(flow, node.id), side_effects: handlerRes.side_effects };
}

// Helper exposto para actions usarem (simples, não Mustache-completo)
export function interpolate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const v = variables[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

// ──────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────
export async function abortExecution(
  execution_id: string,
  reason = "aborted",
  client = createAdminClient(),
): Promise<void> {
  await client
    .from("ds_bot_executions")
    .update({ status: "aborted", error: reason, completed_at: nowIso() })
    .eq("id", execution_id);
}

export async function findActiveExecution(
  conversation_id: string,
  client = createAdminClient(),
): Promise<{ id: string; bot_id: string } | null> {
  const { data } = await client
    .from("ds_bot_executions")
    .select("id, bot_id")
    .eq("conversation_id", conversation_id)
    .in("status", ["running", "awaiting"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// expose for testing/hand-off visibility
export { findNode, nextFromEdge };
