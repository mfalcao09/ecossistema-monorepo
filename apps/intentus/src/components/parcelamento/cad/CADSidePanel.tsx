import React from "react";
import { CADElement, CATEGORY_LABELS } from "@/types/cad";
import { formatArea, formatLength } from "@/lib/geoTransform";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CADSidePanelProps {
  elements: CADElement[];
  totalAreaM2: number;
  scaleLabel: string;
}

interface CategoryStats {
  category: string;
  label: string;
  count: number;
  area_m2: number;
  color: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  lote: '#3b82f6',
  quadra: '#8b5cf6',
  via: '#6b7280',
  area_verde: '#22c55e',
  area_institucional: '#f59e0b',
  app: '#06b6d4',
  reserva_legal: '#84cc16',
  area_lazer: '#f97316',
  annotation: '#9ca3af',
  line: '#374151',
};

export function CADSidePanel({ elements, totalAreaM2, scaleLabel }: CADSidePanelProps) {
  // Aggregate stats per category
  const statsMap: Record<string, CategoryStats> = {};
  for (const el of elements) {
    if (!el.closed) continue; // skip lines for area stats
    const area = el.properties.area_m2 ?? 0;
    if (!statsMap[el.category]) {
      statsMap[el.category] = {
        category: el.category,
        label: CATEGORY_LABELS[el.category] ?? el.category,
        count: 0,
        area_m2: 0,
        color: CATEGORY_COLORS[el.category] ?? '#9ca3af',
      };
    }
    statsMap[el.category].count++;
    statsMap[el.category].area_m2 += area;
  }

  const stats = Object.values(statsMap).sort((a, b) => b.area_m2 - a.area_m2);

  // Lei 6.766 compliance
  const totalLotes = elements.filter((e) => e.category === 'lote' && e.closed);
  const areaLotes = statsMap['lote']?.area_m2 ?? 0;
  const areaVerde = (statsMap['area_verde']?.area_m2 ?? 0) + (statsMap['area_lazer']?.area_m2 ?? 0);
  const areaVia = statsMap['via']?.area_m2 ?? 0;
  const areaInst = statsMap['area_institucional']?.area_m2 ?? 0;
  const totalUsed = areaLotes + areaVerde + areaVia + areaInst;

  const pctVerde = totalUsed > 0 ? (areaVerde / totalUsed) * 100 : 0;
  const pctVia = totalUsed > 0 ? (areaVia / totalUsed) * 100 : 0;

  const loteOk = totalLotes.every(
    (l) => (l.properties.area_m2 ?? 0) >= 125
  );
  const verdeOk = pctVerde >= 10;
  const viaOk = pctVia >= 20;

  const lotesSmall = totalLotes.filter((l) => (l.properties.area_m2 ?? 0) < 125).length;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-background/95 backdrop-blur border border-border rounded-xl shadow-lg p-3 min-w-[320px] max-w-[480px]">
      {/* Scale */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground font-medium">Escala: {scaleLabel}</span>
        <span className="text-xs text-muted-foreground">
          {elements.length} elemento{elements.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Category breakdown */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
          {stats.map((s) => (
            <div key={s.category} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-muted-foreground truncate">{s.label}</span>
              <span className="text-xs font-medium ml-auto">{formatArea(s.area_m2)}</span>
            </div>
          ))}
        </div>
      )}

      {stats.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-1">
          Nenhum elemento desenhado ainda
        </p>
      )}

      {/* Lei 6.766 quick check */}
      {totalLotes.length > 0 && (
        <>
          <div className="border-t border-border pt-2 mt-2">
            <p className="text-xs font-medium mb-1.5">Conformidade Lei 6.766</p>
            <div className="space-y-1">
              <ComplianceRow
                ok={loteOk}
                label={
                  loteOk
                    ? `Lotes ≥ 125 m² ✓`
                    : `${lotesSmall} lote(s) abaixo de 125 m²`
                }
              />
              <ComplianceRow
                ok={verdeOk}
                label={`Área verde: ${pctVerde.toFixed(1)}% ${verdeOk ? '≥ 10% ✓' : '(mín. 10%)'}`}
              />
              <ComplianceRow
                ok={viaOk}
                label={`Viário: ${pctVia.toFixed(1)}% ${viaOk ? '≥ 20% ✓' : '(mín. 20%)'}`}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ComplianceRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      )}
      <span className={`text-xs ${ok ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
        {label}
      </span>
    </div>
  );
}
