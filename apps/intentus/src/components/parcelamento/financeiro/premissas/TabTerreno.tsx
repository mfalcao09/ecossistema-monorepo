/**
 * TabTerreno — Aba 3: Premissas do Terreno
 * US-69: modalidade (à vista/parcelada/permuta), valor, parcelas,
 *        comissão do corretor, split empreendedor/terreneiro
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
import { Info, Landmark, Handshake, ArrowLeftRight } from "lucide-react";
import type { LandPremises, ModalidadeTerreno } from "@/lib/parcelamento/deep-premises-types";

interface Props {
  data: LandPremises;
  onChange: (updates: Partial<LandPremises>) => void;
  /** VGV bruto calculado — para exibir % sobre VGV */
  vgvBruto: number;
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

export function TabTerreno({ data, onChange, vgvBruto }: Props) {
  const isParcelada = data.modalidade === "parcelada";
  const isPermutaFisica = data.modalidade === "permuta_fisica";
  const isPermutaFinanceira = data.modalidade === "permuta_financeira";
  const isAVista = data.modalidade === "a_vista";

  const terrenoPctVGV = vgvBruto > 0 ? ((data.valor_terreno / vgvBruto) * 100).toFixed(1) : "—";

  return (
    <div className="space-y-5">
      {/* ── Modalidade ── */}
      <SectionDivider icon={Landmark} label="Aquisição do terreno" />

      <div>
        <Label htmlFor="lt-modalidade">Modalidade de aquisição</Label>
        <Select
          value={data.modalidade}
          onValueChange={(v) => onChange({ modalidade: v as ModalidadeTerreno })}
        >
          <SelectTrigger id="lt-modalidade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a_vista">Pagamento à vista</SelectItem>
            <SelectItem value="parcelada">Pagamento parcelado</SelectItem>
            <SelectItem value="permuta_fisica">Permuta física (lotes)</SelectItem>
            <SelectItem value="permuta_financeira">Permuta financeira (%VGV)</SelectItem>
          </SelectContent>
        </Select>
        <FieldHint
          text={
            isAVista
              ? "Terreno pago integralmente no início da obra."
              : isParcelada
              ? "Terreno pago em parcelas mensais durante a obra."
              : isPermutaFisica
              ? "Terreneiro recebe lotes prontos em vez de dinheiro."
              : "Terreneiro recebe % sobre o VGV das vendas."
          }
        />
      </div>

      {/* ── Valor do terreno (sempre visível) ── */}
      <div>
        <Label htmlFor="lt-valor">Valor do terreno (R$)</Label>
        <Input
          id="lt-valor"
          type="number"
          min={0}
          step={50000}
          value={data.valor_terreno}
          onChange={(e) => onChange({ valor_terreno: Number(e.target.value) })}
        />
        <FieldHint text={`Representa ${terrenoPctVGV}% do VGV bruto`} />
      </div>

      {/* ── Condições parceladas ── */}
      {isParcelada && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="lt-parcelas">Parcelas</Label>
            <Input
              id="lt-parcelas"
              type="number"
              min={1}
              max={120}
              value={data.parcelas_terreno}
              onChange={(e) => onChange({ parcelas_terreno: Number(e.target.value) })}
            />
            <FieldHint text="Qtd de parcelas mensais pro terreneiro" />
          </div>
          <div>
            <Label htmlFor="lt-juros">Juros (% a.m.)</Label>
            <Input
              id="lt-juros"
              type="number"
              min={0}
              max={3}
              step={0.1}
              value={data.juros_terreno_pct_mes}
              onChange={(e) => onChange({ juros_terreno_pct_mes: Number(e.target.value) })}
            />
            <FieldHint text="0 = sem juros, parcelas fixas" />
          </div>
        </div>
      )}

      {/* ── Permuta física ── */}
      {isPermutaFisica && (
        <div>
          <Label htmlFor="lt-permuta-lotes">% de lotes para o terreneiro</Label>
          <Input
            id="lt-permuta-lotes"
            type="number"
            min={0}
            max={50}
            step={1}
            value={data.permuta_lotes_pct}
            onChange={(e) => onChange({ permuta_lotes_pct: Number(e.target.value) })}
          />
          <FieldHint text="Ex: 15% = terreneiro fica com 15% dos lotes prontos. Esses lotes saem do estoque de vendas." />
        </div>
      )}

      {/* ── Permuta financeira ── */}
      {isPermutaFinanceira && (
        <div>
          <Label htmlFor="lt-permuta-fin">% sobre o VGV para o terreneiro</Label>
          <Input
            id="lt-permuta-fin"
            type="number"
            min={0}
            max={50}
            step={1}
            value={data.permuta_financeira_pct}
            onChange={(e) => onChange({ permuta_financeira_pct: Number(e.target.value) })}
          />
          <FieldHint text="Terreneiro recebe esse % conforme os lotes são vendidos. Reduz receita líquida." />
        </div>
      )}

      {/* ── Comissão e split ── */}
      <SectionDivider icon={Handshake} label="Comissão e split" />

      <div>
        <Label htmlFor="lt-comissao">Comissão do corretor do terreno (%)</Label>
        <Input
          id="lt-comissao"
          type="number"
          min={0}
          max={10}
          step={0.5}
          value={data.comissao_terreno_pct}
          onChange={(e) => onChange({ comissao_terreno_pct: Number(e.target.value) })}
        />
        <FieldHint text="% sobre o valor do terreno. Mercado: 2-5%" />
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <ArrowLeftRight className="h-4 w-4 text-gray-400" />
          <Label>
            Split: Empreendedor {data.split_empreendedor_pct}% / Terreneiro{" "}
            {100 - data.split_empreendedor_pct}%
          </Label>
        </div>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[data.split_empreendedor_pct]}
          onValueChange={([v]) => onChange({ split_empreendedor_pct: v })}
          className="mt-2"
        />
        <FieldHint text="Como a comissão do corretor é dividida. 50/50 = divisão igual." />
      </div>

      {/* ── Resumo visual ── */}
      <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-amber-700">Custo do terreno</span>
          <span className="font-semibold text-amber-800">
            R$ {(data.valor_terreno / 1_000_000).toFixed(2)}M
          </span>
        </div>
        <div className="flex justify-between text-xs text-amber-600">
          <span>Comissão ({data.comissao_terreno_pct}%)</span>
          <span>R$ {((data.valor_terreno * data.comissao_terreno_pct) / 100).toLocaleString("pt-BR")}</span>
        </div>
        <div className="flex justify-between text-xs text-amber-600">
          <span>% sobre o VGV</span>
          <span>{terrenoPctVGV}%</span>
        </div>
      </div>
    </div>
  );
}
