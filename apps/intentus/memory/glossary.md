# Glossary — Intentus / Marcelo

Shorthand, termos internos e referências rápidas.

## Apelidos e Nomes
| Apelido | Significado |
|---------|-------------|
| Claudinho | Nome carinhoso que Marcelo dá ao Claude (assistente IA) |
| Buchecha | Nome carinhoso que Marcelo dá ao MiniMax M2.5 (pair programmer IA) |
| Marcelo | Marcelo Silva — fundador/CEO de múltiplos negócios |

## Termos Técnicos do Projeto
| Termo | Significado | Contexto |
|-------|-------------|----------|
| pricing-ai | Edge Function de precificação de imóveis | Supabase EF, v24r8 atual (version 42) — standby |
| CLM | Contract Lifecycle Management | Módulo principal do Intentus |
| CRM | Customer Relationship Management | Módulo Comercial do Intentus |
| EF | Edge Function | Supabase Edge Functions (58 total) |
| RBAC | Role-Based Access Control | 22 actions × 7 roles, 3 camadas defense-in-depth |
| TX filter | Transaction type filter | Filtro venda/locação no pricing-ai |
| two-pass | Estratégia de scraping duplo | Pass 1: bairro, Pass 2: cidade |
| round-robin | Distribuição balanceada de comparáveis | Entre plataformas (VivaReal, ZapImóveis) |
| Apify | Plataforma de scraping web | Actors para VivaReal e ZapImóveis |
| Urbit | API de dados imobiliários brasileiros | Alternativa ao Apify (em análise comercial) |
| VGV | Valor Geral de Vendas | Métrica imobiliária |
| Agentic Mode | Copilot com tool-use autônomo | 12 tools, MAX_TOOL_ROUNDS=5 |
| Compliance Monitor | Monitoramento automático de compliance | 18 regras, 5 módulos, pg_cron 09:00 UTC |
| State Machine | Máquina de estados de contratos | 13 statuses, 50 transições role-based, trigger PG |
| Cronograma IA-Native | Plano de execução 20 itens | ~254h, 5 fases, F1+F2 completas (10/20) |

## Empresas do Marcelo
| Nome | O que é |
|------|---------|
| Intentus Real Estate | Plataforma SaaS imobiliária (CLM, pricing, etc.) |
| Nexvy | Plataforma SaaS (detalhes a confirmar) |
| Klésis | Colégio — "Educação com Propósito" |
| FIC | Faculdades Integradas de Cassilândia |
| Splendori | Incorporação imobiliária em Piracicaba |

## Plataformas e Ferramentas
| Ferramenta | Uso |
|------------|-----|
| Supabase | Backend (DB, Auth, Edge Functions, Realtime) |
| Vercel | Deploy do frontend |
| Apify | Scraping de portais imobiliários (instável) |
| GitHub Desktop | Commits quando git não está configurado no ambiente |
| shadcn-ui | Biblioteca de componentes UI |
| OpenRouter | Gateway para LLMs (Gemini 2.0 Flash) |
| OpenAI | GPT-4o-mini para análise no pricing-ai |

## Status de Projetos (atualizado 15/03/2026 — Sessão 72)
| Projeto | Status | Nota |
|---------|--------|------|
| pricing-ai v24r8 | ⏸️ Standby | v42 com erros, aguardando alternativa Urbit |
| Integração Urbit | 🔄 Negociação comercial | Marcelo em contato com Urbit para credenciais e pricing |
| Onboarding | ✅ Completo | sessão 27 |
| Notificações v2 | ✅ Completo | sessão 59 — Smart Notifications: priority scoring, snooze, quiet hours, 16 triggers |
| Command Center | ✅ Concluído | sessão 26 — 4 CLM Edge Functions. Fix browser freeze sessão 64 |
| Multi-tenant audit | ✅ Concluído | sessão 28 — 16 issues, 10 fixes |
| Plugin MiniMax M2.5 | ✅ Funcional | sessão 30 — v0.3.0, 6 tools. Pair programming Claudinho+Buchecha |
| Auditoria CLM (sessões 30-34) | ✅ Concluído | 63 achados total, 5 fases de fixes (sessões 31-40) |
| Diagnóstico Comercial | ✅ Concluído | sessão 39 — 27 achados, 4 fases de fixes (sessões 42-45) |
| Benchmarking CLM + CRM | ✅ Concluído | sessões 41+46 — vs 7 CLM líderes + 5 CRM líderes |
| Cronograma IA-Native | 🔄 Em andamento | F1 (5/5 ✅) + F2 (5/5 ✅) = 10/20 itens (~118h de ~254h). Próximo: F3 |
| RBAC Granular | ✅ Concluído | sessão 40 — 22 actions × 7 roles, 3 camadas defense-in-depth |
| State Machine Enterprise | ✅ Concluído | sessão 38 — 13 statuses, 50 transições, trigger PG |
| Copilot Agentic | ✅ Concluído | sessão 53 — 12 tools, conversational contract creation (sessão 62) |
| Compliance Monitor | ✅ Concluído | sessão 58 — 18 regras, 5 módulos, pg_cron |
| Predictive Analytics | ✅ Concluído | sessões 60-61 — renovações + inadimplência |
| Fix produção CLM (CORS+RLS) | ✅ Concluído | sessão 65 — 11+ EFs re-deployadas com CORS fix, user_roles RLS RESTRICTIVE→PERMISSIVE |
| Fix /contratos/ + /analytics | ✅ Concluído | sessões 66-70 — limits, tenant_id, staleTime, Map O(n). ClmAnalytics rewrite do zero (11 métricas) |
| Verificação CLM pré-F3 | ✅ Concluído | sessão 72 — 19 bugs fixados (React #310, 6 tenant_id leaks, batch limits, caching). CLM production-ready |
| ClickSign | 🟡 P2 | Não é blocker para lançamento, workaround manual |

## Integrações Externas
| Integração | Tipo | Status |
|-----------|------|--------|
| MiniMax M2.5 | IA pair programming (Cowork plugin) | ✅ v0.3.0 funcional — 6 tools: ask, code_review, generate_tests, alternative, debug, explain |
| Urbit API | Dados imobiliários (alternativa Apify) | Em negociação comercial |
| Apify | Scraping VivaReal/ZapImóveis | Instável, sendo substituído por Urbit |
| OpenRouter | Gateway LLM (Gemini 2.0 Flash) | Ativo em 12+ Edge Functions (todas de IA) |
| OpenAI | GPT-4o-mini no pricing-ai | Ativo |
| Resend | Email transacional (digest v2) | Ativo — smart ranking, priority, quiet hours |
| pg_cron | Tarefas agendadas | 3 jobs: auto-notifications (08:00), digest (07:00 BRT), compliance (09:00 UTC) |
