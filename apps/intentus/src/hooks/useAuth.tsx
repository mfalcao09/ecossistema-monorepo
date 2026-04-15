import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { invalidateAuthCache } from "@/lib/tenantUtils";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  active?: boolean;
}

const MASTER_UID = "85ba82c5-479d-4405-83ba-69359486780b";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdminOrGerente: boolean;
  isSuperAdmin: boolean;
  tenantId: string | null;
  tenantName: string | null;
  tenant: TenantInfo | null;
  tenantActive: boolean;
  needsOnboarding: boolean;
  refetchTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async (userId: string, tenantId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);
    setRoles(data?.map((r) => r.role) ?? []);
  };

  /** Resolve tenant and then fetch tenant-scoped roles */
  const initUserContext = async (userId: string) => {
    // 1. Resolve tenant first
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id) {
      setNeedsOnboarding(true);
      setTenant(null);
      setRoles([]);
      return;
    }

    // 2. Fetch tenant info
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("id, name, slug, logo_url, active")
      .eq("id", profile.tenant_id)
      .single();

    if (tenantData) {
      setTenant({ ...tenantData, active: tenantData.active ?? true });
      setNeedsOnboarding(false);
    } else {
      setNeedsOnboarding(true);
      setTenant(null);
      setRoles([]);
      return;
    }

    // 3. Fetch roles scoped to this tenant
    await fetchRoles(userId, profile.tenant_id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          setTimeout(() => {
            initUserContext(session.user.id);
          }, 0);
        } else {
          setRoles([]);
          setTenant(null);
          setNeedsOnboarding(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        initUserContext(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refetchTenant = async () => {
    // Invalidate shared tenant cache (tenantUtils) so utility functions
    // also pick up the new tenant — Phase 2.3 sessão 36
    invalidateAuthCache();
    if (session?.user) {
      await initUserContext(session.user.id);
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdminOrGerente = hasRole("admin") || hasRole("gerente");
  // isSuperAdmin: master UID match is sufficient (roles may load async)
  const isSuperAdmin = session?.user?.id === MASTER_UID;

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        roles,
        loading,
        signOut,
        hasRole,
        isAdminOrGerente,
        isSuperAdmin,
        tenantId: tenant?.id ?? null,
        tenantName: tenant?.name ?? null,
        tenant,
        tenantActive: tenant?.active !== false,
        needsOnboarding,
        refetchTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
