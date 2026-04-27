# PENDÊNCIAS — Plano vs Execução

> Gerado automaticamente pela automação `plan-audit`
> Masterplan: parcelamento-solo
> Última auditoria: 2026-04-27 09:30 (segunda-feira)
> Auditoria anterior: 2026-04-26 09:30

## Backlog (planejado, sem progresso ou parcial)

| Bloco   | US                | Item                                                    | Planejado desde | Sessões          | Bloqueador                            |
| ------- | ----------------- | ------------------------------------------------------- | --------------- | ---------------- | ------------------------------------- |
| G       | —                 | Execute actions (ações diretas do copilot)              | ~10/04/2026     | 0                | —                                     |
| G       | —                 | Análise preditiva                                       | ~10/04/2026     | 0                | —                                     |
| G       | —                 | Comparador de empreendimentos                           | ~10/04/2026     | 0                | —                                     |
| H       | US125             | Zoneamento Municipal — frontend                         | 11/04/2026      | 1 (backend s145) | Backend ✅, frontend pendente         |
| H       | US127,128,129,132 | Autônoma 1 (próxima sessão definida no TRACKER)         | 11/04/2026      | 0                | —                                     |
| H       | US121-123         | Autônoma 2 (3 US)                                       | 11/04/2026      | 0                | —                                     |
| H       | US124,126,131     | Autônoma 3 (3 US)                                       | 11/04/2026      | 0                | —                                     |
| H       | US117             | Autônoma 4                                              | 11/04/2026      | 0                | —                                     |
| H       | US130             | Autônoma 5                                              | 11/04/2026      | 0                | —                                     |
| H       | US133,134/135     | Autônoma 7 (2 US)                                       | 11/04/2026      | 0                | —                                     |
| H-anexo | US136-138         | Autônoma 8 — Tier 1 (FBDS APP hídrica + DataGeo + IBGE) | 24/04/2026      | 0                | Bucket FBDS + RLS pendente decisão    |
| H-anexo | US139-140         | Autônoma 9 — DAEE drenagem + SiCAR rural                | 24/04/2026      | 0                | Provedor LLM (P-130 bloqueante geral) |
| H-anexo | US141-142         | Autônoma 10 — Piracicaba/PCJ (condicional piloto)       | 24/04/2026      | 0                | Decisão piloto Splendori              |
| K       | —                 | Bloco K (a definir, ~15 US)                             | —               | 0                | Aguarda H                             |
| L       | —                 | Bloco L (a definir, ~15 US)                             | —               | 0                | Aguarda K                             |
| E       | E2-E6             | Land Designer Fase 2-6 (PRD v1.0 pronto, E1 ✅)         | —               | 0                | —                                     |
| —       | —                 | Pricing AI (retomar)                                    | Indeterminado   | 0                | ⛔ Urbit API (negociação comercial)   |

> ✅ Removidos: Bloco J (US-60,62,63,65 s148), Bloco E Fase E1 (CAD Studio s149), US125 backend (s145).

## Desvios (feito fora do plano)

(nenhum no período 16/04–27/04 — projeto sem novas sessões desde s151 em 12/04/2026)

| Sessão | Data       | O que fez                                | Classificação                              |
| ------ | ---------- | ---------------------------------------- | ------------------------------------------ |
| (s145) | 11/04/2026 | US-125 backend somente                   | parcial fora de sequência (audit anterior) |
| (s148) | 11/04/2026 | Bloco J Geo Avançado antecipado          | avanço fora de sequência (audit anterior)  |
| (s149) | 11/04/2026 | CAD Studio E1 antecipado                 | avanço fora de sequência (audit anterior)  |
| (s150) | 11/04/2026 | 8 bugs (mapa, 3D, EFs 401)               | bugfix/QA (audit anterior)                 |
| (s151) | 12/04/2026 | Auth fix sistêmico 19 EFs + 4 standalone | bugfix/QA (audit anterior)                 |

