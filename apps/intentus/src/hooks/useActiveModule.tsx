import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";

// ─── Module IDs ─────────────────────────────────────────────
export type ModuleId =
  | "home"
  | "dashboard"
  | "cadastros"
  | "clm"
  | "comercial"
  | "relacionamento"
  | "financeiro"
  | "contabilidade"
  | "juridico"
  | "whatsapp"
  | "lancamentos"
  | "parcelamento"
  | "admin"
  | "superadmin";

// ─── Module Definition ──────────────────────────────────────
export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  icon: string; // lucide-react icon name
  color: string; // tailwind bg class
  textColor: string; // tailwind text class
  description: string;
  pathPatterns: string[]; // prefixes or exact paths for auto-detection
  exactPaths?: string[]; // paths that must match exactly (not prefix)
}

// ─── Contabilidade exact paths (checked before financeiro) ──
const CONTABILIDADE_PATHS = [
  "/financeiro/contabil-dashboard",
  "/financeiro/livro-diario",
  "/financeiro/livro-razao",
  "/financeiro/balancete",
  "/financeiro/balanco",
  "/financeiro/prestacao-contas",
  "/financeiro/fechamento",
  "/financeiro/rateio",
  "/financeiro/exportacao-contabil",
  "/financeiro/conciliacao-contabil",
];

// ─── Module Definitions ─────────────────────────────────────
export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: "home",
    label: "Home",
    icon: "Home",
    color: "bg-slate-700",
    textColor: "text-slate-700",
    description: "Ponto de entrada — escolha um módulo",
    pathPatterns: [],
    exactPaths: ["/", "/tarefas", "/atalhos", "/configuracoes"],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    color: "bg-blue-500",
    textColor: "text-blue-500",
    description: "Visão geral do sistema",
    pathPatterns: [],
    exactPaths: ["/dashboard"],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    icon: "Building2",
    color: "bg-slate-500",
    textColor: "text-slate-500",
    description: "Imóveis, Pessoas, Contratos e Garantias",
    pathPatterns: ["/imoveis", "/pessoas", "/garantias"],
    exactPaths: ["/contratos"],
  },
  {
    id: "clm",
    label: "Gestão de Contratos",
    icon: "FileText",
    color: "bg-indigo-500",
    textColor: "text-indigo-500",
    description: "CLM — Ciclo de vida dos contratos",
    pathPatterns: [
      "/contratos/",
      "/rescisoes",
      "/renovacoes",
      "/reajustes",
      "/juridico/assinaturas",
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    icon: "Handshake",
    color: "bg-emerald-500",
    textColor: "text-emerald-500",
    description: "CRM, Pipeline, Leads e Vendas",
    pathPatterns: [
      "/comercial/",
      "/comercial",
      "/leads",
      "/novos-negocios",
      "/negocios",
    ],
    exactPaths: ["/comercial"],
  },
  {
    id: "relacionamento",
    label: "Relacionamento",
    icon: "Users",
    color: "bg-rose-500",
    textColor: "text-rose-500",
    description: "Atendimento, Churn e Satisfação",
    pathPatterns: [
      "/relacionamento/",
      "/relacionamento",
      "/atendimento",
      "/liberacao-garantias",
      "/manutencao",
    ],
    exactPaths: ["/relacionamento"],
  },
  {
    id: "contabilidade",
    label: "Contabilidade",
    icon: "BookOpen",
    color: "bg-teal-500",
    textColor: "text-teal-500",
    description: "Contabilidade avançada e relatórios contábeis",
    pathPatterns: [],
    exactPaths: CONTABILIDADE_PATHS,
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: "DollarSign",
    color: "bg-green-500",
    textColor: "text-green-500",
    description: "Receitas, Despesas, Fluxo de Caixa",
    pathPatterns: ["/financeiro/", "/financeiro"],
    exactPaths: ["/financeiro"],
  },
  {
    id: "juridico",
    label: "Jurídico",
    icon: "Scale",
    color: "bg-purple-500",
    textColor: "text-purple-500",
    description: "Análises, Due Diligence e Compliance",
    pathPatterns: ["/juridico/", "/juridico", "/due-diligence"],
    exactPaths: ["/juridico"],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: "MessageCircle",
    color: "bg-green-600",
    textColor: "text-green-600",
    description: "Atendimento via WhatsApp",
    pathPatterns: ["/atendimento-whatsapp"],
  },
  {
    id: "lancamentos",
    label: "Lançamentos",
    icon: "Rocket",
    color: "bg-orange-500",
    textColor: "text-orange-500",
    description: "Empreendimentos imobiliários",
    pathPatterns: ["/lancamentos/", "/lancamentos"],
    exactPaths: ["/lancamentos"],
  },
  {
    id: "parcelamento",
    label: "Loteamentos",
    icon: "Map",
    color: "bg-lime-600",
    textColor: "text-lime-600",
    description: "Parcelamento de Solo — Análise e Viabilidade",
    pathPatterns: ["/parcelamento/", "/parcelamento"],
    exactPaths: ["/parcelamento"],
  },
  {
    id: "admin",
    label: "Administração",
    icon: "Settings",
    color: "bg-gray-500",
    textColor: "text-gray-500",
    description: "Configurações e gestão do sistema",
    pathPatterns: ["/admin/"],
    exactPaths: [
      "/dados-empresa",
      "/meu-plano",
      "/faturas",
      "/usuarios",
      "/modulos-extras",
      "/configuracoes-site",
      "/admin",
    ],
  },
  {
    id: "superadmin",
    label: "Super Admin",
    icon: "Crown",
    color: "bg-amber-500",
    textColor: "text-amber-500",
    description: "Gestão multi-empresas",
    pathPatterns: ["/sa/", "/sa"],
    exactPaths: ["/sa"],
  },
];

