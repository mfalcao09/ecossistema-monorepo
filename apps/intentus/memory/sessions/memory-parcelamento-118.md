# Sessão 118 — Parcelamento de Solo: Fase 1A CONCLUÍDA

> **Data:** 2026-04-07
> **Status:** ✅ Migration aplicada + advisors corrigidos

## O que foi feito nesta sessão

### 1. Fix bloqueador: allowed_transitions FK
- **Problema:** `tenant_id = '00000000-0000-0000-0000-000000000000'` não existe em `tenants`
- **Diagnóstico:** Query `SELECT DISTINCT tenant_id FROM allowed_transitions` → resultado: `00000000-0000-0000-0000-000000000001`
- **Fix:** Substituído todos os UUIDs na migration

### 2. Fix RLS: função errada
- Ainda havia `(SELECT public.get_auth_tenant_id())` no arquivo
- **Fix:** Substituído para `auth_tenant_id()` (função real confirmada em sessão anterior)

### 3. Migration aplicada com sucesso ✅
- **Nome:** `parcelamento_solo_fase1_schema`
- **Resultado:** `{"success": true}`
- O que foi criado:
  - PostGIS extension ✅
  - Enum `development_type`: adicionado `condominio`, `misto` ✅
  - 13 novas colunas em `developments` (geometry, centroid, bbox, area_m2, ..., reserva_legal_source) ✅
  - 5 índices em `developments` (GIST geo, GIN jsonb, composto tenant+tipo, parcial status) ✅
  - 6 tabelas filhas `development_parcelamento_*` ✅
  - RLS em todas as 6 tabelas ✅
  - Storage bucket `parcelamento-files` (50MB, tipos permitidos) ✅
  - 6 transições RBAC em `allowed_transitions` ✅

### 4. Advisors rodados
- **Security:** Nenhum problema nas tabelas novas. Issues pré-existentes:
  - `spatial_ref_sys` sem RLS (PostGIS system table — esperado/normal)
  - `postgis` no public schema (WARN — esperado, pode mover para extensions schema no futuro)
  - 15 funções sem `search_path` (pré-existentes, não criadas por nós)
  - Políticas `always_true` em coaching/broker tables (pré-existentes, service_role intencionais)
- **Performance:** 6 WARNs `auth_rls_initplan` nas nossas tabelas novas → CORRIGIDOS

### 5. Migration de fix de performance aplicada ✅
- **Nome:** `parcelamento_fase1_rls_perf_fix`
- Fix: `auth.uid()` → `(SELECT auth.uid())` em 6 políticas de INSERT/SELECT/UPDATE

## Arquivos criados/modificados

| Arquivo | Status |
|---|---|
| `supabase/migrations/20260407000001_parcelamento_solo_fase1_schema.sql` | ✅ Final (v3) |
| `supabase/migrations/20260407000002_parcelamento_fase1_rls_perf_fix.sql` | ✅ Novo |
| `memory/projects/parcelamento-solo.md` | Atualizado (sessão anterior) |
| `memory/projects/parcelamento-solo-API-KEYS.md` | Atualizado (sessão anterior) |

## Pendente (para Marcelo executar localmente)

### A. Git commit

```bash
cd /Users/marcelosilva/Projects/GitHub/intentus-plataform
rm -f .git/index.lock
git add \
  memory/projects/parcelamento-solo.md \
  memory/projects/parcelamento-solo-API-KEYS.md \
  memory/projects/parcelamento-solo-DECISOES-D1-D5.md \
  memory/projects/parcelamento-solo-FASE0-AUDITORIA.md \
  memory/projects/parcelamento-solo-FASE1-PLANO.md \
  memory/projects/parcelamento-solo-PRD.md \
  memory/projects/parcelamento-solo-PRD-v0.2.md \
  memory/projects/parcelamento-solo-CENTRAL-SYNC-PENDING.md \
  memory/projects/parcelamento-solo-REFERENCIA-LOTELYTICS.md \
  memory/sessions/memory-parcelamento-114.md \
  memory/sessions/memory-parcelamento-116.md \
  memory/sessions/memory-parcelamento-118.md \
  supabase/migrations/20260407000001_parcelamento_solo_fase1_schema.sql \
  supabase/migrations/20260407000002_parcelamento_fase1_rls_perf_fix.sql

git commit -m "feat(parcelamento): schema Fase 1 — developments + 6 tabelas + RLS + PostGIS + RBAC

- Extensão PostGIS adicionada ao projeto Supabase
- development_type enum: adicionado condominio, misto
- developments: 13 novas colunas (geometry, centroid, elevação, APP, RL, analysis_status)
- 6 tabelas filhas: _files, _geo_layers, _financial, _compliance, _reports, _rl_cache
- RLS PERMISSIVE com auth_tenant_id() em todas as tabelas
- Storage bucket parcelamento-files (50MB, MIME types CAD/geo)
- 6 transições RBAC no allowed_transitions (tenant global ...0001)
- Fix perf: auth.uid() -> (select auth.uid()) em 6 políticas

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### B. Supabase secrets (Dashboard → Project Settings → Edge Functions → Secrets)

| Secret Name | Valor |
|---|---|
| `OPENTOPO_API_KEY` | `eefa7c0b13e68acf907f50288b685522` |
| `CONVERT_API_SECRET` | `UC3FOKfLscgokMujFeQUjgCuSsWblnbo` |
| `GEE_SERVICE_ACCOUNT_EMAIL` | `ee-intentus-parcelamento@gen-lang-client-0612830161.iam.gserviceaccount.com` |
| `GEE_PROJECT_ID` | `gen-lang-client-0612830161` |
| `GEE_PRIVATE_KEY_ID` | `8986e8a348c72ff337613b75f41c0d3384611907` |
| `GEE_PRIVATE_KEY_JSON` | (conteúdo completo do JSON `gen-lang-client-0612830161-8986e8a348c7.json`) |

**Caminho exato:** https://supabase.com/dashboard/project/bvryaopfjiyxjgsuhjsb/settings/functions

### C. Vercel env var (Dashboard → Project → Settings → Environment Variables)

| Nome | Valor | Environments |
|---|---|---|
| `VITE_MAPBOX_TOKEN` | `[MAPBOX_TOKEN_REDACTED]` | Production, Preview, Development |

**Caminho exato:** https://vercel.com/dashboard → intentus-plataform → Settings → Environment Variables

## Próxima fase: Fase 2 — Edge Functions

5 Edge Functions a criar:
1. `development-elevation` (OpenTopography SRTM 30m)
2. `development-geo-layers` (proxy SIGEF/IBAMA PAMGIA)
3. `development-sicar-query` (SICAR Federal WFS)
4. `development-datageo-rl` (DataGeo SP + fallback SICAR)
5. `development-dwg-validator` (ConvertAPI DWG→DXF)
