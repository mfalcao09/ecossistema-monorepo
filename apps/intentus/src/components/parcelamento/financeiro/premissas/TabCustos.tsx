/**
 * TabCustos — Aba 4: Custos e Infraestrutura
 * US-70: overview R$/m²
 * US-71: visualização gráfica do viário
 * US-72: especificações de acabamento
 * US-73/74: tabela infraestrutura editável com toggle ON/OFF
 * US-75: terraplanagem baseada em DEM
 * US-76: taxas e contingências
 * US-77: garantia para prefeitura
 * US-78: rodapé consolidado
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Info,
  HardHat,
  Route,
  Mountain,
  Shield,
  Calculator,
  Building2,
  Zap as ZapIcon,
} from "lucide-react";
import { ViarioSVG } from "./ViarioSVG";
import type {
  CostsPremises,
  InfrastructureItem,
  RoadSystemParams,
  EarthworkParams,
  MunicipalGuaranteeParams,
  TipoPavimentacao,
  TipoMeioFio,
  TipoRedeEletrica,
  InfrastructureCategoryId,
} from "@/lib/parcelamento/deep-premises-types";
import {
  calcCustoInfraTotal,
  calcCustoTotalConsolidado,
} from "@/lib/parcelamento/deep-premises-types";

interface Props {
  data: CostsPremises;
  onChange: (updates: Partial<CostsPremises>) => void;
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
    <div className="flex items-center gap-2 pt-3">
      <Icon className="h-4 w-4 text-gray-400" />
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

function fmtBRL(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function TabCustos({ data, onChange }: Props) {
  const infraTotal = calcCustoInfraTotal(data.infraestrutura);
  const custoConsolidado = calcCustoTotalConsolidado(data);

  // ── Helpers para atualizar sub-objetos ──
  function updateInfraItem(id: InfrastructureCategoryId, updates: Partial<InfrastructureItem>) {
    const newItems = data.infraestrutura.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    onChange({ infraestrutura: newItems });
  }

  function updateViario(updates: Partial<RoadSystemParams>) {
    onChange({ sistema_viario: { ...data.sistema_viario, ...updates } });
  }

  function updateTerraplanagem(updates: Partial<EarthworkParams>) {
    onChange({ terraplanagem: { ...data.terraplanagem, ...updates } });
  }

  function updateGarantia(updates: Partial<MunicipalGuaranteeParams>) {
    onChange({ garantia_prefeitura: { ...data.garantia_prefeitura, ...updates } });
  }

  return (
    <div className="space-y-5">
      {/* ── US-70: Overview custo base ── */}
      <div>
        <Label htmlFor="tc-base">Custo base estimado (R$/m²)</Label>
        <Input
          id="tc-base"
          type="number"
          min={0}
          step={10}
          value={data.custo_base_m2}
          onChange={(e) => onChange({ custo_base_m2: Number(e.target.value) })}
        />
        <FieldHint text="Referência rápida do custo por m² — substituído pelo detalhamento abaixo" />
      </div>

      {/* ── US-71: Sistema viário ── */}
      <SectionDivider icon={Route} label="Sistema viário" />

      <ViarioSVG params={data.sistema_viario} />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="tc-calc-e">Calçada esq. (m)</Label>
          <Input
            id="tc-calc-e"
            type="number"
            min={1}
            max={6}
            step={0.5}
            value={data.sistema_viario.calcada_esquerda_m}
            onChange={(e) => updateViario({ calcada_esquerda_m: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="tc-pista">Pista (m)</Label>
          <Input
            id="tc-pista"
            type="number"
            min={4}
            max={16}
            step={0.5}
            value={data.sistema_viario.pista_m}
            onChange={(e) => updateViario({ pista_m: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="tc-calc-d">Calçada dir. (m)</Label>
          <Input
            id="tc-calc-d"
            type="number"
            min={1}
            max={6}
            step={0.5}
            value={data.sistema_viario.calcada_direita_m}
            onChange={(e) => updateViario({ calcada_direita_m: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* ── US-72: Acabamento ── */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="tc-pav">Pavimentação</Label>
          <Select
            value={data.sistema_viario.tipo_pavimentacao}
            onValueChange={(v) => updateViario({ tipo_pavimentacao: v as TipoPavimentacao })}
          >
            <SelectTrigger id="tc-pav">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CBUQ">CBUQ (asfalto)</SelectItem>
              <SelectItem value="PAVER">Paver (intertravado)</SelectItem>
              <SelectItem value="sem_pavimentacao">Sem pavimentação</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="tc-mf">Meio-fio</Label>
          <Select
            value={data.sistema_viario.tipo_meio_fio}
            onValueChange={(v) => updateViario({ tipo_meio_fio: v as TipoMeioFio })}
          >
            <SelectTrigger id="tc-mf">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="concreto_extrudado">Concreto extrudado</SelectItem>
              <SelectItem value="concreto_pre_moldado">Pré-moldado</SelectItem>
              <SelectItem value="granito">Granito</SelectItem>
              <SelectItem value="nenhum">Nenhum</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="tc-elet">Rede elétrica</Label>
          <Select
            value={data.sistema_viario.tipo_rede_eletrica}
            onValueChange={(v) => updateViario({ tipo_rede_eletrica: v as TipoRedeEletrica })}
          >
            <SelectTrigger id="tc-elet">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aerea">Aérea</SelectItem>
              <SelectItem value="subterranea">Subterrânea</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tc-custo-pav">Custo pavimentação (R$/m²)</Label>
          <Input
            id="tc-custo-pav"
            type="number"
            min={0}
            step={5}
            value={data.sistema_viario.custo_pavimentacao_m2}
            onChange={(e) => updateViario({ custo_pavimentacao_m2: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="tc-custo-mf">Custo meio-fio (R$/ml)</Label>
          <Input
            id="tc-custo-mf"
            type="number"
            min={0}
            step={2}
            value={data.sistema_viario.custo_meio_fio_ml}
            onChange={(e) => updateViario({ custo_meio_fio_ml: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* ── US-73/74: Tabela de infraestrutura ── */}
      <SectionDivider icon={HardHat} label="Infraestrutura (8 categorias)" />

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-8">On</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right w-24">R$/un</TableHead>
              <TableHead className="text-right w-20">Qtd</TableHead>
              <TableHead className="text-right w-28">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.infraestrutura.map((item) => {
              const total = item.enabled ? item.custo_unitario * item.quantidade : 0;
              return (
                <TableRow
                  key={item.id}
                  className={item.enabled ? "" : "opacity-40"}
                >
                  <TableCell>
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={(checked) =>
                        updateInfraItem(item.id, { enabled: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.sinapi_ref && (
                        <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                          {item.sinapi_ref}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {item.unidade === "m2" ? "R$/m²" : item.unidade === "ml" ? "R$/ml" : item.unidade === "un" ? "R$/un" : "verba"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={item.custo_unitario}
                      disabled={!item.enabled}
                      onChange={(e) =>
                        updateInfraItem(item.id, { custo_unitario: Number(e.target.value) })
                      }
                      className="w-20 text-right h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      value={item.quantidade}
                      disabled={!item.enabled}
                      onChange={(e) =>
                        updateInfraItem(item.id, { quantidade: Number(e.target.value) })
                      }
                      className="w-18 text-right h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium text-sm">
                    {item.enabled ? fmtBRL(total) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center px-2 text-sm">
        <span className="text-gray-500">
          {data.infraestrutura.filter((i) => i.enabled).length} de 8 categorias ativas
        </span>
        <span className="font-semibold text-gray-800">
          Subtotal: {fmtBRL(infraTotal)}
        </span>
      </div>

      {/* ── US-75: Terraplanagem ── */}
      <SectionDivider icon={Mountain} label="Terraplanagem" />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tc-decliv">Declividade média (%)</Label>
          <Input
            id="tc-decliv"
            type="number"
            min={0}
            max={60}
            step={0.5}
            value={data.terraplanagem.declividade_media_pct}
            onChange={(e) => updateTerraplanagem({ declividade_media_pct: Number(e.target.value) })}
          />
          <FieldHint text="Extraída do DEM quando disponível" />
        </div>
        <div>
          <Label htmlFor="tc-custo-m3">Custo por m³ (R$)</Label>
          <Input
            id="tc-custo-m3"
            type="number"
            min={0}
            step={1}
            value={data.terraplanagem.custo_m3}
            onChange={(e) => updateTerraplanagem({ custo_m3: Number(e.target.value) })}
          />
          <FieldHint text="R$/m³ de movimentação de terra. Ref SINAPI: R$ 15-25/m³" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tc-corte">Volume de corte (m³)</Label>
          <Input
            id="tc-corte"
            type="number"
            min={0}
            value={data.terraplanagem.volume_corte_m3}
            onChange={(e) => updateTerraplanagem({ volume_corte_m3: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="tc-aterro">Volume de aterro (m³)</Label>
          <Input
            id="tc-aterro"
            type="number"
            min={0}
            value={data.terraplanagem.volume_aterro_m3}
            onChange={(e) => updateTerraplanagem({ volume_aterro_m3: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* ── US-76: Taxas e contingências ── */}
      <SectionDivider icon={Calculator} label="Taxas e contingências" />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="tc-desp">Desp. gerais (%)</Label>
          <Input
            id="tc-desp"
            type="number"
            min={0}
            max={30}
            step={0.5}
            value={data.despesas_gerais_pct}
            onChange={(e) => onChange({ despesas_gerais_pct: Number(e.target.value) })}
          />
          <FieldHint text="% sobre custos de infra" />
        </div>
        <div>
          <Label htmlFor="tc-conting">Contingência (%)</Label>
          <Input
            id="tc-conting"
            type="number"
            min={0}
            max={30}
            step={0.5}
            value={data.contingencia_pct}
            onChange={(e) => onChange({ contingencia_pct: Number(e.target.value) })}
          />
          <FieldHint text="Reserva para imprevistos" />
        </div>
        <div>
          <Label htmlFor="tc-tma">TMA (% a.a.)</Label>
          <Input
            id="tc-tma"
            type="number"
            min={5}
            max={50}
            step={0.5}
            value={data.taxa_desconto_anual_pct}
            onChange={(e) => onChange({ taxa_desconto_anual_pct: Number(e.target.value) })}
          />
          <FieldHint text="Taxa desconto VPL" />
        </div>
      </div>

      {/* ── US-77: Garantia para prefeitura ── */}
      <SectionDivider icon={Shield} label="Garantia para prefeitura" />

      <div>
        <Label htmlFor="tc-garantia-tipo">Tipo de garantia</Label>
        <Select
          value={data.garantia_prefeitura.tipo}
          onValueChange={(v) =>
            updateGarantia({ tipo: v as MunicipalGuaranteeParams["tipo"] })
          }
        >
          <SelectTrigger id="tc-garantia-tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhum">Nenhum</SelectItem>
            <SelectItem value="seguro_garantia">Seguro garantia</SelectItem>
            <SelectItem value="lotes_caucionados">Lotes caucionados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.garantia_prefeitura.tipo === "seguro_garantia" && (
        <div>
          <Label htmlFor="tc-seguro">Custo do seguro (% sobre obra)</Label>
          <Input
            id="tc-seguro"
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={data.garantia_prefeitura.custo_seguro_pct}
            onChange={(e) => updateGarantia({ custo_seguro_pct: Number(e.target.value) })}
          />
          <FieldHint text="Prêmio anual do seguro sobre o valor total da obra" />
        </div>
      )}

      {data.garantia_prefeitura.tipo === "lotes_caucionados" && (
        <div>
          <Label htmlFor="tc-caucao">% dos lotes caucionados</Label>
          <Input
            id="tc-caucao"
            type="number"
            min={0}
            max={50}
            step={5}
            value={data.garantia_prefeitura.valor_ou_pct}
            onChange={(e) => updateGarantia({ valor_ou_pct: Number(e.target.value) })}
          />
          <FieldHint text="Lotes bloqueados como garantia — liberados conforme obra avança" />
        </div>
      )}

      {/* ── Financiamento / Tributação (migrados do modal antigo) ── */}
      <SectionDivider icon={Building2} label="Financiamento e tributação" />

      <div>
        <Label>
          Capital Próprio (Equity): {data.equity_pct}% | Dívida: {100 - data.equity_pct}%
        </Label>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[data.equity_pct]}
          onValueChange={([v]) => onChange({ equity_pct: v })}
          className="mt-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tc-custo-div">Custo dívida (% a.a.)</Label>
          <Input
            id="tc-custo-div"
            type="number"
            min={0}
            max={40}
            step={0.5}
            value={data.custo_divida_anual_pct}
            onChange={(e) => onChange({ custo_divida_anual_pct: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="tc-regime">Regime tributário</Label>
          <Select
            value={data.regime_tributario}
            onValueChange={(v) =>
              onChange({ regime_tributario: v as CostsPremises["regime_tributario"] })
            }
          >
            <SelectTrigger id="tc-regime">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
              <SelectItem value="lucro_real">Lucro Real</SelectItem>
              <SelectItem value="ret_afetacao">RET (4%)</SelectItem>
              <SelectItem value="nao_definido">Não definido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="tc-aliquota">Alíquota efetiva (%)</Label>
        <Input
          id="tc-aliquota"
          type="number"
          min={0}
          max={30}
          step={0.1}
          value={data.regime_tributario === "ret_afetacao" ? 4 : data.aliquota_ir_pct}
          disabled={data.regime_tributario === "ret_afetacao"}
          onChange={(e) => onChange({ aliquota_ir_pct: Number(e.target.value) })}
        />
      </div>

      {/* ── US-78: Rodapé consolidado ── */}
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <ZapIcon className="h-4 w-4 text-green-600" />
          <span className="font-semibold text-green-800 text-sm">Custo Total Consolidado</span>
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-green-700">
            <span>Infraestrutura ({data.infraestrutura.filter((i) => i.enabled).length} itens)</span>
            <span>{fmtBRL(infraTotal)}</span>
          </div>
          <div className="flex justify-between text-green-600 text-xs">
            <span>+ Despesas gerais ({data.despesas_gerais_pct}%)</span>
            <span>{fmtBRL(infraTotal * data.despesas_gerais_pct / 100)}</span>
          </div>
          <div className="flex justify-between text-green-600 text-xs">
            <span>+ Contingência ({data.contingencia_pct}%)</span>
            <span>{fmtBRL(infraTotal * data.contingencia_pct / 100)}</span>
          </div>
          {data.garantia_prefeitura.tipo === "seguro_garantia" && (
            <div className="flex justify-between text-green-600 text-xs">
              <span>+ Seguro garantia ({data.garantia_prefeitura.custo_seguro_pct}%)</span>
              <span>{fmtBRL(infraTotal * data.garantia_prefeitura.custo_seguro_pct / 100)}</span>
            </div>
          )}
          <div className="border-t border-green-200 pt-1 flex justify-between font-bold text-green-900">
            <span>TOTAL</span>
            <span>{fmtBRL(custoConsolidado)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
