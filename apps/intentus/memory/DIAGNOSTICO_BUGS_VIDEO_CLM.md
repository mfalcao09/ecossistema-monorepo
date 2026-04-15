# Diagnóstico de Bugs — Análise do Vídeo CLM
**Plataforma Intentus Real Estate**
**Data:** 07/03/2026
**Vídeo analisado:** Gravação de tela (3:12, 39 frames)
**Executor:** Claude (assistente IA)

---

## Resumo Executivo

Foram identificados **10 bugs** no vídeo, organizados em 3 categorias:

| Categoria | Qtd | Causa Raiz | Impacto |
|-----------|-----|-----------|---------|
| 🔴 Edge Functions com `verify_jwt: true` (erro 401) | 5 | Gateway Supabase bloqueia request sem header `apikey` | **5 funcionalidades de IA inoperantes** |
| 🟡 Edge Functions com erros de lógica (400/404) | 3 | Bugs no código das functions (já têm `verify_jwt: false`) | **Command Center com erros parciais** |
| 🟢 UI/UX | 2 | Consequência dos bugs acima | **Experiência degradada no Command Center** |

---

## Categoria 1: Edge Functions com `verify_jwt: true` (401)

> **Causa raiz única:** Estas 5 functions nunca foram corrigidas na sessão anterior. O frontend faz `fetch()` sem o header `apikey`, e o gateway do Supabase rejeita com 401 ANTES do código da function executar.
>
> **Correção:** Redeploy de cada function com `verify_jwt: false` (mesmo fix aplicado anteriormente no copilot, clm-contract-api, etc.)

### Bug #4 — `contract-draft-ai` (v5) → 401
- **Onde no vídeo:** Frame 20 (~100s)
- **O que acontece:** Ao clicar "Gerar Contrato com IA" no ContractDraftDialog, aparece toast: *"Erro ao gerar contrato: Edge Function returned a non-2xx status code"*
- **Página:** `/contratos` → Dialog "Geração de Contrato por IA"
- **Log Supabase:** `contract-draft-ai` retornando 401

### Bug #5 — `clm-ai-insights` (v5) → 401
- **Onde no vídeo:** Frames 13-14 (~65-70s)
- **O que acontece:** Ao clicar "Analisar com IA" no Dashboard CLM, aparece toast: *"Erro ao analisar com IA"*
- **Página:** `/contratos/analytics` → botão "Analisar com IA"
- **Log Supabase:** `clm-ai-insights` retornando 401

### Bug #6 — `pricing-ai` (v5) → 401
- **Onde no vídeo:** Frames 32-33 (~160-165s)
- **O que acontece:** Ao usar "IA de Precificação de Aluguel" na página de Renovações, aparece toast: *"Erro na análise de precificação: Edge Function returned a non-2xx status code"*
- **Página:** `/renovacoes` → Modal "IA de Precificação de Aluguel"
- **Log Supabase:** `pricing-ai` retornando 401

### Bug #7 — `parse-contract-ai` (v4) → 401
- **Onde no vídeo:** Frames 22-23 (~110-115s)
- **O que acontece:** Ao usar "Importar Contrato com IA", mostra spinner "Processando com IA..." e depois falha silenciosamente
- **Página:** `/contratos` → Modal "Importar Contrato com IA"
- **Log Supabase:** `parse-contract-ai` retornando 401

### Bug #8 — `extract-clauses-ai` (v4) → 401
- **Onde no vídeo:** Frames 38-39 (~190-192s)
- **O que acontece:** Ao clicar "Gerar com IA" na Biblioteca de Cláusulas, mostra spinner e depois toast: *"Edge Function returned a non-2xx status code"*
- **Página:** `/contratos/clausulas` → Modal "Gerar Cláusulas com IA"
- **Log Supabase:** `extract-clauses-ai` retornando 401

---

## Categoria 2: Edge Functions com Erros de Lógica (400/404)

> **Contexto:** Estas 3 functions JÁ foram corrigidas com `verify_jwt: false` na sessão anterior, mas os logs mostram que retornam 400 ou 404 — indicando bugs na lógica interna do código.
>
> **Correção:** Será necessário ler o código de cada function, identificar o bug de lógica, corrigir e redeployar.

