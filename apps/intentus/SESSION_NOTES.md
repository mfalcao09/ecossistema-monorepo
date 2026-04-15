# Intentus Platform — Notas das Sessões Cowork
**Última atualização**: 2026-03-08 (Sessão 3 + Continuações 1-2)

---

## Sessão 1 — Correção do PricingAI (Data Shape Mismatch)

### Problema
O PricingAI causava **tela branca** (white screen crash) ao abrir a rota `/renovacoes`. O frontend esperava um formato de dados diferente do que a Edge Function v22 retornava.

### Causa Raiz
- **Edge Function v22** retorna: `{ success, stats: { suggested_value, ... }, ai_analysis, ... }`
- **Frontend (`usePricingAI.ts`)** esperava: `{ recommended_value, ... }` (formato antigo Lovable)
- Incompatibilidade de tipos causava crash sem erro visível

### Correções Realizadas

#### 1. `src/hooks/usePricingAI.ts`
- Criada função `mapEdgeFunctionResponse()` que converte o formato da Edge Function para o formato esperado pelo dialog
- Mapeamentos principais:
  - `stats.suggested_value` → `recommended_value`
  - `stats.confidence` → `confidence`
  - `stats.price_range` → `price_range`
  - `ai_analysis` → `ai_analysis`
  - Valores numéricos convertidos com `Number()` para evitar NaN

#### 2. `src/components/contracts/PricingAIDialog.tsx`
- Adicionado `PricingErrorBoundary` (React Error Boundary) para capturar crashes
- Em vez de tela branca, exibe mensagem amigável com botão "Tentar novamente"
- Adicionadas verificações de null/undefined em todos os campos exibidos

#### 3. `supabase/functions/pricing-ai/index.ts` (repo)
- Substituído o conteúdo antigo (174 linhas, versão Lovable) por um stub/referência documentando a interface da v22
- Código real vive no Supabase e é deployado via MCP

### Resultado
✅ PricingAI funcional — scraping via Apify, análise via GPT-4o-mini, resultado exibido corretamente no dialog

---

## Sessão 2 — Exibir Links dos Anúncios Comparáveis (v23)

### Objetivo
Permitir que o cliente **audite os comparáveis** clicando nos anúncios originais (VivaReal, ZapImóveis, OLX, QuintoAndar).

### Descoberta
Os dados já existiam no banco (`market_evaluations.market_results.top_comparables` com campo `url`), mas a Edge Function v22 **não retornava** os comparáveis individuais no response.

### Alterações Realizadas

#### 1. Edge Function `pricing-ai` v22 → v23
**Deploy**: Via Supabase MCP (`deploy_edge_function`)
- Adicionado `top_comparables` ao JSON de response no bloco `action === 'analyze'`:
```typescript
top_comparables: bestComparables.map(c => ({
  title: c.title, price: c.price, area: c.area,
  pricePerSqm: c.pricePerSqm, neighborhood: c.neighborhood,
  city: c.city, bedrooms: c.bedrooms, bathrooms: c.bathrooms,
  parkingSpaces: c.parkingSpaces, source: c.source, url: c.url,
})),
```
- Logs atualizados de "v22" para "v23"
- Deploy confirmado: `"version": 23, "status": "ACTIVE"`

#### 2. `src/hooks/usePricingAI.ts`
- Nova interface `ComparableItem`:
```typescript
export interface ComparableItem {
  title: string;
  price: number;
  area: number;
  pricePerSqm: number;
  neighborhood: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  source: string;
  url: string;
}
```
- Campo `top_comparables?: ComparableItem[]` adicionado à interface `PricingRecommendation`
- Em `mapEdgeFunctionResponse()`:
```typescript
top_comparables: Array.isArray(data.top_comparables) ? data.top_comparables : [],
```

#### 3. `src/components/contracts/PricingAIDialog.tsx`
- Novos imports: `ExternalLink, ChevronDown, ChevronUp, Home` (lucide-react)
- Mapa de cores por fonte:
```typescript
const sourceColors = {
  vivareal: { bg: "bg-purple-100", text: "text-purple-800" },
  zapimoveis: { bg: "bg-blue-100", text: "text-blue-800" },
  olx: { bg: "bg-orange-100", text: "text-orange-800" },
  quintoandar: { bg: "bg-pink-100", text: "text-pink-800" },
};
```
- Estado `showComparables` com reset no `handleOpen`
- Seção colapsável "Imóveis Comparáveis Utilizados" entre "Análise Detalhada" e "Stats summary"
- Cada card mostra: título, preço, área, R$/m², bairro, badge colorido da fonte, botão "Ver anúncio"

