# Módulo Parcelamento de Solo (Projetos Horizontais)

> **Status:** 🟡 EM INCORPORAÇÃO — Caminho A escolhido em 07/04/2026
> **Origem:** Lovable (`mfalcao09/qsda564dds564as`) — uploaded como ZIP
> **Posicionamento:** Fase pré-incorporação. Vem ANTES do CRM/CLM no ciclo Intentus.
> **Prefixo de schema/código:** `parcelamento_*` (todas as tabelas, EFs, rotas)

## Decisão estratégica (07/04/2026)

Marcelo decidiu integrar a ferramenta de viabilidade de loteamentos/condomínios (originalmente desenvolvida no Lovable) como **novo módulo do Intentus** chamado **"Parcelamento de Solo (Projetos Horizontais)"**.

**Caminho escolhido:** A — Cópia + adaptação ao repositório `intentus-plataform`, alinhada aos padrões do CLAUDE.md.

**Aviso explícito do Marcelo:** "o projeto não é um projeto pronto, temos ainda muita coisa (MAS MUITA MESMO) para incorporar de novo, vamos processar tudo isso juntos."

→ Tradução: o módulo vai além da ferramenta Lovable. Haverá funcionalidades adicionais a serem incorporadas progressivamente. **Não tratar como migração one-shot; tratar como construção iterativa de um novo módulo robusto.**

## Por que importa

O Intentus hoje cobre **5 módulos pós-empreendimento** (CLM, CRM, Comercial, Relationship, Cross-cutting). Falta a fase **pré-incorporação**: estudo de viabilidade do terreno. Esse módulo fecha o ciclo completo do mercado imobiliário:

```
Terreno bruto → ESTUDO DE VIABILIDADE (novo) → Captação → Contrato → Venda → Relacionamento
```

Nenhum concorrente no Brasil tem esse ciclo completo integrado em uma única plataforma SaaS.

## O que veio do Lovable (núcleo geoespacial)

### Inteligência geoespacial real (não é "calculadora simples")

