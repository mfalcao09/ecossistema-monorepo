import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ───────────────────────────────────────────────────────
export type ReportPeriod = "7d" | "30d" | "90d" | "12m" | "ytd" | "all" | "custom";

export interface ReportFilters {
  period: ReportPeriod;
  dateFrom?: string;
  dateTo?: string;
  contractType?: string;
  status?: string;
}

export interface ContractsByStatus {
  status: string;
  label: string;
  count: number;
  totalValue: number;
}

export interface ContractsByType {
  type: string;
  label: string;
  count: number;
  totalValue: number;
}

export interface MonthlyTrend {
  month: string;       // "2026-01"
  monthLabel: string;  // "Jan/26"
  newContracts: number;
  closedContracts: number;
  totalValue: number;
}

export interface InstallmentSummary {
  totalPendente: number;
  totalPago: number;
  totalAtrasado: number;
  amountPendente: number;
  amountPago: number;
  amountAtrasado: number;
}

export interface FinancialSummary {
  totalContractValue: number;
  averageContractValue: number;
  totalPaid: number;
  totalReceivable: number;
  totalOverdue: number;
  collectionRate: number; // percentual recebido vs total
}

export interface ContractReportData {
  totalContracts: number;
  byStatus: ContractsByStatus[];
  byType: ContractsByType[];
  monthlyTrend: MonthlyTrend[];
  installments: InstallmentSummary;
  financial: FinancialSummary;
  topContracts: TopContract[];
  generatedAt: string;
}

export interface TopContract {
  id: string;
  title: string | null;
  contractNumber: string | null;
  contractType: string;
  status: string;
  totalValue: number;
  startDate: string | null;
  endDate: string | null;
}

// ─── Constants ───────────────────────────────────────────────────
export const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
  renovado: "Renovado",
  em_revisao: "Em Revisão",
  em_aprovacao: "Em Aprovação",
  aguardando_assinatura: "Aguardando Assinatura",
};

export const TYPE_LABELS: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  administracao: "Administração",
  distrato: "Distrato",
  prestacao_servicos: "Prestação de Serviços",
  obra: "Obra",
  comissao: "Comissão",
  fornecimento: "Fornecimento",
  aditivo: "Aditivo",
  cessao: "Cessão",
  nda: "NDA",
  exclusividade: "Exclusividade",
};

export const STATUS_COLORS: Record<string, string> = {
  rascunho: "#94a3b8",
  ativo: "#22c55e",
  encerrado: "#6b7280",
  cancelado: "#ef4444",
  renovado: "#3b82f6",
  em_revisao: "#f59e0b",
  em_aprovacao: "#8b5cf6",
  aguardando_assinatura: "#e2a93b",
};

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "12m": "Últimos 12 meses",
  ytd: "Ano atual",
  all: "Todo o período",
  custom: "Personalizado",
};

// ─── Helpers ─────────────────────────────────────────────────────
function getDateRange(period: ReportPeriod, dateFrom?: string, dateTo?: string) {
  const now = new Date();
  const to = dateTo || now.toISOString().split("T")[0];
  let from: string;

  switch (period) {
    case "7d":
      from = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
      break;
    case "90d":
      from = new Date(now.getTime() - 90 * 86400000).toISOString().split("T")[0];
      break;
    case "12m":
      from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        .toISOString()
        .split("T")[0];
      break;
    case "ytd":
      from = `${now.getFullYear()}-01-01`;
      break;
    case "all":
      from = "2000-01-01";
      break;
    case "custom":
      from = dateFrom || "2000-01-01";
      break;
    default:
      from = "2000-01-01";
  }

  return { from, to };
}

function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const months = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
}

