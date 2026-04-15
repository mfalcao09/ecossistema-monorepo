import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommissionSplits, commissionRoleLabels, commissionStatusLabels } from "@/hooks/useCommissionSplits";
import { DollarSign, Percent, Building2, User } from "lucide-react";

const statusColors: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-800",
  aprovado: "bg-blue-100 text-blue-800",
  pago: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

function formatBRL(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export function DealCommissionsTab({ dealId }: { dealId: string }) {
  const { data: splits, isLoading } = useCommissionSplits(undefined, dealId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (!splits || splits.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p>Comissões serão geradas automaticamente ao concluir o negócio</p>
      </div>
    );
  }

  const totalCommission = splits.reduce((s, c) => s + c.calculated_value, 0);
  const totalNet = splits.reduce((s, c) => s + c.net_value, 0);
  const totalTaxes = splits.reduce((s, c) => s + c.tax_inss + c.tax_irrf, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Comissão Total</p>
          <p className="text-sm font-bold">{formatBRL(totalCommission)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Impostos</p>
          <p className="text-sm font-bold text-destructive">{formatBRL(totalTaxes)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Líquido Total</p>
          <p className="text-sm font-bold text-green-600">{formatBRL(totalNet)}</p>
        </div>
      </div>

      <Separator />

      {/* Individual splits */}
      <div className="space-y-3">
        {splits.map((split) => (
          <Card key={split.id} className="border">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {split.role === "house" ? (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold">
                    {commissionRoleLabels[split.role] || split.role}
                  </span>
                </div>
                <Badge className={statusColors[split.status] || ""} variant="outline">
                  {commissionStatusLabels[split.status] || split.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Percentual:</span>
                  <span className="font-medium">{split.percentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Bruto:</span>
                  <span className="font-medium">{formatBRL(split.calculated_value)}</span>
                </div>
                {split.role !== "house" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">INSS:</span>
                      <span className="text-destructive">{formatBRL(split.tax_inss)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IRRF:</span>
                      <span className="text-destructive">{formatBRL(split.tax_irrf)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between col-span-2 pt-1 border-t">
                  <span className="text-muted-foreground font-medium">Líquido:</span>
                  <span className="font-bold text-green-600">{formatBRL(split.net_value)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
