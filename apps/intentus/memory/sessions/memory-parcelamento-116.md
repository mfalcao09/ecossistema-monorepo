# Sessão 116 — Parcelamento de Solo: PRD v0.2 Aprovado + Checkpoint para Sessão 117

> **Data:** 07/04/2026
> **Status:** ✅ Concluída com aprovação total
> **Próxima sessão:** 117 — Iniciar implementação Fase 1A (Geoespacial)

---

## 1. O que aconteceu nesta sessão

### Contexto inicial
A sessão 116 começou como continuação da 115, onde tínhamos analisado o vídeo de referência do Lotelytics (~17min, 41 frames) e criado o documento `parcelamento-solo-REFERENCIA-LOTELYTICS.md`. A pendência era apresentar a Marcelo o resumo do que vimos e decidir o caminho a seguir.

### Decisão estratégica de Marcelo
Apresentei 3 caminhos possíveis (A: paridade total, B: roadmap em camadas, C: diferenciação por IA). Marcelo escolheu:

> **"Quero o caminho A + C. A mensuração de declividade, topografia do terreno, as linhas de influência (APP, Rodovias, Rios), isso é importantíssimo no projeto. Gostaria muito que isso fosse o mais próximo possível da referência."**

Em seguida confirmou também:

> **"Incluir desde já"** — sobre os diferenciais brasileiros (CAR, SICAR, MapBiomas, Código Florestal)

### Trabalho executado nesta sessão
1. **Skills declaradas**: `product-management:write-spec`, `real-estate`, `saas-product`, `engineering:architecture`, `minimax-pair-programming` (planejado para próxima sessão), `biz-strategy`
2. **PRD v0.2 escrito** em `memory/projects/parcelamento-solo-PRD-v0.2.md` — ampliando de 47 para **137 user stories**
3. **6 novas categorias adicionadas**:
   - 🆕 Geoespacial Profundo (US-48 a US-65, 18 stories, P0)
   - 🆕 Premissas Profundas Lotelytics (US-66 a US-78, 13 stories, P0)
   - 🆕 Análise Financeira 8 abas Lotelytics (US-79 a US-100, 22 stories, P0)
   - 🆕 Diferencial IA Intentus (US-101 a US-115, 15 stories, P0/P1)
   - 🆕 Diferencial Brasil (US-116 a US-135, 20 stories, P0/P1)
   - 🆕 Integração CRM/CLM/Relationship Intentus (US-136 a US-145, 10 stories, P0)
4. **Roadmap repriorizado** em 12 fases (vs 9 anteriores), começando por Fase 1A (Geoespacial PostGIS)
5. **MEMORY.md atualizado** com nova sessão 116, nova decisão, novos arquivos referenciados

### 5 confirmações finais de Marcelo

Apresentei 5 perguntas críticas antes de seguir, e Marcelo respondeu:

| # | Pergunta | Resposta de Marcelo |
|---|---|---|
| 1 | Aprovação geral do PRD v0.2? | ✅ "De acordo com a aprovação geral" |
| 2 | Mapbox vs MapLibre? | ✅ "Mapbox, igual Lotelytics" |
| 3 | PostGIS no Supabase? | ✅ "PostGIS autorizado no supabase" |
| 4 | Prazo de 28 semanas? | ✅ "Estou confortável com o prazo de 28 semanas" |
| 5 | Pricing? | ⏸️ "Vamos falar de preço mais adiante" |

E pediu: **"Registre isso, o plano todo e vamos iniciar a implementação em uma nova sessão."**

---

## 2. Estado dos artefatos ao final da sessão 116

| Arquivo | Status | Conteúdo |
|---|---|---|
| `parcelamento-solo-PRD-v0.2.md` | ✅ Criado e aprovado | 137 US, decisões de Marcelo registradas em §0.1 |
| `parcelamento-solo-REFERENCIA-LOTELYTICS.md` | ✅ Existente (sessão 115) | Análise do vídeo, mapa do produto Lotelytics |
| `parcelamento-solo-FASE0-AUDITORIA.md` | ✅ Existente | 5 EFs auditadas, 250 tabelas listadas |
| `parcelamento-solo-DECISOES-D1-D5.md` | ✅ Existente | D1-D5 todas confirmadas |
| `parcelamento-solo-FASE1-PLANO.md` | ⚠️ **DESATUALIZADO** | Reflete v0.1 (precisa ser ampliado para incluir as 25 tabelas geoespaciais + financeiras + catálogos) |
| `parcelamento-solo-PRD.md` | 📚 Arquivo histórico (v0.1) | Mantido para referência |
| `MEMORY.md` | ✅ Atualizado | Sessão 116 documentada, decisão A+C+Brasil registrada |
| `memory-parcelamento-116.md` | ✅ ESTE ARQUIVO | Checkpoint para sessão 117 |

