# Bloco H: Moat Regional — Integrações Brasileiras

**Masterplan:** [../masterplans/parcelamento-solo.md](../masterplans/parcelamento-solo.md)
**Tracker:** [../TRACKER.md](../TRACKER.md)
**Total:** 15 US originais + 7 US open-geodata (2026-04-24) = **22 US** | **Status:** 🔲 Sessões pré-planejadas, aguardando início
**Briefing complementar:** [../projects/parcelamento-solo-LOTELYTICS-DEEPDIVE.md](../projects/parcelamento-solo-LOTELYTICS-DEEPDIVE.md)

---

## Plano de Sessões (definido por Marcelo)

| Sessão     | US                         | Escopo | Status       |
| ---------- | -------------------------- | ------ | ------------ |
| Autônoma 1 | US127, US128, US129, US132 | (4 US) | 🔲 Próxima   |
| Autônoma 2 | US121, US122, US123        | (3 US) | 🔲 Planejada |
| Autônoma 3 | US124, US126, US131        | (3 US) | 🔲 Planejada |
| Autônoma 4 | US117                      | (1 US) | 🔲 Planejada |
| Autônoma 5 | US130                      | (1 US) | 🔲 Planejada |
| Autônoma 6 | US125                      | (1 US) | 🔲 Planejada |
| Autônoma 7 | US133, US134/135           | (2 US) | 🔲 Planejada |

> Checklist completo das 15 US salvo na memória do projeto Intentus.

---

## US e Progresso

| #   | US        | Descrição             | Sessão     | Status |
| --- | --------- | --------------------- | ---------- | ------ |
| 1   | US117     | (detalhe a preencher) | Autônoma 4 | 🔲     |
| 2   | US125     | (detalhe a preencher) | Autônoma 6 | 🔲     |
| 3   | US130     | (detalhe a preencher) | Autônoma 5 | 🔲     |
| 4   | US121     | (detalhe a preencher) | Autônoma 2 | 🔲     |
| 5   | US122     | (detalhe a preencher) | Autônoma 2 | 🔲     |
| 6   | US123     | (detalhe a preencher) | Autônoma 2 | 🔲     |
| 7   | US124     | (detalhe a preencher) | Autônoma 3 | 🔲     |
| 8   | US126     | (detalhe a preencher) | Autônoma 3 | 🔲     |
| 9   | US131     | (detalhe a preencher) | Autônoma 3 | 🔲     |
| 10  | US127     | (detalhe a preencher) | Autônoma 1 | 🔲     |
| 11  | US128     | (detalhe a preencher) | Autônoma 1 | 🔲     |
| 12  | US129     | (detalhe a preencher) | Autônoma 1 | 🔲     |
| 13  | US132     | (detalhe a preencher) | Autônoma 1 | 🔲     |
| 14  | US133     | (detalhe a preencher) | Autônoma 7 | 🔲     |
| 15  | US134/135 | (detalhe a preencher) | Autônoma 7 | 🔲     |

> Detalhes de cada US serão preenchidos pela sessão paralela que está trabalhando no Bloco H.

---

## Sessões Realizadas (backlinks)

(nenhuma ainda — bloco não iniciado)

---

## Anexo open-geodata (aprovado 2026-04-24)

