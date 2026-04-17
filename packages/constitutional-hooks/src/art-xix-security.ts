/**
 * Art. XIX — Segurança em Camadas (PreToolUse)
 *
 * Regex blocklist para a tool `Bash`. Detecção defensiva — NÃO é a fronteira
 * de segurança real (isso é VM/container isolation).
 *
 * Blocklist é cópia literal da curada no phantom (ver briefing S01 § Art. XIX).
 *
 * IMPORTANTE: regex aqui é APENAS pra validação determinística de comandos
 * conhecidamente perigosos. NÃO usar regex para detectar intenção do usuário
 * (viola Cardinal Rule).
 */

import type { PreToolUseHook } from "./types.js";
import { matchBashBlocklist } from "./utils.js";

function extractCommand(input: Record<string, unknown>): string | null {
  for (const key of ["command", "cmd", "script"]) {
    const v = input[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

export const artXIXSecurity: PreToolUseHook = async (ctx) => {
  if (ctx.tool_name !== "Bash") return { decision: "allow" };

  const command = extractCommand(ctx.tool_input);
  if (!command) return { decision: "allow" };

  const match = matchBashBlocklist(command);
  if (match) {
    return {
      decision: "block",
      reason: `Art. XIX: Comando perigoso detectado: ${match.source}`,
    };
  }

  return { decision: "allow" };
};
