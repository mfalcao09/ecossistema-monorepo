# MEMORY.md — Índice de Roteamento (Intentus Real Estate Platform)

> **Regra**: Manter este arquivo abaixo de 200 linhas. É um ÍNDICE, não um depósito.
> O detalhe vai nos arquivos temáticos abaixo.

## Arquivos de Memória

| Arquivo | O que contém | Quando consultar |
|---------|-------------|-----------------|
| `debugging.md` | 49 bugs catalogados + 10 padrões recorrentes | Quando encontrar erro/bug |
| `patterns.md` | Convenções de código, hooks, EFs, componentes | Antes de implementar qualquer feature |
| `architecture.md` | Stack, módulos, banco, segurança, AI | Decisões técnicas de alto nível |
| `preferences.md` | Como Marcelo trabalha, tom, entregas | Início de cada sessão |
| `glossary.md` | Termos, siglas, módulos | Quando surgir termo desconhecido |
| `people/marcelo.md` | Perfil do CEO | Comunicação em nome dele |
| `mcps-locais-desktop-commander-apple.md` | **MCPs locais (08/04/2026):** Desktop Commander (shell/git no Mac real) + Apple MCP (apps nativos, NÃO executa terminal) | Antes de operação git autônoma |

## Mapa de Sessões (151 sessões — ver SINTESE.md para detalhes)
<!-- weekly-memory-review 12/04/2026: contagem atualizada 139→151. Sessões 140-151 consolidadas em SINTESE.md Bloco 8. -->

> **Última: 151** — **Auth Fix Sistêmico (19 EFs) + Frontend fixes** (mapa height, rotas standalone removidas). Pendente: ~30 EFs CLM/comerciais com mesmo bug 401. Próximo: Bloco E Fase E2 (CAD Studio Ferramentas Avançadas).

> **Sessão 116–118** — **Parcelamento de Solo Fase 1 COMPLETA** (schema PostGIS, 13 cols developments, 6 tabelas, RLS, RBAC, storage bucket). Sessão 116: PRD v0.2 aprovado. Sessão 118: migration aplicada + perf + secrets + VITE_MAPBOX_TOKEN. Git commit feito por Marcelo.

> **Última: 116** (histórico) — **PRD v0.2 ampliado** para 137 user stories após decisão estratégica de Marcelo: **Caminho A (paridade total Lotelytics) + C (diferenciação por IA) + Diferenciais Brasileiros desde já**. Geoespacial (declividade, topografia, linhas de influência APP/rodovias/rios/LT) é prioridade máxima. Documento `projects/parcelamento-solo-PRD-v0.2.md`. 6 novas categorias adicionadas: Geoespacial Profundo (US-48-65), Premissas Profundas (US-66-78), Análise Financeira 8 abas (US-79-100), Diferencial IA Intentus (US-101-115), Diferencial Brasil (US-116-135), Integração CRM/CLM/Relationship (US-136-145). Roadmap repriorizado em 12 fases (~141 dias úteis). Próximo: review com Buchecha → atualizar FASE1-PLANO → habilitar PostGIS → migration Fase 1A.

> **Sessão 115** — Análise de vídeo de referência do **Lotelytics** (~17min, 41 frames). Documento `projects/parcelamento-solo-REFERENCIA-LOTELYTICS.md` mapeia produto inteiro. Marcelo descartou branch Supabase, escolheu Alternativa 4 (direto na produção com salvaguardas).


| Bloco | Sessões | Tema | Status |
|-------|---------|------|--------|
| CLM | 3-72 (46 sessões) | Contratos, RBAC, Command Center, Pricing AI | ✅ F1+F2 completos |
| Pricing AI | 1, 6-24 (15 sessões) | Dual-actor, two-pass, TX boundary | ⏸️ Standby (Urbit) |
| CRM/Comercial | 23, 39, 42-46, 73-113 (41 sessões) | Auditorias, fixes, multi-pipeline, QA | 🔄 F1 em andamento |
| Relationship IA | 5, 29-30, 47, 60, 63, 71, 91, 99, 110-112 (11 sessões) | Churn, LTV, NBA, copilot, exit, feedback | ✅ 12/12 features |
| Infraestrutura | Embedded nas demais | Middleware, caching, migrations | ✅ Estável |
| Onboarding | 25-27 | Checklist, demo mode, preferences | ✅ Completo |
| Notificações | 25-27 | Auto-triggers, email digest, realtime | ✅ v2 completo |

## Decisões Recentes (últimas 10)

