/**
 * ViarioSVG — Visualização gráfica proporcional do sistema viário
 * US-71: Calçada / Pista / Calçada — em tempo real
 *
 * SVG inline responsivo com CSS transitions para animação suave.
 */

import type { RoadSystemParams } from "@/lib/parcelamento/deep-premises-types";
import { calcLarguraTotalVia } from "@/lib/parcelamento/deep-premises-types";

interface Props {
  params: RoadSystemParams;
}

export function ViarioSVG({ params }: Props) {
  const total = calcLarguraTotalVia(params);
  if (total <= 0) return null;

  // Escala: normaliza para viewBox de 400px de largura
  const scale = 400 / total;
  const h = 120; // altura do SVG

  const cE = params.calcada_esquerda_m * scale;
  const pista = params.pista_m * scale;
  const cD = params.calcada_direita_m * scale;

  // Posições X
  const xCalcE = 0;
  const xPista = cE;
  const xCalcD = cE + pista;

  // Cores baseadas no tipo
  const corPista =
    params.tipo_pavimentacao === "PAVER"
      ? "#b45309"     // amber-700 (paver = tijolinho)
      : params.tipo_pavimentacao === "CBUQ"
      ? "#404040"     // cinza escuro (asfalto)
      : "#a3a3a3";    // cinza claro (sem)

  const corCalcada = "#d4d4d8"; // zinc-300
  const corMeioFio = "#71717a"; // zinc-500

  const mfW = 4; // largura visual do meio-fio em px

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 400 ${h}`}
        className="w-full h-28 rounded-lg border border-gray-200 bg-gray-50"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Terreno / fundo verde */}
        <rect x={0} y={0} width={400} height={h} fill="#e5e7eb" rx={6} />

        {/* ── Calçada esquerda ── */}
        <rect
          x={xCalcE}
          y={20}
          width={cE}
          height={h - 40}
          fill={corCalcada}
          className="transition-all duration-300"
        />

        {/* ── Meio-fio esquerdo ── */}
        <rect
          x={xCalcE + cE - mfW / 2}
          y={15}
          width={mfW}
          height={h - 30}
          fill={corMeioFio}
          rx={1}
          className="transition-all duration-300"
        />

        {/* ── Pista de rolamento ── */}
        <rect
          x={xPista}
          y={25}
          width={pista}
          height={h - 50}
          fill={corPista}
          className="transition-all duration-300"
        />

        {/* Linha central tracejada */}
        <line
          x1={xPista + pista / 2}
          y1={30}
          x2={xPista + pista / 2}
          y2={h - 30}
          stroke="white"
          strokeWidth={2}
          strokeDasharray="8,6"
          opacity={0.7}
        />

        {/* ── Meio-fio direito ── */}
        <rect
          x={xCalcD - mfW / 2}
          y={15}
          width={mfW}
          height={h - 30}
          fill={corMeioFio}
          rx={1}
          className="transition-all duration-300"
        />

        {/* ── Calçada direita ── */}
        <rect
          x={xCalcD}
          y={20}
          width={cD}
          height={h - 40}
          fill={corCalcada}
          className="transition-all duration-300"
        />

        {/* ── Labels de dimensão ── */}
        {/* Calçada esquerda */}
        <text
          x={xCalcE + cE / 2}
          y={h / 2 - 4}
          textAnchor="middle"
          className="text-[10px] font-medium fill-gray-600"
        >
          {params.calcada_esquerda_m}m
        </text>
        <text
          x={xCalcE + cE / 2}
          y={h / 2 + 10}
          textAnchor="middle"
          className="text-[8px] fill-gray-400"
        >
          Calçada
        </text>

        {/* Pista */}
        <text
          x={xPista + pista / 2}
          y={h / 2 - 4}
          textAnchor="middle"
          className="text-[11px] font-bold fill-white"
        >
          {params.pista_m}m
        </text>
        <text
          x={xPista + pista / 2}
          y={h / 2 + 10}
          textAnchor="middle"
          className="text-[8px] fill-white/80"
        >
          Pista ({params.tipo_pavimentacao})
        </text>

        {/* Calçada direita */}
        <text
          x={xCalcD + cD / 2}
          y={h / 2 - 4}
          textAnchor="middle"
          className="text-[10px] font-medium fill-gray-600"
        >
          {params.calcada_direita_m}m
        </text>
        <text
          x={xCalcD + cD / 2}
          y={h / 2 + 10}
          textAnchor="middle"
          className="text-[8px] fill-gray-400"
        >
          Calçada
        </text>

        {/* Total no topo */}
        <text
          x={200}
          y={12}
          textAnchor="middle"
          className="text-[9px] font-semibold fill-gray-500"
        >
          Largura total: {total.toFixed(1)}m
        </text>
      </svg>
    </div>
  );
}