// ─── Main Fetch ──────────────────────────────────────────────────
async function fetchContractReport(filters: ReportFilters): Promise<ContractReportData> {
  const { from, to } = getDateRange(filters.period, filters.dateFrom, filters.dateTo);

  // 1. Fetch contracts
  let query = supabase
    .from("contracts")
    .select("id, title, contract_number, contract_type, status, total_value, monthly_value, start_date, end_date, created_at")
    .is("deleted_at", null);

  if (filters.period !== "all") {
    query = query.gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`);
  }
  if (filters.contractType) {
    query = query.eq("contract_type", filters.contractType);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data: contracts, error: contractsError } = await query;
  if (contractsError) throw contractsError;
  const list = contracts || [];

  // 2. Fetch installments for these contracts
  const contractIds = list.map((c) => c.id);
  let installmentList: any[] = [];

  if (contractIds.length > 0) {
    // Fetch in batches of 50 to avoid URL length limits
    for (let i = 0; i < contractIds.length; i += 50) {
      const batch = contractIds.slice(i, i + 50);
      const { data, error } = await supabase
        .from("contract_installments")
        .select("contract_id, status, amount, paid_amount, due_date")
        .in("contract_id", batch);
      if (error) throw error;
      installmentList = installmentList.concat(data || []);
    }
  }

  // 3. Build byStatus
  const statusMap: Record<string, { count: number; totalValue: number }> = {};
  list.forEach((c) => {
    if (!statusMap[c.status]) statusMap[c.status] = { count: 0, totalValue: 0 };
    statusMap[c.status].count += 1;
    statusMap[c.status].totalValue += Number(c.total_value || 0);
  });
  const byStatus: ContractsByStatus[] = Object.entries(statusMap).map(([status, data]) => ({
    status,
    label: STATUS_LABELS[status] || status,
    ...data,
  }));

  // 4. Build byType
  const typeMap: Record<string, { count: number; totalValue: number }> = {};
  list.forEach((c) => {
    if (!typeMap[c.contract_type]) typeMap[c.contract_type] = { count: 0, totalValue: 0 };
    typeMap[c.contract_type].count += 1;
    typeMap[c.contract_type].totalValue += Number(c.total_value || 0);
  });
  const byType: ContractsByType[] = Object.entries(typeMap).map(([type, data]) => ({
    type,
    label: TYPE_LABELS[type] || type,
    ...data,
  }));

  // 5. Monthly trend
  const monthMap: Record<string, { newContracts: number; closedContracts: number; totalValue: number }> = {};
  list.forEach((c) => {
    const month = (c.created_at || "").slice(0, 7); // "2026-03"
    if (!month) return;
    if (!monthMap[month]) monthMap[month] = { newContracts: 0, closedContracts: 0, totalValue: 0 };
    monthMap[month].newContracts += 1;
    monthMap[month].totalValue += Number(c.total_value || 0);
    if (c.status === "encerrado" || c.status === "cancelado") {
      monthMap[month].closedContracts += 1;
    }
  });
  const monthlyTrend: MonthlyTrend[] = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      monthLabel: formatMonthLabel(month),
      ...data,
    }));

  // 6. Installment summary
  const today = new Date().toISOString().split("T")[0];
  const pendentes = installmentList.filter(
    (i) => i.status === "pendente" && i.due_date >= today
  );
  const pagos = installmentList.filter((i) => i.status === "pago");
  const atrasados = installmentList.filter(
    (i) => i.status === "atrasado" || (i.status === "pendente" && i.due_date < today)
  );

  const installments: InstallmentSummary = {
    totalPendente: pendentes.length,
    totalPago: pagos.length,
    totalAtrasado: atrasados.length,
    amountPendente: pendentes.reduce((s, i) => s + Number(i.amount || 0), 0),
    amountPago: pagos.reduce((s, i) => s + Number(i.paid_amount || 0), 0),
    amountAtrasado: atrasados.reduce((s, i) => s + Number(i.amount || 0), 0),
  };

  // 7. Financial summary
  const totalContractValue = list.reduce((s, c) => s + Number(c.total_value || 0), 0);
  const totalPaidAll = installments.amountPago;
  const totalReceivable = installments.amountPendente + installments.amountAtrasado;
  const financial: FinancialSummary = {
    totalContractValue,
    averageContractValue: list.length > 0 ? totalContractValue / list.length : 0,
    totalPaid: totalPaidAll,
    totalReceivable,
    totalOverdue: installments.amountAtrasado,
    collectionRate:
      totalPaidAll + totalReceivable > 0
        ? (totalPaidAll / (totalPaidAll + totalReceivable)) * 100
        : 0,
  };

  // 8. Top 10 contracts by value
  const topContracts: TopContract[] = [...list]
    .sort((a, b) => Number(b.total_value || 0) - Number(a.total_value || 0))
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      title: c.title,
      contractNumber: c.contract_number,
      contractType: c.contract_type,
      status: c.status,
      totalValue: Number(c.total_value || 0),
      startDate: c.start_date,
      endDate: c.end_date,
    }));

  return {
    totalContracts: list.length,
    byStatus,
    byType,
    monthlyTrend,
    installments,
    financial,
    topContracts,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Hook ────────────────────────────────────────────────────────
export function useContractReports(filters: ReportFilters) {
  return useQuery({
    queryKey: ["contract-reports", filters],
    queryFn: () => fetchContractReport(filters),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

// ─── Export helpers ──────────────────────────────────────────────
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