---

## 3. Plano completo (resumo executável)

### Stack confirmada
- **Frontend**: React 18 + Vite + TypeScript + shadcn/ui + Tailwind (igual ao resto do Intentus)
- **Mapas**: **Mapbox GL JS** (decisão de Marcelo: paridade visual com Lotelytics)
- **Backend**: Supabase PostgreSQL + **PostGIS** (autorizado por Marcelo)
- **Edge Functions**: Deno (padrão Intentus)
- **Schema unificado**: tabela `developments` (D1) com prefixo `development_parcelamento_*`
- **Edge Functions prefix**: `development-*`
- **Geo APIs**: OpenTopography (chave: `eefa7c0b13e68acf907f50288b685522` ✅), ConvertAPI (Marcelo cadastra), Google Earth Engine (MapBiomas), Overpass API (OpenStreetMap), SiCAR API
- **IA**: OpenRouter (Gemini 2.0 Flash) + OpenAI (GPT-4o-mini)
- **Pair programming**: Buchecha (MiniMax M2.7) obrigatório antes de cada migration

### 12 Fases do Roadmap
1. **Fase 0** ✅ Auditoria — completa
2. **Fase 1A** 🟡 Schema Geoespacial Profundo (4-5 dias) — **PRÓXIMA**
3. **Fase 1B** Schema Financeiro + Premissas (3-4 dias)
4. **Fase 1C** Schema Catálogos Brasil (2 dias)
5. **Fase 2** Edge Functions Geoespaciais (5-7 dias)
6. **Fase 3** Edge Functions Financeiras (5-7 dias)
7. **Fase 4** Edge Functions IA (Diferencial Intentus, 7-10 dias)
8. **Fase 5** Frontend Geoespacial (8-10 dias)
9. **Fase 6** Frontend Premissas Modal 4 abas (5-7 dias)
10. **Fase 7** Frontend Financeiro 8 abas (8-10 dias)
11. **Fase 8** Frontend Copilot Agentic + IA (5-7 dias)
12. **Fase 9** Integrações Intentus CRM/CLM/Relationship (5-7 dias)
13. **Fase 10** Relatórios PDF + Memoriais (4-5 dias)
14. **Fase 11** Testes e qualidade (5-7 dias)
15. **Fase 12** Documentação + Lançamento (3-4 dias)

**Total estimado: ~141 dias úteis (~28 semanas) — aprovado por Marcelo**

### Tabelas previstas para Fase 1A (Geoespacial — PostGIS)

```
development_parcelamento_terrain
  - Polígono PostGIS GEOMETRY(POLYGON, 4326)
  - Área bruta, perímetro, centroide
  - Metadata do KMZ original

development_parcelamento_topography
  - DEM (Digital Elevation Model) raster ou pontos
  - Curvas de nível (intervalos 1m/2m/5m/10m)
  - Min, max, média de elevação
  - Fonte (OpenTopography SRTM/ALOS)

development_parcelamento_slope_analysis
  - Heatmap de declividade
  - Histograma das 4 classes (0-10%, 10-18%, 18-25%, >25%)
  - Área por classe
  - Volume estimado de movimentação de terra

development_parcelamento_influence_lines
  - Tipo (rodovia/rio/ferrovia/LT/duto)
  - Nome (BR-101, Rio Piracicaba, etc.)
  - Geometria PostGIS LINESTRING/MULTILINESTRING
  - Buffer de proteção legal calculado
  - Fonte (OSM Overpass, IBGE, ANA)

development_parcelamento_app_calculation
  - APP automática conforme Lei 12.651/2012
  - Polígonos das APPs
  - Área total APP em ha e %
  - Justificativa por tipo (margem rio, nascente, encosta, topo morro)

development_parcelamento_overlays
  - Camadas raster e vetoriais
  - Tipo (KMZ, KML, GeoTIFF, ECW, Shapefile)
  - Storage path
  - Bounding box

development_parcelamento_car_data
  - Cache da consulta SiCAR
  - APPs declaradas
  - Reserva Legal
  - Áreas embargadas
  - Áreas de uso consolidado

development_parcelamento_mapbiomas
  - Cache MapBiomas Coleções
  - Histórico 10+ anos de uso/cobertura
  - Snapshots por ano

development_parcelamento_zoning
  - Plano Diretor municipal parsed
  - Coeficiente de Aproveitamento
  - Taxa de ocupação
  - Gabarito
  - Restrições especiais
```

