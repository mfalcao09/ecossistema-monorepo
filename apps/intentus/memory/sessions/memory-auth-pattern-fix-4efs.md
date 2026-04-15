# Auth Pattern Fix — 4 Edge Functions (Session 151)

## Summary
Fixed the auth pattern in 4 Supabase Edge Functions that were calling `supabase.auth.getUser()` WITHOUT passing the JWT token parameter. This was causing 401 errors in some scenarios.

## Bug
- `supabase.auth.getUser()` was being called WITHOUT the JWT token
- The SDK needs the token explicitly to verify the user identity

## Fix Applied to All 4 Files

### Pattern
```typescript
// BEFORE
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user }, error: authErr } = await supabase.auth.getUser();

// AFTER
const token = authHeader.replace("Bearer ", "");
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
```

### Files Fixed

1. **development-elevation/index.ts** (line 367-374)
   - Token extraction added
   - Auth options added to createClient
   - Token passed to getUser()

2. **development-sicar-query/index.ts** (line 201-207)
   - Token extraction added
   - Auth options added to createClient
   - Token passed to getUser()

3. **development-dwg-validator/index.ts** (line 212-222)
   - Token extraction added
   - Auth options added to createClient (multiline format)
   - Token passed to getUser()

4. **development-datageo-rl/index.ts** (line 327-337)
   - Token extraction added
   - Auth options added to createClient (multiline format)
   - Token passed to getUser()

## Status
✅ All 4 files patched and verified
- Token extraction: `const token = authHeader.replace("Bearer ", "");`
- Auth options: `auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }`
- All 4 functions now call: `supabase.auth.getUser(token)`

## Next Steps
1. Deploy these 4 EFs to Supabase
2. Test to confirm 401 errors are resolved
3. Monitor for any auth-related errors in production
