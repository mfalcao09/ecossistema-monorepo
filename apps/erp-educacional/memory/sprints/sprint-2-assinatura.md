# Sprint 2: Assinatura Digital + Motor de Processamento
**Masterplan:** [../masterplans/diploma-digital-v4.md](../masterplans/diploma-digital-v4.md)
**Tracker:** [../TRACKER.md](../TRACKER.md)
**Estimativa:** ~40h | **Status:** 🔄 Em andamento (Epic 2.1 ✅ 100%)

---

## Plano de Sessões

| Sessão | Escopo | Status |
|--------|--------|--------|
| 020-023 | Motor XML — 12 bugs resolvidos, unit tests, comprobatórios | ✅ Entregue |
| 029-030 | Backend extração Railway + UI drag-drop/polling | ✅ Entregue |
| 031-039 | Resiliência Tela 2 (timeout, CORS, routing, paralelização) | ✅ Entregue |
| 041-048 | FormularioRevisao XSD + prompt Gemini + gate + reducer | ✅ Entregue |
| 049-054 | Fixes (0 arquivos, tipo_xsd, preview, IBGE, proxy) | ✅ Entregue |
| 058 | E2.1 fechamento — teste e2e converter_sessao→processo | ✅ Entregue |
| 059-066 | BRy integration + UI polish (assinaturas, disciplinas, gate, revisão) | ✅ Entregue |
| 067-068 | Normalizar períodos + fix assinantes/confiança revisão | ✅ Entregue |
| 069-080 | Polish E2.1: fix CSRF/fetchSeguro, BRy bridge script, vocabulário unificado, excluir diploma | ✅ Entregue |
| (a definir) | E2.2 — Outbox + BRy OAuth2 + worker | 🔲 Pendente (bloqueado: credenciais) |
| (a definir) | E2.3 — Reconciler registradora | 🔲 Pendente |
| (a definir) | E2.4 — Compressão PDF/A | 🔲 Pendente |

> ⚠️ Sessões pendentes serão definidas após conclusão do Sprint 1.

---

## Epics e Progresso

### Epic 2.1: Motor XML + Validação XSD + UI Extração — ✅ 100% COMPLETO
**Sessões:** 020, 021, 022, 023, 024, 025, 029, 030, 031-039, 041-048, 049-054, 058
**Commits:** 1802e3e, 0c25a58, 2518ed3, 139b5d5, 5c6bf66, f9739e46, 5e5e2e9, 8d322b4, 9117ded, 5c29bdd, 30e2d51, 5d7ea69, +fixes, 8275d16
**Entregáveis:**
- [x] Motor XML 12/12 bugs resolvidos
- [x] 17/17 unit tests passando (vitest)
- [x] SelecaoComprobatorios.tsx (808 linhas)
- [x] Ghostscript Railway (PDF/A)
- [x] Railway extração Gemini 2.5 Flash
- [x] UI Tela 1 (drag-drop) + Tela 2 (polling) + Tela 3 (formulário revisão)
- [x] Gate comprobatórios 3 estados (pendente/detectado/confirmado)
- [x] Prompt v3 gavetas + Reducer relacional
- [x] RPC converter_sessao_em_processo
- [x] Proxy server-side para Storage
- [x] Teste end-to-end converter_sessao→processo real (sessão 058, 4 bugs corrigidos)

### Epic 2.2: BRy Pipeline Completo — 🔄 EM ANDAMENTO (~80% completo)
**Sessões:** 059, 060, 078, 079, 080b, 082
**Arquitetura real:** BRy Signer Desktop (extensão + Token A3 USB) + API Initialize/Sign/Finalize/Carimbo
**Entregáveis:**
- [x] Tabela outbox_assinaturas (multi-passo)
- [x] BRy OAuth2 integração (client_credentials)
- [x] Rotas Initialize / Sign / Finalize
- [x] Carimbo do tempo: timestamp-service.ts + rota API manual
- [x] Auto-carimbo após última assinatura (síncrono no finalize)
- [x] Pipeline: carimbo-pipeline.ts (aplicarCarimboXmlInterno + verificarEAvancarPacote)
- [x] Pacote ZIP registradora: XMLs assinados + .p7s carimbo + PDFs/A + manifest.json
- [x] Frontend: seção "Prontos para Registradora" + botão Gerar Pacote
- [ ] **Teste e2e completo com Token A3 USB real** (próxima sessão 083)
- [ ] BRy credenciais homologação (pendente, testa em sandbox por ora)

