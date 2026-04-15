/**
 * TabVendas — Aba 2: Premissas de Vendas
 * US-68: prazo parcelamento, juros, vendas à vista, desconto,
 *        índice correção, comissão, inadimplência
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, TrendingUp, Percent, AlertTriangle } from "lucide-react";
import type { SalesPremises, IndiceCorrecao } from "@/lib/parcelamento/deep-premises-types";

interface Props {
  data: SalesPremises;
  onChange: (updates: Partial<SalesPremises>) => void;
}

function FieldHint({ text }: { text: string }) {
  return (
    <p className="text-xs text-gray-400 mt-1 flex items-start gap-1">
      <Info className="h-3 w-3 mt-0.5 shrink-0 text-blue-400" />
      {text}
    </p>
  );
}

function SectionDivider({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Icon className="h-4 w-4 text-gray-400" />
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

export function TabVendas({ data, onChange }: Props) {
  return (
    <div className="space-y-5">
      {/* ── Velocidade de vendas ── */}
      <SectionDivider icon={TrendingUp} label="Ritmo de vendas" />

      <div>
        <Label>
          Velocidade de Vendas: {data.velocidade_vendas_pct_mes.toFixed(1)}% do VGV/mês
        </Label>
        <Slider
          min={0.5}
          max={15}
          step={0.5}
          value={[data.velocidade_vendas_pct_mes]}
          onValueChange={([v]) => onChange({ velocidade_vendas_pct_mes: v })}
          className="mt-2"
        />
        <FieldHint text={`A ${data.velocidade_vendas_pct_mes}%, leva ~${Math.ceil(100 / data.velocidade_vendas_pct_mes)} meses para vender 100%`} />
      </div>

      {/* ── Condições de pagamento ── */}
      <SectionDivider icon={Percent} label="Condições de pagamento" />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="sv-entrada">Entrada (%)</Label>
          <Input
            id="sv-entrada"
            type="number"
            min={0}
            max={100}
            step={5}
            value={data.entrada_pct}
            onChange={(e) => onChange({ entrada_pct: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="sv-parcelas">Parcelas</Label>
          <Input
            id="sv-parcelas"
            type="number"
            min={1}
            max={240}
            value={data.parcelas_qtd}
            onChange={(e) => onChange({ parcelas_qtd: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="sv-balao">Balão final (%)</Label>
          <Input
            id="sv-balao"
            type="number"
            min={0}
            max={80}
            step={5}
            value={data.balao_final_pct}
            onChange={(e) => onChange({ balao_final_pct: Number(e.target.value) })}
          />
        </div>
      </div>
      <FieldHint
        text={`Entrada ${data.entrada_pct}% + ${data.parcelas_qtd}× parcelas + Balão ${data.balao_final_pct}%`}
      />

      {/* Juros do parcelamento */}
      <div>
        <Label htmlFor="sv-juros">Juros do parcelamento (% ao mês)</Label>
        <Input
          id="sv-juros"
          type="number"
          min={0}
          max={3}
          step={0.1}
          value={data.juros_parcelamento_pct_mes}
          onChange={(e) => onChange({ juros_parcelamento_pct_mes: Number(e.target.value) })}
        />
        <FieldHint text="0 = sem juros (parcelas corrigidas apenas pelo índice). 0,8% é referência de mercado." />
      </div>

      {/* Vendas à vista */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="sv-vista">Vendas à vista (%)</Label>
          <Input
            id="sv-vista"
            type="number"
            min={0}
            max={100}
            step={5}
            value={data.vendas_vista_pct}
            onChange={(e) => onChange({ vendas_vista_pct: Number(e.target.value) })}
          />
          <FieldHint text="% dos lotes vendidos com pagamento integral" />
        </div>
        <div>
          <Label htmlFor="sv-desc-vista">Desconto à vista (%)</Label>
          <Input
            id="sv-desc-vista"
            type="number"
            min={0}
            max={30}
            step={1}
            value={data.desconto_vista_pct}
            onChange={(e) => onChange({ desconto_vista_pct: Number(e.target.value) })}
          />
          <FieldHint text="Desconto concedido para pgto. à vista" />
        </div>
      </div>

      {/* Índice de correção */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="sv-indice">Índice de correção</Label>
          <Select
            value={data.indice_correcao}
            onValueChange={(v) => onChange({ indice_correcao: v as IndiceCorrecao })}
          >
            <SelectTrigger id="sv-indice">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INCC">INCC (construção civil)</SelectItem>
              <SelectItem value="IPCA">IPCA (inflação geral)</SelectItem>
              <SelectItem value="IGPM">IGP-M</SelectItem>
              <SelectItem value="nenhum">Nenhum</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="sv-indice-taxa">Taxa mensal estimada (%)</Label>
          <Input
            id="sv-indice-taxa"
            type="number"
            min={0}
            max={3}
            step={0.1}
            value={data.indice_correcao_mensal_pct}
            disabled={data.indice_correcao === "nenhum"}
            onChange={(e) => onChange({ indice_correcao_mensal_pct: Number(e.target.value) })}
          />
        </div>
      </div>
      <FieldHint text="INCC é o padrão do mercado imobiliário. Taxa mensal: estimativa usada no fluxo de caixa." />

      {/* ── Comissão e inadimplência ── */}
      <SectionDivider icon={AlertTriangle} label="Comissões e riscos" />

      <div>
        <Label htmlFor="sv-comissao">Comissão do corretor (%)</Label>
        <Input
          id="sv-comissao"
          type="number"
          min={0}
          max={10}
          step={0.5}
          value={data.comissao_corretor_pct}
          onChange={(e) => onChange({ comissao_corretor_pct: Number(e.target.value) })}
        />
        <FieldHint text="% sobre o preço de venda. Padrão mercado: 5-6%" />
      </div>

      <div>
        <Label>Inadimplência: {data.inadimplencia_pct.toFixed(1)}%</Label>
        <Slider
          min={0}
          max={15}
          step={0.5}
          value={[data.inadimplencia_pct]}
          onValueChange={([v]) => onChange({ inadimplencia_pct: v })}
          className="mt-2"
        />
        <FieldHint text="% do VGV não recebido. Reduz o VGV líquido. Mercado: 2-5%" />
      </div>
    </div>
  );
}
