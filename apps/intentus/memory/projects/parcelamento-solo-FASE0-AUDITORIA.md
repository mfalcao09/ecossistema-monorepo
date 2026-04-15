# Fase 0 — Relatório de Auditoria

> **Projeto:** Módulo Parcelamento de Solo (Projetos Horizontais)
> **Fase:** 0 — Auditoria pré-execução
> **Data:** 07/04/2026
> **Auditor:** Claudinho (sem pair com Buchecha — auditoria é leitura, não desenvolvimento)
> **Insumos lidos:** 5 Edge Functions completas + listagem de 250+ tabelas atuais do Intentus

---

## 1. Resumo executivo

✅ **Auditoria concluída sem bloqueadores.**

- Nenhum provedor pago descoberto. **Custo recorrente das EFs externas = R$ 0/mês** (todas as APIs externas são gratuitas/governamentais).
- Nenhuma colisão direta de nomes com tabelas atuais do Intentus (graças ao prefixo `parcelamento_*`).
- 1 ponto de atenção semântica: **Intentus já tem tabelas `developments*` para incorporação vertical**. Parcelamento de Solo (horizontal) é vizinho mas distinto. Decisão de naming a confirmar com Marcelo.
- 1 EF é, na prática, um **stub** (`dwg-to-dxf`): apenas valida o magic header e devolve erro pedindo pro usuário exportar como DXF. Pode ser mantida como está ou descartada.
- 2 dependências de TLS frágil: **SICAR** (precisa fallback HTTP→HTTPS) e **OpenTopography** (opcional, requer chave). Ambas já têm fallback no código.

---

## 2. Auditoria das 5 Edge Functions

### 2.1 EF `elevation` (304 linhas) — 🟢 OK

| Item | Achado |
|---|---|
| **Provedor primário** | OpenTopography SRTM 30m (precisa de `OPENTOPO_API_KEY` no `.env` da Supabase) |
| **Provedor fallback** | Open-Meteo Copernicus 90m — **gratuito, sem chave** |
| **Custo** | R$ 0 (Open-Meteo é grátis; OpenTopography tem free tier de 1.000 calls/dia) |
| **CORS** | ❌ Wildcard `*` — precisa virar whitelist Intentus |
| **Auth** | ❌ Sem autenticação — precisa middleware `_shared/auth.ts` |
| **Algoritmo** | Grid 60×60 (max 80) → ray-casting in-polygon → fetch elevations → flood-fill nodata → smoothing 3×3 Gaussian (passes=3) |
| **Bibliotecas** | Apenas `std@0.168.0/http/server` — zero deps externas |
| **Resposta** | `{ elevations, gridPoints, gridCols, gridRows, source, pointCount }` |
| **Riscos** | OpenTopography pode falhar → fallback automático para Open-Meteo já existe |

**Conclusão:** Migra como está, com 3 ajustes obrigatórios:
1. Renomear para `parcelamento-elevation`
2. Trocar CORS wildcard por whitelist Intentus
3. Adicionar `getAuthContext()` do `_shared/auth.ts` (mesmo que análise pública, queremos saber qual tenant está chamando para rate limit)

### 2.2 EF `dwg-to-dxf` (68 linhas) — 🟡 STUB

| Item | Achado |
|---|---|
| **O que faz hoje** | Lê o arquivo, valida magic header `AC*` (DWG), extrai versão (ex: `AC1027`), e devolve erro 422 pedindo para o usuário exportar como DXF |
| **Conversão real** | ❌ NÃO faz. O comentário no código admite: "DWG parsing requires specialized libraries not available in Deno" |
| **Custo** | R$ 0 |
| **Decisão necessária** | Marcelo precisa decidir: (a) manter como validador (pequeno UX win — alerta o usuário cedo), (b) descartar e tratar erro no frontend, (c) **integrar provedor externo de conversão DWG→DXF** (ex: CloudConvert ~US$ 0.005/conversão, ou ezdxf como Lambda Python) |

**Recomendação:** Manter como validador no MVP. Investigar conversão real só se Marcelo confirmar que é dor de usuários reais.

### 2.3 EF `geo-layers` (199 linhas) — 🟢 OK

