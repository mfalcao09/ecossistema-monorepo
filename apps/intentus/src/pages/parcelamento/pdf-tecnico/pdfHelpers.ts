/**
 * pdfHelpers.ts — Funcoes auxiliares para formatacao no PDF
 * Sessao 146 — Bloco K (Relatorios e Exportacao)
 */
import { colors } from "./pdfStyles";

export function formatBRL(value: number | null | undefined): string {
  if (value == null) return "N/D";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatBRLCompact(value: number | null | undefined): string {
  if (value == null) return "N/D";
  if (Math.abs(value) >= 1_000_000_000)
    return `R$ ${(value / 1_000_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} B`;
  if (Math.abs(value) >= 1_000_000)
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(value) >= 1_000)
    return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return formatBRL(value);
}

export function formatPct(value: number | null | undefined): string {
  if (value == null) return "N/D";
  return `${value.toFixed(1)}%`;
}

export function formatNum(value: number | null | undefined, decimals = 1): string {
  if (value == null) return "N/D";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatArea(m2: number | null | undefined): string {
  if (m2 == null) return "N/D";
  const ha = m2 / 10000;
  return ha >= 1
    ? `${formatNum(m2, 0)} m2 (${formatNum(ha, 2)} ha)`
    : `${formatNum(m2, 0)} m2`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "N/D";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatDateLong(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function viabilidadeColor(score: number | null | undefined): string {
  if (score == null) return colors.gray500;
  if (score >= 70) return colors.accent;
  if (score >= 45) return colors.warning;
  return colors.danger;
}

export function viabilidadeLabel(score: number | null | undefined): string {
  if (score == null) return "Pendente";
  if (score >= 70) return "Viavel";
  if (score >= 45) return "Atencao";
  return "Inviavel";
}

export function riskColor(risk: string | null | undefined): string {
  switch (risk) {
    case "baixo": return colors.accent;
    case "moderado": return colors.warning;
    case "alto": return colors.danger;
    case "critico": return colors.danger;
    default: return colors.gray500;
  }
}

export function statusLabel(status: "pass" | "warn" | "fail" | "pending" | string): string {
  switch (status) {
    case "pass": case "compliant": return "Conforme";
    case "warn": case "warning": return "Alerta";
    case "fail": case "violation": return "Violacao";
    case "pending": case "missing_info": return "Pendente";
    default: return status;
  }
}

/** Chunk array into pages of N items */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
