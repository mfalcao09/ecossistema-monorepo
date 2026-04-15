# Planos Ativos do Ecossistema — Mapa de Referência

> **Propósito:** nunca mais confundir nomenclaturas. Este doc é a **fonte única de verdade** sobre quais planos estão rodando em paralelo, onde estão documentados e como se conectam.

**Última atualização:** 2026-04-14 (s093b — auto-embed e2e ✅ · MASTERPLAN v8.2 · **SC-29 P0 próxima sessão**)

---

## Os 3 planos que convivem

### 📗 Plano 1 — Skills + RAG nos Agentes (nomenclatura: Fase 1/2/3/4)

| Fase | Descrição | Status |
|---|---|---|
| **Fase 1** | 3 agentes dedicados (aluno/professor/colaborador) em produção | ✅ Concluída (commit `5196547`) |
| **Fase 2** | Skills Fixas — tabelas `ia_skills` + `ia_agente_skills`, API CRUD, UI de gestão | ⏭️ **Pulada** (decisão ADR-001) |
| **Fase 3** | RAG com pgvector, embeddings, busca híbrida | 🎯 **Em execução como `rag-agentes-erp`** |
| **Fase 4** | Feedback Loop (reforço com base em uso real) | 📋 Futura |

**Documentação original:** `.auto-memory/project_plano_skills_rag_aprovado.md` (05/04/2026).

---

### 📘 Plano 2 — Memória do Ecossistema (nomenclatura: Fase A/B)

| Fase | Descrição | Status |
|---|---|---|
| **Fase A** | Dual-write: arquivos `.md` locais + Supabase ECOSYSTEM em paralelo | ✅ Concluída |
| **Fase B** | Supabase ECOSYSTEM como primário, arquivos locais como backup | ✅ **ATIVA desde 14/04/2026** |

**Ativação Fase B (s093, 14/04/2026):**
- Embeddings: 193/193 (100%) — limiar de 80% superado
- `bootstrap_session()` reescrita com OR-logic + ILIKE (15 resultados vs 1 anterior)
- CLAUDE.md (ERP + Ecossistema) + PROTOCOLO-MEMORIA.md + TRACKER.md atualizados
- FASE 0.4: trigger `auto_embed_after_insert` + Edge Function `embed-on-insert` deployados
- **Pendente:** setar `GEMINI_API_KEY` e `EMBED_INTERNAL_SECRET` como Supabase Secrets no Dashboard (supabase.com → gqckbunsfjgerbuiyzvn → Edge Functions → Secrets)

**Documentação:** `memory/PLANO-VIRADA-FASE-B.md` + `.auto-memory/reference_fase_b_supabase_primario.md`.

---

### 📙 Plano 3 — Caminho Pragmático (nomenclatura: A/C) — **esta é a ação atual**

| Fase | Descrição | Status |
|---|---|---|
| **A** | Estado atual: RAG validado no Ecossistema (Fase A do Plano 2). Agentes do ERP sem RAG (Fase 1 do Plano 1). | ✅ Ponto de partida |
| ~~B~~ | (Fase B do Plano 2 — pulada) | ⏭️ Não entra neste caminho |
| **C** | RAG ativo nos 3 agentes do ERP com tool call, busca híbrida, embedder dedicado | 🎯 **Alvo** |

**Documentação:** `memory/decisions/ADR-001-rag-agentes-erp.md` + `memory/masterplans/rag-agentes-erp.md`.

---

## Como os 3 planos se relacionam

```
Plano 1 (Skills+RAG)          Plano 2 (Memória)              Plano 3 (Caminho A→C)
──────────────────           ──────────────────            ─────────────────────
Fase 1 ✅                      Fase A ✅ (atual)              A (estado atual)
Fase 2 ⏭️ pulada                                              │
Fase 3 🎯 executando ◄──────────┐                             ▼
Fase 4 📋 futura               │                             C (alvo)
                                │
                     Fase B ⏸️ adiada ◄── aguarda embeddings ≥ 80%
```

**Resumo:** o **Plano 3 (A→C)** é a maneira operacional de materializar a **Fase 3 do Plano 1**, enquanto o **Plano 2** segue em Fase A sem pressa de virar para B.

---

## Regras para evitar confusão futura

1. **Toda nova conversa sobre RAG/IA** deve começar consultando este arquivo.
2. **Ao usar letra ou número de fase**, sempre indicar o plano de origem. Ex: "Fase 3 (Plano 1 — Skills+RAG)" ou "Fase A (Plano 2 — Memória)" ou "A→C (Plano 3 — Pragmático)".
3. **Novos planos** devem ser registrados aqui antes de começarem.
4. **Planos concluídos ou descartados** ficam aqui com status apropriado (não são deletados).

---

## Índice rápido

| Documento | Localização |
|---|---|
| ADR desta decisão | `memory/decisions/ADR-001-rag-agentes-erp.md` |
| Masterplan detalhado | `memory/masterplans/rag-agentes-erp.md` |
| Plano Skills+RAG original | `/sessions/loving-optimistic-bohr/mnt/.auto-memory/project_plano_skills_rag_aprovado.md` |
| Scheduled task RAG readiness | MCP `scheduled-tasks` — "RAG ENGINE READINESS CHECK" |
| RAG Engine (Ecossistema) | `/Users/marcelosilva/Projects/GitHub/Ecossistema/rag-engine/` |
| Supabase ECOSYSTEM | `gqckbunsfjgerbuiyzvn` (us-east-2) |
| Supabase ERP | `bvryaopfjiyxjgsuhjsb` |
