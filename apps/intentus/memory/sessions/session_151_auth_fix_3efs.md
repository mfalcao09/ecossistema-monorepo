# Auth Fix Applied — 3 Edge Functions (2026-04-12)

## Summary
Applied the JWT token extraction auth fix pattern to 3 Supabase Edge Functions to resolve 401 Unauthorized errors when users don't have a profile row in the database.

## Pattern Applied
Each function now:
1. Extracts JWT token: `const token = authHeader.replace("Bearer ", "");`
2. Disables session persistence in createClient: `auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }`
3. Passes token to getUser: `supabase.auth.getUser(token)` instead of `supabase.auth.getUser()`

## Files Fixed

### 1. market-benchmarks/index.ts (line 70)
- Function: `buildContext()`
- Change: Added token extraction + auth options + token parameter to getUser()
- Status: ✅ COMPLETE

### 2. ibge-census/index.ts (line 67)
- Function: `buildContext()`
- Change: Added token extraction + auth options + token parameter to getUser()
- Status: ✅ COMPLETE

### 3. development-geo-layers/index.ts (line 290-304)
- Pattern: INLINE auth (not buildContext function)
- Change: Added token extraction + auth options + token parameter to getUser()
- Status: ✅ COMPLETE

## Notes
- **cad-project-manager**: Already has the correct auth pattern via `getTenantId()` helper (line 29-36) — no fix needed
- **parcelamento-legal-analysis**: Does not exist in the codebase — skipped
- All 3 fixes follow the exact pattern applied in session 150 QA bug fixes (brazil-regulations, market-benchmarks tenant_id fallback)
- tenant_id fallback `profile?.tenant_id || user.id` is preserved in all functions

## Next Step
- Deploy these 3 EFs to Supabase via Desktop Commander or MCP tools
- Monitor Vercel deployment to READY state
- Commit with conventional format + Co-Authored-By
