/**
 * CFO-IA — hooks constitucionais
 *
 * Declara quais artigos da Constituição do Ecossistema se aplicam a este agente.
 * Importados de @ecossistema/constitutional-hooks (S01).
 */

import {
  artIIHITL,
  artIIIIdempotency,
  artIVAudit,
  artVIIIBaixaReal,
  artIXFalhaExplicita,
  artXIICostControl,
  artXIVDualWrite,
  artXVIIIDataContracts,
  artXIXSecurity,
  artXXIIAprendizado,
} from '@ecossistema/constitutional-hooks';

import type { HookRegistry } from '@ecossistema/constitutional-hooks';

export const hooks: HookRegistry = {
  preToolUse: [
    artIIHITL,           // pausa antes de ações financeiras de alto risco
    artIIIIdempotency,   // impede duplicação de boletos/webhooks
    artXIICostControl,   // verifica budget antes de chamar LLM caro
    artXIVDualWrite,     // garante write no Supabase antes de .md
    artXVIIIDataContracts, // valida schema Zod em integrações bancárias
    artXIXSecurity,      // valida HMAC de webhooks Inter
  ],
  postToolUse: [
    artIVAudit,          // loga toda ação financeira em audit_log
    artVIIIBaixaReal,    // confirma pagamento só via webhook bancário real
    artIXFalhaExplicita, // re-lança erro com contexto em vez de silenciar
  ],
  sessionEnd: [
    artXXIIAprendizado,  // persiste memória da sessão no Supabase ECOSYSTEM
  ],
};

export default hooks;
