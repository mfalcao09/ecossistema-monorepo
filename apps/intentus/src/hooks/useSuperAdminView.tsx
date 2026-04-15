import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type ViewMode = "gestao" | "empresa";

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000001";

interface SuperAdminViewContextType {
  viewMode: ViewMode | null;
  setViewMode: (mode: ViewMode) => void;
  showChoiceDialog: boolean;
  isSuperAdmin: boolean;
  impersonatedTenantId: string | null;
  impersonatedTenantName: string | null;
  impersonateTenant: (tenantId: string, tenantName: string) => Promise<void>;
  exitImpersonation: () => Promise<void>;
  isImpersonating: boolean;
  isSyncing: boolean;
}

const SuperAdminViewContext = createContext<SuperAdminViewContextType>({
  viewMode: null,
  setViewMode: () => {},
  showChoiceDialog: false,
  isSuperAdmin: false,
  impersonatedTenantId: null,
  impersonatedTenantName: null,
  impersonateTenant: async () => {},
  exitImpersonation: async () => {},
  isImpersonating: false,
  isSyncing: false,
});

const LS_KEY = "sa_view_mode";
const LS_IMP_ID = "sa_imp_tenant_id";
const LS_IMP_NAME = "sa_imp_tenant_name";

export function SuperAdminViewProvider({ children }: { children: ReactNode }) {
  const { hasRole, session, user, refetchTenant } = useAuth();
  const MASTER_UID = "85ba82c5-479d-4405-83ba-69359486780b";
  const isSuperAdmin = user?.id === MASTER_UID || hasRole("superadmin");
  const queryClient = useQueryClient();

  const [isSyncing, setIsSyncing] = useState(false);
  const hasSynced = useRef<string | null>(null);

  const [viewMode, setViewModeState] = useState<ViewMode | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(LS_KEY);
    if (stored === "gestao" || stored === "empresa") return stored;
    return null;
  });

  const [impersonatedTenantId, setImpersonatedTenantId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LS_IMP_ID);
  });

  const [impersonatedTenantName, setImpersonatedTenantName] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LS_IMP_NAME);
  });

  const isImpersonating = !!impersonatedTenantId && impersonatedTenantId !== MASTER_TENANT_ID;

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(LS_KEY, mode);
  }, []);

  // Sync profiles.tenant_id on mount when impersonation is restored from localStorage
  useEffect(() => {
    if (!user || !isSuperAdmin) return;
    if (hasSynced.current === user.id) return;
    hasSynced.current = user.id;

    const syncTenantProfile = async () => {
      const targetTenantId = impersonatedTenantId && impersonatedTenantId !== MASTER_TENANT_ID
        ? impersonatedTenantId
        : MASTER_TENANT_ID;

      setIsSyncing(true);
      try {
        await supabase
          .from("profiles")
          .update({ tenant_id: targetTenantId } as any)
          .eq("user_id", user.id);

        await refetchTenant();
        queryClient.invalidateQueries();
      } finally {
        setIsSyncing(false);
      }
    };

    syncTenantProfile();
  }, [user, isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const impersonateTenant = useCallback(async (tenantId: string, tenantName: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ tenant_id: tenantId } as any)
      .eq("user_id", user.id);
    if (error) throw error;

    setImpersonatedTenantId(tenantId);
    setImpersonatedTenantName(tenantName);
    localStorage.setItem(LS_IMP_ID, tenantId);
    localStorage.setItem(LS_IMP_NAME, tenantName);

    setViewModeState("empresa");
    localStorage.setItem(LS_KEY, "empresa");

    await refetchTenant();
    queryClient.invalidateQueries();
  }, [user, refetchTenant, queryClient]);

  const exitImpersonation = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ tenant_id: MASTER_TENANT_ID } as any)
      .eq("user_id", user.id);
    if (error) throw error;

    setImpersonatedTenantId(null);
    setImpersonatedTenantName(null);
    localStorage.removeItem(LS_IMP_ID);
    localStorage.removeItem(LS_IMP_NAME);

    setViewModeState("gestao");
    localStorage.setItem(LS_KEY, "gestao");

    await refetchTenant();
    queryClient.invalidateQueries();
  }, [user, refetchTenant, queryClient]);

  // Clear on logout
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setViewModeState(null);
        setImpersonatedTenantId(null);
        setImpersonatedTenantName(null);
        localStorage.removeItem(LS_KEY);
        localStorage.removeItem(LS_IMP_ID);
        localStorage.removeItem(LS_IMP_NAME);
        hasSynced.current = null;
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const showChoiceDialog = isSuperAdmin && viewMode === null;

  return (
    <SuperAdminViewContext.Provider value={{
      viewMode, setViewMode, showChoiceDialog, isSuperAdmin,
      impersonatedTenantId, impersonatedTenantName,
      impersonateTenant, exitImpersonation, isImpersonating,
      isSyncing,
    }}>
      {children}
    </SuperAdminViewContext.Provider>
  );
}

export function useSuperAdminView() {
  return useContext(SuperAdminViewContext);
}
