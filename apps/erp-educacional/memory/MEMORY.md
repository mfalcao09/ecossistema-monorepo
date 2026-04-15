# MEMORY.md — Roteador de Memória (ERP-Educacional)

> ⚠️ **FASE B ATIVA** — Este arquivo é **backup de emergência**.
> Fonte primária: Supabase ECOSYSTEM (`gqckbunsfjgerbuiyzvn`).
> Use `select bootstrap_session('tarefa', 'erp', 15)` no início da sessão.
> Última sync automática: 2026-04-14

> Regra: máximo 40 linhas. Detalhe vai nos arquivos linkados.
> Última atualização: 2026-04-15 (s095 — sync auto) | Retroactive pass: ✅ 95 sessões

## Ponto de Entrada
→ **[TRACKER.md](TRACKER.md)** — estado atual, progresso por sprint, próxima sessão

## Rastreabilidade (Masterplan → Sprint → Sessão)
| Recurso | Arquivo |
|---------|---------|
| Masterplan ativo | [masterplans/diploma-digital-v4.md](masterplans/diploma-digital-v4.md) |
| Sprints (6) | [sprints/](sprints/) — 1 arquivo por sprint com plano de sessões |
| Pendências | [PENDENCIAS.md](PENDENCIAS.md) — gerado automaticamente (plan-audit) |
| Sessões (55+) | [sessions/SINTESE.md](sessions/SINTESE.md) — histórico cronológico |

## Arquivos Temáticos (Camada 2 — ler sob demanda)
| Arquivo | Consultar quando... |
|---------|---------------------|
| [preferences.md](preferences.md) | Início de projeto (não de sessão) |
| [architecture.md](architecture.md) | Decisão técnica de alto nível |
| [patterns.md](patterns.md) | Antes de implementar feature |
| [debugging.md](debugging.md) | Bug encontrado |
| [xml-estrutura-xsd-v105.md](xml-estrutura-xsd-v105.md) | Codar/revisar XML |
| [bugs-motor-xml-status-final.md](bugs-motor-xml-status-final.md) | Status do motor XML |
| [projects/design-consolidado-sessao-024.md](projects/design-consolidado-sessao-024.md) | Fluxo novo processo |
| [projects/plano-tecnico-fluxo-novo-processo-sessao-028-v2.md](projects/plano-tecnico-fluxo-novo-processo-sessao-028-v2.md) | Plano técnico v2 |

## Pastas
| Pasta | Conteúdo |
|-------|----------|
| masterplans/ | Visão end-to-end de cada projeto grande |
| sprints/ | Plano + progresso de cada sprint |
| sessions/ | Registro individual de cada sessão |
| projects/ | Designs, planos técnicos |
| workflows/ | Runbooks operacionais (commit-push-autonomo) |

## Decisões Ativas (últimas 5 — rotacionar)
| Data | Decisão |
|------|---------|
| 15/04 | s095: **🎉 Sprint 7 — Pacote Registradora COMPLETO** — assinatura-pdf.ts HUB Signer BRy + POST /documentos/assinar + webhook /bry-assinatura-pdf + UI Etapa 3 (ZIP+XML upload) + pacote-registradora fix (ZIP binário). Commit `817c47e` deploy READY. |
| 15/04 | s094: **🎉 Sprint 6 — Acervo Digital COMPLETO** — RPC step 12.5 DDC automático + POST /acervo/converter (PDF/A Ghostscript) + fix verificarEAvancarPacote (→ aguardando_documentos) + GET+PATCH /comprobatorios + AbaComprobatoriosMec. Commit `d76b639` deploy READY. |
| 14/04 | s093: **Pipeline end-to-end diagnóstico** — 11 gaps mapeados (G1–G11), plano S6–S9 aprovado, 4 decisões confirmadas (termos ✅, BRy assinatura ✅, UFMS upload web ✅, RVDD FIC ✅). Fix Kauana + STATUS_CONFIG 11→30+. Ver PLANO-PIPELINE-END-TO-END.md |
| 14/04 | s092: **🎉 S-03 Régua de Cobrança Completa** — migration `20260413_financeiro_regua_cobranca.sql` (3 tabelas), 6 endpoints Vercel Python live. NAOTEMMULTA+ISENTO boleto; encargos só PIX sob demanda. Commit `1f27208` |
| 13/04 | s090: **S3 Tela de Conversas ✅** — 3 painéis full-height, migration queues+statuses+ticket_number, 4 APIs REST, Realtime Supabase, Meta Cloud API v19.0. Commit 552be02 |

## Módulo Financeiro (sessão 093+)
- **Sessão de referência:** [sessions/sessao-092-2026-04-14.md](sessions/sessao-092-2026-04-14.md)
- **Regras chave:** boleto NAOTEMMULTA+ISENTO; encargos (multa 10%+juros 2%/mês) só no PIX sob demanda; 1 PIX/dia/cobrança; régua e-mail dias 1/3/7/12/17/22; bloquear portal dia 23
- **Bloqueador:** credenciais Inter sandbox (6 env vars) para emissão real
- **Próximo:** importar alunos 2026/1, configurar desconto_pontualidade, testar crons, implementar payment-webhook.py

## Tensões Ativas
- **Prazo MEC graduação:** 01/07/2025 já venceu — URGENTE
- **BRy credenciais homologação:** Sem acesso — bloqueia testes reais do pipeline BRy (Sprint 8)
- **Inter credenciais:** Sem sandbox credentials — bloqueia emissão real bolepix
- **Sprint 8 próximo (096):** Fluxo UFMS manual + teste ZIP Kauana (id: 5e197846) + configurar vars BRy Vercel
