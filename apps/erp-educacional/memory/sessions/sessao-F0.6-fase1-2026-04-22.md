# Sessão F0.6 / Fase 1 — 2026-04-22 (tarde)

**Branch:** `claude/vigorous-mccarthy-8ca1e4`
**Produção final:** `diploma-digital-qsd0n5815` (Ready)
**Backlinks:** masterplan diploma-digital-v4 → Fase 0.6 Snapshot Imutável / Fase 1 (snapshot + UI)

## 🎯 Objetivo

Implementar o backbone do plano Snapshot Imutável aprovado em 2026-04-22 manhã: migrations, lib TypeScript, endpoints REST, UI da aba Snapshot no diploma. Nada de XMLs ou PDFs lendo do snapshot ainda — isso é Fase 2 e 3.

## ✅ Entregas

### Banco (2 migrations via `apply_migration`)
- `snapshot_imutavel_diploma` — 6 colunas novas em `diplomas` + index parcial
- `diploma_snapshot_edicoes_auditoria` — tabela append-only com CHECK `length(justificativa) >= 20` + RLS

### Backend
- **`src/lib/diploma/snapshot.ts`** (~450 linhas)
  - Tipos canônicos `DadosSnapshot` v1
  - `montarSnapshotExtracao()` builder com normalização
  - `aplicarPatches()` não-mutativo com dot-notation
  - `diffSnapshots()` recursivo para auditoria
  - `podeEditarSnapshot()` / `snapshotEstaTravado()`
- **`POST /api/processos`** — monta snapshot no INSERT do diploma (try/catch defensivo)
- **`GET /api/diplomas/[id]/snapshot`** — snapshot + metadata + últimas 10 edições
- **`PATCH /api/diplomas/[id]/snapshot`** — edição com justificativa + optimistic lock
- **`POST /api/diplomas/[id]/snapshot/travar`** — trava manual idempotente

### UI
- **`src/components/diploma/AbaSnapshot.tsx`** (600+ linhas)
  - Status card visual (rascunho amber / travado emerald)
  - Resumo + JSONViewerModal + EditorModal
  - Histórico de edições com diffs
  - Botão "Confirmar e liberar assinaturas" 2-step
- **Aba "Snapshot"** entre "Dados" e "XMLs" em `/diploma/diplomas/[id]`

## 🐛 Bug fixado
Supabase JS não infere corretamente com `.select()` string concatenada → cast via interfaces `DiplomaSnapshotRow`, `DiplomaSnapshotEditCheckRow`, `DiplomaTravarRow`

## 🔒 Preservado
- Diplomas legados: aba mostra aviso, fluxo atual intocado
- Extração IA, APIs BRy, Secretaria, RVDD, Registro — nada mexido
- Try/catch defensivo: snapshot falhando não bloqueia criação do diploma

## 📋 Pendências

| ID | Descrição | Prioridade |
|---|---|---|
| P-040 | Executar Fase 2: builders XML lendo do snapshot (~3h15) | Alta |
| P-041 | Executar Fase 3: templates React + Puppeteer para 3 PDFs lendo do snapshot (~4h) | Alta |
| P-042 | Smoke end-to-end novo diploma → snapshot → travar → XMLs + PDFs | Alta |
| P-033 | E-mails 4 assinantes FIC para BRy | Alta |

## 🔗 Commits da sessão
- `feat(diploma): Snapshot Imutável Fase 1 — snapshot + UI + endpoints` (2bc395a)
- `fix(build): cast explícito de Supabase row nos endpoints de snapshot` (a23d4f6)
