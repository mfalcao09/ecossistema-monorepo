import { useState, useMemo } from "react";
import {
  Building2,
  Home,
  Users,
  FileText,
  FileX,
  Wrench,
  Scale,
  LayoutDashboard,
  Globe,
  LogOut,
  UserCog,
  Rocket,
  ListChecks,
  ChevronRight,
  MessageCircle,
  LayoutGrid,
  Columns3,
  FileCheck,
  CheckSquare,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  AlertTriangle,
  BarChart3,
  Shield,
  Handshake,
  Landmark,
  DollarSign,
  ArrowRightLeft,
  UserPlus,
  Receipt,
  FileSpreadsheet,
  ShieldCheck,
  Crown,
  Headset,
  Fingerprint,
  Megaphone,
  ScrollText,
  KeyRound,
  CalendarDays,
  Eye,
  Trophy,
  TrendingUp,
  Zap,
  Lock,
  FileBarChart,
  Star,
  Send,
  FileSearch,
  FolderTree,
  FastForward,
  Settings,
  PenTool,
  MapPin,
  ClipboardCheck,
  Gavel,
  Bot,
  Cpu,
  Network,
  ScanSearch,
  BookOpen,
  BookText,
  Package,
  FileUp,
  SlidersHorizontal,
  Bell,
  Brain,
  Activity,
  Share2,
  GitMerge,
  Trash2,
  GitCompareArrows,
  Radar,
  Dna,
  Radio,
  Target,
  Mail,
  LineChart,
  ShieldAlert,
  UserMinus,
  BrainCircuit,
  Heart,
  Plus,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useTenantModules } from "@/hooks/useTenantModules";
import { useIsPageAllowed } from "@/hooks/useUserPagePermissions";
import { useSuperAdminView } from "@/hooks/useSuperAdminView";
import { usePlatformIdentity } from "@/hooks/usePlatformIdentity";
import { useWhatsappProductEnabled } from "@/hooks/useWhatsappProductEnabled";
import { useAddonProducts } from "@/hooks/useAddonProducts";
import { useChatSubscription } from "@/hooks/useChatSubscription";
import { useActiveModule, type ModuleId } from "@/hooks/useActiveModule";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type PlanTier = "basico" | "profissional" | "enterprise";

const MODULE_PLAN_TIER: Record<string, PlanTier> = {
  // Básico
  imoveis: "basico", pessoas: "basico", contratos: "basico",
  comercial_basico: "basico", dashboard_comercial: "basico", novo_negocio: "basico",
  negocios_andamento: "basico", pipeline: "basico",
  financeiro_basico: "basico", receitas: "basico", despesas: "basico",
  fluxo_caixa: "basico", inadimplencia: "basico", faturas_emitidas: "basico",
  relacionamento_basico: "basico", gestao_relacionamento: "basico",
  central_atendimento: "basico", contratos_relacionamento: "basico",
  rescisoes: "basico", renovacoes: "basico",
  // Profissional
  comercial_intermediario: "profissional", agenda_visitas: "profissional",
  disponibilidade: "profissional", avaliacoes_mercado: "profissional",
  financeiro_intermediario: "profissional", contas_bancarias: "profissional",
  centros_custo: "profissional", conciliacao_bancaria: "profissional",
  relacionamento_intermediario: "profissional", reajustes: "profissional",
  liberacao_garantias: "profissional", seguros_sinistros: "profissional",
  juridico_intermediario: "profissional", analises: "profissional",
  due_diligence: "profissional", notificacoes_extrajudiciais: "profissional",
  seguros_obrigatorios: "profissional", controle_ocupacao: "profissional",
  api: "profissional",
  // Enterprise
  garantias: "enterprise", addon_empreendimentos: "enterprise",
  comercial_completo: "enterprise", financeiro_completo: "enterprise",
  relacionamento_completo: "enterprise", juridico_completo: "enterprise",
  modelos_contrato: "enterprise", procuracoes: "enterprise",
  processos_judiciais: "enterprise", compliance: "enterprise",
  assinaturas_digitais: "enterprise", conformidade_tributaria: "enterprise",
  // Add-ons (Enterprise tier)
  addon_metas_ranking: "enterprise", addon_exclusividades: "enterprise",
  addon_relatorios_comercial: "enterprise", automacoes_comercial: "enterprise",
  addon_comissoes: "enterprise", addon_repasses: "enterprise",
  addon_garantias_contratuais: "enterprise", addon_notas_fiscais: "enterprise",
  addon_dre_gerencial: "enterprise", addon_antecipacao: "enterprise",
  addon_retencao_ir: "enterprise", addon_dimob: "enterprise",
  addon_relatorios_financeiro: "enterprise", addon_plano_contas: "enterprise",
  addon_config_financeiras: "enterprise", addon_automacoes_financeiro: "enterprise",
  addon_pesquisa_satisfacao: "enterprise", addon_regua_comunicacao: "enterprise",
  addon_automacoes_relacionamento: "enterprise", addon_manutencao_vistorias: "enterprise",
  addon_contabilidade_avancada: "enterprise", addon_juridico_avancado: "enterprise",
};

