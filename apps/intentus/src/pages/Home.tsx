// ─── Home (ponto de entrada pós-login) ─────────────────────────────
// Sessão 130 CONT3 Passo 6: nova Home com cards de módulos.
// Sessão 131 Passo 7: HeroBar + Alertas Inteligentes migrados do Dashboard pra cá.

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DashboardHeroBar } from "@/components/dashboard/DashboardHeroBar";
import { useUnifiedAlerts } from "@/hooks/useUnifiedAlerts";
import type { UnifiedAlert } from "@/hooks/useUnifiedAlerts";
import {
  Home as HomeIcon,
  LayoutDashboard,
  Building2,
  FileText,
  Handshake,
  Users,
  BookOpen,
  DollarSign,
  Scale,
  MessageCircle,
  Rocket,
  Map as MapIcon,
  Settings,
  Crown,
  ChevronRight,
  Sparkles,
  Clock,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MODULE_DEFINITIONS, type ModuleDefinition, type ModuleId } from "@/hooks/useActiveModule";

// Mapa de ícones por nome (as definitions guardam string, aqui resolvemos pro componente)
const ICON_MAP: Record<string, LucideIcon> = {
  Home: HomeIcon,
  LayoutDashboard,
  Building2,
  FileText,
  Handshake,
  Users,
  BookOpen,
  DollarSign,
  Scale,
  MessageCircle,
  Rocket,
  Map: MapIcon,
  Settings,
  Crown,
};

// Módulos que devem aparecer como CARDS na Home
const MODULE_CARD_IDS: ModuleId[] = [
  "cadastros",
  "clm",
  "comercial",
  "relacionamento",
  "lancamentos",
  "parcelamento",
  "financeiro",
  "contabilidade",
  "juridico",
];

// Rota canônica de entrada de cada módulo (onde o card navega)
const MODULE_ENTRY_ROUTE: Record<ModuleId, string> = {
  home: "/",
  dashboard: "/dashboard",
  cadastros: "/imoveis",
  clm: "/contratos",
  comercial: "/comercial/dashboard",
  relacionamento: "/relacionamento",
  contabilidade: "/financeiro/contabil-dashboard",
  financeiro: "/financeiro/receitas",
  juridico: "/juridico",
  whatsapp: "/atendimento-whatsapp",
  lancamentos: "/lancamentos",
  parcelamento: "/parcelamento",
  admin: "/dados-empresa",
  superadmin: "/sa",
};

// ─── Config dos alertas (copiado do Dashboard) ────────────────────
const LEVEL_CONFIG = {
  critical:    { icon: AlertTriangle, color: "text-destructive",  bg: "bg-destructive/10 border-destructive/30",    badge: "destructive" as const, label: "Crítico" },
  warning:     { icon: AlertTriangle, color: "text-amber-500",    bg: "bg-amber-500/10 border-amber-500/30",         badge: "secondary"   as const, label: "Atenção" },
  opportunity: { icon: TrendingUp,    color: "text-emerald-500",  bg: "bg-emerald-500/10 border-emerald-500/30",     badge: "secondary"   as const, label: "Oportunidade" },
  info:        { icon: Info,          color: "text-primary",      bg: "bg-primary/5 border-primary/20",              badge: "outline"     as const, label: "Info" },
};

const CATEGORY_ROUTES: Record<string, string> = {
  relacionamento: "/relacionamento",
  contratos:      "/contratos",
  comercial:      "/comercial/dashboard",
  financeiro:     "/financeiro/receitas",
  atendimento:    "/atendimento",
};

function AlertCard({ alert }: { alert: UnifiedAlert }) {
  const navigate = useNavigate();
  const config = LEVEL_CONFIG[alert.level];
  const Icon = config.icon;
  const route = CATEGORY_ROUTES[alert.category];
  return (
    <Card
      className={`flex items-start gap-3 p-3 border ${config.bg} cursor-pointer hover:shadow-md transition-shadow`}
      onClick={() => route && navigate(route)}
    >
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${config.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-foreground truncate">{alert.title}</span>
          <Badge variant={config.badge} className="text-xs shrink-0">{config.label}</Badge>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{alert.message}</p>
        <p className="text-xs font-medium text-primary mt-1 flex items-center gap-1">
          {alert.action} <ChevronRight className="h-3 w-3" />
        </p>
      </div>
    </Card>
  );
}

// ─── Card de módulo ──────────────────────────────────────────────
function ModuleCard({ mod, onClick }: { mod: ModuleDefinition; onClick: () => void }) {
  const Icon = ICON_MAP[mod.icon] ?? LayoutDashboard;
  return (
    <Card
      onClick={onClick}
      className="group cursor-pointer p-5 hover:shadow-lg transition-all hover:border-primary/40 flex flex-col gap-3 min-h-[160px]"
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-11 h-11 rounded-lg flex items-center justify-center ${mod.color} text-white shadow-sm`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-base leading-tight">{mod.label}</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-snug">
          {mod.description}
        </p>
      </div>
    </Card>
  );
}

// ─── Página Home ──────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate();
  const { tenantName, isAdminOrGerente, isSuperAdmin } = useAuth();
  const { data: alertsData, isLoading: alertsLoading } = useUnifiedAlerts();
  const alerts = alertsData?.alerts || [];

  // Lista de módulos a exibir
  const visibleModules = useMemo(() => {
    return MODULE_CARD_IDS.map((id) =>
      MODULE_DEFINITIONS.find((m) => m.id === id)
    ).filter((m): m is ModuleDefinition => !!m);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ─── Bloco A — HeroBar (saudação + relógio + clima) ─────── */}
      <DashboardHeroBar />

      {/* ─── Breadcrumb + badges de role + atalho pro Dashboard ─ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <HomeIcon className="w-4 h-4" />
          <span>Início</span>
          {tenantName && (
            <>
              <span>·</span>
              <span className="font-medium text-foreground">{tenantName}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600">
              <Crown className="w-3 h-3 mr-1" /> Super Admin
            </Badge>
          )}
          {isAdminOrGerente && !isSuperAdmin && (
            <Badge variant="outline">Admin</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            Ir para Dashboard
          </Button>
        </div>
      </div>

      <Separator />

      {/* ─── Bloco B — Cards de módulos ──────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Módulos disponíveis
          </h2>
          <span className="text-xs text-muted-foreground">
            {visibleModules.length} módulos
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleModules.map((mod) => (
            <ModuleCard
              key={mod.id}
              mod={mod}
              onClick={() => navigate(MODULE_ENTRY_ROUTE[mod.id])}
            />
          ))}
        </div>
      </div>

      {/* ─── Bloco C — Alertas Inteligentes (migrado do Dashboard) ─ */}
      {!alertsLoading && alerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Alertas Inteligentes
            </h2>
            <Badge variant="outline" className="text-xs">{alerts.length}</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {alerts.slice(0, 6).map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Bloco D — Atividade recente (stub) ─────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Atividade recente
          </h2>
        </div>
        <Card className="p-8 text-center border-dashed">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="font-medium mb-1">Em breve</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Aqui você verá os últimos contratos, leads, projetos e documentos
            que você tocou — um atalho rápido pra voltar ao trabalho.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-4 gap-1"
            onClick={() => navigate("/dashboard")}
          >
            Ver dashboard completo <ArrowRight className="w-3 h-3" />
          </Button>
        </Card>
      </div>
    </div>
  );
}
