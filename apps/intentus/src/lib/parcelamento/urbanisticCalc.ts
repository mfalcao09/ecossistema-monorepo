/**
 * urbanisticCalc.ts — Cálculos urbanísticos e score de viabilidade
 *
 * Implementa os parâmetros da Lei 6.766/79 (Parcelamento do Solo Urbano)
 * e cálculos de viabilidade técnica para o wizard de novo projeto.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UrbanisticInput {
  /** Área total do terreno em m² */
  area_total_m2: number;
  /** Declividade média do terreno em % */
  declividade_pct: number;
  /** Área de APP estimada em m² */
  app_area_m2: number;
  /** Percentual de Reserva Legal (conforme UF e bioma) */
  reserva_legal_pct: number;
  /** Percentual mínimo de área pública exigido pelo município (default 35% pela Lei 6.766) */
  area_publica_min_pct?: number;
  /** Área mínima de cada lote em m² (default 125 m² Lei 6.766 art. 4) */
  lote_min_m2?: number;
  /** Frente mínima do lote em metros (default 5 m) */
  frente_min_m?: number;
}

export interface UrbanisticResult {
  /** Área líquida após APP e Reserva Legal */
  area_liquida_m2: number;
  /** Área disponível para loteamento após área pública */
  area_loteavel_m2: number;
  /** Área de APP em m² */
  app_area_m2: number;
  /** Área de Reserva Legal em m² */
  reserva_legal_m2: number;
  /** Área pública mínima em m² (ruas, praças, equipamentos) */
  area_publica_m2: number;
  /** Estimativa de número de lotes */
  lotes_estimados: number;
  /** Percentual de área bruta comprometida com restrições */
  restricoes_pct: number;
  /** Índice de aproveitamento efetivo (área loteável / área total) */
  aproveitamento_pct: number;
  /** Alertas urbanísticos */
  alertas_lei6766: string[];
  /** Se o terreno está tecnicamente viável para parcelamento */
  is_viable: boolean;
}

// ---------------------------------------------------------------------------
// Reserva Legal por UF (Lei 12.651/2012 — Código Florestal)
// ---------------------------------------------------------------------------

const RESERVA_LEGAL_BY_UF: Record<string, number> = {
  // Amazônia Legal
  AM: 80, PA: 80, RO: 80, RR: 80, AC: 80, AP: 80, MT: 80,
  TO: 35, MA: 35,
  // Demais estados (Cerrado, Mata Atlântica, Pampa, Pantanal)
  GO: 20, MS: 20, MG: 20, SP: 20, RJ: 20, ES: 20,
  BA: 20, SE: 20, AL: 20, PE: 20, PB: 20, RN: 20, CE: 20, PI: 20,
  PR: 20, SC: 20, RS: 20, DF: 20,
};

/**
 * Retorna o percentual de Reserva Legal exigido para a UF.
 * Default 20% para UFs não mapeadas.
 */
export function getReservaLegalPctByUF(uf: string): number {
  return RESERVA_LEGAL_BY_UF[uf.toUpperCase()] ?? 20;
}

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

/**
 * Calcula parâmetros urbanísticos conforme Lei 6.766/79 e Lei 12.651/2012.
 */
