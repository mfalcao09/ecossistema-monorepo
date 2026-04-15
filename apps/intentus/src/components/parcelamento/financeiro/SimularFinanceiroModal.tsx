/**
 * SimularFinanceiroModal — Sheet lateral com formulário de premissas
 *
 * Abre quando o usuário clica em "Simular" na página de Análise Financeira.
 * Encadeia save_scenario → simulate via useSimularFinanceiro.
 *
 * Organizado em 3 seções colapsáveis:
 *   1. Produto (lotes, preço, prazos)
 *   2. Comercialização (velocidade, entrada, parcelas, inadimplência)
 *   3. Financiamento (equity/dívida, taxa desconto, WACC, tributos)
 *
 * 📚 Cada campo tem tooltip explicativo (modo professor).
 */

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
import { Loader2, Zap, Info } from "lucide-react";
import { useSimularFinanceiro, SCENARIO_DEFAULTS, ScenarioFormValues } from "@/hooks/useSimularFinanceiro";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  developmentId: string;
  projectName?: string;
  /** Valores pré-preenchidos (do projeto: total_units, vgv_estimado) */
  hints?: {
    qtd_lotes?: number | null;
    preco_medio_lote?: number | null;
  };
}

function FieldHint({ text }: { text: string }) {
  return (
    <p className="text-xs text-gray-400 mt-1 flex items-start gap-1">
      <Info className="h-3 w-3 mt-0.5 shrink-0 text-blue-400" />
      {text}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-px flex-1 bg-gray-100" />
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2">
        {children}
      </p>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

export function SimularFinanceiroModal({
  open,
  onOpenChange,
  developmentId,
  projectName,
  hints,
}: Props) {
  const { tenantId } = useAuth();
  const { mutate: simular, isPending } = useSimularFinanceiro();

  const [form, setForm] = useState<ScenarioFormValues>({
    ...SCENARIO_DEFAULTS,
    qtd_lotes: hints?.qtd_lotes ?? SCENARIO_DEFAULTS.qtd_lotes,
    preco_medio_lote: hints?.preco_medio_lote ?? SCENARIO_DEFAULTS.preco_medio_lote,
  });

  const set = <K extends keyof ScenarioFormValues>(key: K, value: ScenarioFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const vgvEstimado = form.qtd_lotes * form.preco_medio_lote;
  const equityRestante = 100 - form.equity_pct;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;

    // Garante equity + dívida = 100%
    const formFinal = { ...form, divida_pct: equityRestante };

    simular(
      { developmentId, tenantId, formValues: formFinal },
      {
        onSuccess: () => {
          toast({
            title: "Simulação concluída!",
            description: "VPL, TIR e fluxo de caixa calculados com sucesso.",
          });
          onOpenChange(false);
        },
        onError: (err) => {
          toast({
            title: "Erro na simulação",
            description: err instanceof Error ? err.message : "Tente novamente.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[520px] overflow-y-auto" side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />
            Simular Cenário Financeiro
          </SheetTitle>
          <SheetDescription>
            {projectName ? `Projeto: ${projectName}` : "Preencha as premissas abaixo."}
            {" "}Os custos de obra já estão carregados do banco.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6 pb-24">
          {/* ── Seção 1: Produto ──────────────────────────────── */}
          <SectionTitle>1. Produto</SectionTitle>

          <div className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome do cenário</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Ex: Cenário Realista — Mar/2026"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="qtd_lotes">Qtd. de Lotes</Label>
                <Input
                  id="qtd_lotes"
                  type="number"
                  min={1}
                  value={form.qtd_lotes}
                  onChange={(e) => set("qtd_lotes", Number(e.target.value))}
                />
                <FieldHint text="Total de lotes do parcelamento" />
              </div>
              <div>
                <Label htmlFor="preco_medio_lote">Preço Médio (R$)</Label>
                <Input
                  id="preco_medio_lote"
                  type="number"
                  min={1000}
                  step={1000}
                  value={form.preco_medio_lote}
                  onChange={(e) => set("preco_medio_lote", Number(e.target.value))}
                />
                <FieldHint text="Preço médio por lote" />
              </div>
            </div>

            {/* VGV calculado */}
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm">
              <span className="text-blue-600 font-medium">VGV Estimado: </span>
              <span className="font-bold text-blue-800">
                R$ {(vgvEstimado / 1_000_000).toFixed(2)}M
              </span>
              <span className="text-blue-400 text-xs ml-2">
                ({form.qtd_lotes} lotes × R$ {(form.preco_medio_lote / 1_000).toFixed(0)}k)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prazo_obra">Prazo de Obra (meses)</Label>
                <Input
                  id="prazo_obra"
                  type="number"
                  min={1}
                  max={60}
                  value={form.prazo_obra_meses}
                  onChange={(e) => set("prazo_obra_meses", Number(e.target.value))}
                />
                <FieldHint text="Duração da execução das obras" />
              </div>
              <div>
                <Label htmlFor="prazo_comerc">Prazo Comercial (meses)</Label>
                <Input
                  id="prazo_comerc"
                  type="number"
                  min={1}
                  max={120}
                  value={form.prazo_comercializacao_meses}
                  onChange={(e) => set("prazo_comercializacao_meses", Number(e.target.value))}
                />
                <FieldHint text="Período para vender todos os lotes" />
              </div>
            </div>

            <div>
              <Label htmlFor="mes_inicio">Mês de início das vendas</Label>
              <Input
                id="mes_inicio"
                type="number"
                min={0}
                max={form.prazo_obra_meses}
                value={form.mes_inicio_vendas}
                onChange={(e) => set("mes_inicio_vendas", Number(e.target.value))}
              />
              <FieldHint text="0 = no lançamento, 6 = 6 meses após o início" />
            </div>
          </div>

          {/* ── Seção 2: Comercialização ───────────────────────── */}
          <SectionTitle>2. Comercialização</SectionTitle>

          <div className="space-y-4">
            <div>
              <Label>
                Velocidade de Vendas: {form.velocidade_vendas_pct_mes.toFixed(1)}% do VGV/mês
              </Label>
              <Slider
                min={0.5}
                max={15}
                step={0.5}
                value={[form.velocidade_vendas_pct_mes]}
                onValueChange={([v]) => set("velocidade_vendas_pct_mes", v)}
                className="mt-2"
              />
              <FieldHint text="% do VGV total vendido por mês. 4% = 25 meses para 100%" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="entrada_pct">Entrada (%)</Label>
                <Input
                  id="entrada_pct"
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={form.entrada_pct}
                  onChange={(e) => set("entrada_pct", Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="parcelas_qtd">Parcelas</Label>
                <Input
                  id="parcelas_qtd"
                  type="number"
                  min={1}
                  max={240}
                  value={form.parcelas_qtd}
                  onChange={(e) => set("parcelas_qtd", Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="balao_pct">Balão (%)</Label>
                <Input
                  id="balao_pct"
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={form.balao_final_pct}
                  onChange={(e) => set("balao_final_pct", Number(e.target.value))}
                />
              </div>
            </div>
            <FieldHint text={`Entrada ${form.entrada_pct}% + ${form.parcelas_qtd} parcelas + Balão ${form.balao_final_pct}% = ${form.entrada_pct + form.balao_final_pct}% + parcelado`} />

            <div>
              <Label>
                Inadimplência: {form.inadimplencia_pct.toFixed(1)}%
              </Label>
              <Slider
                min={0}
                max={15}
                step={0.5}
                value={[form.inadimplencia_pct]}
                onValueChange={([v]) => set("inadimplencia_pct", v)}
                className="mt-2"
              />
              <FieldHint text="% do VGV que não será recebido. Reduz o VGV líquido." />
            </div>
          </div>

          {/* ── Seção 3: Financiamento ─────────────────────────── */}
          <SectionTitle>3. Financiamento e Tributação</SectionTitle>

          <div className="space-y-4">
            <div>
              <Label>
                Capital Próprio (Equity): {form.equity_pct}% | Dívida: {equityRestante}%
              </Label>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[form.equity_pct]}
                onValueChange={([v]) => set("equity_pct", v)}
                className="mt-2"
              />
              <FieldHint text="100% equity = sem financiamento bancário. 0% = totalmente alavancado." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="taxa_desconto">Taxa de Desconto (% a.a.)</Label>
                <Input
                  id="taxa_desconto"
                  type="number"
                  min={5}
                  max={50}
                  step={0.5}
                  value={form.taxa_desconto_anual_pct}
                  onChange={(e) => set("taxa_desconto_anual_pct", Number(e.target.value))}
                />
                <FieldHint text="TMA — retorno mínimo exigido. VPL usa esta taxa." />
              </div>
              <div>
                <Label htmlFor="custo_divida">Custo da Dívida (% a.a.)</Label>
                <Input
                  id="custo_divida"
                  type="number"
                  min={0}
                  max={40}
                  step={0.5}
                  value={form.custo_divida_anual_pct}
                  onChange={(e) => set("custo_divida_anual_pct", Number(e.target.value))}
                />
                <FieldHint text="Taxa do financiamento bancário ao ano." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="regime">Regime Tributário</Label>
                <Select
                  value={form.regime_tributario}
                  onValueChange={(v) =>
                    set("regime_tributario", v as ScenarioFormValues["regime_tributario"])
                  }
                >
                  <SelectTrigger id="regime">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                    <SelectItem value="lucro_real">Lucro Real</SelectItem>
                    <SelectItem value="ret_afetacao">RET (Afetação) — 4%</SelectItem>
                    <SelectItem value="nao_definido">Não definido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="aliquota_ir">Alíquota efetiva (%)</Label>
                <Input
                  id="aliquota_ir"
                  type="number"
                  min={0}
                  max={30}
                  step={0.1}
                  value={form.regime_tributario === "ret_afetacao" ? 4 : form.aliquota_ir_pct}
                  disabled={form.regime_tributario === "ret_afetacao"}
                  onChange={(e) => set("aliquota_ir_pct", Number(e.target.value))}
                />
                <FieldHint
                  text={
                    form.regime_tributario === "ret_afetacao"
                      ? "Fixo em 4% no regime RET (Lei 10.931/04)"
                      : "Lucro Presumido padrão ≈ 5,93% sobre receita"
                  }
                />
              </div>
            </div>
          </div>
        </form>

        <SheetFooter className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !tenantId}
            className="gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculando…
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Simular
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
