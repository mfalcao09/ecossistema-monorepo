import { Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenantModules } from "@/hooks/useTenantModules";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { UserMenu } from "@/components/UserMenu";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import { TenantSelector } from "@/components/TenantSelector";
import { SuperAdminViewChoiceDialog } from "@/components/SuperAdminViewChoiceDialog";
import { SuperAdminViewProvider, useSuperAdminView } from "@/hooks/useSuperAdminView";
import { ActiveModuleProvider } from "@/hooks/useActiveModule";
import { ModuleSwitcher } from "@/components/ModuleSwitcher";
import { AlertTriangle, CreditCard, ShieldAlert, Crown } from "lucide-react";
import { AICopilot } from "@/components/AICopilot";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MobileBottomNav } from "@/components/pwa/MobileBottomNav";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { MobileQuickActions } from "@/components/pwa/MobileQuickActions";
import { useIsMobile } from "@/hooks/use-mobile";

function SubscriptionBlockedBanner() {
  const navigate = useNavigate();
  return (
    <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="font-medium text-destructive">
          Sua assinatura expirou. O acesso ao sistema está limitado.
        </span>
        <span className="text-muted-foreground">
          Regularize sua situação para continuar utilizando todas as funcionalidades.
        </span>
      </div>
      <Button
        size="sm"
        variant="destructive"
        className="shrink-0 gap-1.5"
        onClick={() => navigate("/faturas")}
      >
        <CreditCard className="h-3.5 w-3.5" />
        Ver Faturas
      </Button>
    </div>
  );
}

function TenantInactiveBlock({ isTrial }: { isTrial: boolean }) {
  const navigate = useNavigate();
  if (isTrial) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30">
            <Crown className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Período de Teste Expirado</h2>
          <p className="text-muted-foreground">
            Seu período de teste de 7 dias chegou ao fim. 
            Escolha um plano para continuar utilizando a plataforma.
          </p>
          <Button
            className="gap-2"
            onClick={() => navigate("/meu-plano")}
          >
            <Crown className="h-4 w-4" />
            Escolher um Plano
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Empresa Inativa</h2>
        <p className="text-muted-foreground">
          Sua empresa está inativa devido a pendências financeiras. 
          Regularize suas faturas para reativar o acesso ao sistema.
        </p>
        <Button
          variant="destructive"
          className="gap-2"
          onClick={() => navigate("/faturas")}
        >
          <CreditCard className="h-4 w-4" />
          Ir para Faturas
        </Button>
      </div>
    </div>
  );
}

function AppLayoutInner() {
  const { session, loading, needsOnboarding, tenantActive, tenantId, roles } = useAuth();
  const { isBlocked } = useTenantModules();
  const { viewMode, isSuperAdmin, isImpersonating, isSyncing } = useSuperAdminView();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isSuperadmin = roles.includes("superadmin");
  const isGestaoMode = isSuperAdmin && viewMode === "gestao";

  // Check if tenant has a trial plan (price_monthly = 0)
  const { data: subscriptionData } = useQuery({
    queryKey: ["layout-subscription-check", tenantId],
    enabled: !!tenantId && !tenantActive && !isSuperadmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("tenant_subscriptions")
        .select("id, status, plan_id, plans:plan_id(price_monthly)")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const isTrial = subscriptionData
    ? Number((subscriptionData.plans as any)?.price_monthly ?? 1) === 0
    : false;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  // Inactive tenant: allow /faturas for paid, /meu-plano for trial
  const isTenantInactive = !tenantActive && !isSuperadmin;
  const isOnAllowedPage = isTrial
    ? location.pathname === "/meu-plano"
    : location.pathname === "/faturas";

  return (
    <ActiveModuleProvider currentPath={location.pathname}>
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {isTenantInactive && (
            <div className={`${isTrial ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200' : 'bg-destructive/10 border-destructive/20'} border-b px-4 py-3 flex items-center gap-2 text-sm`}>
              {isTrial ? (
                <>
                  <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="font-medium text-amber-700 dark:text-amber-400">
                    Seu período de teste expirou. Escolha um plano para continuar.
                  </span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                  <span className="font-medium text-destructive">
                    Sua empresa está inativa. Regularize suas faturas para restaurar o acesso.
                  </span>
                </>
              )}
            </div>
          )}
          {!isTenantInactive && isBlocked && <SubscriptionBlockedBanner />}
          <header className="sticky top-0 z-30 h-16 bg-card border-b border-border">
            <div className="flex h-16 items-center gap-3 px-4 lg:px-5 min-w-0">
              <SidebarTrigger className="w-8 h-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg" />
              <div className="flex-1 min-w-0">
                {isGestaoMode ? (
                  <TenantSelector />
                ) : (
                  <GlobalSearch />
                )}
              </div>
              <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
                {isImpersonating && <TenantSelector />}
                {!isGestaoMode && <NotificationCenter />}
                <ModuleSwitcher />
                <ThemeToggle />
                <hr className="w-px h-6 bg-border border-none mx-1" />
                <UserMenu />
              </div>
            </div>
          </header>
          <div className={`flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden ${isMobile ? "pb-20" : ""}`}>
            {isTenantInactive && !isOnAllowedPage ? (
              <TenantInactiveBlock isTrial={isTrial} />
            ) : (
              <Outlet />
            )}
          </div>
        </main>
      </div>
      <SuperAdminViewChoiceDialog />
      {!isSuperadmin && <AICopilot />}
      {/* PWA Components */}
      <OfflineIndicator />
      <InstallBanner />
      <MobileBottomNav />
      <MobileQuickActions />
    </SidebarProvider>
    </ActiveModuleProvider>
  );
}

export function AppLayout() {
  return (
    <SuperAdminViewProvider>
      <AppLayoutInner />
    </SuperAdminViewProvider>
  );
}
