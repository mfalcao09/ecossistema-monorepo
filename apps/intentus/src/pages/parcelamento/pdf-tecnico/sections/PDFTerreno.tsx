/**
 * PDFTerreno.tsx — Secao 1: Terreno e Topografia
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors, hexToRgba } from "../pdfStyles";
import { formatArea, formatPct, formatNum, viabilidadeColor, viabilidadeLabel } from "../pdfHelpers";
import type { ParcelamentoDevelopment } from "@/lib/parcelamento/types";

interface Props {
  project: ParcelamentoDevelopment;
}

export default function PDFTerreno({ project }: Props) {
  const viabScore = project.analysis_results?.viabilidade_score ?? null;
  const viabColor = viabilidadeColor(viabScore);

  return (
    <View>
      <Text style={s.sectionTitle}>1. Terreno e Topografia</Text>

      {/* Score de viabilidade */}
      <View
        style={[
          s.scoreBadge,
          { backgroundColor: hexToRgba(viabColor, 0.08) },
        ]}
      >
        <Text style={[s.scoreValue, { color: viabColor }]}>
          {viabScore != null ? viabScore.toFixed(0) : "—"}
        </Text>
        <View>
          <Text style={[s.scoreLabel, { fontFamily: "Helvetica-Bold" }]}>
            {viabilidadeLabel(viabScore)}
          </Text>
          <Text style={{ fontSize: 7, color: colors.gray500 }}>
            Score de viabilidade (0-100)
          </Text>
        </View>
      </View>

      <View style={s.twoCol}>
        {/* Coluna 1: Caracteristicas fisicas */}
        <View style={s.col}>
          <Text style={s.subSectionTitle}>Caracteristicas Fisicas</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Area total</Text>
            <Text style={s.infoValue}>{formatArea(project.area_m2)}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Perimetro</Text>
            <Text style={s.infoValue}>
              {project.perimeter_m ? `${formatNum(project.perimeter_m, 0)} m` : "N/D"}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Elevacao</Text>
            <Text style={s.infoValue}>
              {project.elevation_min != null && project.elevation_max != null
                ? `${formatNum(project.elevation_min, 0)}m - ${formatNum(project.elevation_max, 0)}m (desnivel ${formatNum((project.elevation_max ?? 0) - (project.elevation_min ?? 0), 0)}m)`
                : "N/D"}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Elevacao media</Text>
            <Text style={s.infoValue}>
              {project.elevation_avg != null ? `${formatNum(project.elevation_avg, 0)} m` : "N/D"}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Declividade media</Text>
            <Text style={s.infoValue}>
              {project.slope_avg_pct != null ? formatPct(project.slope_avg_pct) : "N/D"}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Localizacao</Text>
            <Text style={s.infoValue}>
              {project.city ?? "—"}, {project.state ?? "—"}
            </Text>
          </View>
        </View>

        {/* Coluna 2: Areas ambientais */}
        <View style={s.col}>
          <Text style={s.subSectionTitle}>Areas Ambientais</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>APP (Area Prot. Perm.)</Text>
            <Text style={s.infoValue}>
              {project.app_area_m2 ? formatArea(project.app_area_m2) : "N/D"}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Reserva Legal</Text>
            <Text style={s.infoValue}>
              {project.reserva_legal_pct != null
                ? `${formatPct(project.reserva_legal_pct)} (${project.reserva_legal_source ?? "estimativa"})`
                : "N/D"}
            </Text>
          </View>
          {project.reserva_legal_area_m2 && (
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>RL area</Text>
              <Text style={s.infoValue}>
                {formatArea(project.reserva_legal_area_m2)}
              </Text>
            </View>
          )}
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Lotes estimados</Text>
            <Text style={s.infoValue}>{project.total_units ?? "N/D"}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Arquivo origem</Text>
            <Text style={s.infoValue}>
              {project.source_file_name ?? "N/D"} ({project.source_file_format ?? "—"})
            </Text>
          </View>
        </View>
      </View>

      {/* Alerta de declividade alta */}
      {(project.slope_avg_pct ?? 0) > 30 && (
        <View style={s.alertDanger}>
          <Text style={s.alertText}>
            Atencao: Declividade media acima de 30% pode inviabilizar parcelamento per Lei 6.766/79, art. 3o, par. unico, III.
          </Text>
        </View>
      )}
    </View>
  );
}
