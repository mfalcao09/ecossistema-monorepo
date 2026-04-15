# Plano de Correção — CLM Fase 4
**Plataforma Intentus Real Estate**
**Data:** 07/03/2026
**Status:** ⏳ AGUARDANDO APROVAÇÃO DE MARCELO

---

## Visão Geral

O plano está dividido em **3 etapas**, ordenadas por prioridade e impacto:

| Etapa | O que | Bugs corrigidos | Esforço estimado | Risco |
|-------|-------|----------------|-----------------|-------|
| 1 | Redeploy de 5 Edge Functions com `verify_jwt: false` | #4, #5, #6, #7, #8 | ~15 min | Baixo |
| 2 | Debug e fix de 3 Edge Functions com erros de lógica | #9, #10, #11, #13 | ~1-2h | Médio |
| 3 | Melhoria UX do botão "Atualizar" no Command Center | #12 | ~30 min | Baixo |

---

## Etapa 1 — Redeploy de 5 Edge Functions (Prioridade ALTA)

### O que será feito:
Para cada uma das 5 functions abaixo, vou:
1. Ler o código atual da function via `get_edge_function`
2. Redeployar com exatamente o mesmo código, mas com `verify_jwt: false`
3. Testar no navegador para confirmar que o erro 401 foi resolvido

### Functions a corrigir:

| # | Function | Versão Atual | Ação |
|---|----------|-------------|------|
| 1 | `contract-draft-ai` | v5 | Redeploy com `verify_jwt: false` |
| 2 | `clm-ai-insights` | v5 | Redeploy com `verify_jwt: false` |
| 3 | `pricing-ai` | v5 | Redeploy com `verify_jwt: false` |
| 4 | `parse-contract-ai` | v4 | Redeploy com `verify_jwt: false` |
| 5 | `extract-clauses-ai` | v4 | Redeploy com `verify_jwt: false` |

### Resultado esperado:
- "Gerar Contrato com IA" → funciona
- "Analisar com IA" no Dashboard → funciona
- "IA de Precificação de Aluguel" → funciona
- "Importar Contrato com IA" → funciona
- "Gerar Cláusulas com IA" → funciona

### Nota de segurança:
Com `verify_jwt: false`, a validação de JWT fica por conta do código da function (não do gateway). As functions que já corrigimos anteriormente (copilot, unified-alerts, etc.) funcionam assim sem problemas. O ideal a longo prazo é adicionar o header `apikey` no frontend, mas isso requer mudança no código React e é uma melhoria futura.

---

## Etapa 2 — Debug de 3 Edge Functions com Erros de Lógica (Prioridade MÉDIA)

### O que será feito:
Para cada function, vou:
1. Ler o código atual via `get_edge_function`
2. Analisar os logs para entender quais endpoints/rotas estão falhando
3. Identificar o bug de lógica (parâmetros, rotas, queries)
4. Corrigir o código
5. Redeployar e testar

### Functions a debugar:

| # | Function | Versão | Erro | Provável Causa |
|---|----------|--------|------|---------------|
| 1 | `clm-contract-api` | v3 | 404 | Rota/endpoint não encontrado — possível mismatch entre URL chamada pelo frontend e rotas definidas na function |
| 2 | `clm-approvals-api` | v3 | 400 | Validação de parâmetros falhando — possível campo obrigatório não enviado pelo frontend |
| 3 | `clm-obligations-api` | v3 | 400 | Mesmo tipo de problema — validação rejeitando request |

### Resultado esperado:
- Command Center carrega sem banner de erro vermelho
- Dados de contratos, aprovações e obrigações carregam corretamente
- Bug #13 (banner vermelho) desaparece automaticamente

### Nota:
Esta etapa requer análise mais profunda do código. Posso precisar verificar também o código do frontend para entender quais parâmetros/rotas estão sendo chamados.

---

## Etapa 3 — Melhoria UX do Botão "Atualizar" (Prioridade BAIXA)

### O que será feito:
1. Localizar o componente do Command Center no código React
2. Alterar a lógica do botão "Atualizar" para fazer refetch sem invalidar o cache visual (evitando o skeleton loading)
3. Usar `refetch()` do React Query em vez de `invalidateQueries()`, ou adicionar `keepPreviousData: true`

### Resultado esperado:
- Clicar "Atualizar" busca dados novos sem flicker
- Dados antigos permanecem visíveis até os novos chegarem

---

## Ordem de Execução Recomendada

```
ETAPA 1 (15 min) → TESTAR → ETAPA 2 (1-2h) → TESTAR → ETAPA 3 (30 min) → TESTE FINAL
```

A Etapa 1 é a mais rápida e resolve o maior número de bugs (5 de 10). Recomendo começar por ela.

---

## O que NÃO será alterado

- ❌ Código do frontend (exceto Etapa 3, se aprovada)
- ❌ Schema do banco de dados
- ❌ Outras Edge Functions que já funcionam (copilot, unified-alerts)
- ❌ Integração Clicksign (pendência futura separada)

---

## Aprovação

Marcelo, este plano requer sua aprovação antes de eu iniciar qualquer correção.

**Opções:**
- ✅ **Aprovar tudo** — Executo as 3 etapas em sequência
- ✅ **Aprovar Etapa 1 apenas** — Corrijo os 5 erros de 401 (mais rápido, maior impacto)
- ✅ **Aprovar Etapas 1 e 2** — Corrijo os 401 e os erros de lógica
- ❌ **Não aprovar** — Aguardo suas instruções

---

*Plano gerado por Claude com base na análise de 39 frames do vídeo e logs do Supabase.*
