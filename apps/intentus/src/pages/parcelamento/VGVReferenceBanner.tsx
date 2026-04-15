/**
 * VGVReferenceBanner.tsx — VGV de Referência Permanente (US-100)
 * Sessão 146 — Bloco K
 *
 * Banner sempre visível com VGV bruto e líquido + aviso de ajuste
 * quando os dados financeiros estão desatualizados em relação
 * aos parâmetros do terreno.
 *
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */
import { useMemo } from "react";
import { useParcelamentoFinancial } from "@/hooks/useParcelamentoProjects";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

interface Props {
  projectId: string;
  vgvEstimado?: number | null;
  totalUnits?: number | null;
  areaM2?: number | null;
  updatedAt?: string | null;
}

function formatBRL(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `R$ ${(value / 1_000).toFixed(0)} mil`;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBRLFull(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function VGVReferenceBanner({
  projectId,
  vgvEstimado,
  totalUnits,
  areaM2,
  updatedAt,
}: Props) {
  const { data: financial, isLoading } = useParcelamentoFinancial(projectId);

  const vgvBruto = financial?.vgv_bruto ?? vgvEstimado;
  const vgvLiquido = financial?.vgv_liquido;
  const margemBruta = financial?.margem_bruta_pct;

  // Check if financial data might be outdated
  const needsUpdate = useMemo(() => {
    if (!financial || !updatedAt) return false;
    const projectUpdated = new Date(updatedAt).getTime();
    const financialUpdated = financial.updated_at
      ? new Date(financial.updated_at).getTime()
      : 0;
    // Financial is outdated if project was updated after financial calc
    return projectUpdated > financialUpdated + 60_000; // 1 min tolerance
  }, [financial, updatedAt]);

  // Per-unit and per-m2 metrics
  const vgvPerUnit = vgvBruto && totalUnits ? vgvBruto / totalUnits : null;
  const vgvPerM2 = vgvBruto && areaM2 ? vgvBruto / areaM2 : null;

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border border-gray-100 bg-gray-50 p-4 h-20" />
    );
  }

  if (!vgvBruto) return null;

  return (
    <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-indigo-50/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="w-4 h-4 text-blue-600" />
        <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
          VGV de Referencia
        </span>
        {needsUpdate && (
          <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            Ajuste recomendado
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* VGV Bruto */}
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Bruto</p>
          <p className="text-lg font-bold text-gray-900" title={formatBRLFull(vgvBruto)}>
            {formatBRL(vgvBruto)}
          </p>
        </div>

        {/* VGV Líquido */}
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Liquido</p>
          <p className="text-lg font-bold text-emerald-700" title={formatBRLFull(vgvLiquido)}>
            {vgvLiquido ? formatBRL(vgvLiquido) : "—"}
          </p>
          {margemBruta != null && (
            <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              Margem {(margemBruta * 100).toFixed(1)}%
            </p>
          )}
        </div>

        {/* VGV por Lote */}
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Por Lote</p>
          <p className="text-sm font-semibold text-gray-700">
            {vgvPerUnit ? formatBRLFull(vgvPerUnit) : "—"}
          </p>
        </div>

        {/* VGV por m² */}
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Por m2</p>
          <p className="text-sm font-semibold text-gray-700">
            {vgvPerM2 ? formatBRLFull(vgvPerM2) : "—"}
          </p>
        </div>
      </div>

      {needsUpdate && (
        <div className="mt-3 pt-2 border-t border-blue-100">
          <p className="text-[10px] text-amber-700 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Os parametros do terreno foram atualizados apos o ultimo calculo financeiro.
            Recalcule na aba Financeiro para atualizar o VGV.
          </p>
        </div>
      )}
    </div>
  );
}
