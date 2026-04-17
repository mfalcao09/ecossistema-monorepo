// credential-gateway-v2/acl.ts
// ACL matching contra ecosystem_credentials.acl (jsonb).
import type { SupabaseClient } from "../_shared/supabase-admin.ts";

export interface ACLRule {
  agent_pattern: string;              // 'cfo-*' | 'exact-agent' | '*'
  allowed_scopes?: string[];          // ['read','proxy','validate','list']
}

export interface ACLCheck {
  allowed: boolean;
  reason?: string;
  credential?: {
    id: string;
    name: string;
    project: string;
    environment: string;
    vault_key: string | null;
    proxy_only: boolean;
    rate_limit: Record<string, number> | null;
    expires_at: string | null;
    is_active: boolean;
  };
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp("^" + escaped + "$");
}

export async function checkACL(
  supabase: SupabaseClient,
  agentId: string,
  credentialName: string,
  project: string,
  scope: string,
): Promise<ACLCheck> {
  const { data, error } = await supabase
    .from("ecosystem_credentials")
    .select("id, name, project, environment, vault_key, proxy_only, rate_limit, expires_at, is_active, acl")
    .match({ name: credentialName, project })
    .maybeSingle();

  if (error) {
    console.error("[acl] select error:", error.message);
    return { allowed: false, reason: "db_error" };
  }
  if (!data) return { allowed: false, reason: "credential_not_found" };
  if (!data.is_active) return { allowed: false, reason: "credential_inactive" };

  const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    return { allowed: false, reason: "credential_expired" };
  }

  const acl: ACLRule[] = Array.isArray(data.acl) ? data.acl : [];
  if (acl.length === 0) {
    // Fail-closed: ACL vazia = ninguém acessa (exceto owner, tratado antes).
    return { allowed: false, reason: "acl_empty" };
  }

  for (const rule of acl) {
    if (!rule?.agent_pattern) continue;
    const rx = patternToRegex(rule.agent_pattern);
    if (!rx.test(agentId)) continue;
    const scopes = Array.isArray(rule.allowed_scopes) ? rule.allowed_scopes : ["read"];
    if (scopes.includes("*") || scopes.includes(scope)) {
      return {
        allowed: true,
        credential: {
          id: data.id,
          name: data.name,
          project: data.project,
          environment: data.environment,
          vault_key: data.vault_key,
          proxy_only: !!data.proxy_only,
          rate_limit: (data.rate_limit ?? null) as Record<string, number> | null,
          expires_at: data.expires_at,
          is_active: data.is_active,
        },
      };
    }
    return { allowed: false, reason: "scope_not_allowed" };
  }

  return { allowed: false, reason: "not_in_acl" };
}