## Novidades desde última auditoria (15/04→26/04)

- **Bloco H anexo open-geodata aprovado em 2026-04-24:** +7 US (US136-142) adicionadas ao plano. Total agora 22 US no Bloco H (15 originais + 7 anexo).
- Documento canônico criado: `parcelamento-solo-LOTELYTICS-DEEPDIVE.md`.
- Decisões pendentes para iniciar anexo: bucket FBDS Storage + RLS, provedor LLM (P-130), delegação squad.
- **Sessão 153 — 2026-04-27 — ANEEL/EPE LT oficial:** EF `development-geo-layers` v3 estendida com fetchers EPE ArcGIS REST (LT existentes layer 21, planejadas layer 10, subestações layer 20+9). UI Parcelamento → tab Mapa & Camadas: 3 toggles novos (azul sólido / laranja tracejado / círculos amarelos), `LTImpactPanel` calcula via Turf km de LT em 5km/10km do terreno + alerta se LT cruza polígono + lista de tensões kV e concessionárias.
- **Sessão 154 — 2026-04-27 — BDGD distribuição (Tier 1 + Tier 2):** infra completa pra rede de distribuição local nacional. **Tier 1**: 6 tabelas PostGIS (`bdgd_distribuidoras`, `bdgd_mt_segments`, `bdgd_bt_segments`, `bdgd_substations`, `bdgd_segments_hd`, `bdgd_sync_log`); RPC `bdgd_proximity_for_development` com auto-fallback Tier 1→Tier 2; script Python `scripts/sync_bdgd.py` + workflow GHA `bdgd-sync.yml` (114 distribuidoras BR via DCAT ANEEL). **Tier 2**: script `scripts/load_bdgd_hd.py` + workflow `bdgd-load-hd.yml` (alta precisão por projeto, geometria sem simplify, raio 5km, cleanup 90d); EFs `development-bdgd-proximity` + `development-bdgd-trigger-hd`; UI `ParcelamentoBDGDPanel` (toggles MT/BT/SUB + botão "Carregar precisão milimétrica" disparando workflow GHA). UI usa Switch shadcn em todos os toggles (consistente com camadas EPE).

## Pendências abertas desta sessão

- **P-181:** Buffer geodésico server-side (PostGIS) — atualmente o painel usa Turf no client (precisão ~95% por amostragem de vértices). Para projetos com mil+ features ou compliance regulatório, migrar pra RPC `parcelamento_lt_intersect_lengths(dev_id, layer_key)` com `ST_Buffer` + `ST_Length` + `ST_Intersection`.
- **P-182:** ~~BDGD distribuição~~ — **RESOLVIDO sessão 154** (infra completa, falta apenas executar workflow GHA `BDGD Sync` pra popular dados nacionais).
- **P-183:** Cache TTL ANEEL — hoje cache compartilha TTL com Overpass (sem expiração explícita via `expires_at`). Definir TTL específico de 30d para EPE (LT muda pouco) num próximo deploy.
- **P-184:** SIGEL ANEEL pasta `SMA` ainda não explorada — pode ter Geração Distribuída + UFV que complementam EPE. Spike em sessão futura.
- **P-185:** Migrar `development-elevation` SRTM 30m → Copernicus DEM GLO-30 (mais preciso, gratuito). Sprint A planejado (Marcelo).
- **P-186:** Esri 4 features (Sprint C planejado) — Slope raster (heatmap), Viewshed, Cut/Fill 3D Three.js, Suitability score combinado.
- **P-187:** Executar workflow `BDGD Sync` no GitHub Actions (após push) pra popular Tier 1 nacional. Tempo esperado: 3-4h pra 114 distribuidoras × 37GB streaming. Pode rodar com `--filter` em batches.
- **P-188:** Configurar secret `GITHUB_TRIGGER_TOKEN` (PAT scope `actions:write`) na Edge Function `development-bdgd-trigger-hd` — sem ele, botão "Carregar precisão milimétrica" do Tier 2 retorna erro 503. Marcelo cria PAT em https://github.com/settings/tokens, scope `repo` + `workflow`, salva via Supabase Dashboard → Edge Functions → Secrets.
- **P-189:** Cron diário `bdgd_cleanup_hd_expired()` ainda não está agendado (pg_cron). Sem ele, dados HD de projetos arquivados acumulam. Configurar via SQL: `SELECT cron.schedule('bdgd-hd-cleanup', '0 3 * * *', $$ SELECT bdgd_cleanup_hd_expired() $$);`