#### 4. `supabase/functions/pricing-ai/index.ts` (repo)
- Atualizado stub para referenciar v23

### Verificação
✅ `npx tsc --noEmit` — sem erros TypeScript
✅ `npm run build` — build concluído em 20.80s
✅ Edge Function v23 deployada e ativa

---

## Sessão 3 — Correção de 4 Bugs no CLM (2026-03-08)

### Bugs Reportados

#### Bug 1: parse-contract-ai — "Erro ao processar com IA" ✅ RESOLVIDO
- **Sintoma**: Dialog "Importar Contrato com IA" mostra "Erro ao processar" ao enviar PDF
- **Causa Raiz**: Edge Function v5 retornava HTTP 200 para TODOS os responses (inclusive erros), e quando `callGemini()` falhava (ex: API key expirada, rate limit, erro do OpenRouter), o erro real era engolido — a mensagem genérica "Erro ao processar com IA" era retornada sem nenhum detalhe da causa
- **Solução (v6)**:
  - Validação de texto mínimo (50 chars) para detectar PDFs escaneados
  - Logging do provider de API (OpenRouter vs Google) e modelo usado
  - Verificação de API keys ausentes antes de chamar
  - **Error handling detalhado**: lê o body do erro do `callGemini()` e propaga mensagens específicas (429=rate limit, 402=créditos, 401/403=key inválida)
  - Detecção de content filter (SAFETY/BLOCKED) com mensagem clara
  - Detecção de text response vs function call
  - Logging de sucesso com timing
- **Edge Function**: `parse-contract-ai` v5 → v6 (deploy via Supabase MCP)
- **Frontend**: `AIContractImportDialog.tsx` — melhorado error handling para exibir mensagens detalhadas da v6

#### Bug 2: Dashboard CLM — Análise IA renderizada inline ✅ RESOLVIDO
- **Problema**: Resultado da análise IA aparecia no rodapé como `<pre>` (texto corrido, sem formatação)
- **Solução**: Substituído por Dialog com ReactMarkdown + ScrollArea
- **Arquivo**: `src/pages/ContractAnalytics.tsx`

#### Bug 3: Copilot IA — Renomear + Scroll ✅ RESOLVIDO
- **Problema**: Nome "Copilot IA" deveria ser "Analista Intentus - IA"; scroll não funcionava para respostas longas
- **Solução**: Renomeado em 3 locais; scroll fixado acessando viewport interno do Radix ScrollArea (`[data-radix-scroll-area-viewport]`); largura bolhas assistente 270→310px
- **Arquivo**: `src/components/AICopilot.tsx`

#### Bug 4: Botão superior Precificação IA em Renovações ✅ RESOLVIDO
- **Problema**: Botão passava `null` como contrato, causando erro
- **Solução**: Removido o botão superior (botões por contrato continuam funcionando)
- **Arquivo**: `src/components/contracts/ContractRenewalTab.tsx`

### Arquivos Modificados (Sessão 3)

#### Commit 1 (Bugs 2, 3, 4)
- `src/components/AICopilot.tsx` — Rename + scroll fix + largura bolhas
- `src/components/contracts/ContractRenewalTab.tsx` — Removido botão superior Precificação IA
- `src/pages/ContractAnalytics.tsx` — Dialog com ReactMarkdown para análise IA
- **Summary**: `fix: corrige 3 bugs no CLM — copilot, análise IA e precificação`

#### Commit 2 (Bug 1 — parse-contract-ai v6)
- `src/components/contracts/AIContractImportDialog.tsx` — Melhorado error handling (console.error + mensagens diretas da v6)
- `supabase/functions/parse-contract-ai/index.ts` — Stub atualizado para v6
- **Summary**: `fix: parse-contract-ai v6 — error handling detalhado para importação de contratos`

### Edge Functions Relevantes
- `parse-contract-ai` v5 → **v6** — Importação de contratos com error handling detalhado
- `copilot` v9 — Chat IA (Analista Intentus)
- `clm-ai-insights` v6 — Análise IA do Dashboard CLM
- `pricing-ai` v23 — Precificação IA

---

## Continuação 1 — pricing-ai v24 (Timeout + Filtro de Área)

