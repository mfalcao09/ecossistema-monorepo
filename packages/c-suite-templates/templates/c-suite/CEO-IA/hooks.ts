/**
 * CEO-IA — hooks constitucionais
 *
 * CEO tem foco em coordenação e alinhamento estratégico.
 * Maior ênfase em Art. I (Propósito), Art. VII (Hierarquia), Art. IX (Falha Explícita).
 */

import {
  artIIPrimazia,          // Artigo I — Primazia do Propósito
  artIIHITL,              // Artigo II — Human-in-the-Loop
  artIVAudit,             // Artigo IV — Rastreabilidade
  artVIIHierarquia,       // Artigo VII — Hierarquia Respeitada
  artIXFalhaExplicita,    // Artigo IX — Falha Explícita
  artXIVDualWrite,        // Artigo XIV — Dual-Write
  artXXIIAprendizado,     // Artigo XXII — Aprendizado é Infraestrutura
} from '@ecossistema/constitutional-hooks';

import type { HookRegistry } from '@ecossistema/constitutional-hooks';

export const hooks: HookRegistry = {
  preToolUse: [
    artIIPrimazia,        // filtro de propósito BAM antes de toda ação
    artIIHITL,            // pausa para ações de alto risco ou irreversíveis
    artVIIHierarquia,     // verifica se está respeitando a cadeia de comando
    artXIVDualWrite,      // garante persistência em Supabase
  ],
  postToolUse: [
    artIVAudit,           // loga toda decisão executiva
    artIXFalhaExplicita,  // não silencia erros
  ],
  sessionEnd: [
    artXXIIAprendizado,   // persiste contexto da sessão
  ],
};

export default hooks;
