# MASTERPLAN: Diploma Digital FIC v4.0
**Tracker:** [../TRACKER.md](../TRACKER.md)
**Arquivo original:** `/ERP-Educacional/MASTERPLAN-REVISADO-v4.md`
**Data:** 10/04/2026 | **Timeline:** 6 Sprints × 2 semanas = 12 semanas (~204h)
**Objetivo:** Roteiro de diploma digital + ERP educacional, do zero até escalar para 1.000 IES.

---

## Sprint 1: Segurança Zero-Trust (~32h) → [../sprints/sprint-1-seguranca.md](../sprints/sprint-1-seguranca.md)
- Epic 1.1: Criptografia PII (HMAC-SHA256 + AES-256) — 🔄 parcial
- Epic 1.2: Supabase Vault (migrar secrets BRy)
- Epic 1.3: Segurança Railway DB Write Direto (IP allowlist + RPC)
- Epic 1.4: Hard Lock Jurídico (trigger imutabilidade + desbloqueio excepcional)

## Sprint 2: Assinatura Digital + Motor (~40h) → [../sprints/sprint-2-assinatura.md](../sprints/sprint-2-assinatura.md)
- Epic 2.1: Motor XML + Validação XSD + UI Extração — 🔄 ~90%
- Epic 2.2: Outbox + BRy KMS (auth→sign→response síncrono)
- Epic 2.3: Reconciler Registradora (auto-accept cosmético, flag semântico)
- Epic 2.4: Compressão PDF/A (DPI agressivo, nunca remover fontes)

## Sprint 3: RVDD + Portal do Diplomado (~36h) → [../sprints/sprint-3-rvdd.md](../sprints/sprint-3-rvdd.md)
- Epic 3.1: RVDD — PDF visual do diploma (template + dados do XML)
- Epic 3.2: Portal do Diplomado (consulta pública, download, validação)
- Epic 3.3: Repositório HTTPS (armazenamento público obrigatório MEC)

## Sprint 4: Compliance MEC (~28h) → [../sprints/sprint-4-compliance.md](../sprints/sprint-4-compliance.md)
- Epic 4.1: Validação XSD como gate pré-assinatura
- Epic 4.2: Auditoria de schema (65 tabelas vs requisitos MEC)
- Epic 4.3: Cache strategy (rotas cacheáveis vs proibidas)

## Sprint 5: Backup + Expedição (~32h) → [../sprints/sprint-5-backup.md](../sprints/sprint-5-backup.md)
- Epic 5.1: Backup Cloudflare R2 (redundância 10 anos)
- Epic 5.2: Módulo Expedição (Termo Registro + Expedição, 9 docs)
- Epic 5.3: Histórico-PDF sob demanda (signatários escolhidos)

## Sprint 6: Observabilidade + Testes (~36h) → [../sprints/sprint-6-observabilidade.md](../sprints/sprint-6-observabilidade.md)
- Epic 6.1: Dashboard administrativo (métricas, filas, alertas)
- Epic 6.2: Sentry integração profunda (source maps, traces)
- Epic 6.3: Testes automatizados (e2e + integration)

---

## Errata v3→v4
17 problemas corrigidos (5 críticos). Detalhes completos no arquivo original `MASTERPLAN-REVISADO-v4.md`.

## Squad de IAs
Claude (Arquiteto) → Buchecha/MiniMax (code review) → DeepSeek (lógica/debug) → Qwen (frontend) → Kimi (bugs) → Codestral (refatoração)
