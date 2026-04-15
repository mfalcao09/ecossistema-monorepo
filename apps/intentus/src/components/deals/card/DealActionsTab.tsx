import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useUpdateDealStatus } from "@/hooks/useDealRequests";
import { getNextStatuses } from "@/lib/legalTransitions";
import { Send, DollarSign, Percent, AlertCircle } from "lucide-react";
import type { DealRequest } from "@/lib/dealRequestSchema";

function formatBRL(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export function DealActionsTab({ deal }: { deal: DealRequest }) {
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [housePct, setHousePct] = useState(50);
  const [captadorPct, setCaptadorPct] = useState(25);
  const [vendedorPct, setVendedorPct] = useState(25);
  const updateStatus = useUpdateDealStatus();

  const nextOptions = getNextStatuses(deal.status);
  const isClosing = newStatus === "concluido";

  const commissionPct = deal.commission_percentage || 6;
  const baseValue = deal.deal_type === "locacao"
    ? Number(deal.proposed_monthly_value || 0)
    : Number(deal.proposed_value || 0);
  const totalCommission = baseValue * commissionPct / 100;

  const splitTotal = housePct + captadorPct + vendedorPct;

  const handleSubmit = () => {
    if (!newStatus) return;
    updateStatus.mutate(
      {
        dealId: deal.id,
        fromStatus: deal.status,
        toStatus: newStatus,
        notes: statusNotes,
        ...(isClosing ? {
          commissionOverrides: { house: housePct, captador: captadorPct, vendedor: vendedorPct },
        } : {}),
      },
      { onSuccess: () => { setNewStatus(""); setStatusNotes(""); } }
    );
  };

  if (nextOptions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Mover para</Label>
        <Select value={newStatus} onValueChange={setNewStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o próximo status" />
          </SelectTrigger>
          <SelectContent>
            {nextOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Commission preview when closing */}
      {isClosing && baseValue > 0 && (
        <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <DollarSign className="h-4 w-4" />
            Rateio de Comissões
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Base: {formatBRL(baseValue)} × {commissionPct}% = <strong>{formatBRL(totalCommission)}</strong></p>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">House (%)</Label>
              <Input
                type="number"
                min={0} max={100}
                value={housePct}
                onChange={(e) => setHousePct(Number(e.target.value))}
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">{formatBRL(totalCommission * housePct / 100)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Captador (%)</Label>
              <Input
                type="number"
                min={0} max={100}
                value={captadorPct}
                onChange={(e) => setCaptadorPct(Number(e.target.value))}
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">{formatBRL(totalCommission * captadorPct / 100)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vendedor (%)</Label>
              <Input
                type="number"
                min={0} max={100}
                value={vendedorPct}
                onChange={(e) => setVendedorPct(Number(e.target.value))}
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">{formatBRL(totalCommission * vendedorPct / 100)}</p>
            </div>
          </div>

          {splitTotal !== 100 && (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>A soma dos percentuais deve ser 100% (atual: {splitTotal}%)</span>
            </div>
          )}
        </div>
      )}

      {isClosing && baseValue === 0 && (
        <div className="flex items-center gap-2 text-amber-600 text-xs p-3 border rounded-lg bg-amber-50">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Nenhum valor proposto definido. Comissões não serão geradas automaticamente.</span>
        </div>
      )}

      <div className="space-y-2">
        <Label>Observações (opcional)</Label>
        <Textarea value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} placeholder="Registre detalhes..." rows={3} />
      </div>
      <Button onClick={handleSubmit} disabled={!newStatus || updateStatus.isPending || (isClosing && splitTotal !== 100 && baseValue > 0)}>
        <Send className="mr-1 h-4 w-4" />
        {updateStatus.isPending ? "Atualizando..." : isClosing ? "Concluir e Gerar Comissões" : "Atualizar Status"}
      </Button>
    </div>
  );
}