**Fonte:** análise dos 16 repos de [github.com/open-geodata](https://github.com/open-geodata) — briefing canônico em [../projects/parcelamento-solo-LOTELYTICS-DEEPDIVE.md](../projects/parcelamento-solo-LOTELYTICS-DEEPDIVE.md).

**Princípio:** não forkar repos. Consumir **dados oficiais** (FBDS/MMA, DataGeo/CETESB, API IBGE, DAEE-SP) e armazenar snapshots no Supabase Intentus.

### Plano de Sessões anexas

| Sessão      | US                  | Escopo                                                                                         | Esforço          | Status                  |
| ----------- | ------------------- | ---------------------------------------------------------------------------------------------- | ---------------- | ----------------------- |
| Autônoma 8  | US136, US137, US138 | **Tier 1 core** — FBDS (APP hídrica auto) + DataGeo extend + IBGE overlay demográfico          | ~3 sessões       | 🔲 Planejada            |
| Autônoma 9  | US139, US140        | **Cruzamento com Bloco L** — drenagem SINAPI por pluviometria DAEE-SP + SiCAR rural (opcional) | ~1,5-2,5 sessões | 🔲 Planejada            |
| Autônoma 10 | US141, US142        | **Tier 2 regional Splendori (on-demand)** — Plano Diretor Piracicaba + Plano Bacia PCJ         | ~1 sessão        | 🔲 Condicional (piloto) |

### US detalhadas (open-geodata)

| #   | US        | Descrição                                                                                                                                                                                                                              | Fonte                          | Sessão      | Esforço      | Moat vs Lotelytics                            |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----------- | ------------ | --------------------------------------------- |
| 16  | **US136** | EF `analyze-app-hydro` — buffer Código Florestal (30/50/100m + 50m nascente) sobre hidrografia FBDS; ETL GeoPackage FBDS (7,9 GB) → Supabase Storage + subset PostGIS com índice GIST por bioma/UF                                     | `br_fbds` (MMA/FBDS)           | Autônoma 8  | 2 sessões    | 🟢 Além — Lotelytics não faz APP hídrica auto |
| 17  | **US137** | Extensão `development-geo-layers` com novas camadas DataGeo: APM (Áreas de Proteção de Manancial), zoneamento CETESB, UC estaduais SP — snapshots em Supabase Storage (evitar `raw.githubusercontent`)                                 | `sp_datageo` (DataGeo/CETESB)  | Autônoma 8  | 0,5 sessão   | 🟢 Reforça 8×0 em geo                         |
| 18  | **US138** | Overlay demográfico no mapa do projeto + card "Acessibilidade vs salário formal IBGE" no Performance Score — consumir [API IBGE Serviço Dados](https://servicodados.ibge.gov.br/api/docs) direto, **sem fork**                         | `br_ibge_api` (IBGE)           | Autônoma 8  | 0,5 sessão   | 🟡 Paridade Lotelytics                        |
| 19  | **US139** | **Cruza Bloco L (SINAPI itemizado)** — dimensionar galeria de águas pluviais SINAPI por Período de Retorno (10/25/50 anos) com séries pluviométricas DAEE-SP; cálculo regional por município                                           | `sp_daee_hidrologia` (DAEE-SP) | Autônoma 9  | 1 sessão     | 🟢 Diferencial no GAP P0 #2                   |
| 20  | **US140** | EF `analyze-car` — due diligence de terreno em zona rural/periurbana (consulta SiCAR por CAR/CPF, sobreposição APP/RL/Uso Consolidado sobre polígono). **Reimplementar com `sicar` pip + `geopandas`** — repo `ArcGIS-SiCAR` é só spec | `ArcGIS-SiCAR` (inspiração)    | Autônoma 9  | 1-1,5 sessão | 🟢 Sem paralelo Lotelytics                    |
| 21  | **US141** | (Opcional/condicional piloto) Sanity-check do Splendori com Plano Diretor Piracicaba — validar zoneamento/gabarito/recuos antes do cliente                                                                                             | `sp_piracicaba`                | Autônoma 10 | 0,5 sessão   | 🔵 Hiperlocal                                 |
| 22  | **US142** | (Opcional/condicional piloto) Relatório ambiental Splendori com dados do Plano de Bacia PCJ 2020-2035 (disponibilidade hídrica, outorga)                                                                                               | `sp_bh_pcj-2020-2035`          | Autônoma 10 | 0,5 sessão   | 🔵 Hiperlocal                                 |

### Descartados do Anexo (não entram no backlog)

`br_snis` (stub), `br_track` (Polish obsoleto), `sp_daee_outorgas` (nichado), **5 `ArcGIS-*`** (ArcPy desktop — Python puro resolve).

### Decisões pendentes antes de iniciar

1. **Storage do FBDS (7,9 GB):** Supabase Storage (arquivo original) + PostGIS (subset por bioma/UF com GIST). Confirmar bucket + política RLS.
2. **Provedor LLM** para Copilot tool nova `analyze_app_hydro` — aguardar P-130 (bloqueante geral do módulo).
3. **Delegação squad:** Buchecha (EF `analyze-app-hydro` US136) · DeepSeek (ETL FBDS PostGIS US136) · Qwen (UI overlay APP + demografia US137/US138).