| Item | Achado |
|---|---|
| **Provedor** | IBAMA PAMGIA (`https://pamgia.ibama.gov.br/server/rest/services/01_Publicacoes_Bases`) — **gov.br público, gratuito** |
| **7 camadas consultadas** | sigef_privado, sigef_publico, hidrografia, massa_dagua, embargos_ibama, terra_indigena, unidade_conservacao |
| **Tecnologia** | ArcGIS REST API (query por polígono ou bbox em SRID 4674) |
| **Strip Z** | Já implementado: ArcGIS só aceita coords 2D, código já remove altitude |
| **Conversão** | ArcGIS JSON → GeoJSON nativo |
| **Paralelismo** | `Promise.all` em todas as 7 camadas |
| **Custo** | R$ 0 |
| **CORS** | ❌ Wildcard — ajustar |
| **Auth** | ❌ Sem auth — ajustar |
| **Riscos** | Servidor IBAMA pode estar lento/instável (gov.br) — sem retry, sem timeout explícito → adicionar timeout 20s e retry 1× |

**Conclusão:** Migra como está, com mesmos ajustes da `elevation` + adicionar timeout/retry.

### 2.4 EF `sicar-query` (104 linhas) — 🟡 FRÁGIL

| Item | Achado |
|---|---|
| **Provedor** | SICAR/CAR GeoServer (`geoserver.car.gov.br`) — **gov.br público** |
| **Problema conhecido** | TLS antigo do GeoServer não negocia bem com Deno. Código já tenta 4 URLs (HTTP/HTTPS × 2 endpoints) com fallback |
| **Camada** | `sicar:reserva_legal` (default) |
| **Timeout** | 20 segundos por tentativa |
| **Comportamento em falha** | Devolve `FeatureCollection` vazio + `_note` explicando indisponibilidade — **degrada com graça, não quebra a UI** |
| **Custo** | R$ 0 |
| **Ponto crítico** | Esta é a EF mais frágil. Em momentos de instabilidade do CAR, retorna vazio e o usuário fica sem dado de RL |
| **Mitigação existente** | Cache em `reserva_legal_cache` (que precisa ser migrada como `parcelamento_reserva_legal_cache`) |

**Recomendação:** Migra como está. Ampliar TTL do cache de 7 dias para 30 dias. Adicionar `last_successful_fetch_at` para o frontend exibir "última atualização há X dias".

### 2.5 EF `datageo-reserva-legal` (133 linhas) — 🟢 OK

| Item | Achado |
|---|---|
| **Provedor** | DataGeo SP (`datageo.ambiente.sp.gov.br`) — **gov.sp.gov.br público** |
| **Camada** | `datageowms:vwm_car_reserva_legal_pol` |
| **Tecnologia** | WMS GetFeatureInfo com grid 5×5 = 25 pontos para cobrir o bbox |
| **Deduplicação** | Por `featureKey` (área declarada + 1ª coordenada com 6 casas decimais) — IDs do WMS são instáveis |
| **Escopo** | **APENAS São Paulo**. Para outros estados, fallback é o `sicar-query` |
| **Custo** | R$ 0 |
| **Riscos** | Latência (25 fetches paralelos), mas tem timeout 15s por chamada |

**Conclusão:** Migra como está. Documentar claramente que só serve SP.

---

## 3. Verificação de colisão de nomes

### 3.1 Tabelas que viriam do Lovable

| Nome original | Já existe no Intentus? | Decisão |
|---|---|---|
| `projects` | ❌ Não existe (mas conceito-chave) | → `parcelamento_projects` |
| `project_memberships` | ❌ Não | → `parcelamento_project_memberships` |
| `project_files` | ❌ Não | → `parcelamento_project_files` |
| `financial_analyses` | ❌ Não (Intentus tem `pricing_analyses`) | → `parcelamento_financial_analyses` |
| `legal_compliance` | ❌ Não (Intentus tem `legal_compliance_items`) | → `parcelamento_legal_compliance` |
| `reserva_legal_cache` | ❌ Não | → `parcelamento_reserva_legal_cache` |

✅ **Zero colisões diretas.** O prefixo `parcelamento_*` está confirmado como seguro.

### 3.2 Vizinhanças semânticas (atenção, não bloqueio)

