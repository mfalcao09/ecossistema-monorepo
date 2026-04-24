# Parcelamento de Solo — Deep Dive: open-geodata × Lotelytics × Intentus

> **Data:** 2026-04-24
> **Autor:** Claudinho (Opus 4.7)
> **Origem:** Marcelo enviou 16 repos da org [open-geodata](https://github.com/open-geodata) para avaliação de integração no módulo de Parcelamento de Solo da Intentus.
> **Escopo:** recorte estrito em **loteamentos** (não "real estate genérico"), cruzando os repos com (a) GAPs P0 vs Lotelytics e (b) moat regional brasileiro já presente no módulo.
> **Documentos relacionados:**
>
> - [parcelamento-solo-REFERENCIA-LOTELYTICS.md](./parcelamento-solo-REFERENCIA-LOTELYTICS.md) — mapa visual do produto referência
> - [competitor-analysis-lotelytics.md](./competitor-analysis-lotelytics.md) — placar 35×16 + GAPs P0/P1/P2
> - [../masterplans/parcelamento-solo.md](../masterplans/parcelamento-solo.md) — masterplan 12 blocos

---

## 1. Contexto estratégico

- **Intentus já vence Lotelytics 35×16** (+ 24 empates) — domina geo (8×0), compliance legal (9×0), CAD (3×0), IA (3×0), gestão (4×0).
- **Derrota só em Premissas/Custos itemizados (8×0)** — é o único flanco competitivo real.
- **Piloto concreto:** Splendori House&Garden II Piracicaba — 920 lotes, 86,59 ha, mesmo projeto analisado no vídeo-referência do Lotelytics.
- **Stack-geo já madura:** EFs `development-geo-layers` (Overpass), `ibge-census` v2, `market-benchmarks` (SINAPI agregado), integração MapBiomas, IBAMA/ICMBio, DataGeo RL.

### GAPs P0 abertos (ordem do competitor analysis)

1. **Detecção automática de servidão** (buffer rodovia/LT, 1 sessão)
2. **Custos SINAPI itemizados** (30+ linhas, 2 sessões)
3. **Terraplanagem por declividade** (5 faixas, 1 sessão)

Ampliação natural do P0 #1 já prevista: **APP automática** (cursos d'água + buffer 30/50/100m Código Florestal).

---

## 2. Autor/organização dos 16 repos

- **Mantenedor:** Michel Metran (engenheiro ambiental SP, solo). Bus factor = 1.
- **Licença:** MIT em todos.
- **Qualidade:** boa para referência e snapshots de dado pontual. **Sem SLA, sem testes, sem releases versionadas.** Vários READMEs terminam em `TODO:`. Último push da maioria entre 2022-2025.
- **Implicação:** não forkar, não depender do código — usar como **ponteiro para fontes oficiais** (FBDS, DataGeo, IBGE, DAEE).

---

## 3. Tabela-síntese (16 repos, recorte loteamento)

| #   | Repo                                                                                 | Finalidade                               | Tipo              | Cobertura                     | Push    | Relev. loteamento     | Justificativa                                                                     |
| --- | ------------------------------------------------------------------------------------ | ---------------------------------------- | ----------------- | ----------------------------- | ------- | --------------------- | --------------------------------------------------------------------------------- |
| 1   | [br_fbds](https://github.com/open-geodata/br_fbds)                                   | Uso do solo, APPs, hidrografia (FBDS 5m) | GeoPackage 7,9 GB | BR (Mata Atlântica + Cerrado) | 2023-02 | **Alta**              | Alimenta APP automática + risco ambiental; cobre 100% da pegada Intentus          |
| 2   | [sp_piracicaba_atlasrural](https://github.com/open-geodata/sp_piracicaba_atlasrural) | Atlas Rural Piracicaba IPEF 2006         | Vetorial          | Piracicaba                    | 2025-06 | **Média\***           | \*Só porque Splendori é em Piracicaba; dado é de 2006                             |
| 3   | [sp_bh_pcj-2020-2035](https://github.com/open-geodata/sp_bh_pcj-2020-2035)           | Plano Bacias PCJ 2020-2035               | Vetorial          | SP/MG (PCJ)                   | 2025-06 | **Média\***           | \*Splendori está em PCJ → disponibilidade hídrica p/ relatório ambiental          |
| 4   | [sp_piracicaba](https://github.com/open-geodata/sp_piracicaba)                       | Plano Diretor Piracicaba (zoneamento)    | Shapefile         | Piracicaba                    | 2025-06 | **Média\***           | \*Sanity-check do piloto; não escala                                              |
| 5   | [br_ibge_sidra](https://github.com/open-geodata/br_ibge_sidra)                       | Scripts SIDRA tabela 6579 (pop.)         | Notebook + CSV    | BR (5570 mun.)                | 2024-05 | **Média**             | `ibge-census` v2 já cobre; repo útil como template SIDRA                          |
| 6   | [sp_datageo](https://github.com/open-geodata/sp_datageo)                             | DataGeo SP (camadas ambientais)          | GeoJSON raw       | SP                            | 2023-08 | **Alta**              | Extende `development-geo-layers` com APP estadual + CETESB + mananciais           |
| 7   | [sp_daee_outorgas](https://github.com/open-geodata/sp_daee_outorgas)                 | Outorgas água DAEE                       | Notebooks         | SP                            | 2023-08 | **Baixa**             | Nicho agro/industrial, pouco impacto em loteamento residencial                    |
| 8   | [br_snis](https://github.com/open-geodata/br_snis)                                   | Wrapper SNIS saneamento                  | Stub              | BR                            | 2023-08 | **Nenhuma**           | README é TODO; SNIS oficial vale a pena mas este repo não entrega                 |
| 9   | [br_ibge_api](https://github.com/open-geodata/br_ibge_api)                           | Wrapper API IBGE Serviço Dados           | Notebook          | BR                            | 2023-08 | **Alta**              | Malhas municipais GeoJSON + overlay demográfico no mapa                           |
| 10  | [br_track](https://github.com/open-geodata/br_track)                                 | Mapas Polish (GPS) → vetor               | Notebook          | BR                            | 2023-05 | **Nenhuma**           | Formato obsoleto; OSM via Overpass é superior                                     |
| 11  | [sp_daee_hidrologia](https://github.com/open-geodata/sp_daee_hidrologia)             | Pluviometria/fluviometria DAEE           | Scripts Python    | SP                            | 2023-05 | **Média**             | Dimensiona drenagem SINAPI por RP local (GAP P0 #2)                               |
| 12  | [ArcGIS-Convert](https://github.com/open-geodata/ArcGIS-Convert)                     | Converter geodatabase                    | ArcPy             | -                             | 2022-09 | **Nenhuma**           | Desktop proprietário; stack Intentus é web                                        |
| 13  | [ArcGIS-IGC](https://github.com/open-geodata/ArcGIS-IGC)                             | (sem README) IGC/SP                      | ArcPy             | SP                            | 2022-09 | **Nenhuma**           | Abandonado, sem descrição                                                         |
| 14  | [ArcGIS-Transformation](https://github.com/open-geodata/ArcGIS-Transformation)       | Transformações datum BR                  | ArcPy             | BR                            | 2022-09 | **Nenhuma**           | `pyproj` faz o mesmo em Python puro                                               |
| 15  | [ArcGIS-SiCAR](https://github.com/open-geodata/ArcGIS-SiCAR)                         | Processar CAR SiCAR                      | ArcPy             | BR                            | 2022-09 | **Média** (como spec) | Caso de uso ótimo (rural/periurbano); reimplementar com `sicar` pip + `geopandas` |
| 16  | [ArcGIS-TrackSource](https://github.com/open-geodata/ArcGIS-TrackSource)             | Viário via GPS Polish                    | ArcPy             | BR                            | 2017-09 | **Nenhuma**           | 8 anos abandonado; OSM resolve                                                    |

---

## 4. Tier 1 — Adotar no roadmap

### 🥇 `br_fbds` → APP automática (estende GAP P0 #1)

**O que entrega:** hidrografia 1:25.000, APPs já vetorizadas, uso do solo 5m resolução — cobrindo Mata Atlântica + Cerrado (100% da pegada Intentus: Splendori/Piracicaba, Klésis/FIC/Cassilândia, mercado alvo incorporadoras SP+MG+GO+MT).

**Aplicação direta:**

- Nova EF **`analyze-app-hydro`** (irmã de `analyze-easements`): recebe polígono → intersecta com hidrografia FBDS → gera buffers Código Florestal (30m cursos d'água <10m, 50m 10-50m, 100m 50-200m, APP de nascente 50m raio) → devolve área afetada + % da bruta.
- **Moat vs Lotelytics:** Lotelytics não faz APP hídrica automática (só rodovia/LT).
- **Integração Copilot:** Tool nova `analyze_app_hydro` no `copilot` v23.

**Implementação:**

1. Download FBDS GeoPackage (7,9 GB) → Supabase Storage bucket `geodata` (uma vez).
2. ETL para tabela `geo_fbds_hydro` (linhas + metadados bioma/UF/município) com `GIST` index PostGIS.
3. Para polígonos pequenos (< 100ha típico Intentus), query `ST_Intersects(hydro_line, polygon_bbox_3km)` é rápida.
4. Buffer + intersect em Turf.js dentro da EF (consistente com `analyze-easements`).

**Esforço:** 2 sessões (ETL + EF + UI).
**Risco:** dado FBDS de 2013-2019 (mas oficial MMA); cobertura parcial no Cerrado norte. Não bloqueante.

---

### 🥈 `sp_datageo` → extensão `development-geo-layers`

**O que entrega:** GeoJSONs prontos via `raw.githubusercontent.com` — APP estadual SP, áreas de proteção de manancial (APM — Splendori/Piracicaba está em APM PCJ), zoneamento ambiental CETESB, unidades de conservação estaduais.

**Você já usa:** "DataGeo RL (SP)" no `development-geo-layers`. Este repo tem mais camadas do mesmo DataGeo.

**Aplicação:** adicionar 3-4 novas camadas à EF existente. Baixar snapshots para Supabase Storage (não depender de `raw.githubusercontent` em runtime — evita rate limit + indisponibilidade).

**Esforço:** 0,5-1 sessão.

---

### 🥉 `br_ibge_api` → overlay demográfico

**O que entrega:** wrapper da [API IBGE Serviço Dados](https://servicodados.ibge.gov.br/api/docs) — malhas municipais em 4 resoluções + agregados SIDRA.

**Você já usa:** `ibge-census` v2 com 55 municípios. Esse repo traz **malhas em GeoJSON** (contorno municipal), útil para:

- Render do município no mapa do projeto.
- Overlay "Acessibilidade vs salário formal IBGE" (que aparece no Performance Score do Lotelytics).
- Validação de município informado nos metadados.

**Aplicação:** **não forkar o repo**. Consumir a API IBGE direto do Next.js (é pública, estável). Usar o repo como documentação/exemplo.

**Esforço:** 0,5 sessão.

---

## 5. Tier 2 — Avaliar por cobertura regional do piloto

| Repo                            | Quando usar                                             | Entrega                                                                                         |
| ------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `sp_piracicaba` (Plano Diretor) | Validação do piloto Splendori antes de rodar no cliente | Zoneamento urbano PM Piracicaba (uso do solo, gabarito, recuos)                                 |
| `sp_piracicaba_atlasrural`      | Só se Splendori houver área rural reclassificada        | Áreas rurais de Piracicaba 2006                                                                 |
| `sp_bh_pcj-2020-2035`           | Relatório ambiental Splendori                           | Plano de bacia PCJ — cenários de disponibilidade hídrica 2020-2035, outorga                     |
| `sp_daee_hidrologia`            | **Entra no GAP P0 #2** (SINAPI itemizado → drenagem)    | Séries pluviométricas SP → dimensionar galeria pluvial por RP 10/25/50 anos por região          |
| `br_ibge_sidra`                 | Extensão futura de `ibge-census` v3                     | Template para novas tabelas SIDRA (PIB municipal, Censo, Emprego CAGED)                         |
| `ArcGIS-SiCAR` (**como spec**)  | Loteamentos rurais/periurbanos                          | Caso de uso de due diligence CAR — reimplementar com `sicar` (pip) + `geopandas`. **Não fork.** |

---

## 6. Tier 3 — Descartar (definitivo)

**Bloco único:**

- **5 `ArcGIS-*`** (Convert, IGC, Transformation, SiCAR-código, TrackSource) → ArcPy/ArcGIS Desktop, licença ~US$ 1.500/ano, incompatível com Next.js/Deno. Equivalentes Python puros (`geopandas`, `pyproj`, `shapely`, `rasterio`) resolvem tudo que eles fazem, melhor e grátis.
- **`br_snis`** → README stub. SNIS oficial é útil, mas este repo não entrega nada além do link.
- **`br_track`** → formato Polish/GPS, OSM via Overpass supera.
- **`sp_daee_outorgas`** → nicho agro/industrial, pouco impacto em loteamento residencial.

**Ação:** nunca voltar a avaliar.

---

## 7. Roadmap de integração proposto

| Sprint  | Bloco                      | Entrega                                                                      | GAP que fecha                                             | Esforço     |
| ------- | -------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------- | ----------- |
| **S+1** | Bloco H                    | EF `analyze-app-hydro` (FBDS hidrografia + buffers Código Florestal)         | Ampliação P0 #1 (APP automática) — **além do Lotelytics** | 2 sessões   |
| **S+1** | Bloco H                    | Extensão `development-geo-layers` com APM/CETESB/UC (sp_datageo)             | Moat regional SP                                          | 0,5 sessão  |
| **S+2** | Bloco G                    | Overlay demográfico IBGE no mapa + card "Acessibilidade vs salário"          | Paridade Lotelytics Performance Score                     | 0,5 sessão  |
| **S+2** | Bloco L (SINAPI itemizado) | Drenagem dimensionada por pluviometria DAEE (SP) → custo SINAPI por RP local | **Diferencial** no GAP P0 #2                              | 1 sessão    |
| **S+3** | Bloco H opcional           | EF `analyze-car` reimplementada Python puro (inspiração ArcGIS-SiCAR)        | Due diligence rural/periurbano                            | 1-2 sessões |

**Total acrescido:** 4,5-6,5 sessões para fechar ampliação de P0 #1 e contribuir ao P0 #2 com diferencial regional.

---

## 8. Princípio orientador

**Não integrar os repos.** Usar como **ponteiro para as fontes oficiais** (FBDS/MMA, DataGeo/CETESB, API IBGE, DAEE) — armazenar snapshots próprios no Supabase Intentus, servir via EFs. O código dos repos é Python/notebooks ad-hoc sem testes; o valor está nos **dados que eles apontam** e no **desenho conceitual** de alguns fluxos (principalmente `ArcGIS-SiCAR`).

---

## 9. Próxima ação imediata para Marcelo

1. **Aprovar entrada dos 3 itens Tier 1 no Bloco H** do masterplan → atualizar [../masterplans/parcelamento-solo.md](../masterplans/parcelamento-solo.md) e [../sprints/bloco-h-moat-regional.md](../sprints/bloco-h-moat-regional.md).
2. **Decidir storage do FBDS** (7,9 GB) → Supabase Storage vs PostGIS local. Recomendação: Storage para arquivo original + PostGIS com subset por bioma/UF (índice GIST) para queries.
3. **Delegar implementação ao squad** via `squad-parallel`: Buchecha (EF `analyze-app-hydro`), DeepSeek (SQL/ETL FBDS), Qwen (UI overlay APP + demografia).

---

## 10. Status — APROVADO 2026-04-24

Marcelo aprovou integrar **Tier 1 + Tier 2** ao Bloco H como anexo. Atualizações realizadas:

- [../masterplans/parcelamento-solo.md](../masterplans/parcelamento-solo.md) — total US: 137 → **144** (Bloco H passa de 15 → 22 US)
- [../sprints/bloco-h-moat-regional.md](../sprints/bloco-h-moat-regional.md) — seção "Anexo open-geodata" com 7 novas US (US136-US142), 3 sessões autônomas adicionais (8, 9, 10-condicional)

### US aprovadas

| US    | Escopo                                                        | Sessão                    | Esforço      |
| ----- | ------------------------------------------------------------- | ------------------------- | ------------ |
| US136 | EF `analyze-app-hydro` (FBDS + Código Florestal)              | Autônoma 8                | 2 sessões    |
| US137 | Extensão `development-geo-layers` com DataGeo (APM/CETESB/UC) | Autônoma 8                | 0,5 sessão   |
| US138 | Overlay demográfico IBGE + card Acessibilidade                | Autônoma 8                | 0,5 sessão   |
| US139 | Drenagem SINAPI por pluviometria DAEE-SP (cruza Bloco L)      | Autônoma 9                | 1 sessão     |
| US140 | EF `analyze-car` (SiCAR rural) — `sicar` pip + `geopandas`    | Autônoma 9                | 1-1,5 sessão |
| US141 | Sanity-check Splendori × Plano Diretor Piracicaba             | Autônoma 10 (condicional) | 0,5 sessão   |
| US142 | Relatório ambiental Splendori × Plano Bacia PCJ               | Autônoma 10 (condicional) | 0,5 sessão   |

**Total:** 6-7,5 sessões (4-5,5 core + 1-2 condicional piloto).
