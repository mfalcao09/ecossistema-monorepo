import { useState } from "react";
import { useContractAuditTrail } from "@/hooks/useContractAuditTrail";
import { auditActionLabels } from "@/lib/clmSchema";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Clock, User, FileText, CheckCircle, XCircle, PenLine, Plus, ClipboardList } from "lucide-react";

interface Props {
  contractId: string;
}

const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  criado: Plus,
  editado: PenLine,
  documento_enviado: FileText,
  aprovacao: CheckCircle,
  aprovacao_rejeitada: XCircle,
  obrigacao_criada: ClipboardList,
  obrigacao_cumprida: CheckCircle,
};

export function ContractAuditTab({ contractId }: Props) {
  const [actionFilter, setActionFilter] = useState("todas");
  const { data: trail, isLoading } = useContractAuditTrail(contractId, { action: actionFilter });

  const exportCSV = () => {
    if (!trail || trail.length === 0) return;
    const headers = ["Data", "Ação", "Campo", "De", "Para", "Usuário"];
    const rows = trail.map((t) => [
      new Date(t.created_at).toLocaleString("pt-BR"),
      auditActionLabels[t.action] ?? t.action,
      t.field_changed ?? "",
      t.old_value ?? "",
      t.new_value ?? "",
      t.performer_name ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_contrato_${contractId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrar:</span>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {Object.entries(auditActionLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!trail || trail.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
        </Button>
      </div>

      {trail && trail.length > 0 ? (
        <div className="relative border-l-2 border-muted ml-4 space-y-0">
          {trail.map((entry) => {
            const Icon = actionIcons[entry.action] || Clock;
            return (
              <div key={entry.id} className="relative pl-6 pb-4">
                <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                  <Icon className="h-2.5 w-2.5 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {auditActionLabels[entry.action] ?? entry.action}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {entry.field_changed && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">Campo:</span> <strong>{entry.field_changed}</strong>
                      {entry.old_value && <> de <span className="line-through text-muted-foreground">{entry.old_value}</span></>}
                      {entry.new_value && <> para <span className="text-primary font-medium">{entry.new_value}</span></>}
                    </p>
                  )}
                  {entry.performer_name && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> {entry.performer_name}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum registro de auditoria.</p>
      )}
    </div>
  );
}