### Problema
O PricingAI falhava com timeout porque o Apify actor leva ~45-50s para scraping, e a Edge Function tinha `MAX_POLL_TIME_MS = 45000` (45s), insuficiente. Além disso, o filtro de área era muito restritivo (±50%), descartando comparáveis válidos em mercados com pouca oferta.

### Alterações Realizadas

#### 1. Edge Function `pricing-ai` v23 → v24
**Deploy**: Via Supabase MCP (`deploy_edge_function`)
- **Timeout interno**: `MAX_POLL_TIME_MS` de 45.000ms → **180.000ms** (3 minutos)
- **Filtro de área**: De `area * 0.5` até `area * 1.5` (±50%) → `area * 0.3` até `area * 1.7` (±70%)
- Logs atualizados para "v24"

#### 2. `src/hooks/usePricingAI.ts`
- **Frontend timeout**: `PRICING_AI_TIMEOUT_MS` de 120.000ms → **200.000ms** (200s)

#### 3. `supabase/functions/pricing-ai/index.ts` (repo)
- Stub atualizado para referenciar v24

### Resultado
✅ Edge Function v24 deployada e ativa
✅ Frontend com timeout compatível (200s > 180s da Edge Function)

---

## Continuação 2 — parse-contract-ai v7 (Fix Schema `nullable`)

### Problema
O "Importar Contrato com IA" retornava **erro 400** do OpenRouter/Google:
```
"Provider returned error", code: 400
"The specified schema produ..."  (schema validation error)
```

### Causa Raiz
O campo `inspection_data` no schema de function calling tinha `nullable: true`, que é uma propriedade **específica da API Gemini**. O fluxo era:

1. Schema definido com `nullable: true` (formato Gemini) em `index.ts`
2. `convertSchema()` em `resolve-persona.ts` copiava `nullable` para o formato OpenAI
3. Schema enviado ao **OpenRouter** (formato OpenAI com `nullable` inválido)
4. OpenRouter convertia de volta para formato Google
5. Google **rejeitava** o schema com erro 400

O `nullable` não é uma propriedade válida no JSON Schema padrão (formato OpenAI) — é específico da API Gemini nativa.

### Alterações Realizadas

#### 1. Edge Function `parse-contract-ai` v6 → v7
**Deploy**: Via Supabase MCP (`deploy_edge_function`)

**Arquivo `index.ts`**:
- Removido `nullable: true` do campo `inspection_data`:
```typescript
// Antes (v6):
inspection_data: { type: "OBJECT", nullable: true, properties: { ... } }
// Depois (v7):
inspection_data: { type: "OBJECT", properties: { ... } }
```

**Arquivo `_shared/resolve-persona.ts`**:
- Removido tratamento de `nullable` da função `convertSchema()`:
```typescript
// Removida esta linha:
if (schema.nullable) out.nullable = schema.nullable;
```

#### 2. `supabase/functions/parse-contract-ai/index.ts` (repo)
- Stub atualizado de v6 para v7 com changelog documentando o fix

### Resultado
✅ Edge Function v7 deployada e ativa
✅ TypeScript check sem erros
✅ Schema agora compatível com pipeline OpenRouter → Google

---

## Tabela de Erros Atualizada (Todas as Sessões)

| # | Erro | Causa | Solução | Sessão |
|---|------|-------|---------|--------|
| 1 | Tela branca em `/renovacoes` | Data shape mismatch (Edge vs Frontend) | `mapEdgeFunctionResponse()` adapter | S1 |
| 2 | Crash silencioso no PricingAIDialog | Acesso a propriedades undefined | `PricingErrorBoundary` + null checks | S1 |
| 3 | Git author identity not configured | Git não configurado no VM | Fornecido summary/description para GitHub Desktop | S1 |
| 4 | `.git/index.lock` | Lock file residual | Removido manualmente | S1 |
| 5 | Repo com código Lovable desatualizado | Código do repo não correspondia ao deployado | Substituído por stub/referência | S1 |
| 6 | "Erro ao processar com IA" genérico | parse-contract-ai v5 sem error handling | v6: mensagens detalhadas, logging, validação | S3 |
| 7 | Análise IA renderizada como `<pre>` | Faltava formatação no Dashboard CLM | Dialog com ReactMarkdown + ScrollArea | S3 |
| 8 | Copilot nome/scroll incorretos | Nome errado, scroll não funcionava | Rename + scroll fix via Radix viewport | S3 |
| 9 | Botão superior Precificação IA | Passava `null` como contrato | Removido botão superior | S3 |
| 10 | PricingAI timeout | `MAX_POLL_TIME_MS` = 45s (insuficiente) | v24: 180s interno, 200s frontend | C1 |
| 11 | Filtro de área muito restritivo | ±50% descartava comparáveis válidos | v24: ±70% (0.3x a 1.7x) | C1 |
| 12 | parse-contract-ai erro 400 schema | `nullable: true` incompatível com OpenAI/OpenRouter | v7: removido nullable do schema e do convertSchema | C2 |

