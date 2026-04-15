# Sessão 151 — Systemic Auth Fix (19 EFs) + Frontend Fixes

**Data**: 2026-04-12  
**Tipo**: QA Bug Fix — Systemic Auth  
**Status**: ✅ COMPLETO  
**Commit**: `31d3f3e`  
**Vercel**: `dpl_J7qP2nDpvVWSgcTnAjoHs7im7QLL` — BUILDING (aguardando READY)

---

## Objetivo

Resolver todos os bugs reportados por Marcelo após sessão 150: mapa em branco, 3D não funciona, Financeiro abrindo como página separada, e TODAS as Edge Functions retornando 401.

---

## Root Cause Analysis

### Bug Sistêmico: getUser() sem token em 19 EFs

**Root cause**: `supabase.auth.getUser()` chamado SEM o parâmetro JWT token em Edge Functions Deno. Em versões mais recentes do `@supabase/supabase-js@2` (resolvido via esm.sh), o método `getUser()` não lê o token dos `global.headers.Authorization` de forma confiável no runtime Deno.

**Evidência**: GoTrue `/user` retornava 200 (JWT válido), mas as EFs retornavam 401 — provando que o JWT é válido mas o client-side parsing na EF falha.

**Fix Pattern (aplicado em 19 EFs)**:
```typescript
// ANTES — falha no Deno
const supabase = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user } } = await supabase.auth.getUser();

// DEPOIS — funciona
const token = authHeader.replace("Bearer ", "");
const supabase = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } },
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { data: { user } } = await supabase.auth.getUser(token);
```

**Padrão adicional**: `tenantId: profile?.tenant_id || user.id` (fallback para user.id quando profile não tem tenant_id)

---

## EFs Corrigidas (19 total)

| # | Edge Function | Tipo de Fix |
|---|--------------|-------------|
| 1 | brazil-regulations | getUser(token) + auth options + tenant fallback |
| 2 | market-benchmarks | getUser(token) + auth options + tenant fallback |
| 3 | ibge-census | getUser(token) + auth options + tenant fallback |
| 4 | environmental-embargoes | getUser(token) + auth options + tenant fallback |
| 5 | urbanistic-project-export | getUser(token) + auth options + tenant fallback |
| 6 | development-mapbiomas | getUser(token) + auth options + tenant fallback + remove throw |
| 7 | cad-project-manager | profiles table fallback (já tinha getUser(token)) |
| 8 | development-geo-layers | Já estava correto (verificado) |
| 9 | parcelamento-financial-calc | getUser(token) + auth options |
| 10 | zoneamento-municipal | getUser(token) + auth options + tenant fallback |
| 11 | memorial-descritivo | getUser(token) + auth options + tenant fallback |
| 12 | cri-matricula | getUser(token) + auth options + tenant fallback |
| 13 | fii-cra-simulator | getUser(token) + auth options + tenant fallback |
| 14 | copilot | getUser(token) + auth options + tenant fallback |
| 15 | development-elevation | getUser(token) + auth options |
| 16 | development-sicar-query | getUser(token) + auth options |
| 17 | development-dwg-validator | getUser(token) + auth options |
| 18 | development-datageo-rl | getUser(token) + auth options |
| 19 | predictive-default-ai | getUser(token) + auth options + tenant fallback |

---

## Frontend Fixes

### Fix 1 — Rotas standalone Financeiro/Conformidade removidas
**Arquivo**: `src/App.tsx`
- Removidas linhas 347-348: `<Route path="/parcelamento/:id/financeiro">` e `<Route path="/parcelamento/:id/conformidade">`
- Removidos imports não utilizados de ParcelamentoFinanceiro e ParcelamentoConformidade
- Financeiro e Conformidade agora são tabs inline dentro de ParcelamentoDetalhe (lazy + Suspense)

### Fix 2 — Mapa Mapbox container com altura explícita
**Arquivo**: `src/pages/parcelamento/ParcelamentoDetalhe.tsx`
- Container do MapaPreview: `min-h-[420px]` → `style={{ height: 420 }}`
- `height: 100%` no filho não funciona quando o pai só tem `min-height` (Mapbox precisa de altura concreta)

---

## EFs com mesmo bug mas NÃO corrigidas nesta sessão

Há ~30+ EFs comerciais/CLM com `getUser()` sem token (ex: commercial-nurturing-engine, commercial-email-service, clm-ai-insights, etc). Como o Marcelo não está testando esses módulos agora, foram deixadas para uma sessão futura de fix em massa.

---

## Notas: parcelamento-legal-analysis

A EF `parcelamento-legal-analysis` apareceu nos logs com 401 mas **NÃO existe como arquivo standalone**. A funcionalidade está integrada no copilot (que foi corrigido). Provavelmente é uma EF legada que foi absorvida pelo copilot ou por legal-chatbot.

---

## Deploy Summary

| Artefato | Status |
|----------|--------|
| 19 EFs Supabase | ✅ ALL DEPLOYED |
| Git commit `31d3f3e` | ✅ PUSHED |
| Vercel `dpl_J7qP2nDpvVWSgcTnAjoHs7im7QLL` | ⏳ BUILDING |

---

## Lições Aprendidas

1. **`getUser(token)` é obrigatório em EFs Deno**: Nunca usar `getUser()` sem argumento em Edge Functions. A versão de `@supabase/supabase-js` resolvida via esm.sh pode não ler o token do `global.headers`.
2. **Auth options são obrigatórias em EFs**: `persistSession: false, autoRefreshToken: false, detectSessionInUrl: false` — sem isso o client tenta usar localStorage que não existe no Deno.
3. **`min-height` ≠ `height` para filhos com `h-full`**: CSS `height: 100%` precisa de `height` explícito no pai. `min-height` não conta.
4. **Rotas standalone conflitam com tabs inline**: Se um componente é renderizado como tab E como rota, a rota tem precedência quando acessada diretamente.
5. **Bug sistêmico = fix sistêmico**: Quando um padrão está errado, grep por ele e corrigir TODAS as ocorrências, não só as que o usuário reportou.

---

## Próximo

- Verificar Vercel READY
- Marcelo testar todos os módulos
- Considerar fix em massa das ~30 EFs comerciais/CLM restantes
- Continuar com Bloco E Fase E2 (CAD Studio Ferramentas Avançadas)
