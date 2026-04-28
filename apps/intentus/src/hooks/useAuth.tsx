import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
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

  /** Resolve tenant and then fetch tenant-scoped roles.
   *
   * Defensivo contra falhas transitórias (RLS sincronizando após reload):
   * - usa .maybeSingle() em vez de .single() — não dá throw em "0 rows"
   * - só seta needsOnboarding=true quando confirmadamente sem tenant
   *   (profile retornou mas tenant_id é null)
   * - se a query do profile FALHA (network/RLS), NÃO redireciona pra
   *   onboarding — preserva o estado anterior. Senão um blip transitório
   *   faz o user perder a sessão de trabalho.
   */
  const initUserContext = async (userId: string) => {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      // Falha transitória — não muda estado, deixa usuário re-tentar
      console.warn("[useAuth] profile fetch falhou:", profileError.message);
      return;
    }

    if (!profile?.tenant_id) {
      // Confirmadamente sem tenant — onboarding genuíno
      setNeedsOnboarding(true);
      setTenant(null);
      setRoles([]);
      return;
    }

    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, slug, logo_url, active")
      .eq("id", profile.tenant_id)
      .maybeSingle();

    if (tenantError) {
      console.warn("[useAuth] tenant fetch falhou:", tenantError.message);
      return;
    }

    if (tenantData) {
      setTenant({ ...tenantData, active: tenantData.active ?? true });
      setNeedsOnboarding(false);
    } else {
      // Tenant_id existe no profile mas tenant foi deletado — onboarding
      setNeedsOnboarding(true);
      setTenant(null);
      setRoles([]);
      return;
    }

    await fetchRoles(userId, profile.tenant_id);
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      try {
        if (session?.user) {
          // AWAIT — não setar loading=false até tenant resolver.
          // try/finally garante que loading=false SEMPRE roda mesmo
          // se initUserContext lançar exception inesperada.
          await initUserContext(session.user.id);
        } else {
          setRoles([]);
          setTenant(null);
          setNeedsOnboarding(false);
        }
      } catch (err) {
        console.error("[useAuth] onAuthStateChange falhou:", err);
      } finally {
        setLoading(false);
      }
    });

    // Inicial: carrega session + tenant em sequência antes de liberar UI.
    // try/finally garante que UI nunca fica travada em "Carregando..." se
    // alguma chamada do Supabase travar/lançar.
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        if (session?.user) {
          await initUserContext(session.user.id);
        }
      } catch (err) {
        console.error("[useAuth] init falhou:", err);
      } finally {
        setLoading(false);
      }
    })();

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