- **Parser KMZ/KML** com cálculo de área usando geometria esférica (raio terra 6.378.137m)
- **Reverse geocode IBGE** com correção automática de localização
- **Integração SICAR/CAR** via WFS GeoServer (com cache em `reserva_legal_cache`)
- **Integração SIGEF/IBAMA PAMGIA** (5 camadas: hidrografia, massa d'água, embargos, terras indígenas, UCs)
- **Integração DataGeo (SP)** para Reserva Legal precisa
- **Cálculo de APP/RL real** via interseção geométrica Turf.js (não estimativa)
- **Visualização 3D** com Three.js + react-three-fiber + drei (terreno + simulador de loteamento)
- **Parser DXF/DWG** para importar layouts CAD prontos
- **Triangulação Delaunay** para mesh do terreno
- **Edge Function `elevation`** com grid 60×60 + smoothing 3×3 Gaussian

### Schema do banco (12 migrations no Lovable)

8 estados de projeto:
```
em_preenchimento | em_analise | viavel | quase_viavel |
rejeitado | monitorando | arquivado | lixeira
```

Tabelas-chave (com prefixo Lovable):
- `projects` (geo: `total_area`, `latitude`, `longitude`, `terrain_geojson`, `lot_size_m2`, `road_width_m`, `app_pct`, `subdivision_standard`)
- `project_memberships` (multi-tenant)
- `project_files`
- `financial_analyses` (JSONB: `infrastructure_cost`, `cash_flow`, `indicators`)
- `legal_compliance` (JSONB: `checklist`, `app_areas`, `compliance_score`)
- `reserva_legal_cache` (com bbox indexing)

### Fluxo de criação (4 steps)

1. **Step 1:** Nome + UF + cidade (combobox IBGE)
2. **Step 2:** Upload KMZ/KML drag-drop + reverse geocode + APP automático via SICAR
3. **Step 3:** Parâmetros urbanísticos (% áreas + área mínima do lote + standard)
4. **Step 4:** Cálculo de viabilidade (área líquida, total de lotes, taxa de aproveitamento)

### Auto-save resiliente

Cada step persiste em `sessionStorage` + banco. Refresh não perde progresso.

## O que NÃO veio do Lovable (gaps)

- ❌ **Análise Financeira** (placeholder de 32 linhas) — schema pronto, UI inexistente
- ❌ **Conformidade Legal** (placeholder de 34 linhas) — schema pronto, UI inexistente
- ❌ **Relatórios** (placeholder de 40 linhas) — nenhuma geração PDF/Excel
- ❌ **Testes automatizados** (Vitest instalado, zero testes)
- ❌ **Modelo urbanístico avançado** — atual é simplista (% sobre área bruta), não considera Lei 6.766/79 detalhada nem zoneamento municipal

## O que vai ser ADICIONADO (Marcelo avisou: "muita coisa")

**Status:** A definir progressivamente conforme Marcelo for trazendo requisitos.

Possíveis dimensões a incorporar (hipóteses iniciais — confirmar):
- Calculadora urbanística completa (zoneamento + declividade + non aedificandi)
- Análise financeira com cenários Monte Carlo
- Geração de relatórios PDF profissionais
- IA generativa para parecer técnico (OpenRouter/Gemini 2.0 Flash, padrão Intentus)
- Modo "autopilot" (IA escolhe melhor configuração de loteamento)
- Comparador de empreendimentos
- Integração Google Earth Engine (MapBiomas, NDVI, histórico de uso do solo)
- Twin digital integrado ao CRM (lotes calculados → produtos no CRM)
- Algoritmo genético para otimização de traçado
- WebXR/AR para visita virtual
- Memorial descritivo automático
- Integração com bases municipais de zoneamento
- ?? (mais a definir)

## Adaptações obrigatórias para o Intentus (Caminho A)

| Item | Lovable atual | Padrão Intentus |
|---|---|---|
| Single query | `.single()` em alguns lugares | **`.maybeSingle()` SEMPRE** |
| Multi-tenant | `owner_id` direto + `project_memberships` | **`getAuthTenantId()` + `tenant_id` em toda query** |
| Roles | 3 + super_admin | **7 roles do Intentus** (superadmin, admin, gerente, corretor, financeiro, juridico, manutencao) |
| CORS | wildcard `*` | **Whitelist** (app.intentusrealestate.com.br + previews + localhost) |
| Type casts | `as unknown as` em geo-layers-api | **Tipar corretamente** + regenerar types Supabase |
| EF middleware | Nenhum | **`_shared/middleware.ts` + `_shared/auth.ts`** |
| Soft delete | `deleted_at` | **Manter** (já compatível) |
| `lovable-tagger` | Presente em devDeps | **Remover** |
| Prefixo de tabelas | `projects`, `financial_analyses` | **`parcelamento_projects`, `parcelamento_financial_analyses`** (evitar colisão com CRM `projects`) |

## Plano de execução — 8 fases

| Fase | Duração | Conteúdo |
|---|---|---|
| **0** | 1-2d | Auditoria das EFs externas + listagem de tabelas + decisões |
| **1** | 2-3d | Schema do banco (`parcelamento_*`) + RLS + helper functions |
| **2** | 2-3d | 5 Edge Functions adaptadas (`parcelamento-elevation`, `parcelamento-geo-layers`, `parcelamento-sicar-query`, `parcelamento-datageo-rl`, `parcelamento-dwg-to-dxf`) |
| **3** | 1-2d | Libs (`kml-parser`, `cad-parser`, `geo-layers-api`, `ibge-api`, `reverse-geocode`) + tipos |
| **4** | 4-6d | Páginas e componentes (Dashboard, NewProject 4-step, Detail, Map, 3D) |
| **5** | 5-7d | **Reescrever os 3 placeholders** (Financial, Compliance, Reports) |
| **6** | 3-4d | Testes unitários + E2E + build limpo |
| **7** | 1-2d | Migração de dados existentes (opcional) |
| **8** | 1d | Documentação + atualizar CLAUDE.md/MEMORY.md |

**Total:** 4-6 semanas — mas com aviso de Marcelo de "muita coisa a mais", expectativa real é **8-12 semanas iterativas**.

## Pair programming obrigatório

Conforme regra do CLAUDE.md:
> "Todo o desenvolvimento deve ser feito utilizando o Plugin Minimax M2.7 (Buchecha)."

→ Toda fase de implementação será feita em pair programming Claudinho + Buchecha.
→ Skill: `minimax-ai-assistant:minimax-pair-programming`

## Riscos identificados

| Risco | Severidade | Mitigação |
|---|---|---|
| Dependência do GeoServer SICAR (instável, CORS) | 🔴 Alta | Cache existente; expandir TTL; fallback estimativa |
| EF `elevation` — provedor desconhecido | 🟡 Média | **Auditoria na Fase 0** |
| EF `dwg-to-dxf` — provedor desconhecido | 🟡 Média | **Auditoria na Fase 0** |
| Componentes 3D enormes (753 + 947 linhas) | 🟡 Média | Refatorar em sub-componentes na Fase 4 |
| Modelo urbanístico simplista | 🟡 Média | Marketing claro: "estudo de massa preliminar" |
| Sem testes | 🟡 Média | Criar testes na Fase 6 |
| Colisão com tabela `projects` do CRM | 🔴 Alta | **Prefixo `parcelamento_*` obrigatório** |

## Skills/MCPs em uso neste projeto

- `real-estate` — base de conhecimento imobiliário
- `saas-product` — PRD/roadmap
- `legal-docs` — checklist Lei 6.766/79
- `marcelo-profile` — calibração de tom
- `engineering:architecture` — ADR
- `engineering:system-design` — design do módulo
- `product-management:write-spec` — PRD
- `minimax-ai-assistant:minimax-pair-programming` — pair com Buchecha (obrigatório)
- MCP Supabase — `apply_migration`, `deploy_edge_function`, `list_tables`, `get_advisors`, `execute_sql`

## Referências

- **Análise técnica completa:** `analise-tool-imobiliaria-lovable.md` (raiz do projeto, 600+ linhas)
- **ZIP fonte:** `/sessions/adoring-admiring-bohr/mnt/uploads/qsda564dds564as-main.zip`
- **Análise extraída em:** `/sessions/adoring-admiring-bohr/analysis/qsda564dds564as-main/`
- **Lei 6.766/79** — Parcelamento do Solo Urbano
- **Código Florestal (Lei 12.651/12)** — APP e Reserva Legal
- **NBR 12.721** — Cálculo de áreas em incorporações imobiliárias

## ⚠️ NOTA CRÍTICA — Reserva Legal via bases estaduais (adicionada em 2026-04-07)

**Prioridade: ALTA. Marcelo declarou: "É fundamental."**

A Reserva Legal (RL) no Brasil é declarada e gerenciada em dois níveis:
- **Federal:** SICAR (sicar.gov.br) — dados nacionais, mas com atraso e inconsistências (proprietários que não atualizaram o CAR)
- **Estadual:** cada estado mantém sua própria base de georreferenciamento florestal, frequentemente mais precisa, atualizada e com camadas adicionais (APP, fragmentos, biomas)

**Por que estadual é fundamental:**
1. A aprovação de loteamentos passa pelo **órgão ambiental estadual** (ex: CETESB/SMA em SP, IEF em MG, IMASUL no MS). Eles usam a base deles, não o SICAR federal.
2. A RL **inscrita no CAR federal** pode diferir da RL **averbada no registro de imóveis** estadual — conflito jurídico que bloqueia aprovação.
3. Para análise de viabilidade confiável, precisa cruzar SICAR federal + base estadual.

**Bases estaduais prioritárias (estados onde Marcelo opera):**
| UF | Órgão | URL/API | Status |
|---|---|---|---|
| SP | DataGeo SP (SMA/CETESB) | datageo.ambiente.sp.gov.br/geoserver | ✅ Servidor testado e vivo — camada RL ainda não mapeada, investigar na Fase 2 |
| MS | IMASUL (Base Cartográfica Estadual) | idemsul.ms.gov.br | ⏳ Não testado ainda |
| MG | IEF/IDAF | ide.meioambiente.mg.gov.br | ⏳ Não testado ainda |

**Plano de ação:**
1. **Fase 2 (quando criar as EFs):** criar EF `development-rl-estadual` que tenta: (1) DataGeo SP para terrenos em SP, (2) SICAR federal fallback para outros estados, (3) flag de qualidade da fonte no resultado
2. **Fase 3 (roadmap):** expandir para MS e MG conforme demanda real dos clientes
3. **NUNCA bloquear o fluxo por RL indisponível:** o sistema deve mostrar a análise com a flag `rl_source: "sicar_federal" | "estadual_sp" | "estimativa"` e deixar o usuário entender a qualidade da informação

**Impacto no schema já planejado:**
- A coluna `reserva_legal_pct` e `reserva_legal_area_m2` em `developments` deve ter campo companion `reserva_legal_source text` (já vou incluir na migration da Fase 1)
- A tabela `development_parcelamento_rl_cache` deve ter campo `source_precision text CHECK IN ('estadual', 'federal', 'estimativa')`

---

## Histórico

- **07/04/2026** — Decisão Caminho A. Análise técnica completa entregue. Memória inicializada.
- **07/04/2026** — Marcelo confirmou nome do módulo: "Parcelamento de Solo (Projetos Horizontais)" com prefixo `parcelamento_*`.
- **07/04/2026** — Marcelo avisou: "muita coisa a mais para incorporar — vamos processar juntos".
- **07/04/2026 (sessão 117)** — Marcelo declarou: RL via bases estaduais é FUNDAMENTAL. Nota crítica adicionada acima. Schema a ser ajustado na migration Fase 1.