const TIER_CONFIG: Record<PlanTier, { label: string; className: string }> = {
  basico: { label: "BÁSICO", className: "bg-blue-500/20 text-blue-400" },
  profissional: { label: "PRO", className: "bg-purple-500/20 text-purple-400" },
  enterprise: { label: "ENTERPRISE", className: "bg-amber-500/20 text-amber-400" },
};

function PlanBadge({ moduleKey }: { moduleKey?: string }) {
  if (!moduleKey) return null;
  const tier = MODULE_PLAN_TIER[moduleKey];
  if (!tier) return null;
  const config = TIER_CONFIG[tier];
  return (
    <span className={`ml-auto inline-flex items-center rounded px-1 py-0 text-[9px] font-bold leading-tight whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  );
}

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
  module?: string;
}

interface NavItemWithSub extends NavItem {
  children?: { title: string; url: string }[];
}

const mainNav: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
];

// Atalho "Home" que prefixa a sidebar contextual de todos os módulos.
// Permite que o usuário sempre consiga voltar pra Home a partir de qualquer módulo.
// Sessão 131 Passo 7: garantir retorno universal à Home.
const homeShortcutItem: NavItem = {
  title: "Home",
  url: "/",
  icon: Home,
};

// Helper que prepend o atalho Home como primeiro item da primeira section.
// Usado por todos os módulos contextuais (exceto home/dashboard/superadmin).
function withHomeShortcut<T extends { label: string; items: NavItem[] }>(
  sections: T[],
): T[] {
  if (sections.length === 0) return sections;
  const [first, ...rest] = sections;
  return [
    { ...first, items: [homeShortcutItem, ...first.items] },
    ...rest,
  ];
}

const cadastrosNav: NavItem[] = [
  { title: "Imóveis", url: "/imoveis", icon: Building2, module: "imoveis" },
  { title: "Favoritos", url: "/favoritos", icon: Heart, module: "imoveis" },
  { title: "Pessoas", url: "/pessoas", icon: Users, module: "pessoas" },
  { title: "Contratos", url: "/contratos", icon: FileText, module: "contratos" },
  { title: "Garantias Contratuais", url: "/garantias", icon: Shield, roles: ["admin", "gerente", "juridico", "financeiro"], module: "garantias" },
];

const gestaoContratosNav: NavItem[] = [
  { title: "Command Center", url: "/contratos/command-center", icon: LayoutDashboard, module: "contratos" },
  { title: "Dashboard CLM", url: "/contratos/analytics", icon: BarChart3, module: "contratos" },
  { title: "Contratos", url: "/contratos", icon: FileText, module: "contratos" },
  { title: "Central de Aprovações", url: "/contratos/aprovacoes", icon: Shield, module: "contratos" },
  { title: "Rescisões", url: "/rescisoes", icon: FileX, module: "relacionamento_basico" },
  { title: "Renovações", url: "/renovacoes", icon: ScrollText, module: "relacionamento_basico" },
  { title: "Reajustes", url: "/reajustes", icon: Scale, module: "relacionamento_intermediario" },
  { title: "Assinaturas Digitais", url: "/juridico/assinaturas", icon: PenTool, roles: ["admin", "gerente", "juridico"], module: "juridico_completo" },
  { title: "Minutário", url: "/contratos/minutario", icon: FileCheck, module: "contratos" },
  { title: "Biblioteca de Cláusulas", url: "/contratos/clausulas", icon: BookOpen, module: "contratos" },
  { title: "Relatórios CLM", url: "/contratos/relatorios", icon: BarChart3, module: "contratos" },
  { title: "Compliance", url: "/contratos/compliance", icon: ShieldCheck, module: "contratos" },
  { title: "Cobrança", url: "/contratos/cobranca", icon: AlertTriangle, module: "contratos" },
  { title: "Configurações CLM", url: "/contratos/configuracoes", icon: Settings, roles: ["admin", "gerente"], module: "contratos" },
];

const lancamentosNav: NavItem[] = [
  { title: "Empreendimentos", url: "/lancamentos", icon: Rocket, roles: ["admin", "gerente"], module: "addon_empreendimentos" },
  { title: "Espelho de Vendas", url: "/lancamentos/espelho", icon: LayoutGrid, roles: ["admin", "gerente", "corretor"], module: "addon_empreendimentos" },
  { title: "Pipeline de Vendas", url: "/lancamentos/pipeline", icon: Columns3, roles: ["admin", "gerente", "corretor"], module: "addon_empreendimentos" },
  { title: "Propostas", url: "/lancamentos/propostas", icon: FileText, roles: ["admin", "gerente", "corretor", "financeiro"], module: "addon_empreendimentos" },
  { title: "Contratos", url: "/lancamentos/contratos", icon: FileCheck, roles: ["admin", "gerente", "financeiro", "juridico"], module: "addon_empreendimentos" },
  { title: "Dashboard Comercial", url: "/lancamentos/dashboard", icon: BarChart3, roles: ["admin", "gerente"], module: "addon_empreendimentos" },
  { title: "Tarefas", url: "/lancamentos/tarefas", icon: CheckSquare, roles: ["admin", "gerente", "corretor"], module: "addon_empreendimentos" },
];

// ─── Parcelamento de Solo — Nav Items ───────────────────────
// Sessão 130 CONT3 Passo 5: sidebar contextual do módulo Parcelamento
const parcelamentoNav: NavItem[] = [
  { title: "Dashboard", url: "/parcelamento", icon: LayoutDashboard, roles: ["admin", "gerente"] },
  { title: "Novo Projeto", url: "/parcelamento?novo=1", icon: Plus, roles: ["admin", "gerente"] },
  { title: "Comparar Empreendimentos", url: "/parcelamento/comparar", icon: GitCompareArrows, roles: ["admin", "gerente"] },
  { title: "Detalhamento de Projetos", url: "/parcelamento/projetos", icon: FileSearch, roles: ["admin", "gerente"] },
  { title: "Biblioteca de Conhecimento", url: "/parcelamento/biblioteca", icon: BookText, roles: ["admin", "gerente"] },
  { title: "Drive", url: "/parcelamento/drive", icon: FolderTree, roles: ["admin", "gerente"] },
  { title: "Lixeira", url: "/parcelamento/lixeira", icon: Trash2, roles: ["admin", "gerente"] },
  { title: "Configuração do Módulo", url: "/parcelamento/config", icon: Settings, roles: ["admin", "gerente"] },
];

// ─── Home — Nav Items (sidebar global, só aparece em "/", /tarefas, /atalhos, /configuracoes) ──
// Sessão 130 CONT3 Passo 6: sidebar principal da Home nova
const homeNav: NavItem[] = [
  { title: "Home", url: "/", icon: Home, roles: ["admin", "gerente", "corretor", "financeiro", "juridico"] },
  { title: "Minhas Tarefas", url: "/tarefas", icon: CheckSquare, roles: ["admin", "gerente", "corretor", "financeiro", "juridico"] },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["admin", "gerente"] },
  { title: "Atalhos", url: "/atalhos", icon: Zap, roles: ["admin", "gerente", "corretor", "financeiro", "juridico"] },
  { title: "Configurações", url: "/configuracoes", icon: Settings, roles: ["admin", "gerente"] },
];

const financeNav: NavItemWithSub[] = [
  { title: "Faturas", url: "/financeiro/faturas-emitidas", icon: Receipt, roles: ["admin", "gerente", "financeiro"], module: "financeiro_basico" },
  {
    title: "Receitas", url: "/financeiro/receitas", icon: ArrowUpRight,
    roles: ["admin", "gerente", "financeiro"], module: "financeiro_basico",
    children: [
      { title: "A Receber", url: "/financeiro/receitas" },
    ],
  },
  {
    title: "Despesas", url: "/financeiro/despesas", icon: ArrowDownRight,
    roles: ["admin", "gerente", "financeiro"], module: "financeiro_basico",
    children: [
      { title: "A Pagar", url: "/financeiro/despesas" },
    ],
  },
  { title: "Inadimplência", url: "/financeiro/inadimplencia", icon: AlertTriangle, roles: ["admin", "gerente", "financeiro"], module: "financeiro_basico" },
  { title: "Fluxo de Caixa", url: "/financeiro/caixa", icon: Wallet, roles: ["admin", "gerente", "financeiro"], module: "financeiro_basico" },
  { title: "Contas Bancárias", url: "/financeiro/contas", icon: Landmark, roles: ["admin", "gerente", "financeiro"], module: "financeiro_intermediario" },
  { title: "Conciliação Bancária", url: "/financeiro/conciliacao", icon: FileSearch, roles: ["admin", "gerente", "financeiro"], module: "financeiro_intermediario" },
  { title: "Centros de Custo", url: "/financeiro/centros-custo", icon: FolderTree, roles: ["admin", "gerente", "financeiro"], module: "financeiro_intermediario" },
  { title: "Plano de Contas", url: "/financeiro/plano-contas", icon: FolderTree, roles: ["admin", "gerente", "financeiro"], module: "addon_plano_contas" },
  { title: "Antecipação", url: "/financeiro/antecipacao", icon: FastForward, roles: ["admin", "gerente", "financeiro"], module: "addon_antecipacao" },
  { title: "Comissões", url: "/financeiro/comissoes", icon: DollarSign, roles: ["admin", "gerente", "financeiro"], module: "addon_comissoes" },
  { title: "Repasses", url: "/financeiro/repasses", icon: ArrowRightLeft, roles: ["admin", "gerente", "financeiro"], module: "addon_repasses" },
  { title: "Garantias Contratuais", url: "/financeiro/garantias-locaticias", icon: Shield, roles: ["admin", "gerente", "financeiro"], module: "addon_garantias_contratuais" },
  { title: "Notas Fiscais", url: "/financeiro/notas-fiscais", icon: FileText, roles: ["admin", "gerente", "financeiro"], module: "addon_notas_fiscais" },
  { title: "DRE Gerencial", url: "/financeiro/dre", icon: TrendingUp, roles: ["admin", "gerente", "financeiro"], module: "addon_dre_gerencial" },
  { title: "Retenção IR", url: "/financeiro/ir", icon: Receipt, roles: ["admin", "gerente", "financeiro"], module: "addon_retencao_ir" },
  { title: "DIMOB", url: "/financeiro/dimob", icon: FileSpreadsheet, roles: ["admin", "gerente", "financeiro"], module: "addon_dimob" },
  { title: "Relatórios", url: "/financeiro/relatorios", icon: BarChart3, roles: ["admin", "gerente", "financeiro"], module: "addon_relatorios_financeiro" },
  { title: "Configurações Financeiras", url: "/financeiro/configuracoes", icon: Settings, roles: ["admin", "gerente"], module: "addon_config_financeiras" },
  { title: "Automações", url: "/financeiro/automacoes", icon: Zap, roles: ["admin", "gerente"], module: "addon_automacoes_financeiro" },
];

const contabilidadeAvancadaNav: NavItem[] = [
  { title: "Dashboard Contábil", url: "/financeiro/contabil-dashboard", icon: LayoutDashboard, roles: ["admin", "gerente", "financeiro"], module: "addon_contabilidade_avancada" },
  { title: "Livro Diário", url: "/financeiro/livro-diario", icon: BookOpen, roles: ["admin", "gerente", "financeiro"], module: "addon_contabilidade_avancada" },
  { title: "Livro Razão", url: "/financeiro/livro-razao", icon: BookText, roles: ["admin", "gerente", "financeiro"], module: "addon_contabilidade_avancada" },
  { title: "Balancete", url: "/financeiro/balancete", icon: FileCheck, roles: ["admin", "gerente", "financeiro"], module: "addon_contabilidade_avancada" },
  { title: "Balanço Patrimonial", url: "/financeiro/balanco", icon: Scale, roles: ["admin", "gerente", "financeiro"], module: "addon_contabilidade_avancada" },
  { title: "Prestação de Contas", url: "/financeiro/prestacao-contas", icon: FileBarChart, roles: ["admin", "gerente", "financeiro"], module: "addon_contabilidade_avancada" },
  { title: "Fechamento de Período", url: "/financeiro/fechamento", icon: Lock, roles: ["admin", "gerente"], module: "addon_contabilidade_avancada" },
  { title: "Rateio de Despesas", url: "/financeiro/rateio", icon: ArrowRightLeft, roles: ["admin", "gerente", "financeiro"], module: "addon_contabilidade_avancada" },
  { title: "Exportação Contábil", url: "/financeiro/exportacao-contabil", icon: FileSpreadsheet, roles: ["admin", "gerente", "financeiro"], module: "addon_contabilidade_avancada" },
  { title: "Conciliação Contábil", url: "/financeiro/conciliacao-contabil", icon: FileSearch, roles: ["admin", "gerente", "financeiro"], module: "addon_contabilidade_avancada" },
];

const adminNav: NavItem[] = [
  { title: "Dashboard Admin", url: "/admin/dashboard", icon: LayoutDashboard, roles: ["admin", "gerente"] },
  { title: "Configurações da Empresa", url: "/dados-empresa", icon: Building2, roles: ["admin", "gerente"] },
  { title: "Meu Plano", url: "/meu-plano", icon: Crown, roles: ["admin", "gerente"] },
  { title: "Faturas", url: "/faturas", icon: FileText, roles: ["admin", "gerente"] },
  { title: "Módulos Extras", url: "/modulos-extras", icon: Package, roles: ["admin", "gerente"] },
  { title: "Gestão de Usuários", url: "/usuarios", icon: UserCog, roles: ["admin", "gerente"] },
  { title: "Configurações Globais", url: "/admin/configuracoes", icon: Settings, roles: ["admin", "gerente"] },
  { title: "Base de Conhecimento IA", url: "/admin/ia-conhecimento", icon: Brain, roles: ["admin", "gerente"] },
  { title: "Configurações do Site", url: "/configuracoes-site", icon: Globe, roles: ["admin", "gerente"], module: "addon_site_settings" },
];

const comercialNav: NavItem[] = [
  { title: "Dashboard", url: "/comercial/dashboard", icon: BarChart3, roles: ["admin", "gerente", "corretor"], module: "comercial_basico" },
  { title: "Iniciar Novo Negócio", url: "/novos-negocios", icon: Rocket, roles: ["admin", "gerente", "corretor"], module: "comercial_basico" },
  { title: "Negócios em Andamento", url: "/negocios", icon: ListChecks, roles: ["admin", "gerente", "corretor", "juridico", "financeiro"], module: "comercial_basico" },
  { title: "Pipeline", url: "/leads", icon: UserPlus, roles: ["admin", "gerente", "corretor"], module: "comercial_basico" },
  { title: "Distribuição de Leads", url: "/comercial/distribuicao-leads", icon: Share2, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Captação Multi-Canal", url: "/comercial/captacao-canais", icon: Radio, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Win/Loss Analysis", url: "/comercial/win-loss", icon: Target, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "ROI por Canal", url: "/comercial/roi-canais", icon: TrendingUp, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Relatório IA", url: "/comercial/relatorio-ia", icon: FileBarChart, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Forecast Receita", url: "/comercial/forecast", icon: TrendingUp, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Matching Imóvel-Cliente", url: "/comercial/matching", icon: Zap, roles: ["admin", "gerente", "corretor"], module: "comercial_basico" },
  { title: "Conversation Intelligence", url: "/comercial/conversation-intelligence", icon: Activity, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Conv. Intelligence IA", url: "/comercial/conversation-intelligence-advanced", icon: Brain, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Coaching IA", url: "/comercial/coaching-ia", icon: Brain, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Filtros & Views", url: "/comercial/filtros-avancados", icon: SlidersHorizontal, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Email CRM", url: "/comercial/email", icon: Mail, roles: ["admin", "gerente", "corretor"], module: "comercial_basico" },
  { title: "Monitor SLA", url: "/comercial/sla", icon: ShieldCheck, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Ranking", url: "/comercial/ranking", icon: Trophy, roles: ["admin", "gerente", "corretor"], module: "comercial_basico" },
  { title: "Follow-up IA", url: "/comercial/follow-up", icon: Send, roles: ["admin", "gerente", "corretor"], module: "comercial_basico" },
  { title: "Agenda de Visitas", url: "/comercial/agenda", icon: CalendarDays, roles: ["admin", "gerente", "corretor"], module: "comercial_intermediario" },
  { title: "Disponibilidade", url: "/comercial/disponibilidade", icon: Eye, roles: ["admin", "gerente", "corretor"], module: "comercial_intermediario" },
  { title: "Avaliações de Mercado", url: "/comercial/avaliacoes", icon: TrendingUp, roles: ["admin", "gerente", "corretor"], module: "comercial_intermediario" },
  { title: "Metas & Ranking", url: "/comercial/metas", icon: Trophy, roles: ["admin", "gerente", "corretor"], module: "addon_metas_ranking" },
  { title: "Exclusividades", url: "/comercial/exclusividades", icon: Lock, roles: ["admin", "gerente", "corretor"], module: "addon_exclusividades" },
  { title: "Pulse", url: "/comercial/pulse", icon: Activity, roles: ["admin", "gerente", "corretor"], module: "comercial_basico" },
  { title: "Automações", url: "/comercial/automacoes", icon: Zap, roles: ["admin", "gerente"], module: "comercial_completo" },
  { title: "Relatórios", url: "/comercial/relatorios", icon: FileBarChart, roles: ["admin", "gerente"], module: "addon_relatorios_comercial" },
  { title: "Pipeline Analytics", url: "/comercial/analytics", icon: BarChart3, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Assistente IA", url: "/comercial/assistente-ia", icon: Bot, roles: ["admin", "gerente", "corretor"], module: "comercial_basico" },
  { title: "Deduplicação", url: "/comercial/deduplicacao", icon: GitMerge, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Prospector IA", url: "/comercial/prospector", icon: Target, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Nurturing", url: "/comercial/nurturing", icon: Megaphone, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Deal Forecast IA", url: "/comercial/deal-forecast", icon: LineChart, roles: ["admin", "gerente"], module: "comercial_basico" },
  { title: "Portais BR", url: "/comercial/portais", icon: Globe, roles: ["admin", "gerente"], module: "comercial_basico" },
];

const juridicoNav: NavItem[] = [
  { title: "Análises", url: "/juridico", icon: Scale, roles: ["admin", "gerente", "juridico"], module: "juridico_intermediario" },
  { title: "Due Diligence", url: "/due-diligence", icon: ShieldCheck, roles: ["admin", "gerente", "juridico", "corretor"], module: "juridico_intermediario" },
  { title: "Notificações Extrajudiciais", url: "/juridico/notificacoes", icon: Send, roles: ["admin", "gerente", "juridico"], module: "juridico_intermediario" },
  { title: "Seguros Obrigatórios", url: "/juridico/seguros-obrigatorios", icon: Shield, roles: ["admin", "gerente", "juridico"], module: "juridico_intermediario" },
  { title: "Controle de Ocupação", url: "/juridico/ocupacao", icon: MapPin, roles: ["admin", "gerente", "juridico"], module: "juridico_intermediario" },
  { title: "Modelos de Contrato", url: "/juridico/modelos", icon: FileText, roles: ["admin", "gerente", "juridico"], module: "juridico_completo" },
  { title: "Procurações", url: "/juridico/procuracoes", icon: KeyRound, roles: ["admin", "gerente", "juridico"], module: "juridico_completo" },
  { title: "Processos Judiciais", url: "/juridico/processos", icon: Gavel, roles: ["admin", "gerente", "juridico"], module: "juridico_completo" },
  { title: "Compliance", url: "/juridico/compliance", icon: ClipboardCheck, roles: ["admin", "gerente", "juridico"], module: "juridico_completo" },
  { title: "Conformidade Tributária", url: "/juridico/conformidade-tributaria", icon: FileSearch, roles: ["admin", "gerente", "juridico"], module: "juridico_completo" },
];

const juridicoAvancadoNav: NavItem[] = [
  { title: "Despacho e Órgãos", url: "/juridico/despacho", icon: Landmark, roles: ["admin", "gerente", "juridico"], module: "addon_juridico_avancado" },
  { title: "LGPD e Privacidade", url: "/juridico/lgpd", icon: Lock, roles: ["admin", "gerente", "juridico"], module: "addon_juridico_avancado" },
  { title: "OCR & IA Documental", url: "/juridico/ocr-matriculas", icon: ScanSearch, roles: ["admin", "gerente", "juridico"], module: "addon_juridico_avancado" },
  { title: "Relatório de Documentos", url: "/juridico/relatorios-documentos", icon: FileBarChart, roles: ["admin", "gerente", "juridico"], module: "addon_juridico_avancado" },
  { title: "Legal Desk", url: "/juridico/legal-desk", icon: Bot, roles: ["admin", "gerente", "juridico", "corretor"], module: "addon_juridico_avancado" },
  { title: "Jurimetria", url: "/juridico/jurimetria", icon: BarChart3, roles: ["admin", "gerente", "juridico"], module: "addon_juridico_avancado" },
  { title: "Mapeamento Societário", url: "/juridico/societario", icon: Network, roles: ["admin", "gerente", "juridico"], module: "addon_juridico_avancado" },
];

const whatsappNav: NavItem[] = [
  { title: "Atendimento WhatsApp", url: "/atendimento-whatsapp", icon: MessageCircle },
];

const relacionamentoNav: NavItem[] = [
  { title: "Dashboard", url: "/relacionamento", icon: LayoutDashboard, module: "relacionamento_basico" },
  { title: "Churn Radar 360°", url: "/relacionamento/churn-radar", icon: Radar, roles: ["admin", "gerente"] as AppRole[], module: "relacionamento_basico" },
  { title: "DNA do Cliente", url: "/relacionamento/dna-cliente", icon: Dna, roles: ["admin", "gerente"] as AppRole[], module: "relacionamento_basico" },
  { title: "Sentiment Scanner", url: "/relacionamento/sentiment-scanner", icon: ScanSearch, roles: ["admin", "gerente"] as AppRole[], module: "relacionamento_basico" },
  { title: "Churn Interceptor", url: "/relacionamento/churn-interceptor", icon: ShieldAlert, roles: ["admin", "gerente"] as AppRole[], module: "relacionamento_basico" },
  { title: "IntelliHome Concierge", url: "/relacionamento/intellihome", icon: Bot, roles: ["admin", "gerente"] as AppRole[], module: "relacionamento_basico" },
  { title: "Digital Twin", url: "/relacionamento/digital-twin", icon: Cpu, roles: ["admin", "gerente"] as AppRole[], module: "relacionamento_basico" },
  { title: "Life Events", url: "/relacionamento/life-events", icon: CalendarDays, roles: ["admin", "gerente"] as AppRole[], module: "relacionamento_basico" },
  { title: "Next Best Action", url: "/relacionamento/next-best-action", icon: Target, roles: ["admin", "gerente"] as AppRole[], module: "relacionamento_basico" },
  { title: "Revenue & LTV", url: "/relacionamento/revenue-ltv", icon: DollarSign, roles: ["admin", "gerente"] as AppRole[], module: "relacionamento_basico" },
  { title: "Exit Experience", url: "/relacionamento/exit-experience", icon: UserMinus, roles: ["admin", "gerente"] as AppRole[], module: "relacionamento_basico" },
  { title: "Feedback Intelligence", url: "/relacionamento/feedback-intelligence", icon: BrainCircuit, roles: ["admin", "gerente"] as AppRole[], module: "relacionamento_basico" },
  { title: "Central de Atendimento", url: "/atendimento", icon: Headset, module: "relacionamento_basico" },
  { title: "Liberação de Garantias", url: "/liberacao-garantias", icon: KeyRound, module: "relacionamento_intermediario" },
  { title: "Seguros & Sinistros", url: "/relacionamento/seguros", icon: ShieldCheck, roles: ["admin", "gerente", "financeiro"] as AppRole[], module: "relacionamento_intermediario" },
  { title: "Pesquisa de Satisfação", url: "/relacionamento/pesquisas", icon: Star, roles: ["admin", "gerente"] as AppRole[], module: "addon_pesquisa_satisfacao" },
  { title: "Régua de Comunicação", url: "/relacionamento/regua", icon: Send, roles: ["admin", "gerente"] as AppRole[], module: "addon_regua_comunicacao" },
  { title: "Automações", url: "/relacionamento/automacoes", icon: Zap, roles: ["admin", "gerente"] as AppRole[], module: "addon_automacoes_relacionamento" },
  { title: "Manutenção & Vistorias", url: "/manutencao", icon: Wrench, roles: ["admin", "gerente", "manutencao"] as AppRole[], module: "addon_manutencao_vistorias" },
];

const publicNav: NavItem[] = [
  { title: "Site Público", url: "/vitrine", icon: Globe, module: "vitrine" },
];

const superadminNav: NavItem[] = [
  { title: "Dashboard", url: "/sa", icon: LayoutDashboard, roles: ["superadmin"] },
  { title: "Comercial", url: "/sa/comercial", icon: Megaphone, roles: ["superadmin"] },
  { title: "Empresas", url: "/sa/empresas", icon: Building2, roles: ["superadmin"] },
  { title: "Planos", url: "/sa/planos", icon: Crown, roles: ["superadmin"] },
  { title: "Financeiro", url: "/sa/financeiro", icon: DollarSign, roles: ["superadmin"] },
  { title: "Integração Bancária", url: "/sa/integracao-bancaria", icon: Landmark, roles: ["superadmin"] },
  { title: "Usuários", url: "/sa/usuarios", icon: UserCog, roles: ["superadmin"] },
  { title: "Identidade", url: "/sa/identidade", icon: Fingerprint, roles: ["superadmin"] },
  { title: "Add-on WhatsApp", url: "/sa/addon-whatsapp", icon: MessageCircle, roles: ["superadmin"] },
  { title: "Add-on Produtos", url: "/sa/addon-produtos", icon: Package, roles: ["superadmin"] },
  { title: "IA & Personas", url: "/sa/ia-personas", icon: Bot, roles: ["superadmin"] },
];

function filterByRole(items: NavItem[], roles: AppRole[], hasModule?: (key: string) => boolean, isPageAllowed?: (path: string) => boolean) {
  const isSuperadminRole = roles.includes("superadmin");
  return items.filter((item) => {
    // superadmin bypasses role restrictions (sees all items)
    if (item.roles && !isSuperadminRole && !item.roles.some((r) => roles.includes(r))) return false;
    if (item.module && hasModule && !hasModule(item.module)) return false;
    if (isPageAllowed && !isPageAllowed(item.url)) return false;
    return true;
  });
}

function NavItems({ items, showPlanBadges = false }: { items: NavItem[]; showPlanBadges?: boolean }) {
  return (
    <>
      {items.map((item) => (
        <SidebarMenuItem key={item.url}>
          <SidebarMenuButton asChild>
            <NavLink
              to={item.url}
              end={item.url === "/"}
              className="flex items-center gap-2"
              activeClassName="bg-primary/10 text-primary font-medium [&>svg]:text-primary"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.title}</span>
              {showPlanBadges && <PlanBadge moduleKey={item.module} />}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  );
}

function CollapsibleSection({
  label,
  items,
  currentPath,
  children,
}: {
  label: string;
  items?: { url: string }[];
  currentPath: string;
  children: React.ReactNode;
}) {
  const hasActive = items?.some((i) => currentPath.startsWith(i.url) && i.url !== "/") ?? false;
  return (
    <Collapsible defaultOpen={hasActive} className="group/collapsible">
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="cursor-pointer select-none flex items-center justify-between hover:text-sidebar-foreground">
            {label}
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            {children}
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
// ─── Module → Nav Items Mapping ─────────────────────────────
function useModuleNavItems(
  moduleId: ModuleId,
  roles: AppRole[],
  hasModule: (key: string) => boolean,
  isPageAllowed: (path: string) => boolean,
  isTrial: boolean,
  whatsappVisible: boolean,
  hasAddonProducts: boolean,
  tenantId: string | null,
) {
  return useMemo(() => {
    const f = (items: NavItem[]) => filterByRole(items, roles, hasModule, isPageAllowed);

    switch (moduleId) {
      case "home":
        return { sections: [{ label: "Início", items: f(homeNav) }] };
      case "dashboard":
        // Dashboard usa a mesma sidebar global da Home (sessão 131 Passo 7).
        // Assim o usuário consegue voltar pra Home, acessar Tarefas, Atalhos e Configurações.
        return { sections: [{ label: "Início", items: f(homeNav) }] };
      case "cadastros":
        return { sections: withHomeShortcut([{ label: "Cadastros", items: f(cadastrosNav) }]) };
      case "clm":
        return { sections: withHomeShortcut([{ label: "Gestão de Contratos (CLM)", items: f(gestaoContratosNav) }]) };
      case "comercial":
        return { sections: withHomeShortcut([{ label: "Comercial", items: f(comercialNav) }]) };
      case "relacionamento":
        return { sections: withHomeShortcut([{ label: "Relacionamento", items: f(relacionamentoNav) }]) };
      case "financeiro":
        return { sections: withHomeShortcut([{ label: "Financeiro", items: f(financeNav) }]) };
      case "contabilidade":
        return { sections: withHomeShortcut([{ label: "Contabilidade Avançada", items: f(contabilidadeAvancadaNav) }]) };
      case "juridico": {
        const base = f(juridicoNav);
        const adv = f(juridicoAvancadoNav);
        return {
          sections: withHomeShortcut([{ label: "Jurídico", items: base }]),
          advancedSection: adv.length > 0 ? { label: "Jurídico Avançado", items: adv } : null,
        };
      }
      case "whatsapp":
        return { sections: withHomeShortcut([{ label: "Atendimento WhatsApp", items: whatsappVisible ? whatsappNav : [] }]) };
      case "lancamentos":
        return { sections: withHomeShortcut([{ label: "Lançamentos Imobiliários", items: f(lancamentosNav) }]) };
      case "parcelamento":
        return { sections: withHomeShortcut([{ label: "Parcelamento de Solo", items: f(parcelamentoNav) }]) };
      case "admin": {
        const adminItems = f(adminNav).filter(
          (item) => item.url !== "/modulos-extras" || hasAddonProducts || tenantId === "00000000-0000-0000-0000-000000000001"
        );
        return { sections: withHomeShortcut([{ label: "Administração", items: adminItems }]) };
      }
      case "superadmin":
        return { sections: [{ label: "Super Admin", items: filterByRole(superadminNav, roles, hasModule) }] };
      default:
        return { sections: [] };
    }
  }, [moduleId, roles, hasModule, isPageAllowed, isTrial, whatsappVisible, hasAddonProducts, tenantId]);
}

export function AppSidebar() {
  const { signOut, roles, user, tenantName, tenantId } = useAuth();
  const { hasModule, isTrial } = useTenantModules();
  const { isPageAllowed } = useIsPageAllowed();
  const { viewMode, isSuperAdmin, isImpersonating, impersonatedTenantName } = useSuperAdminView();
  const { identity } = usePlatformIdentity();
  const { hasProducts: hasAddonProducts } = useAddonProducts();
  const { enabled: whatsappProductEnabled } = useWhatsappProductEnabled();
  const { hasSubscription: hasChatSubscription } = useChatSubscription();
  const { activeModule } = useActiveModule();
  const location = useLocation();
  const currentPath = location.pathname;

  // WhatsApp nav item visible only when product is globally enabled AND tenant has active chat subscription
  const whatsappVisible = whatsappProductEnabled && hasChatSubscription;

  const isGestaoMode = isSuperAdmin && viewMode === "gestao";
  const isEmpresaMode = isSuperAdmin && viewMode === "empresa";

  // Get nav items for active module
  const effectiveModule: ModuleId = isGestaoMode ? "superadmin" : activeModule;
  const { sections, advancedSection } = useModuleNavItems(
    effectiveModule,
    roles,
    hasModule,
    isPageAllowed,
    isTrial,
    whatsappVisible,
    hasAddonProducts,
    tenantId,
  ) as any;

  const subtitleText = isGestaoMode
    ? "Gestão Multi-Empresas"
    : isImpersonating
      ? impersonatedTenantName || "Empresa"
      : tenantName || identity.platform_name;

  return (
    <Sidebar>
      <SidebarHeader className="h-16 flex items-center border-b border-sidebar-border px-5">
        <div className="flex items-center gap-2.5 w-full">
          {identity.logo_url ? (
            <img
              src={identity.logo_url}
              alt="Logo"
              className="rounded-lg object-contain h-8 dark:invert dark:brightness-200"
              style={{ maxHeight: '32px' }}
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
              <Home className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
          <span className="font-semibold text-foreground text-lg truncate">
            {subtitleText}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>

        {/* Contextual nav items for active module */}
        {(sections || []).map((section: { label: string; items: NavItem[] }, idx: number) => (
          section.items.length > 0 && (
            <SidebarGroup key={`${section.label}-${idx}`}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItems items={section.items} showPlanBadges={isTrial} />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        ))}

        {/* Jurídico Avançado sub-section (when juridico module is active) */}
        {advancedSection && advancedSection.items.length > 0 && (
          <SidebarGroup>
            <Collapsible defaultOpen={advancedSection.items.some((i: NavItem) => currentPath.startsWith(i.url))} className="group/juridico-adv">
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer select-none flex items-center justify-between hover:text-sidebar-foreground">
                  {advancedSection.label}
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-data-[state=open]/juridico-adv:rotate-90" />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <NavItems items={advancedSection.items} showPlanBadges={isTrial} />
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* SuperAdmin badge for superadmin module */}
        {effectiveModule === "superadmin" && (
          <div className="px-4 py-1">
            <div className="flex items-center gap-1.5 px-2">
              <Crown className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Super Admin</span>
            </div>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-4 py-3">
        <div className="text-[10px] text-center text-muted-foreground">v1.0.0</div>
      </SidebarFooter>
    </Sidebar>
  );
}
