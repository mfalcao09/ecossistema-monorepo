import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Handshake,
  Users,
  DollarSign,
  BookOpen,
  Scale,
  MessageCircle,
  Rocket,
  Map,
  Settings,
  Crown,
} from "lucide-react";
import { useActiveModule, type ModuleId, type ModuleDefinition } from "@/hooks/useActiveModule";
import { useAuth } from "@/hooks/useAuth";
import { useTenantModules } from "@/hooks/useTenantModules";
import { useWhatsappProductEnabled } from "@/hooks/useWhatsappProductEnabled";
import { useChatSubscription } from "@/hooks/useChatSubscription";
import { useSuperAdminView } from "@/hooks/useSuperAdminView";
import { cn } from "@/lib/utils";

// ─── Icon Map (lucide-react) ────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Building2,
  FileText,
  Handshake,
  Users,
  DollarSign,
  BookOpen,
  Scale,
  MessageCircle,
  Rocket,
  Map,
  Settings,
  Crown,
};

// ─── Default landing page per module ────────────────────────
const MODULE_LANDING: Record<ModuleId, string> = {
  dashboard: "/",
  cadastros: "/imoveis",
  clm: "/contratos/command-center",
  comercial: "/comercial/dashboard",
  relacionamento: "/relacionamento",
  financeiro: "/financeiro/faturas-emitidas",
  contabilidade: "/financeiro/contabil-dashboard",
  juridico: "/juridico",
  whatsapp: "/atendimento-whatsapp",
  lancamentos: "/lancamentos",
  parcelamento: "/parcelamento",
  admin: "/admin/dashboard",
  superadmin: "/sa",
};

// ─── Hub-and-spoke network icon — central node with 8 radial connections ────
function AppsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Central circle */}
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      {/* Radial lines */}
      <line x1="12" y1="9.5" x2="12" y2="3.5" />
      <line x1="12" y1="14.5" x2="12" y2="20.5" />
      <line x1="9.5" y1="12" x2="3.5" y2="12" />
      <line x1="14.5" y1="12" x2="20.5" y2="12" />
      <line x1="10.23" y1="10.23" x2="5.98" y2="5.98" />
      <line x1="13.77" y1="13.77" x2="18.02" y2="18.02" />
      <line x1="13.77" y1="10.23" x2="18.02" y2="5.98" />
      <line x1="10.23" y1="13.77" x2="5.98" y2="18.02" />
      {/* Outer nodes */}
      <circle cx="12" cy="2.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="21.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="21.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="5.25" cy="5.25" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18.75" cy="18.75" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18.75" cy="5.25" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="5.25" cy="18.75" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ─── Modules that require specific conditions ───────────────
function useVisibleModules(): ModuleDefinition[] {
  const { allModules } = useActiveModule();
  const { roles } = useAuth();
  const { hasModule } = useTenantModules();
  const { enabled: whatsappEnabled } = useWhatsappProductEnabled();
  const { hasSubscription: hasChatSub } = useChatSubscription();
  const { isSuperAdmin, viewMode } = useSuperAdminView();

  const isGestaoMode = isSuperAdmin && viewMode === "gestao";
  const isSuperadminRole = roles.includes("superadmin");

  return allModules.filter((mod) => {
    if (isGestaoMode) return mod.id === "superadmin";
    if (mod.id === "superadmin") return isSuperadminRole;
    if (mod.id === "whatsapp") return whatsappEnabled && hasChatSub;
    if (mod.id === "contabilidade") return hasModule("addon_contabilidade_avancada");
    if (mod.id === "lancamentos") return hasModule("addon_empreendimentos");
    if (mod.id === "parcelamento") return hasModule("addon_empreendimentos");
    if (mod.id === "admin") {
      return roles.some((r) => ["admin", "gerente", "superadmin"].includes(r));
    }
    if (mod.id === "juridico") {
      return hasModule("juridico_intermediario") || hasModule("juridico_completo") || hasModule("addon_juridico_avancado");
    }
    if (mod.id === "financeiro") return hasModule("financeiro_basico");
    if (mod.id === "comercial") return hasModule("comercial_basico");
    if (mod.id === "relacionamento") return hasModule("relacionamento_basico");
    if (mod.id === "clm") return hasModule("contratos");
    return true;
  });
}

// ─── Component ──────────────────────────────────────────────
export function ModuleSwitcher() {
  const [open, setOpen] = useState(false);
  const { activeModule, setActiveModule } = useActiveModule();
  const navigate = useNavigate();
  const visibleModules = useVisibleModules();

  const handleModuleClick = (mod: ModuleDefinition) => {
    setActiveModule(mod.id);
    navigate(MODULE_LANDING[mod.id]);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            open && "bg-muted text-foreground"
          )}
          aria-label="Abrir módulos"
        >
          <AppsIcon className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 rounded-xl shadow-xl border border-border overflow-hidden"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-sm text-foreground" style={{ textTransform: "none" }}>Módulos</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Acesse os módulos da plataforma</p>
        </div>

        {/* Grid */}
        <div className="p-3">
          <div className="grid grid-cols-3 gap-1">
            {visibleModules.map((mod) => {
              const Icon = ICON_MAP[mod.icon] || LayoutDashboard;
              const isActive = activeModule === mod.id;

              return (
                <button
                  key={mod.id}
                  onClick={() => handleModuleClick(mod)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg px-2 py-3 text-center transition-all duration-200",
                    "hover:bg-muted",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive && "bg-primary/5 ring-1 ring-primary/20"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                      mod.color,
                      "text-white",
                      isActive ? "shadow-md scale-105" : "shadow-sm"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium leading-tight line-clamp-2 transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}
                    style={{ textTransform: "none" }}
                  >
                    {mod.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
