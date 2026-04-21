/**
 * Middleware funcional para rotas /api/public/v1/**.
 *
 * Uso:
 *   export const POST = withPublicApiKey("messages:send", async (req, { key }) => { ... });
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveApiKey, hasScope, type AuthenticatedApiKey, type ScopeAction } from "./api-key";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicApiCtx = {
  key: AuthenticatedApiKey;
  supabase: SupabaseClient;
};

export function withPublicApiKey(
  scope: ScopeAction,
  handler: (req: NextRequest, ctx: PublicApiCtx) => Promise<Response> | Response,
) {
  return async function wrapped(req: NextRequest): Promise<Response> {
    const supabase = createAdminClient();

    const key = await resolveApiKey(req, supabase);
    if (!key) {
      return NextResponse.json(
        { error: "unauthorized", detail: "Missing or invalid API key" },
        {
          status: 401,
          headers: {
            "WWW-Authenticate": 'Bearer realm="erp-fic", error="invalid_token"',
          },
        },
      );
    }

    if (!hasScope(key, scope)) {
      return NextResponse.json(
        { error: "forbidden", detail: `Missing scope: ${scope}`, your_scopes: key.scopes },
        { status: 403 },
      );
    }

    return handler(req, { key, supabase });
  };
}
