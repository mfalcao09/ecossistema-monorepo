import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { guaranteeTypeOptions, paymentTermsOptions, type DealRequest } from "@/lib/dealRequestSchema";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, Calendar, DollarSign, Users } from "lucide-react";

const dealTypeLabels: Record<string, string> = { venda: "Venda", locacao: "Locação", administracao: "Administração" };
const roleLabels: Record<string, string> = {
  locatario: "Locatário", comprador: "Comprador", proprietario: "Proprietário",
  fiador: "Fiador", administrador: "Administrador", testemunha: "Testemunha",
};

export function DealDetailsTab({ deal }: { deal: DealRequest }) {
  const guaranteeLabel = guaranteeTypeOptions.find((g) => g.value === deal.guarantee_type)?.label;
  const paymentLabel = paymentTermsOptions.find((p) => p.value === deal.payment_terms)?.label;

  return (
    <ScrollArea className="max-h-[50vh]">
      <div className="space-y-4 pr-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Tipo de Negócio" icon={<Building2 className="h-4 w-4 text-muted-foreground" />}>
            {dealTypeLabels[deal.deal_type] || deal.deal_type}
          </Field>
          {deal.proposed_value && (
            <Field label="Valor Proposto" icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}>
              R$ {Number(deal.proposed_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </Field>
          )}
          {deal.proposed_monthly_value && (
            <Field label="Valor Mensal" icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}>
              R$ {Number(deal.proposed_monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês
            </Field>
          )}
          {deal.proposed_start_date && (
            <Field label="Início Proposto" icon={<Calendar className="h-4 w-4 text-muted-foreground" />}>
              {format(new Date(deal.proposed_start_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
            </Field>
          )}
          {deal.proposed_duration_months && (
            <Field label="Duração"><span>{deal.proposed_duration_months} meses</span></Field>
          )}
          {paymentLabel && <Field label="Condições de Pagamento">{paymentLabel}</Field>}
          {guaranteeLabel && <Field label="Garantia">{guaranteeLabel}</Field>}
          {deal.commission_percentage && <Field label="Comissão">{deal.commission_percentage}%</Field>}
        </div>

        {deal.deal_request_parties?.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <span className="text-muted-foreground text-xs font-medium uppercase">Partes Envolvidas</span>
              <div className="space-y-1.5">
                {deal.deal_request_parties.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{p.people?.name || "—"}</span>
                    <Badge variant="outline" className="text-xs py-0">{roleLabels[p.role] || p.role}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {deal.commercial_notes && (
          <>
            <Separator />
            <div className="space-y-1">
              <span className="text-muted-foreground text-xs font-medium uppercase">Observações Comerciais</span>
              <p className="text-sm whitespace-pre-wrap">{deal.commercial_notes}</p>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-muted-foreground text-xs font-medium uppercase">{label}</span>
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">{children}</span>
      </div>
    </div>
  );
}
