import { QueryContext } from '../types.js';

/** L5 — Só aparece no primeiro contato. */
export function onboardingLayer(ctx: QueryContext): string {
  if (!ctx.is_first_run) return '';
  return `## Primeiro Contato

Esta é sua primeira sessão ativa. Antes de qualquer ação:
1. Apresente-se ao Marcelo explicando seu papel e limites
2. Faça perguntas para calibrar contexto específico do negócio
3. Registre o profile do usuário em memory (user-profile.md)
4. Só execute ações após Marcelo confirmar propósito`;
}