// ─── Path → Module Detection ────────────────────────────────
// Order matters! More specific modules are checked first.
const DETECTION_ORDER: ModuleId[] = [
  "home",            // / , /tarefas, /atalhos, /configuracoes — check first (exact paths)
  "superadmin",      // /sa/* — check first (admin area)
  "contabilidade",   // /financeiro/contabil-* — BEFORE financeiro
  "clm",             // /contratos/* (sub-routes) — BEFORE cadastros
  "whatsapp",        // /atendimento-whatsapp — specific
  "lancamentos",     // /lancamentos/*
  "parcelamento",    // /parcelamento/*
  "comercial",       // /comercial/*, /leads, /novos-negocios, /negocios
  "relacionamento",  // /relacionamento/*, /atendimento, etc
  "financeiro",      // /financeiro/* (remaining after contabilidade)
  "juridico",        // /juridico/*, /due-diligence
  "admin",           // /admin/*, /dados-empresa, etc
  "cadastros",       // /imoveis, /pessoas, /contratos (exact), /garantias
  "dashboard",       // / (exact match — last resort)
];

const moduleMap = new Map<ModuleId, ModuleDefinition>();
MODULE_DEFINITIONS.forEach((m) => moduleMap.set(m.id, m));

export function getModuleByPath(pathname: string): ModuleId {
  const normalizedPath = pathname.endsWith("/") && pathname !== "/"
    ? pathname.slice(0, -1)
    : pathname;

  for (const moduleId of DETECTION_ORDER) {
    const mod = moduleMap.get(moduleId)!;

    // Check exact paths first
    if (mod.exactPaths) {
      for (const exact of mod.exactPaths) {
        if (normalizedPath === exact) return moduleId;
      }
    }

    // Check prefix patterns
    for (const pattern of mod.pathPatterns) {
      if (pattern.endsWith("/")) {
        // Prefix match: path must start with pattern
        if (normalizedPath.startsWith(pattern)) return moduleId;
      } else {
        // Exact or startsWith match
        if (normalizedPath === pattern || normalizedPath.startsWith(pattern + "/")) {
          return moduleId;
        }
      }
    }
  }

  return "home"; // fallback — tudo que não bate em módulo conhecido cai na Home
}

export function getModuleDefinition(id: ModuleId): ModuleDefinition {
  return moduleMap.get(id) || MODULE_DEFINITIONS[0];
}

// ─── LocalStorage Key ───────────────────────────────────────
const STORAGE_KEY = "intentus_active_module";

function loadStoredModule(): ModuleId | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && moduleMap.has(stored as ModuleId)) {
      return stored as ModuleId;
    }
  } catch {
    // localStorage unavailable
  }
  return null;
}

function saveModule(id: ModuleId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage unavailable
  }
}

// ─── Context ────────────────────────────────────────────────
interface ActiveModuleContextValue {
  activeModule: ModuleId;
  activeModuleDefinition: ModuleDefinition;
  setActiveModule: (id: ModuleId) => void;
  allModules: ModuleDefinition[];
  getModuleByPath: (pathname: string) => ModuleId;
  getModuleDefinition: (id: ModuleId) => ModuleDefinition;
}

const ActiveModuleContext = createContext<ActiveModuleContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────
interface ActiveModuleProviderProps {
  children: ReactNode;
  currentPath: string;
}

export function ActiveModuleProvider({ children, currentPath }: ActiveModuleProviderProps) {
  const [activeModule, setActiveModuleState] = useState<ModuleId>(() => {
    // Priority: URL detection > localStorage > home
    const fromUrl = getModuleByPath(currentPath);
    if (fromUrl !== "dashboard" || currentPath === "/dashboard") return fromUrl;
    return loadStoredModule() || "home";
  });

  // Auto-detect module when URL changes
  useEffect(() => {
    const detected = getModuleByPath(currentPath);
    if (detected !== activeModule) {
      setActiveModuleState(detected);
      saveModule(detected);
    }
  }, [currentPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveModule = useCallback((id: ModuleId) => {
    setActiveModuleState(id);
    saveModule(id);
  }, []);

  const activeModuleDefinition = useMemo(
    () => getModuleDefinition(activeModule),
    [activeModule]
  );

  const value = useMemo<ActiveModuleContextValue>(
    () => ({
      activeModule,
      activeModuleDefinition,
      setActiveModule,
      allModules: MODULE_DEFINITIONS,
      getModuleByPath,
      getModuleDefinition,
    }),
    [activeModule, activeModuleDefinition, setActiveModule]
  );

  return (
    <ActiveModuleContext.Provider value={value}>
      {children}
    </ActiveModuleContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────
export function useActiveModule(): ActiveModuleContextValue {
  const context = useContext(ActiveModuleContext);
  if (!context) {
    throw new Error("useActiveModule must be used within an ActiveModuleProvider");
  }
  return context;
}