---

## Arquivos Modificados (Todas as Sessões — Atualizado)

### Frontend
- `src/hooks/usePricingAI.ts` — adapter + ComparableItem + top_comparables + timeout 200s
- `src/components/contracts/PricingAIDialog.tsx` — ErrorBoundary + seção comparáveis
- `src/components/contracts/AIContractImportDialog.tsx` — Error handling detalhado
- `src/components/AICopilot.tsx` — Rename + scroll fix + largura bolhas
- `src/components/contracts/ContractRenewalTab.tsx` — Removido botão superior Precificação IA
- `src/pages/ContractAnalytics.tsx` — Dialog com ReactMarkdown para análise IA

### Backend (Supabase Edge Functions)
- `pricing-ai` v22 → v23 → **v24** (deploy via Supabase MCP)
- `parse-contract-ai` v5 → v6 → **v7** (deploy via Supabase MCP)

### Documentação
- `CLAUDE.md` — Notas do projeto
- `SESSION_NOTES.md` — Este arquivo

### Repo Sync
- `supabase/functions/pricing-ai/index.ts` — stub/referência v24
- `supabase/functions/parse-contract-ai/index.ts` — stub/referência v7

---

## Informações Técnicas Importantes (Atualizado)

### Supabase
- **Project ID**: `bvryaopfjiyxjgsuhjsb`
- **Edge Functions**: 15 no total
- **pricing-ai verify_jwt**: `false` (acesso público)
- **parse-contract-ai verify_jwt**: `false`

### Apify
- **Actor ID**: `f1xSvpkpklEh2EhGJ`
- **Tempo de scraping**: ~45-50 segundos
- **Frontend timeout**: 200 segundos (atualizado de 120s)
- **Edge Function timeout**: 180 segundos (atualizado de 45s)

### AI Providers
- **pricing-ai**: OpenAI GPT-4o-mini (análise de mercado)
- **parse-contract-ai**: Google Gemini via OpenRouter (function calling para extração de contratos)
- **Roteamento**: `resolve-persona.ts` (shared) — OpenRouter (preferido) ou Google API direta
- **Schema conversion**: Gemini format → `convertSchema()` → OpenAI format (sem `nullable`)

### Tiered Comparison System
- **Tier 0**: Mesmo bairro
- **Tier 1**: Mesma cidade
- **Tier 2**: Mesmo estado
- **Filtro de área**: ±70% (0.3x a 1.7x da área do imóvel)

### Tabelas Supabase Relevantes
- `market_listings` — Listings scrapados com campo `url`
- `market_evaluations` — Resultados com `market_results` JSON (inclui `top_comparables` e `scraping_summary`)
- `ai_prompts` — Configuração de prompts por function_key (ex: `contract_parser`)

### Dados de Demo
- UUIDs padrão: `a0000000-*` (propriedades), `c0000000-*` (contratos)

### Versões Atuais das Edge Functions Principais
| Edge Function | Versão | Descrição |
|---------------|--------|-----------|
| pricing-ai | **v24** | Precificação IA (Apify + GPT-4o-mini) |
| parse-contract-ai | **v7** | Importação de contratos com IA (Gemini via OpenRouter) |
| copilot | v9 | Chat IA (Analista Intentus) |
| clm-ai-insights | v6 | Análise IA do Dashboard CLM |

### Commits Pendentes
- **Summary**: `fix: parse-contract-ai v7 — remove nullable incompatível com OpenRouter`
- **Description**:
  ```
  parse-contract-ai v7:
  - Remove nullable: true do inspection_data (incompatível com formato OpenAI)
  - Remove tratamento de nullable no convertSchema (resolve-persona.ts)
  - nullable é específico da API Gemini e causava rejeição 400 quando
    o schema era convertido para formato OpenAI via OpenRouter

  pricing-ai v24 (sessão anterior):
  - Timeout interno: 45s → 180s
  - Filtro de área: ±50% → ±70%
  - Frontend timeout: 120s → 200s
  ```
