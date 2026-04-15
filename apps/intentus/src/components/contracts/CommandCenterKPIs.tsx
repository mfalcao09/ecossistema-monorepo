import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  DollarSign,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import type { ContractKPIs } from "@/hooks/useContractKPIs";

interface CommandCenterKPIsProps {
  kpis: ContractKPIs | undefined;
  isLoading: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  variant?: "default" | "warning" | "danger" | "success";
  isLoading: boolean;
}

function KPICard({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
  isLoading,
}: KPICardProps) {
  const variantStyles = {
    default: "border-l-4 border-l-blue-500",
    warning: "border-l-4 border-l-yellow-500",
    danger: "border-l-4 border-l-red-500",
    success: "border-l-4 border-l-green-500",
  };

  return (
    <Card className={`${variantStyles[variant]} hover:shadow-md transition-shadow overflow-hidden`}>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {title}
              </span>
              <span className="text-muted-foreground">{icon}</span>
            </div>
            <div className="text-lg font-bold truncate">{value}</div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function CommandCenterKPIs({
  kpis,
  isLoading,
}: CommandCenterKPIsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      <KPICard
        title="Total Contratos"
        value={kpis?.totalContracts ?? 0}
        subtitle={`${kpis?.activeContracts ?? 0} ativos`}
        icon={<FileText className="h-4 w-4" />}
        variant="default"
        isLoading={isLoading}
      />
      <KPICard
        title="Valor Total"
        value={formatCurrency(kpis?.totalValue ?? 0)}
        subtitle={`${formatCurrency(kpis?.activeValue ?? 0)} em ativos`}
        icon={<DollarSign className="h-4 w-4" />}
        variant="default"
        isLoading={isLoading}
      />
      <KPICard
        title="Inadimplência"
        value={kpis?.overdueInstallments ?? 0}
        subtitle={formatCurrency(kpis?.overdueAmount ?? 0)}
        icon={<AlertTriangle className="h-4 w-4" />}
        variant={(kpis?.overdueInstallments ?? 0) > 0 ? "danger" : "success"}
        isLoading={isLoading}
      />
      <KPICard
        title="Aprovações"
        value={kpis?.pendingApprovals ?? 0}
        subtitle="pendentes"
        icon={<Clock className="h-4 w-4" />}
        variant={(kpis?.pendingApprovals ?? 0) > 0 ? "warning" : "success"}
        isLoading={isLoading}
      />
      <KPICard
        title="Vencendo em 30d"
        value={kpis?.expiringNext30Days ?? 0}
        subtitle="contratos"
        icon={<Clock className="h-4 w-4" />}
        variant={(kpis?.expiringNext30Days ?? 0) > 0 ? "warning" : "success"}
        isLoading={isLoading}
      />
      <KPICard
        title="Recebido"
        value={formatCurrency(kpis?.paidAmount ?? 0)}
        subtitle={`A receber: ${formatCurrency(kpis?.receivableAmount ?? 0)}`}
        icon={<TrendingUp className="h-4 w-4" />}
        variant="success"
        isLoading={isLoading}
      />
    </div>
  );
}
