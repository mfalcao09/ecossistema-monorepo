/**
 * TabProjeto — Aba 1: Dados do Projeto
 * US-67: nome, tipo (aberto/fechado), total lotes, área média, preço/m², cronograma
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Info, MapPin, Calendar, DollarSign } from "lucide-react";
import type { ProjectPremises, TipoEmpreendimento } from "@/lib/parcelamento/deep-premises-types";
import { calcVGVBruto, calcPrecoMedioLote } from "@/lib/parcelamento/deep-premises-types";

interface Props {
  data: ProjectPremises;
  onChange: (updates: Partial<ProjectPremises>) => void;
}

function FieldHint({ text }: { text: string }) {
  return (
    <p className="text-xs text-gray-400 mt-1 flex items-start gap-1">
      <Info className="h-3 w-3 mt-0.5 shrink-0 text-blue-400" />
      {text}
    </p>
  );
}

export function TabProjeto({ data, onChange }: Props) {
  const vgv = calcVGVBruto(data);
  const precoMedioLote = calcPrecoMedioLote(data);

  return (
    <div className="space-y-5">
      {/* Nome do cenário */}
      <div>
        <Label htmlFor="dp-nome">Nome do cenário</Label>
        <Input
          id="dp-nome"
          value={data.nome}
          onChange={(e) => onChange({ nome: e.target.value })}
          placeholder="Ex: Cenário Realista — Abr/2026"
        />
      </div>

      {/* Tipo de empreendimento */}
      <div>
        <Label htmlFor="dp-tipo">Tipo de empreendimento</Label>
        <Select
          value={data.tipo_empreendimento}
          onValueChange={(v) => onChange({ tipo_empreendimento: v as TipoEmpreendimento })}
        >
          <SelectTrigger id="dp-tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aberto">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                Loteamento Aberto
              </div>
            </SelectItem>
            <SelectItem value="fechado">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                Condomínio Fechado
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <FieldHint
          text={
            data.tipo_empreendimento === "aberto"
              ? "Lei 6.766/79 — vias públicas, doação de áreas. Registro de loteamento."
              : "Lei 4.591/64 — área privada, muro perimetral, portaria. Registro de incorporação."
          }
        />
      </div>

      {/* Lotes e área */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="dp-lotes">Total de lotes</Label>
          <Input
            id="dp-lotes"
            type="number"
            min={1}
            max={5000}
            value={data.total_lotes}
            onChange={(e) => onChange({ total_lotes: Number(e.target.value) })}
          />
          <FieldHint text="Quantidade total de lotes do parcelamento" />
        </div>
        <div>
          <Label htmlFor="dp-area">Área média do lote (m²)</Label>
          <Input
            id="dp-area"
            type="number"
            min={100}
            max={5000}
            step={10}
            value={data.area_media_lote_m2}
            onChange={(e) => onChange({ area_media_lote_m2: Number(e.target.value) })}
          />
          <FieldHint text="Área média por unidade" />
        </div>
      </div>

      {/* Preço por m² */}
      <div>
        <Label htmlFor="dp-preco">Preço por m² (R$/m²)</Label>
        <Input
          id="dp-preco"
          type="number"
          min={50}
          max={10000}
          step={10}
          value={data.preco_m2}
          onChange={(e) => onChange({ preco_m2: Number(e.target.value) })}
        />
        <FieldHint text="Preço médio de venda por metro quadrado" />
      </div>

      {/* VGV + Preço médio — calculados */}
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm text-blue-600 font-medium flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            VGV Estimado
          </span>
          <span className="font-bold text-blue-800 text-lg">
            R$ {(vgv / 1_000_000).toFixed(2)}M
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-blue-500">
          <span>Preço médio/lote</span>
          <span>R$ {precoMedioLote.toLocaleString("pt-BR")}</span>
        </div>
        <p className="text-xs text-blue-400">
          {data.total_lotes} lotes × {data.area_media_lote_m2}m² × R$ {data.preco_m2}/m²
        </p>
      </div>

      {/* Cronograma */}
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="h-4 w-4 text-gray-400" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Cronograma
        </span>
        <div className="h-px flex-1 bg-gray-100" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="dp-obra">Prazo Obra (meses)</Label>
          <Input
            id="dp-obra"
            type="number"
            min={6}
            max={60}
            value={data.prazo_obra_meses}
            onChange={(e) => onChange({ prazo_obra_meses: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="dp-comerc">Prazo Comercial</Label>
          <Input
            id="dp-comerc"
            type="number"
            min={6}
            max={120}
            value={data.prazo_comercializacao_meses}
            onChange={(e) => onChange({ prazo_comercializacao_meses: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="dp-inicio">Início vendas</Label>
          <Input
            id="dp-inicio"
            type="number"
            min={0}
            max={data.prazo_obra_meses}
            value={data.mes_inicio_vendas}
            onChange={(e) => onChange({ mes_inicio_vendas: Number(e.target.value) })}
          />
        </div>
      </div>
      <FieldHint text="Mês 0 = vendas no lançamento. Prazo Comercial = tempo total para vender 100% dos lotes." />

      {/* Resumo do cronograma visual */}
      <div className="flex gap-2">
        <Badge variant="outline" className="text-xs">
          Obra: {data.prazo_obra_meses}m
        </Badge>
        <Badge variant="outline" className="text-xs">
          Vendas: mês {data.mes_inicio_vendas} ao {data.prazo_comercializacao_meses}
        </Badge>
        <Badge variant="outline" className="text-xs">
          Total: {Math.max(data.prazo_obra_meses, data.prazo_comercializacao_meses)}m
        </Badge>
      </div>
    </div>
  );
}
