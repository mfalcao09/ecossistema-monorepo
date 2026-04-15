---
name: Fase B — Supabase como memória primária
description: 🟢 FASE B ATIVA (14/04/2026): bootstrap_session() substitui leitura de TRACKER.md no início de toda sessão ERP/Ecosystem
type: reference
originSessionId: f40dba1e-39f8-4ed5-8aec-9a5deb2c508d
---
## Status
Fase B ativada em 14/04/2026. RAG Engine Railway: 193+ embeddings (100%).
Fix aplicado: match_ecosystem_memory_keyword v2 (websearch_to_tsquery + ILIKE siglas).

## Como usar no início de TODA sessão

```sql
-- ERP (diploma digital, sprints, agentes FIC)
select bootstrap_session('descrever tarefa desta sessão', 'erp', 15);

-- Ecossistema (agentes, planos, arquitetura cross-business)
select bootstrap_session('descrever tarefa desta sessão', 'ecosystem', 15);

-- Ambos os projetos (sem filtro)
select bootstrap_session('descrever tarefa desta sessão', null, 20);
```

## MCP para executar
`mcp__05dc4b38-c201-4b12-8638-a3497e112721__execute_sql`
Projeto Supabase: `gqckbunsfjgerbuiyzvn` (us-east-2)

## O que a função retorna
- Feedbacks estruturais (regras críticas, anti-padrões) — sempre incluídos
- Memórias contextuais relevantes para a tarefa descrita
- Perfis do squad (Buchecha, DeepSeek, Qwen, Kimi, Codestral, Claude)

## Ordem de escrita no encerramento (FASE B)
1. INSERT no Supabase PRIMEIRO (primário)
2. Salvar arquivo .md local DEPOIS (backup/cache)

## Fallback (Supabase indisponível)
Ler TRACKER.md + sprint ativo (modo Fase A, ~2.000 tokens).

## Arquivos atualizados nesta virada
- ERP-Educacional/CLAUDE.md → seção "Sistema de Rastreabilidade"
- Ecossistema/CLAUDE.md → seção "Sistema de Memória"
- GitHub/PROTOCOLO-MEMORIA.md → fluxo Orient→Work→Persist + Regras de Ouro
