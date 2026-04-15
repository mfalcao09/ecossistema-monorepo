import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, UserCheck } from "lucide-react";
import { contractTypeLabels } from "@/lib/contractSchema";
import { guaranteeTypeOptions, paymentTermsOptions } from "@/lib/dealRequestSchema";
import type { DealRequestFormData } from "@/hooks/useDealRequests";
import { usePeopleForSelect } from "@/hooks/useContracts";

interface Props {
  data: Partial<DealRequestFormData>;
  onChange: (data: Partial<DealRequestFormData>) => void;
}

export function StepCommercialConditions({ data, onChange }: Props) {
  const update = (field: keyof DealRequestFormData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const isLocacao = data.deal_type === "locacao";
  const isVenda = data.deal_type === "venda";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Solicitar Análise e Elaboração de Contrato
        </h2>
        <p className="text-sm text-muted-foreground">
          Informe as condições comerciais que foram negociadas com o cliente. Esses dados serão
          encaminhados às áreas jurídica e financeira para análise, elaboração de parecer e minuta do contrato.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Deal Type */}
        <div className="space-y-1.5">
          <Label>Tipo de Negócio *</Label>
          <Select value={data.deal_type ?? ""} onValueChange={(v) => update("deal_type", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(contractTypeLabels).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Payment Terms */}
        <div className="space-y-1.5">
          <Label>Forma de Pagamento</Label>
          <Select value={data.payment_terms ?? ""} onValueChange={(v) => update("payment_terms", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {paymentTermsOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Values - conditional on type */}
        {(isVenda || !data.deal_type) && (
          <div className="space-y-1.5">
            <Label>Valor Total Proposto (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="0,00"
              value={data.proposed_value ?? ""}
              onChange={(e) => update("proposed_value", Number(e.target.value))}
            />
          </div>
        )}

        {(isLocacao || data.deal_type === "administracao" || !data.deal_type) && (
          <div className="space-y-1.5">
            <Label>Valor Mensal Proposto (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="0,00"
              value={data.proposed_monthly_value ?? ""}
              onChange={(e) => update("proposed_monthly_value", Number(e.target.value))}
            />
          </div>
        )}

        {/* Start Date */}
        <div className="space-y-1.5">
          <Label>Data de Início Prevista</Label>
          <Input
            type="date"
            value={data.proposed_start_date ?? ""}
            onChange={(e) => update("proposed_start_date", e.target.value)}
          />
        </div>

        {/* Duration */}
        {(isLocacao || data.deal_type === "administracao") && (
          <div className="space-y-1.5">
            <Label>Duração (meses)</Label>
            <Input
              type="number"
              min={1}
              placeholder="12"
              value={data.proposed_duration_months ?? ""}
              onChange={(e) => update("proposed_duration_months", Number(e.target.value))}
            />
          </div>
        )}

        {/* Guarantee Type */}
        <div className="space-y-1.5">
          <Label>Tipo de Garantia</Label>
          <Select value={data.guarantee_type ?? ""} onValueChange={(v) => update("guarantee_type", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {guaranteeTypeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Commission */}
        <div className="space-y-1.5">
          <Label>{isLocacao ? "Taxa de Administração (%)" : "Comissão (%)"}</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            placeholder={isLocacao ? "10" : "6"}
            value={data.commission_percentage ?? ""}
            onChange={(e) => update("commission_percentage", Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            {isLocacao
              ? "Taxa de administração calculada sobre o valor do aluguel (não incide sobre IPTU/condomínio)"
              : "Comissão sobre o valor total do imóvel"}
          </p>
        </div>
      </div>

      {/* Arras/Sinal for sales */}
      {isVenda && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Sinal / Arras
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Registre o valor do sinal (arras) caso aplicável. Este valor entra como dinheiro em trânsito (passivo) na conta da imobiliária.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Valor do Sinal (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0,00"
                value={(data as any).earnest_money ?? ""}
                onChange={(e) => update("earnest_money" as any, Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data do Sinal</Label>
              <Input
                type="date"
                value={(data as any).earnest_money_date ?? ""}
                onChange={(e) => update("earnest_money_date" as any, e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Broker Attribution */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <UserCheck className="h-4 w-4" /> Atribuição de Corretores
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Identifique o corretor que captou o imóvel e o que trouxe o cliente para o rateio correto de comissões.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <BrokerSelect
            label="Corretor Captador (trouxe o imóvel)"
            value={(data as any).captador_person_id}
            onChange={(v) => update("captador_person_id" as any, v)}
          />
          <BrokerSelect
            label="Corretor Vendedor (trouxe o cliente)"
            value={(data as any).vendedor_person_id}
            onChange={(v) => update("vendedor_person_id" as any, v)}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label>Observações Comerciais</Label>
        <Textarea
          placeholder="Descreva detalhes adicionais da negociação que devem ser repassados ao jurídico e financeiro (ex: condições especiais, acordos verbais, particularidades do cliente)..."
          rows={4}
          value={data.commercial_notes ?? ""}
          onChange={(e) => update("commercial_notes", e.target.value)}
        />
      </div>
    </div>
  );
}

function BrokerSelect({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState("");
  const { data: people } = usePeopleForSelect();
  const selected = people?.find((p) => p.id === value);
  const filtered = people?.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8);

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {selected && (
        <Badge variant="secondary" className="mb-1 gap-1">
          {selected.name}
          <button className="ml-1 text-xs opacity-60 hover:opacity-100" onClick={() => onChange("")}>✕</button>
        </Badge>
      )}
      {!selected && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar corretor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          {search && filtered && filtered.length > 0 && (
            <div className="max-h-[120px] overflow-y-auto rounded-md border divide-y text-sm">
              {filtered.map((p) => (
                <button key={p.id} className="w-full text-left px-3 py-1.5 hover:bg-muted/50" onClick={() => { onChange(p.id); setSearch(""); }}>
                  {p.name} <span className="text-xs text-muted-foreground capitalize">({p.person_type})</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