| Data | Decisão | Contexto |
|------|---------|----------|
| 12/04/2026 | **getUser(token) obrigatório em toda EF Deno** | Bug sistêmico: 19+ EFs retornavam 401 pois `getUser()` sem token não lê `global.headers` no Deno via esm.sh. Fix: `const token = authHeader.replace("Bearer ", ""); createClient(..., { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }); getUser(token)` |
| 12/04/2026 | **min-height ≠ height para Mapbox** | `h-full` não funciona quando pai usa `min-h-screen`. Usar `style={{ height: 420 }}` ou `calc(100vh - Xpx)` explícito. |
| 12/04/2026 | **Tabs inline > rotas standalone para sub-módulos** | Financeiro/Conformidade removidos de App.tsx como rotas; lazy + Suspense inline em ParcelamentoDetalhe evita re-mount e mantém contexto de rota pai. |
| 11/04/2026 | **crypto.randomUUID() nativo** | Pacote `uuid` não existe no projeto — usar `crypto.randomUUID()` sempre. Causa: build Vercel falhou (Rollup unresolved import). |
| 11/04/2026 | **JSON.parse em useMemo precisa try/catch** | Throws dentro de useMemo propagam para fora do ErrorBoundary React (inclusive do R3F). Sempre proteger com try/catch + fallback. |
| 11/04/2026 | **geometry_coordinates JSONB = companion para PostGIS** | PostGIS geography não é acessível diretamente no frontend. Column JSONB companion armazena coordenadas para acesso direto sem conversão backend. |
| 11/04/2026 | **tenantId fallback obrigatório em EFs** | `tenantId: profile?.tenant_id \|\| user.id` — nunca lançar erro quando profile não tem tenant_id. Padrão aplicado a todas as EFs novas. |
| 07/04/2026 | **Parcelamento de Solo — Caminho A+C+Brasil** | Paridade total com Lotelytics + diferenciação por IA Intentus + diferenciais brasileiros (CAR, SICAR, MapBiomas, Código Florestal, SINAPI mensal) desde já. PRD v0.2 com 137 US. |
| 05/04/2026 | **Diretriz Skills/Plugins obrigatória** | Claude DEVE indicar e usar skills antes de cada tarefa |
| 05/04/2026 | **Regra "vou encerrar" = salvamento completo** | Salva em 5 arquivos: sessão, MEMORY, CENTRAL-MEMORY, preferences, CLAUDE |
| Mar 2026 | F10 Feedback Intelligence Loop completo | 3 tabelas, 12 actions, 3 AI tools |
| Mar 2026 | F9 Exit Experience Architecture completo | 3 tabelas, 12 actions, offboarding humanizado |
| Mar 2026 | Cronograma IA-Native Relationship 100% | 12/12 features, 4 phases |
| Mar 2026 | Multi-pipeline customizável | pipeline_templates + pipeline_columns (normalizado) |
| Mar 2026 | Middleware compartilhado (_shared/) | Eliminou 100-150 linhas de boilerplate por EF |
| Mar 2026 | Tenant cache com 30min TTL + dedup | getAuthContext() em 95+ arquivos |
| Mar 2026 | Optimistic locking para transições | WHERE status = old_status + .select() |
| Mar 2026 | Laravel Tailwind theme | Substituiu Cleopatra theme |
| Mar 2026 | CORS whitelist padrão | 5 domínios (prod, preview, localhost, 127.0.0.1, vercel.app) |
| Mar 2026 | Smart Notifications v2 | Priority scoring, snooze, email digest |

## Tensões e Contradições Detectadas

- **Pricing AI**: v24r8 funcional mas Apify é frágil → Urbit API seria mais estável mas está em negociação comercial
- **Copilot v11**: Funcional mas CORS pendente na última versão → workaround via rewrite no Vercel
- **TypeScript strict**: `noImplicitAny: false`, `strictNullChecks: false` → Dívida técnica reconhecida
- **Type casting**: 26+ arquivos com `as unknown as` → Parcialmente corrigido, pendente regen de tipos Supabase
- **Auth 401 em ~30 EFs CLM/comerciais**: mesmo bug sistêmico de sessão 151 (getUser sem token), mas não corrigido ainda pois Marcelo não está testando esses módulos agora
- **Migration zoneamento-municipal pendente**: Sessão 145 criou schema, mas migration ainda não foi aplicada ao banco de dados

## Memória Central (Cross-Project)

> Localização única: `/Users/marcelosilva/Projects/GitHub/`
> Para acessar: solicitar montagem da pasta via `request_cowork_directory`

- **CENTRAL-MEMORY.md**: `/Users/marcelosilva/Projects/GitHub/CENTRAL-MEMORY.md` — índice de TODOS os projetos
- **ECOSSISTEMA-INOVACAO-IA.md**: `/Users/marcelosilva/Projects/GitHub/ECOSSISTEMA-INOVACAO-IA.md` — visão, arquitetura e inventário do ecossistema de agentes
- **PROTOCOLO-MEMORIA.md**: `/Users/marcelosilva/Projects/GitHub/PROTOCOLO-MEMORIA.md` — como atualizar memória
- **ONBOARDING-KIT.md**: `/Users/marcelosilva/Projects/GitHub/ONBOARDING-KIT.md` — template para novos projetos

## Módulos do Intentus

| Módulo | Status | Memória |
|---|---|---|
| CLM (Contract Lifecycle) | ✅ COMPLETO | `projects/cronograma-ia-native.md` |
| CRM/Comercial | ✅ COMPLETO (multi-pipeline + QA 160 rotas) | `projects/cronograma-ia-native.md` |
| Relationship IA | ✅ COMPLETO | `projects/relationship-ia-native-plan.md` |
| Pricing AI | ⏸️ Standby | `projects/pricing-ai.md` |
| Integração Urbit | 🔄 Negociação | `projects/integracao-urbit.md` |
| **Parcelamento de Solo (Horizontais)** | 🟢 **~60% — Blocos A-D+F+G1+H5+J+E1 completos** | **`projects/parcelamento-solo-PRD-v0.2.md`** (vigente) + `parcelamento-solo-PRD.md` (v0.1 arquivo) + `parcelamento-solo-REFERENCIA-LOTELYTICS.md` + `parcelamento-solo-FASE0-AUDITORIA.md` + `parcelamento-solo-DECISOES-D1-D5.md` + `parcelamento-solo-FASE1-PLANO.md` + `parcelamento-solo-BLOCO-E-PRD.md` + `parcelamento-solo-GAP-ANALYSIS.md` |

## Projetos e Documentação

- Projetos ativos: `projects/`
- Contexto de auditorias: `context/`
- Docs por fase: `docs/01-fundacao-clm/`, `docs/02-auditorias/`, `docs/03-estrategia-ia-native/`
- Sessões individuais (139): `sessions/`
- Síntese consolidada: `sessions/SINTESE.md`
