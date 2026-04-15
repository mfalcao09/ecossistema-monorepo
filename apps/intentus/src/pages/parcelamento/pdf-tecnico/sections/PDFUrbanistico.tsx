/**
 * PDFUrbanistico.tsx — Secao 2: Parametros Urbanisticos
 * Sessao 146 — Bloco K
 */
import { View, Text } from "@react-pdf/renderer";
import { s, colors } from "../pdfStyles";
import { formatPct, formatNum } from "../pdfHelpers";
import type { ParcelamentoDevelopment } from "@/lib/parcelamento/types";

interface Props {
  project: ParcelamentoDevelopment;
}

export default function PDFUrbanistico({ project }: Props) {
  return (
    <View>
      <Text style={s.sectionTitle}>2. Parametros Urbanisticos</Text>

      <View style={s.twoCol}>
        <View style={s.col}>
          <Text style={s.subSectionTitle}>Classificacao</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Tipo</Text>
            <Text style={s.infoValue}>
              {project.tipo_parcelamento?.replace(/_/g, " ") ?? "N/D"}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Padrao</Text>
            <Text style={s.infoValue}>
              {project.padrao_empreendimento ?? "N/D"}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Lote minimo</Text>
            <Text style={s.infoValue}>
              {project.lote_minimo_m2 ? `${formatNum(project.lote_minimo_m2, 0)} m2` : "N/D"}
            </Text>
          </View>
        </View>

        <View style={s.col}>
          <Text style={s.subSectionTitle}>Distribuicao de Areas</Text>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Area publica</Text>
            <Text style={s.infoValue}>
              {project.pct_area_publica != null ? formatPct(project.pct_area_publica) : "N/D"}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Area verde</Text>
            <Text style={s.infoValue}>
              {project.pct_area_verde != null ? formatPct(project.pct_area_verde) : "N/D"}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Sistema viario</Text>
            <Text style={s.infoValue}>
              {project.pct_sistema_viario != null ? formatPct(project.pct_sistema_viario) : "N/D"}
            </Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>APP declarada</Text>
            <Text style={s.infoValue}>
              {project.pct_app_declarado != null ? formatPct(project.pct_app_declarado) : "N/D"}
            </Text>
          </View>
        </View>
      </View>

      {/* Barra proporcional visual */}
      <Text style={[s.subSectionTitle, { marginTop: 12 }]}>
        Distribuicao Proporcional
      </Text>
      <View style={{ flexDirection: "row", height: 16, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
        <BarSegment pct={project.pct_sistema_viario} color={colors.gray600} label="Viario" />
        <BarSegment pct={project.pct_area_publica} color={colors.primaryLight} label="Publica" />
        <BarSegment pct={project.pct_area_verde} color={colors.accent} label="Verde" />
        <BarSegment pct={project.pct_app_declarado} color={colors.warning} label="APP" />
        <BarSegment
          pct={calcAreaLiquida(project)}
          color={colors.primary}
          label="Liquida"
        />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        <Legend color={colors.gray600} label={`Viario ${formatPct(project.pct_sistema_viario)}`} />
        <Legend color={colors.primaryLight} label={`Publica ${formatPct(project.pct_area_publica)}`} />
        <Legend color={colors.accent} label={`Verde ${formatPct(project.pct_area_verde)}`} />
        <Legend color={colors.warning} label={`APP ${formatPct(project.pct_app_declarado)}`} />
        <Legend color={colors.primary} label={`Liquida ${formatPct(calcAreaLiquida(project))}`} />
      </View>

      {/* Alerta Lei 6.766 */}
      {(project.pct_area_publica ?? 0) < 35 && project.tipo === "loteamento" && (
        <View style={s.alertInfo}>
          <Text style={s.alertText}>
            Lei 6.766/79 exige minimo de 35% de area publica para loteamentos (sistema viario + areas verdes + areas institucionais).
          </Text>
        </View>
      )}
    </View>
  );
}

function calcAreaLiquida(p: ParcelamentoDevelopment): number | null {
  const total =
    (p.pct_sistema_viario ?? 0) +
    (p.pct_area_publica ?? 0) +
    (p.pct_area_verde ?? 0) +
    (p.pct_app_declarado ?? 0);
  if (total === 0) return null;
  return Math.max(0, 100 - total);
}

function BarSegment({ pct, color }: { pct?: number | null; color: string; label: string }) {
  if (!pct || pct <= 0) return null;
  return (
    <View style={{ width: `${pct}%`, backgroundColor: color, height: 16 }} />
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 7, color: "#4a5568" }}>{label}</Text>
    </View>
  );
}
