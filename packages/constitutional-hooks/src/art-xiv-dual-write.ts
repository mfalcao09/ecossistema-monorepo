/**
 * Art. XIV — Dual-Write Supabase-first (PreToolUse)
 *
 * Intercepta `Write` e `Edit` em paths críticos (memory/secrets/credentials/
 * tasks/sessions) e bloqueia — o dado deve ir pro Supabase ECOSYSTEM antes
 * de qualquer .md em disco.
 *
 * O agente deve ler o `reason` e redirecionar para a API apropriada:
 *   /memory/*.md       → ecosystem_memory
 *   /secrets/*         → ecosystem_credentials
 *   /credentials/*     → ecosystem_credentials
 *   /tasks/*.md        → agent_tasks
 *   /sessions/*.md     → ecosystem_sessions
 */

import type { PreToolUseHook } from "./types.js";
import { isDualWritePath } from "./utils.js";

const INTERCEPTED_TOOLS: ReadonlySet<string> = new Set(["Write", "Edit", "NotebookEdit"]);

function pickPath(input: Record<string, unknown>): string | null {
  for (const key of ["file_path", "path", "notebook_path"]) {
    const v = input[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function targetTable(path: string): string {
  const p = path.replaceAll("\\", "/");
  if (/\/memory\//.test(p)) return "ecosystem_memory";
  if (/\/secrets\/|\/credentials\//.test(p)) return "ecosystem_credentials";
  if (/\/tasks\//.test(p)) return "agent_tasks";
  if (/\/sessions\//.test(p)) return "ecosystem_sessions";
  return "ecosystem_memory"; // fallback
}

export const artXIVDualWrite: PreToolUseHook = async (ctx) => {
  if (!INTERCEPTED_TOOLS.has(ctx.tool_name)) return { decision: "allow" };

  const path = pickPath(ctx.tool_input);
  if (!path) return { decision: "allow" };
  if (!isDualWritePath(path)) return { decision: "allow" };

  const table = targetTable(path);
  return {
    decision: "block",
    reason: `Art. XIV: Write em ${path} redirecionado para Supabase (tabela ${table}).`,
  };
};
