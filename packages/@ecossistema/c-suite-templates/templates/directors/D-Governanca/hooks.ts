/**
 * D-Governanca — hooks constitucionais
 *
 * Ironicamente, o guardião da constituição tem os hooks mais simples —
 * ele mesmo É a camada de auditoria. Mas precisa de Art. II (HITL)
 * para suas próprias ações destrutivas (pausar agente, rotacionar credencial).
 */

import {
  artIIHITL,
  artIVAudit,
  artIXFalhaExplicita,
  artXIVDualWrite,
  artXIXSecurity,
  artXXIIAprendizado,
} from '@ecossistema/constitutional-hooks';

import type { HookRegistry } from '@ecossistema/constitutional-hooks';

export const hooks: HookRegistry = {
  preToolUse: [
    artIIHITL,            // D-Governanca também precisa de HITL para pausar agente
    artXIXSecurity,       // nunca expõe dados de audit cross-business sem validação
    artXIVDualWrite,      // persiste tudo em ecosystem_memory
  ],
  postToolUse: [
    artIVAudit,           // audit do auditor — meta-auditoria
    artIXFalhaExplicita,  // se D-Governanca falha, PRECISA ser explícito
  ],
  sessionEnd: [
    artXXIIAprendizado,
  ],
};

// Exceção HITL documentada — pausar agente é ação autônoma para D-Governanca
// quando severity=critical. Esta exceção está documentada no MASTERPLAN-V9 §17.
export const HITL_EXCEPTIONS = ['pause_agent_critical_violation'] as const;

export default hooks;