## Roadmap futuro (radar)

- **MÓDULO PROJETO EXECUTIVO** — registrado para futuro: usar `bdgd_segments_hd` como base de dados principal pra geração de memorial descritivo, georreferenciamento de servidão, projeto de urbanismo executivo. Plug natural com Bloco E (Land Designer Fase 2-6 do PRD v1.0). Ver MEMORY.md auto-memory `project_intentus_projeto_executivo.md`.

## Métricas

| Métrica                          | Valor                               |
| -------------------------------- | ----------------------------------- |
| Sessões no período (16/04–27/04) | 0 sessões                           |
| Sessões nas últimas 24h          | 0 sessões                           |
| Sessões no plano                 | 0                                   |
| Sessões hotfix/QA                | 0                                   |
| % hotfix                         | n/a (sem atividade)                 |
| Velocidade                       | 0 blocos/semana — projeto pausado   |
| Bloco H Autônoma 1 sem início há | 16 dias (desde 11/04/2026)          |
| Bloco G Sprint 2 sem início há   | ~17 dias                            |
| Última sessão Intentus           | s151 em 12/04 — 15 dias de silêncio |
| US adicionadas no período        | +7 (anexo open-geodata em 24/04)    |

## Inconsistências detectadas

| Item                     | Observado                                       | Esperado                                | Ação                                  |
| ------------------------ | ----------------------------------------------- | --------------------------------------- | ------------------------------------- |
| bloco-h-moat-regional.md | US125 marcada 🔲                                | Registrar backend s145 ✅ parcial       | Atualizar na próxima sessão H         |
| TRACKER Bloco H          | "145 (US125 backend)"                           | OK — já reflete                         | —                                     |
| Bloco J                  | ✅ no TRACKER mas sem arquivo sprint próprio    | Normal — definido ad-hoc                | —                                     |
| Bloco H anexo (24/04)    | 7 US no sprint mas TRACKER ainda mostra "15 US" | Atualizar TRACKER para 22 US no Bloco H | Pendente — manual ou próxima sessão H |

## Alertas

- 🔴 **CRÍTICO:** Pricing AI bloqueado por Urbit API — negociação comercial em andamento, sem prazo definido.
- 🔴 **CRÍTICO:** Provedor LLM P-130 é bloqueante geral — afeta Copilot tools novas (US136 anexo) e Bloco G S2.
- 🟡 **ATENÇÃO:** Projeto sem novas sessões há 15 dias (desde s151 em 12/04). Bloco H Autônoma 1 segue sendo a próxima sessão prevista, sem início.
- 🟡 **ATENÇÃO:** Bloco G Sprint 2 (Execute actions, Análise preditiva, Comparador) sem sessão planejada há ~17 dias.
- 🟠 **INCONSISTÊNCIA:** TRACKER do Bloco H precisa refletir +7 US do anexo open-geodata (24/04). Total deve ser 22 US (não 15).
- 🟠 **INCONSISTÊNCIA:** bloco-h-moat-regional.md não reflete backend US125 feito em s145 — corrigir na próxima sessão de Bloco H.
- 🟢 **OK:** Blocos A-D + F + G S1 + J + E1 todos ✅. PRD Bloco E (60 US) + anexo open-geodata (7 US) prontos. ~60% global.
- 🟢 **OK:** Sem hotfix/QA no período — sem regressões reportadas.
