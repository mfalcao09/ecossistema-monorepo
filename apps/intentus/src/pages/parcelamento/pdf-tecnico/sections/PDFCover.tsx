/**
 * PDFCover.tsx — Capa do Relatorio Tecnico
 * Sessao 146 — Bloco K
 */
import { Page, View, Text } from "@react-pdf/renderer";
import { s, colors } from "../pdfStyles";
import { formatDateLong } from "../pdfHelpers";
import type { ParcelamentoDevelopment } from "@/lib/parcelamento/types";

interface Props {
  project: ParcelamentoDevelopment;
}

export default function PDFCover({ project }: Props) {
  const dateStr = formatDateLong();
  const tipoLabel =
    project.tipo === "loteamento"
      ? "Loteamento"
      : project.tipo === "condominio"
      ? "Condominio Horizontal"
      : "Parcelamento de Solo";

  return (
    <Page size="A4" style={s.page}>
      <View style={s.coverContainer}>
        <Text style={s.coverBrand}>Intentus Real Estate</Text>
        <Text style={s.coverTitle}>{project.name}</Text>
        <Text style={s.coverSubtitle}>
          Relatorio Tecnico de Viabilidade
        </Text>
        <View style={s.coverDivider} />
        <Text style={s.coverMeta}>
          {project.city ?? "—"}, {project.state ?? "—"}
        </Text>
        <Text style={s.coverMeta}>{tipoLabel}</Text>
        <Text style={s.coverMeta}>{dateStr}</Text>

        {/* Area e lotes no cover */}
        {project.area_m2 && (
          <Text style={[s.coverMeta, { marginTop: 16 }]}>
            Area: {(project.area_m2 / 10000).toFixed(2)} ha |{" "}
            {project.total_units ?? "—"} lotes estimados
          </Text>
        )}
      </View>

      <View style={s.coverFooter}>
        <Text style={s.coverFooterText}>
          Documento gerado automaticamente pela plataforma Intentus
        </Text>
        <Text style={s.coverFooterText}>Confidencial</Text>
      </View>
    </Page>
  );
}
