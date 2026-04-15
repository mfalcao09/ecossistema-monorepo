import { supabase } from "@/integrations/supabase/client";

// ============================================================
// In-memory cache for tenant resolution
// Eliminates ~2 API calls per request across 95+ consumer files
// Phase 2.3 — sessão 36 (Claudinho + Buchecha)
// ============================================================

interface AuthCacheEntry {
  userId: string;
  tenantId: string;
  timestamp: number;
}

/** Cache TTL: 30 minutes (tenant_id rarely changes during a session) */
const CACHE_TTL_MS = 30 * 60 * 1000;

/** Module-level cache — shared across all callers */
let authCache: AuthCacheEntry | null = null;

/** Dedup guard: if a resolution is in-flight, reuse its promise */
let inflightPromise: Promise<AuthCacheEntry> | null = null;

// Auto-invalidate cache on auth state changes
// SIGNED_IN is critical: prevents user A's tenant leaking to user B on switch
supabase.auth.onAuthStateChange((event) => {
  if (
    event === "SIGNED_IN" ||
    event === "SIGNED_OUT" ||
    event === "USER_UPDATED" ||
    event === "TOKEN_REFRESHED"
  ) {
    authCache = null;
    inflightPromise = null;
  }
});

/**
 * Resolves user + tenant from cache or DB.
 * Uses in-memory cache with 30min TTL + dedup for concurrent calls.
 */
async function resolveAuthCached(): Promise<AuthCacheEntry> {
  // 1. Return cached if valid
  if (authCache && Date.now() - authCache.timestamp < CACHE_TTL_MS) {
    return authCache;
  }

  // 2. Dedup: if another call is already resolving, wait for it
  if (inflightPromise) {
    return inflightPromise;
  }

  // 3. Resolve from DB
  inflightPromise = (async (): Promise<AuthCacheEntry> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.tenant_id) {
        throw new Error(
          "Sem empresa vinculada. Complete o cadastro da empresa primeiro."
        );
      }

      const entry: AuthCacheEntry = {
        userId: user.id,
        tenantId: profile.tenant_id,
        timestamp: Date.now(),
      };

      authCache = entry;
      return entry;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

// ============================================================
// PUBLIC API (signatures unchanged — zero refactor needed)
// ============================================================

/**
 * Returns the current user's tenant_id.
 * Cached for 30 minutes; auto-invalidates on logout/token refresh.
 * Used in 95+ files across the codebase.
 */
export async function getAuthTenantId(): Promise<string> {
  const { tenantId } = await resolveAuthCached();
  return tenantId;
}

/**
 * Returns both userId and tenantId (cached).
 * Drop-in replacement for clmApi.ts resolveAuthContext().
 */
export async function getAuthContext(): Promise<{
  userId: string;
  tenantId: string;
}> {
  const { userId, tenantId } = await resolveAuthCached();
  return { userId, tenantId };
}

/**
 * Manually invalidate the cache.
 * Useful after profile updates or tenant switches.
 */
export function invalidateAuthCache(): void {
  authCache = null;
  inflightPromise = null;
}