Total: **9 tabelas para a Fase 1A**

### Edge Functions previstas para Fase 2 (Geoespaciais)

1. `development-parse-kmz` — extrai polígono e metadados
2. `development-fetch-elevation` — chama OpenTopography
3. `development-compute-slope` — gradiente DEM em 4 classes
4. `development-detect-influence-lines` — Overpass API
5. `development-compute-app` — Lei 12.651/2012
6. `development-fetch-car` — SiCAR API
7. `development-fetch-mapbiomas` — Google Earth Engine
8. `development-overlay-tiff-ecw` — raster overlay
9. `development-export-geometry` — KMZ/KML/SHP/DWG

---

## 4. Pré-requisitos para iniciar Sessão 117

### Bloqueadores que Marcelo precisa resolver antes ou durante a sessão 117

1. **Cadastrar conta no ConvertAPI** (https://convertapi.com) e obter `CONVERT_API_SECRET`
2. **Gerar token público no Mapbox** (https://account.mapbox.com/access-tokens) e enviar `MAPBOX_PUBLIC_TOKEN`
3. **Validar plano de pagamento Mapbox** — primeiros 50k loads/mês são free, acima disso $0,60 por mil. Para uso interno inicial deve ficar grátis.
4. **Configurar Google Cloud / Earth Engine** (para US-117 MapBiomas) — pode ser feito em paralelo durante a Fase 5
5. **Configurar OAuth SiCAR** (para US-116 CAR data) — pode ser feito durante a Fase 1C

### Não-bloqueadores (já temos)
- ✅ `OPENTOPO_API_KEY = eefa7c0b13e68acf907f50288b685522`
- ✅ Acesso ao Supabase (project ID `bvryaopfjiyxjgsuhjsb`)
- ✅ Permissão para habilitar PostGIS (Marcelo confirmou)
- ✅ PRD v0.2 aprovado
- ✅ Buchecha (MiniMax) configurado para review

---

## 5. Roteiro detalhado da Sessão 117 (próxima)

A sessão 117 deve abrir com este roteiro **passo-a-passo** (preferência de Marcelo: detalhado e iterativo):

### Bloco 1 — Atualizar FASE1-PLANO (30 min)
1. Reabrir `parcelamento-solo-FASE1-PLANO.md`
2. Reescrever em **Fase 1A + 1B + 1C** conforme PRD v0.2
3. Listar todas as 25 tabelas com SQL completo (CREATE TABLE + indexes + RLS PERMISSIVE/RESTRICTIVE + comments)
4. Salvar como `parcelamento-solo-FASE1-PLANO-v0.2.md`

### Bloco 2 — Review com Buchecha (30 min)
1. Invocar skill `minimax-ai-assistant:minimax-pair-programming`
2. Enviar SQL completo da Fase 1A
3. Pedir review focado em: nomenclatura, índices PostGIS (GIST, GIN), RLS, tipos PostGIS corretos, performance
4. Aplicar correções

### Bloco 3 — Habilitar PostGIS (5 min)
1. Listar extensões atuais (`mcp__supabase__list_extensions`)
2. Habilitar: `CREATE EXTENSION IF NOT EXISTS postgis;`
3. Verificar versão e capacidades

### Bloco 4 — Aplicar migration Fase 1A (1h, com salvaguardas)
1. Criar arquivo `supabase/migrations/YYYYMMDDHHMMSS_add_parcelamento_geospatial.sql`
2. Envelope `BEGIN; ... COMMIT;`
3. Aplicar via `mcp__supabase__apply_migration`
4. Rodar `mcp__supabase__get_advisors` (security + performance)
5. Resolver warnings se houver
6. Validar com `mcp__supabase__list_tables` que todas as 9 tabelas foram criadas

### Bloco 5 — Configurar secrets (15 min)
1. Marcelo confirma `OPENTOPO_API_KEY` está cadastrado nos secrets do Supabase
2. Marcelo cadastra `CONVERT_API_SECRET`
3. Marcelo cadastra `MAPBOX_PUBLIC_TOKEN`

### Bloco 6 — Commit + Documentação (15 min)
1. Conventional commit: `feat(parcelamento): add geospatial schema (PostGIS) — Fase 1A`
2. Co-Authored-By: Claude Opus 4.6 + Buchecha
3. Atualizar `MEMORY.md` com status pós-Fase 1A
4. Atualizar `parcelamento-solo-PRD-v0.2.md` marcando Fase 1A como ✅

**Tempo total estimado da sessão 117: ~2h30min**

---

## 6. Avisos e cuidados importantes

### Regras críticas (do CLAUDE.md, válidas em toda sessão)
- `.maybeSingle()` sempre (nunca `.single()`)
- `profiles.id ≠ auth.users.id` — sempre `.eq("user_id", userId)`
- DOMPurify para HTML de IA
- Conventional commits + Co-Authored-By
- Pair programming com Buchecha obrigatório antes de cada migration
- RLS PERMISSIVE antes de RESTRICTIVE (zero PERMISSIVE = tabela inacessível)
- Tenant isolation com `getAuthTenantId()` em toda query
- NUNCA hard-delete audit trails
- NUNCA migration sem `BEGIN; COMMIT;` envelope na Alternativa 4

### Decisão crítica de migration: Alternativa 4 (escolhida na sessão 115)
- **NÃO usar branches Supabase** (Marcelo descartou)
- Aplicar **direto na produção** com salvaguardas:
  - BEGIN; ... COMMIT; envelope
  - Backup conceitual via `list_tables` antes
  - Review com Buchecha **antes**
  - `get_advisors` **depois**
  - Rollback plan documentado

### Riscos identificados
- **PostGIS é pesado**: pode aumentar consumo de RAM do Supabase
- **Mapbox tem limite free**: 50k loads/mês, acima disso cobra $0,60/k
- **MapBiomas via Earth Engine**: requer OAuth Google Cloud, complexidade extra
- **SiCAR API instável**: serviço público brasileiro pode cair
- **DEM 30m vs 12.5m**: ALOS é melhor mas tem cobertura menor

---

## 7. Skills que serão usadas na próxima sessão (117)

- `engineering:architecture` — desenhar schema PostGIS
- `engineering:debug` — caso advisors retornem warnings
- `minimax-ai-assistant:minimax-pair-programming` — review SQL com Buchecha
- `real-estate` — validar conformidade com Lei 12.651/2012 e Lei 6.766/79
- `saas-product` — manter alinhamento com produto
- `engineering:deploy-checklist` — checklist pré-migration

---

## 8. Estado do TODO list ao final desta sessão

- ✅ Ler PRD v0.1 atual e documento de referência Lotelytics
- ✅ Mapear gaps entre PRD v0.1 e Lotelytics + diferenciais brasileiros
- ✅ Escrever PRD v0.2 ampliado
- ✅ Atualizar MEMORY.md com status do PRD v0.2
- ✅ Apresentar resumo executivo do PRD v0.2 a Marcelo + próximos passos
- ✅ Receber 5 confirmações finais de Marcelo
- ✅ Registrar decisões e plano completo (este arquivo)

---

## 9. Citação da decisão estratégica de Marcelo (verbatim)

> "Quero o caminho A + C. A mensuração de declividade, topografia do terreno, as linhas de influência (APP, Rodovias, Rios), isso é importantíssimo no projeto. Gostaria muito que isso fosse o mais próximo possível da referência."
>
> "Incluir desde já" (sobre diferenciais brasileiros)
>
> "1) De acordo com a aprovação geral / 2) Mapbox, igual Lotelytics / 3) PostGIS autorizado no supabase / 4) Estou confortável com o prazo de 28 semanas / 5) Vamos falar de preço mais adiante."
>
> "Registre isso, o plano todo e vamos iniciar a implementação em uma nova sessão."

— Marcelo Silva, 07/04/2026

---

**FIM DO CHECKPOINT DA SESSÃO 116**
**Próxima sessão (117) deve abrir lendo este arquivo primeiro.**