export function calculateUrbanistic(input: UrbanisticInput): UrbanisticResult {
  const {
    area_total_m2,
    declividade_pct,
    app_area_m2,
    reserva_legal_pct,
    area_publica_min_pct = 35,
    lote_min_m2 = 125,
  } = input;

  const alertas: string[] = [];

  // 1. APP + Reserva Legal
  const reserva_legal_m2 = (reserva_legal_pct / 100) * area_total_m2;
  const area_liquida_m2 = Math.max(0, area_total_m2 - app_area_m2 - reserva_legal_m2);

  // 2. Área pública mínima (Lei 6.766 art. 4 — 35% da gleba total)
  const area_publica_m2 = (area_publica_min_pct / 100) * area_total_m2;

  // 3. Área loteável
  const area_loteavel_m2 = Math.max(0, area_liquida_m2 - area_publica_m2);

  // 4. Estimativa de lotes (eficiência de 70% na área loteável)
  const eficiencia = 0.70;
  const lotes_estimados = Math.floor((area_loteavel_m2 * eficiencia) / lote_min_m2);

  // 5. Percentuais
  const restricoes_pct = ((app_area_m2 + reserva_legal_m2 + area_publica_m2) / area_total_m2) * 100;
  const aproveitamento_pct = (area_loteavel_m2 / area_total_m2) * 100;

  // 6. Alertas Lei 6.766
  if (declividade_pct > 30) {
    alertas.push("Declividade > 30% — área imprópria para parcelamento (Lei 6.766 art. 3°, IV)");
  } else if (declividade_pct > 15) {
    alertas.push("Declividade entre 15-30% — atenção às diretrizes municipais de corte e aterro");
  }

  if (area_loteavel_m2 < 2000) {
    alertas.push("Área loteável abaixo de 2.000 m² — inviável economicamente");
  }

  if (lotes_estimados < 10) {
    alertas.push("Estimativa de lotes abaixo de 10 — avaliar viabilidade do empreendimento");
  }

  if (restricoes_pct > 70) {
    alertas.push("Mais de 70% da área comprometida com restrições ambientais e urbanísticas");
  }

  if (aproveitamento_pct < 15) {
    alertas.push("Aproveitamento efetivo abaixo de 15% — revisar premissas de APP e Reserva Legal");
  }

  const is_viable = declividade_pct <= 30 && lotes_estimados >= 5 && area_loteavel_m2 > 0;

  return {
    area_liquida_m2,
    area_loteavel_m2,
    app_area_m2,
    reserva_legal_m2,
    area_publica_m2,
    lotes_estimados,
    restricoes_pct,
    aproveitamento_pct,
    alertas_lei6766: alertas,
    is_viable,
  };
}

// ---------------------------------------------------------------------------
// Viabilidade Score (0–100)
// ---------------------------------------------------------------------------

/**
 * Calcula um score de viabilidade 0–100 baseado nos parâmetros urbanísticos.
 *
 * Dimensões:
 * - Aproveitamento efetivo  (40%)
 * - Declividade             (25%)
 * - Quantidade de lotes     (20%)
 * - Restrições ambientais   (15%)
 */
export function calculateViabilidadeScore(result: UrbanisticResult, declividade_pct: number): number {
  // Aproveitamento (0–40 pts)
  const aprovPts = Math.min(40, (result.aproveitamento_pct / 50) * 40);

  // Declividade (0–25 pts)
  let declivPts: number;
  if (declividade_pct <= 8) declivPts = 25;
  else if (declividade_pct <= 15) declivPts = 20;
  else if (declividade_pct <= 25) declivPts = 10;
  else if (declividade_pct <= 30) declivPts = 3;
  else declivPts = 0;

  // Número de lotes (0–20 pts)
  let lotesPts: number;
  if (result.lotes_estimados >= 200) lotesPts = 20;
  else if (result.lotes_estimados >= 100) lotesPts = 16;
  else if (result.lotes_estimados >= 50) lotesPts = 12;
  else if (result.lotes_estimados >= 20) lotesPts = 7;
  else if (result.lotes_estimados >= 5) lotesPts = 3;
  else lotesPts = 0;

  // Restrições (0–15 pts) — quanto menor a restrição, melhor
  const restricoesPts = Math.max(0, 15 - (result.restricoes_pct / 100) * 15);

  const total = Math.round(aprovPts + declivPts + lotesPts + restricoesPts);
  return Math.min(100, Math.max(0, total));
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

/** Formata percentual com 1 casa decimal */
export function formatPct(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/**
 * Formata área SEMPRE em m² com separador de milhar pt-BR.
 *
 * ⚠️ Sessão 130 CONT3 — decisão UX Marcelo: NUNCA converter para hectares
 * no frontend. Setor imobiliário prefere m² direto.
 */
export function formatM2(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m²`;
}
