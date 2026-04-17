/**
 * @ecossistema/constitutional-hooks
 *
 * 11 hooks que transformam Artigos Constitucionais V9 em compliance
 * verificável. Registrar no Claude Agent SDK ao construir o agente.
 *
 * @example
 * ```ts
 * import {
 *   artIIHITL, artIIIIdempotency, artIVAudit, artVIIIBaixaReal,
 *   artIXFalhaExplicita, artXIICostControl, artXIVDualWrite,
 *   artXVIIIDataContracts, artXIXSecurity, artXXSoberania,
 *   artXXIIAprendizado,
 * } from '@ecossistema/constitutional-hooks';
 *
 * const agent = new ManagedAgent({
 *   hooks: {
 *     preToolUse:  [artIIHITL, artIIIIdempotency, artXIICostControl, artXIVDualWrite, artXIXSecurity, artXXSoberania, artXVIIIDataContracts],
 *     postToolUse: [artIVAudit, artVIIIBaixaReal, artIXFalhaExplicita],
 *     sessionEnd:  [artXXIIAprendizado],
 *   },
 * });
 * ```
 */

export * from "./types.js";
export * from "./utils.js";

export { artIIHITL } from "./art-ii-hitl.js";
export {
  artIIIIdempotency,
  createArtIIIHook,
  DEFAULT_IDEMPOTENT_TOOLS,
} from "./art-iii-idempotency.js";
export type { ArtIIIConfig } from "./art-iii-idempotency.js";
export { artIVAudit } from "./art-iv-audit.js";
export { artVIIIBaixaReal } from "./art-viii-baixa-real.js";
export { artIXFalhaExplicita, ToolFailedError } from "./art-ix-falha-explicita.js";
export { artXIICostControl, createArtXIIHook } from "./art-xii-cost-control.js";
export type { ArtXIIConfig } from "./art-xii-cost-control.js";
export { artXIVDualWrite } from "./art-xiv-dual-write.js";
export {
  artXVIIIDataContracts,
  createArtXVIIIHook,
} from "./art-xviii-data-contracts.js";
export type { ArtXVIIIConfig } from "./art-xviii-data-contracts.js";
export { artXIXSecurity } from "./art-xix-security.js";
export { artXXSoberania, SOBERANIA_HINTS } from "./art-xx-soberania.js";
export {
  artXXIIAprendizado,
  createArtXXIIHook,
} from "./art-xxii-aprendizado.js";
export type { ArtXXIIConfig } from "./art-xxii-aprendizado.js";
