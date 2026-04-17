/**
 * hooks_bridge.mjs — Bridge Node.js para @ecossistema/constitutional-hooks
 *
 * Lê linhas JSON do stdin, chama o hook TypeScript compilado, responde JSON no stdout.
 * Iniciado como child process pelo Python HooksBridge (hooks/loader.py).
 *
 * Protocolo:
 *   stdin:  {"hook":"preToolUse","ctx":{...}}\n
 *   stdout: {"decision":"allow"}\n
 *   stderr: logs de erro (não interfere no protocolo)
 *
 * Hooks disponíveis:
 *   preToolUse  — Arts. II, III, XII, XIV, XVIII, XIX, XX
 *   postToolUse — Arts. IV, VIII, IX
 *   sessionEnd  — Art. XXII
 */

import { createInterface } from 'readline';

// Importar hooks compilados do pacote TS.
// O pacote precisa estar buildado (pnpm build em packages/constitutional-hooks).
let hooks;
try {
  hooks = await import('@ecossistema/constitutional-hooks');
} catch (err) {
  // Hooks não disponíveis ainda (package não buildado).
  // Fail-open: permite tudo com log.
  process.stderr.write(`[hooks_bridge] WARN: constitutional-hooks não disponível: ${err.message}\n`);
  hooks = {
    preToolUse: async () => ({ decision: 'allow', reason: 'hooks not loaded' }),
    postToolUse: async () => ({ decision: 'allow' }),
    sessionEnd: async () => ({ decision: 'allow' }),
  };
}

const HOOK_MAP = {
  preToolUse:  hooks.preToolUse  ?? (() => Promise.resolve({ decision: 'allow' })),
  postToolUse: hooks.postToolUse ?? (() => Promise.resolve({ decision: 'allow' })),
  sessionEnd:  hooks.sessionEnd  ?? (() => Promise.resolve({ decision: 'allow' })),
};

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

for await (const line of rl) {
  let parsed;
  try {
    parsed = JSON.parse(line.trim());
  } catch (err) {
    process.stderr.write(`[hooks_bridge] ERROR parse: ${err.message}\n`);
    process.stdout.write(JSON.stringify({ decision: 'allow', error: 'parse_error' }) + '\n');
    continue;
  }

  const { hook, ctx } = parsed;
  const fn = HOOK_MAP[hook];

  if (!fn) {
    process.stderr.write(`[hooks_bridge] WARN: hook desconhecido: ${hook}\n`);
    process.stdout.write(JSON.stringify({ decision: 'allow' }) + '\n');
    continue;
  }

  let result;
  try {
    result = await fn(ctx);
  } catch (err) {
    process.stderr.write(`[hooks_bridge] ERROR ${hook}: ${err.message}\n`);
    // Art. XII fail-closed: custo → bloqueia se erro
    if (hook === 'preToolUse' && ctx?.tool_name === 'checkCost') {
      result = { decision: 'block', reason: 'hook error — fail-closed' };
    } else {
      result = { decision: 'allow', error: err.message };
    }
  }

  process.stdout.write(JSON.stringify(result) + '\n');
}