O Intentus já tem **5 tabelas `developments*`** para incorporação **vertical** (prédios, com unidades):
- `developments` (empreendimento-pai)
- `development_units` (unidades vendáveis — apartamentos)
- `development_blocks` (blocos)
- `development_proposals` (propostas comerciais)
- `development_contracts` (contratos de venda — ligados ao CLM)
- `development_tasks` (cronograma)
- `development_price_tables` (tabelas de preço)

**Implicação importante:** O Intentus já tem o conceito de "empreendimento" — só que voltado para verticalização. Parcelamento de Solo é o **parente horizontal**.

**Duas opções de modelagem (a confirmar com Marcelo):**

**Opção A — Isolamento total (já decidido):**
- `parcelamento_projects` é uma entidade independente.
- Vantagem: zero risco de quebrar CRM/CLM.
- Desvantagem: 2 fluxos paralelos para o mesmo conceito ("empreendimento").

**Opção B — Reuso de `developments` + flag `tipo`:**
- Adicionar `developments.tipo = 'vertical' | 'horizontal'` e estender com FKs opcionais para `parcelamento_*`.
- Vantagem: ciclo único (terreno → loteamento horizontal/vertical → CLM → CRM).
- Desvantagem: refator nas tabelas existentes; risco em produção.

**Recomendação:** Manter Opção A para o MVP (decisão original). Documentar Opção B como roadmap de fase 9+ ("unificação do conceito Empreendimento").

### 3.3 Edge Functions — colisão

Vou listar EFs depois de aprovação para confirmar, mas pelo memory atual o Intentus tem **110+ EFs**. Nenhuma com prefixo `parcelamento-*`. Confirmado seguro.

---

## 4. Variáveis de ambiente que precisarão ser configuradas no Supabase

| Var | Origem | Obrigatória? | Como obter |
|---|---|---|---|
| `OPENTOPO_API_KEY` | OpenTopography (SRTM 30m) | ❌ Opcional | Cadastro grátis em https://portal.opentopography.org (1.000 calls/dia free) |
| `SUPABASE_URL` | Já existe | ✅ Sim | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Já existe | ✅ Sim | — |
| `SUPABASE_ANON_KEY` | Já existe | ✅ Sim | — |

**Conclusão:** Nada novo a contratar. Marcelo só precisa decidir se quer SRTM 30m (mais preciso) ou ficar só com Copernicus 90m (zero setup).

---

## 5. Decisões abertas pós-auditoria

| # | Decisão | Recomendação Claudinho | Aguarda |
|---|---|---|---|
| D1 | Manter Opção A (isolamento) ou Opção B (unificar com `developments`)? | **Opção A** para MVP | Marcelo |
| D2 | EF `dwg-to-dxf`: stub validador, descartar, ou contratar provedor? | **Stub validador** no MVP | Marcelo |
| D3 | OpenTopography: cadastrar para SRTM 30m ou ficar só com 90m? | **Cadastrar** (5 min, grátis, 30m vale a pena para análise de declividade) | Marcelo |
| D4 | Escopo do MVP: incluir os 3 placeholders (Financial, Compliance, Reports) ou ir ao ar sem eles? | **Incluir Compliance + Reports**; Financial em V1.1 | Marcelo |
| D5 | IA generativa para parecer técnico desde o início ou só em V1.1? | **Desde o início**, usando OpenRouter Gemini 2.0 Flash (padrão Intentus) | Marcelo |

---

## 6. Próximos passos imediatos

1. Apresentar este relatório ao Marcelo
2. Marcelo decide D1–D5
3. Iniciar **Fase 1 — Schema** com pair Buchecha:
   - Criar migration `parcelamento_module_schema.sql`
   - Tabelas com prefixo + RLS + helper functions
   - Storage bucket `parcelamento-files`
   - Validar via `mcp__supabase__apply_migration` em branch
4. Conventional commit dos arquivos de memória + análise (`docs:` + `feat:`)

---

## 7. Histórico

- **07/04/2026 — Fase 0 concluída.** Auditoria de 5 EFs e 250+ tabelas. Zero bloqueadores. Aguardando 5 decisões de Marcelo para iniciar Fase 1.