### Epic 2.3: Reconciler Registradora — 🔲 NÃO INICIADO
**Sessões:** —
**Correção v4:** Divergências cosméticas = auto-accept; semânticas = flag humano
**Entregáveis:**
- [ ] Lógica de comparação XML enviado vs retornado
- [ ] Auto-accept para case/acentuação
- [ ] Flag humano para nomes/datas/códigos
- [ ] Painel de reconciliação

### Epic 2.4: Compressão PDF/A — 🔲 NÃO INICIADO
**Sessões:** —
**Correção v4:** NUNCA remover fontes embedadas (viola ISO 19005). Só DPI agressivo + downsampling
**Entregáveis:**
- [ ] Pass de compressão (72dpi, downsampling imagens)
- [ ] Verificação pós-compressão (válido PDF/A?)
- [ ] Threshold: >15MB = comprime, <15MB = mantém

---

## Sessões Realizadas (backlinks)

| # | Data | Commits | O que avançou | Epic |
|---|------|---------|---------------|------|
| 020 | 06/04 | 1802e3e | Hardening trim + RPC anti-race | E2.1 |
| 021 | 06/04 | 0c25a58 | codigo_validacao opcional + Assinantes builder | E2.1 |
| 022 | 07/04 | 2518ed3 | Override humano universal + atos_curso | E2.1 |
| 023 | 07/04 | 139b5d5 | PDF/A infra + SelecaoComprobatorios | E2.1 |
| 024 | 07/04 | ee6ec62 +4 | Bug #F Caminho B — converter-service + tela React (motor 12/12) | E2.1 |
| 025 | 07/04 | — | Design fluxo novo processo v2 (planejamento) | E2.1 |
| 026-027 | 08/04 | fb8d07c | Implementação design + push destravado via /tmp clone | E2.1 |
| 029 | 08/04 | 5c6bf66, f9739e46 | Backend extração Railway + Next.js rotas | E2.1 |
| 030 | 08/04 | 5e5e2e9 | UI loop completo (drag-drop + polling) | E2.1 |
| 031-039 | 08-09/04 | vários | Resiliência Tela 2 (7 sessões fixes) | E2.1 |
| 041 | 09/04 | 8d322b4 | FormularioRevisao reescrito XSD v1.05 | E2.1 |
| 042 | 10/04 | 9117ded | Prompt Gemini expandido | E2.1 |
| 043 | 10/04 | 5c29bdd | Gate comprobatórios 3 estados | E2.1 |
| 044 | 10/04 | 30e2d51 | Vinculação manual + prompt 14 tipos | E2.1 |
| 045 | 10/04 | c631432, 9d80e02 | Fix build + blob URL preview | E2.1 |
| 046 | 10/04 | 71d619c | RPC converter_sessao_em_processo | E2.1 |
| 047 | 10/04 | 044bf49, 5474b5d | Fix gate false positives + iframe PDF | E2.1 |
| 048 | 10/04 | 5d7ea69 | Prompt v3 + Reducer relacional | E2.1 |
| 049 | 11/04 | 5d7b4ef, eb5561b | Fix "0 arquivos" + fix gate tipo_xsd | E2.1 |
| 052 | 11/04 | 6c06897 | Fix preview PDF proxy | E2.1 |
| 053 | 11/04 | 0a1cacf | Naturalidade 3 campos IBGE | E2.1 |
| 054 | 11/04 | (commit) | Fix gate tipo_xsd confirmações | E2.1 |
| 058 | 11/04 | 8275d16 | Teste e2e converter + RPC v2 (4 bugs fix) — **Epic 2.1 COMPLETO** | E2.1 ✅ |
| 059 | 11/04 | cc17f10 | Epic 2.2 BRy Integration (lib/bry + rotas + outbox + frontend) | E2.2 |
| 060 | 11/04 | 576d6ec | Página /diploma/assinaturas dedicada + sidebar BRy + seleção lote | E2.1 polish |
| 061 | 11/04 | 1286420 | Fix Código e-MEC auto-preenchido + normalização enums banco→XSD v1.05 | E2.1 polish |
| 062 | 11/04 | 84ca857 | Fix gate desincronizado — INSERT processo_arquivos non-blocking | E2.1 polish |
| 063 | 11/04 | 2fd21c3 | FormularioRevisao 12 seções XSD v1.05 + PDF export + RPC COALESCE | E2.1 polish |
| 064 | 11/04 | ea74208 | 6 ajustes UI (dados processo, disciplinas agrupadas, checkboxes dialog) | E2.1 polish |
| 065 | 11/04 | 805d6b1 | Fix "Diplomando não identificado" → CPF+NOME no card extração | E2.1 polish |
| 066 | 11/04 | 444207c | Substituir Arquivo no dialog + Excluir importação c/ confirm + disciplinas editáveis | E2.1 polish |
| 067 | 11/04 | (commit) | Normalizar períodos (normalizarPeriodo) + labels editáveis + botão Padronizar | E2.1 polish |
| 068 | 11/04 | (commit) | Fix assinantes (auto-load /api/assinantes) + confiança 0%→97% (RPC + retrofix) | E2.1 polish |
| 069 | 11/04 | 0f779dd | Fix C: navegação direta para pipeline quando diploma_id existe (list + form antigo) | E2.1 polish |
| 070 | 11/04 | 17efbc4 | Pipeline Auditar Requisitos XSD: 6 validators + API + hook + UI + gate suave | E2.1 polish |
| 071 | 11/04 | 8c59bb7 | Fix Bug #2: botões auditoria → /diploma/processos/{id} (processoId+onVerDocumentos) | E2.1 polish |
| 072 | 11/04 | 031b9f7 | Fix Bug #3: botões auditoria → /diploma/processos/novo/revisao/{sessaoId} (sessaoId+dual-path) | E2.1 polish |
| 073 | 11/04 | 8b10b4a | Fix Bug #4 (causa raiz): GET /api/diplomas/[id] retornava extracao:null hardcoded | E2.1 polish |
| 074 | 11/04 | e31ebfb | Processo nasce no Upload: DB migration + POST iniciar cria processo + RPC UPDATE/INSERT + lista navegação em_extracao | Arq |
| 075 | 12/04 | b82d6fd | Fix 6 bugs: nav lista→revisão + 3 links pipeline + redirect pós-confirmar + auditoria genitores/CH/comprobatórios + SQL RPC+data fix | E2.1 polish |
| 076 | 12/04 | 563cb88 | Auto-save timestamp persistente + bloqueio formulário pós-publicação (backend 403 DIPLOMA_PUBLICADO + banner âmbar) | E2.1 polish |
| 077 | 12/04 | (5 commits) | Fix pipeline Gerar XML: CSRF, rota Ver Processo, React unmounting, ImageMagick Railway, BUCKET_ORIGEM processo-arquivos | E2.1 polish |
| 078 | 12/04 | 8929107 | Fix detecção extensão BRy Signer: retry loop 16×500ms + "Verificar novamente" + badge "Verificando…" | E2.2 |
| 079 | 12/04 | 8eb4f89, 2f85648 | Fix BRy bridge script (causa raiz real) + alinhar tipos Promise em AssinadorBry.tsx | E2.2 |
| 080b | 12/04 | 362334c, 8305f07, 558b081 | Fix BRy timeout hang (Promise.race 8s) + TopBar cleanup + sidebar Emissões/Assinaturas reorder | E2.2 |
| 081 | 12/04 | (commits) | Dashboard +2 cards + vocabulário unificado pipeline-unificado.ts + fix CSRF fetchSeguro (excluir diploma + 5 mutações) | E2.1 polish |
| 082 | 12/04 | 613f151, df83975 | **Carimbo do tempo automático**: timestamp-service + auto-carimbo no finalize + pipeline pós-assinatura → pacote ZIP registradora | E2.2 |