### Bug #9 — `clm-contract-api` (v3) → 404
- **Onde no vídeo:** Frames 9-10 (~45-50s) — contribui para o erro do Command Center
- **O que acontece:** API retorna 404 (Not Found) para certas rotas/endpoints
- **Impacto:** Command Center não consegue carregar dados de contratos em certas consultas
- **Log Supabase:** Múltiplas requisições retornando 404

### Bug #10 — `clm-approvals-api` (v3) → 400
- **Onde no vídeo:** Frames 9-10 (~45-50s) — contribui para o erro do Command Center
- **O que acontece:** API retorna 400 (Bad Request) — provável validação de parâmetros falhando
- **Impacto:** Dados de aprovações podem não carregar corretamente
- **Log Supabase:** Requisições retornando 400

### Bug #11 — `clm-obligations-api` (v3) → 400
- **Onde no vídeo:** Frames 9-10 (~45-50s) — contribui para o erro do Command Center
- **O que acontece:** API retorna 400 (Bad Request)
- **Impacto:** Dados de obrigações podem não carregar corretamente
- **Log Supabase:** Requisições retornando 400

---

## Categoria 3: UI/UX (Consequência)

### Bug #12 — Command Center: Flicker ao Atualizar
- **Onde no vídeo:** Frames 2-3 (~10-15s)
- **O que acontece:** Ao clicar "Atualizar", todos os componentes entram em skeleton loading e depois recarregam — os dados eventualmente aparecem, mas a experiência é abrupta
- **Causa:** Invalidação completa do cache do React Query ao clicar "Atualizar"
- **Severidade:** Baixa (cosmético)

### Bug #13 — Command Center: Banner de Erro Vermelho
- **Onde no vídeo:** Frames 9-10 (~45-50s)
- **O que acontece:** Aparece banner vermelho: *"Erro ao carregar dados do CLM. Verifique se as Edge Functions estão ativas."*
- **Causa:** Consequência direta dos Bugs #9, #10 e #11 (functions retornando 400/404)
- **Severidade:** Alta (mas é SINTOMA, não causa raiz)

---

## Status Atual de TODAS as Edge Functions

| # | Edge Function | Versão | `verify_jwt` | Status HTTP | Situação |
|---|-------------|--------|-------------|-------------|----------|
| 1 | `copilot` | v9 | `false` ✅ | 200 ✅ | **Funcionando** |
| 2 | `unified-alerts` | v4 | `false` ✅ | 200 ✅ | **Funcionando** |
| 3 | `clm-contract-api` | v3 | `false` ✅ | 404 ❌ | **Bug de lógica** |
| 4 | `clm-approvals-api` | v3 | `false` ✅ | 400 ❌ | **Bug de lógica** |
| 5 | `clm-obligations-api` | v3 | `false` ✅ | 400 ❌ | **Bug de lógica** |
| 6 | `contract-draft-ai` | v5 | `true` ❌ | 401 ❌ | **Precisa redeploy** |
| 7 | `clm-ai-insights` | v5 | `true` ❌ | 401 ❌ | **Precisa redeploy** |
| 8 | `pricing-ai` | v5 | `true` ❌ | 401 ❌ | **Precisa redeploy** |
| 9 | `parse-contract-ai` | v4 | `true` ❌ | 401 ❌ | **Precisa redeploy** |
| 10 | `extract-clauses-ai` | v4 | `true` ❌ | 401 ❌ | **Precisa redeploy** |

---

## Funcionalidades que ESTÃO funcionando (confirmado no vídeo)

- ✅ Dashboard CLM / Analytics — KPIs, gráficos, dados
- ✅ Copilot IA — respondendo perguntas (v9)
- ✅ Listagem de Contratos — tabela com dados reais
- ✅ Modal de Detalhes do Contrato — todas as 9 abas
- ✅ Novo Contrato (cadastro manual) — modal funcional
- ✅ Rescisões — página e alertas funcionando
- ✅ Renovações — listagem e alertas funcionando
- ✅ Reajustes — página e modal funcionando
- ✅ Minutário — 7 minutas cadastradas, botões funcionais
- ✅ Biblioteca de Cláusulas — listagem e UI funcionando
- ✅ Formulário de Edição de Contrato — campos e botões operacionais

---

## ⚠️ Pendência Permanente: Integração Clicksign (Assinatura Digital)
> Aba "Assinaturas" no modal de contrato já está preparada, aguardando configuração da integração.

---

*Documento gerado automaticamente por Claude a partir da análise frame-a-frame do vídeo de teste.*
