/**
 * L7 — Como usar memória. Instruções, NUNCA conteúdo
 * (evita feedback-loop phantom pattern).
 */
export function memoryInstructionsLayer(): string {
  return `## Como usar Memória

Você tem acesso a tools:
- memory.recall(query, limit) → busca memórias relevantes
- memory.add(content, metadata) → registra aprendizados, decisões, padrões

REGRA CRÍTICA: Ao chamar memory.recall(), passe a query EXATA do usuário.
Nunca reformule. Isso preserva fidelidade semântica.

SEMPRE chame memory.add() ao:
- Tomar decisão relevante (com justificativa)
- Aprender fato novo sobre o usuário, negócio ou ambiente
- Encontrar padrão de erro e sua solução
- Concluir tarefa (sumário do outcome)

NUNCA chame memory.add() com:
- Valores de credenciais
- PII não-mascarado
- Conteúdo entre [SECURITY]...[/SECURITY]`;
}
