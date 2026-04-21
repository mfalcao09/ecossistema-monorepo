# TRACKER — ERP Educacional / Diploma Digital FIC

> ⚠️ **FASE B ATIVA** — Este arquivo é **backup de emergência**.
> Fonte primária: Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn`).
> Use `select bootstrap_session('tarefa', 'erp', 15)` no início da sessão.
> Última sync automática: 2026-04-14

> Atualizado: 22/04/2026 (F0.6 ENCERRADA — arquitetura Snapshot Imutável completa em produção) | Sessão mais recente: F0.6/Fase3 (render-pdf.ts + 2 templates React + 2 rotas /print/* + patch endpoint documentos — produção `diploma-digital-i8arc5f78`) | Próxima: smoke end-to-end piloto Kauana + merge PR #19 | Retroactive pass: ✅ completo

## Estado Atual
- **Masterplan ativo:** diploma-digital-v4 → [masterplans/diploma-digital-v4.md](masterplans/diploma-digital-v4.md)
- **Masterplan paralelo:** MASTERPLAN-FIC-MULTIAGENTES-v2 (Ecossistema) — CFO/S-01 ✅ inaugurado
- **Sprint ativo (Diploma):** Sprint 2 (Assinatura + Motor) → [sprints/sprint-2-assinatura.md](sprints/sprint-2-assinatura.md)
- **Sprint ativo (Financeiro):** S-01 ✅ S-02 ✅ S-03 ✅ COMPLETO → **S-04 próxima:** Importar alunos + configurar descontos 2026/1 + executar bolepix real (aguarda credenciais Inter sandbox)
- **Sprint ativo (Atendimento):** S3 ✅ TELA DE CONVERSAS — 3 painéis (lista+chat+info), APIs REST, Realtime Supabase, bubbles WhatsApp, envio outbound Meta Cloud API. Deploy READY commit 552be02.
- **Sprint 6 — Acervo Digital:** ✅ CONCLUÍDO (s094, commit `d76b639`, deploy READY `dpl_89vEbauDXmayo2s9GnegqbzZ287Q`)
- **Sprint 7 — Pacote Registradora:** ✅ CONCLUÍDO (s095, commit `817c47e`, deploy READY `dpl_FYTdVrwZgJjeCP7FoNKj1zGLq1EP`)
- **Próxima sessão (Diploma):** F0.6 → **Snapshot Imutável Fase 1** — migrations + snapshot.ts + UI aba Snapshot + patch POST /processos + endpoints PATCH/travar (~4h45)
- **Próxima sessão+1 (Diploma):** F0.7 → **Snapshot Fase 2** (XMLs lendo snapshot, ~3h15) + F0.8 (PDFs lendo snapshot + templates React, ~4h)
- **Piloto Kauana** (id: 5e197846) — reagendar após F0.6-F0.8 ou testar em paralelo com dados atuais
- **Próxima sessão (Diploma/Sprint):** 096 → **Sprint 8** — Fluxo UFMS manual + teste ZIP Kauana + configurar vars BRy Vercel + importar XML registrado
- **Próxima sessão (Financeiro):** 093 → **MÓDULO FINANCEIRO** — importar alunos 2026/1 + configurar descontos + testar crons manualmente + webhook pagamento Inter
- **Próxima sessão (Atendimento):** S4 — Teste WhatsApp real + atribuição de agentes + transferência de fila
- **Bloqueadores:** BRy credenciais homologação (bloqueia S2/E2.2) | Inter sandbox credentials (bloqueia S-02 real) | Prazo MEC 01/07/2025 vencido

## Progresso Global

| Sprint | Nome | Epics | Progresso | Sessões | Status |
|--------|------|-------|-----------|---------|--------|
| — | Pré-Masterplan (Fundação) | — | ✅ | 001-019 | Base do ERP construída |
| 1 | Segurança Zero-Trust | 4 | 4/4 (100%) | 028,051-052,055-057 | ✅ COMPLETO |
| 2 | Assinatura + Motor | 4 | ~2/4 (50%) | 020-027,029-039,041-082 | 🔄 E2.1 ✅ 100%, E2.2 ~80%, E2.3-2.4 pendentes |
| 3 | RVDD + Portal | 3 | 0/3 (0%) | — | 🔲 Não iniciado |
| 4 | Compliance MEC | 3 | 0/3 (0%) | — | 🔲 Não iniciado |
| 5 | Backup + Expedição | 3 | 0/3 (0%) | — | 🔲 Não iniciado |
| 6 | Acervo Digital (Pipeline E2) | 4 | 4/4 (100%) | 094 | ✅ COMPLETO |
| 7 | Pacote Registradora | 5 | 5/5 (100%) | 095 | ✅ COMPLETO |
| 8 | Envio UFMS + Registro | — | 0 (0%) | — | 🔲 Próximo |

**Progresso global (Diploma):** ████░░░░░░ ~20% (fundação + S1 completo + S2 parcial)
**Progresso global (Financeiro):** ███░░░░░░░ ~25% (S-01 ✅ S-02 ✅ S-03 ✅ — régua cobrança completa, 6 endpoints live)
**Sessões totais:** 95 (094: Sprint 6 Acervo Digital ✅ | 095: Sprint 7 Pacote Registradora ✅)

## Últimas 5 Sessões

| # | Data | Entregou | Sprint/Epic |
|---|------|----------|-------------|
| F0.6/F3 | 22/04 | **🎉 F0.6 ENCERRADA — PDFs via Puppeteer + templates React**: render-pdf.ts (160 linhas, helper Puppeteer reutilizável) + TermoExpedicaoTemplate.tsx (texto oficial Port. MEC 70/2025) + TermoResponsabilidadeTemplate.tsx (5 cláusulas referenciando snapshot) + 2 rotas /print/termo-* (Client Components, fetch endpoint /dados) + patch POST /api/diplomas/[id]/documentos (bifurcação: snapshot→Puppeteer, legado→pdf-lib, maxDuration 120). Compatibilidade 100% preservada: BRy HUB Signer, bucket documentos, Secretaria, API XAdES. **Arquitetura snapshot completa em 1 sessão (~14h estimadas)**. Produção: `diploma-digital-i8arc5f78` | Fase0.6/Snapshot-F3 |
| F0.6/F2 | 22/04 | **🎉 Snapshot Imutável Fase 2 — XMLs lendo snapshot**: src/lib/diploma/snapshot-to-dados-diploma.ts (350 linhas) com aplicarSnapshotSobreDadosDiploma + normalizações de enum (TTitulacao, TFormaAcesso, forma_integralizacao). Patch em montador.ts: SELECT inclui snapshot + aplica helper antes das regras de negócio. 5 bugs fixados durante build. Preserva 100% builders XML, legados e APIs BRy. Produção: `diploma-digital-ihudd6c9e` | Fase0.6/Snapshot-F2 |
| F0.6/F1 | 22/04 | **🎉 Snapshot Imutável Fase 1**: 2 migrations (diplomas.dados_snapshot_extracao jsonb + diploma_snapshot_edicoes audit) + src/lib/diploma/snapshot.ts (builder+patches+diff+travar) + POST /api/processos populando snapshot + 3 endpoints REST (GET/PATCH/travar) + UI AbaSnapshot (status card+viewer+editor+histórico+travar). Produção: `diploma-digital-qsd0n5815`. Diplomas legados preservados (aviso amigável). Próximas: F2 builders XML, F3 Puppeteer PDFs | Fase0.6/Snapshot-F1 |
| F0.5 | 22/04 | **🎉 PDF Texto Selecionável via Puppeteer + Plano Snapshot**: rota `/print/historico/[id]` + endpoint POST `/pdf` (Puppeteer+Chromium headless) + LivePreview com props `dadosAluno/dadosCurso/dadosAssinantes` + botão "Salvar PDF" (download direto, sem diálogo) + botão "Imprimir" (iframe escondido) + toggle "Papel já timbrado" + @sparticuz/chromium@147 + puppeteer-core@24. **Plano arquitetural Snapshot Imutável APROVADO** (14h em 3 fases): artefatos oficiais lêem de `dados_snapshot_extracao` JSONB imutável, 2 APIs BRy distintas (XAdES+HUB Signer) leem do mesmo snapshot, auditoria em `diploma_snapshot_edicoes`. Produção: `diploma-digital-4r3nca9e0` | Fase0.5/PDF+Arquitetura |
| F0.4 | 17/04 | **🎉 Fase 0.4 PDFs COMPLETA — Módulo Secretaria**: Secretaria (layout+emissão+configurações) + secretaria/emissao/historico (busca+download PDF) + API POST /api/secretaria/emissao/historico/[diplomaId] + timbrado e margens no pdf-generator.ts (PDFBuilderOpts+mmToPt) + timbrado nos 3 PDFs via api/diplomas/[id]/documentos + remove aba historico de diploma/config + PR #19 aberta. Branch: claude/vigorous-mccarthy-8ca1e4 | Fase0.4/PDFs |
| 095 | 15/04 | **🎉 Sprint 7 — Pacote Registradora COMPLETO**: assinatura-pdf.ts (HUB Signer BRy) + POST /documentos/assinar + webhook /bry-assinatura-pdf + UI Etapa 3 (ZIP+XML upload) + pacote-registradora fix (ZIP binário). Commit `817c47e`, deploy READY. | S7/Pacote |
| 094 | 15/04 | **🎉 Sprint 6 — Acervo Digital COMPLETO**: RPC v3 step 12.5 (DDC automático) + POST /acervo/converter (PDF/A Ghostscript) + fix verificarEAvancarPacote (→ aguardando_documentos) + GET+PATCH /comprobatorios + AbaComprobatoriosMec. Commit `d76b639`, deploy READY. | S6/Acervo |
| 093 | 14/04 | **Pipeline end-to-end diagnóstico**: fix diploma Kauana (bucket xml-diplomas + status avançado) + fix labels STATUS_CONFIG (11→30+ status, fallback correto) + 11 gaps identificados + plano S6–S9 documentado + 4 decisões confirmadas por Marcelo + HTML visual pipeline | S2/diagnóstico |
| 092 | 14/04 | **🎉 S-03 Régua de Cobrança Completa** — migration `20260413_financeiro_regua_cobranca.sql` aplicada (3 tabelas novas + ALTERs), emit-boletos.py ajustado (NAOTEMMULTA+desconto pontualidade), cron-inadimplencia.py, gerar-pix-demanda.py, cron-regua.py (6 tons escalada), cron-expirar-pix.py. Commit `1f27208`, todos endpoints HTTP 401 ✅ | CFO/S-03 |
| 091 | 13/04 | **Hotfixes Usuários** — fix CSRF (fetchSeguro), roles Zod desatualizadas, indicador requisitos senha + confirmação, símbolo obrigatório, título site "Faculdades Integradas de Cassilândia — FIC". Commits `7a88501` `ca35c6b` `696d5ec` `0b6c2f7` todos READY | Manutenção/ERP |
| 090 | 13/04 | **🎉 Sprint S3 — Tela de Conversas** — 3 painéis full-height (ConversasList/ChatPanel/ContactInfoPanel), migration queues+statuses+ticket_number, 4 APIs REST (GET lista, GET detalhe, POST message, PATCH), Realtime Supabase, bubbles WhatsApp, envio outbound Meta Cloud API v19.0. Deploy READY `dpl_jfnicVQWAbaymH9TqNxCBh7covph` commit `552be02` | Atendimento/S3 |
| 089b | 13/04 | **🎉 WEBHOOK VALIDADO E2E** — reescrita para `atendimento_*` (commit e3578d1) + fallback inbox phone_number_id (commit 7df5790) + deploy READY + 3 rows gravados (contacts/conversations/messages). Causa raiz: Vercel ERP → `ifdnjieklngcfodmtied`, schema `atendimento_*`. | Atendimento/S2 |
| 089 | 13/04 | **Atendimento S2** — Webhook WABA configurado no Meta Console, HMAC-SHA256, bypass middleware, WHATSAPP_APP_SECRET no Vercel, deploy READY, teste GET e2e ✅ (schema errado descoberto em 088b). URL: gestao.ficcassilandia.com.br/api/atendimento/webhook | Atendimento/S2 |
| 088b | 13/04 | **Diagnóstico causa raiz webhook** — Vercel ERP aponta para `ifdnjieklngcfodmtied` (NÃO `bvryaopfjiyxjgsuhjsb`). Schema real é `atendimento_*`. Inbox FIC seedado (id=179deb2b). Opção A aprovada: reescrever webhook.ts. Pendente: reescrita + deploy + validação. | Atendimento/S2 |
| 088 | 13/04 | **Nexvy batches 3–10 documentados** + **ATENDIMENTO-PLANO-v2-SESSAO088.md** — roadmap 10 sprints atualizado, 34+ tabelas mapeadas, novas descobertas: filas dist. automática, n8n ID 2967 ativo, API REST v1.0.0, cargos granulares, DS Agente/Bot, widgets externos | Atendimento/plano |
| 087 | 12/04 | **Análise Nexvy batch 2 (38 prints)** + NEXVY-REFERENCIA-ATENDIMENTO.md atualizado + Lead Detail Modal completo + DS Voice (funis+gatilhos) + Supabase inserts | Atendimento/S2 prep |
| 086 | 12/04 | **Análise Nexvy → ERP** — 21 arquivos extraídos analisados, NEXVY-REFERENCIA-ATENDIMENTO.md criado: 8 sprints roadmap, gap analysis (12 tabelas faltando), design tokens, decisões de arquitetura | Atendimento/S2 prep |
| 085 | 12/04 | **Módulo Atendimento Sprint 1** — 9 tabelas Supabase + 8 arquivos frontend + TopBar Atendimento + fix vercel.json (commits 004521e, 6a234bb, 3082329) deploy READY | Atendimento/S1 |
| 084 | 13/04 | **S-02 emit-boletos.py completo** — OAuth2+mTLS Inter API, Bolepix emission, PDF download, Supabase Storage (bucket bolepix-pdfs), Resend e-mail HTML, requirements.txt fix (commit 44f3f60) | CFO/S-02 |
| 083 | 12/04 | **Módulo Financeiro inaugurado** — 4 tabelas Supabase (alunos/cobrancas/comunicacoes/comprovantes) + Python runtime Vercel + emit-boletos.py + payment-webhook.py esqueletos (commit 8df004c) | CFO/S-01 |
| 082 | 12/04 | **Carimbo do tempo automático** + pipeline registradora: timestamp-service, auto-carimbo no finalize, pacote ZIP (XMLs+.p7s+PDFs/A+manifest), seção "Prontos para Registradora" (commits 613f151 + df83975) | S2/E2.2 |
| 081 | 12/04 | Dashboard +2 cards (AguardandoRevisão+Cancelados) + vocabulário unificado pipeline-unificado.ts + fix CSRF fetchSeguro (excluir diploma + 5 outras mutações) | S2/E2.1 polish |
| 080b | 12/04 | Fix BRy timeout hang (Promise.race 8s) + TopBar cleanup + sidebar Emissões/Assinaturas reorder (commits 362334c + 8305f07 + 558b081) | S2/E2.2 |
| 079 | 12/04 | Fix BRy bridge script (causa raiz real) + alinhar tipos Promise em AssinadorBry.tsx (commits 8eb4f89 + 2f85648) | S2/E2.2 |
| 078 | 12/04 | Fix detecção extensão BRy Signer: retry loop 16×500ms + "Verificar novamente" + badge "Verificando…" (commit 8929107) | S2/E2.2 |
| 076 | 12/04 | Auto-save timestamp persistente + bloqueio formulário pós-publicação: backend 403 DIPLOMA_PUBLICADO + banner âmbar + form disabled (commit 563cb88) | S2/E2.1 polish |
| 075 | 12/04 | Fix 6 bugs pós-s074: nav lista→revisão, 3 links pipeline, redirect pós-confirmar, auditoria genitores/CH/comprobatórios + SQL RPC+data fix (commit b82d6fd) | S2/E2.1 polish |
| 074 | 11/04 | Processo nasce no Upload — Épicos A+B+C+E: DB migration (nome nullable + sessao_id FK), POST iniciar cria processo, RPC UPDATE vs INSERT, lista processos em_extracao navega à revisão (commit e31ebfb) | S2/Arq |
| 073 | 11/04 | Fix Bug #4 (causa raiz): API retornava extracao:null hardcoded → query extracao_sessoes real (commit 8b10b4a) | S2/E2.1 polish |
| 072 | 11/04 | Fix Bug #3: botões auditoria → /diploma/processos/novo/revisao/{sessaoId} (sessaoId+dual-path, commit 031b9f7) | S2/E2.1 polish |
| 071 | 11/04 | Fix Bug #2: botões auditoria → /diploma/processos/{id} (processoId+onVerDocumentos, commit 8c59bb7) | S2/E2.1 polish |
| 070 | 11/04 | Pipeline Auditar Requisitos XSD: 6 validators + API + hook + UI + gate suave (commit 17efbc4) | S2/E2.1 |
| 069 | 11/04 | Fix C: navegação direta para pipeline (commit 0f779dd) — list + form antigo reconhecem diploma_id | S2/E2.1 polish |
| 068 | 11/04 | Fix assinantes (auto-load /api/assinantes) + confiança 0%→97% (RPC + retrofix) | S2/E2.1 polish |
| 067 | 11/04 | Normalizar períodos (normalizarPeriodo) + labels editáveis + botão Padronizar | S2/E2.1 polish |
| 066 | 11/04 | Substituir Arquivo no dialog + Excluir importação/extração com confirmação | S2/E2.1 polish |

## Índice de Referência (Camada 2 — ler sob demanda)
- Preferências: [preferences.md](preferences.md) | Patterns: [patterns.md](patterns.md)
- Arquitetura: [architecture.md](architecture.md) | Debugging: [debugging.md](debugging.md)
- XSD v1.05: [xml-estrutura-xsd-v105.md](xml-estrutura-xsd-v105.md)
- Motor XML bugs: [bugs-motor-xml-status-final.md](bugs-motor-xml-status-final.md)
- Design fluxo: [projects/design-consolidado-sessao-024.md](projects/design-consolidado-sessao-024.md)
- Plano técnico v2: [projects/plano-tecnico-fluxo-novo-processo-sessao-028-v2.md](projects/plano-tecnico-fluxo-novo-processo-sessao-028-v2.md)
- Sessões completas: [sessions/SINTESE.md](sessions/SINTESE.md)
