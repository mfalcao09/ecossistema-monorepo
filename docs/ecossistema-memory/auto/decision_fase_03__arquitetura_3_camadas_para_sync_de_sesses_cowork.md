---
name: FASE 0.3 — Arquitetura 3 camadas para sync de sessões Cowork
description: FASE 0.3 — Arquitetura 3 camadas para sync de sessões Cowork
type: decision
project: ecosystem
tags: ["decision", "fase-0-3", "architecture", "sync-sessions", "pg_cron", "redundancy"]
success_score: 0.95
supabase_id: 4e4968c3-4d2e-45e3-8ccf-139577bd9a78
created_at: 2026-04-14 18:47:55.951518+00
updated_at: 2026-04-14 18:47:55.951518+00
---

## Decisão: Opção C + D para persistência de sessões

**Data:** 14/04/2026 (s097)

**Problema:** Sessões Cowork são efêmeras — destruídas ao fechar. bootstrap_session() não tinha histórico.

**Solução escolhida (C + D):**
- C: Edge Function sync-sessions puxa sessões .md do GitHub e insere no Supabase
- D: bootstrap_session() detecta gap > 6h e dispara sync automático antes de retornar memórias

**Componentes entregues:**
1. Edge Function sync-sessions (ACTIVE) — pull GitHub API, dois repos (ecosystem + erp)
2. pg_cron job sync-sessions-hourly (todo minuto 5)
3. trigger_sync_sessions() SQL function — lê segredo do Vault, chama via pg_net
4. bootstrap_session() com session_sync JSON no resultado
5. git-push-memory scheduled task estendida

**UNIQUE index:** (title, project) WHERE type=session — garante idempotência

**Teste:** 18.7h gap → auto_sync_triggered: true, memory_count: 5 ✅

**Por que não A/B/E:** A (hook manual) = esquecimento humano | B (Supabase Realtime) = não sobrevive sessão | E (só manual) = ponto único de falha
