/**
 * PDFPageWrapper.tsx — Pagina reutilizavel com header/footer fixo
 * Sessao 146 — Bloco K (Relatorios e Exportacao)
 */
import { Page, View, Text } from "@react-pdf/renderer";
import { s, colors } from "./pdfStyles";

interface PDFPageWrapperProps {
  children: React.ReactNode;
  projectName: string;
  dateStr: string;
}

export default function PDFPageWrapper({
  children,
  projectName,
  dateStr,
}: PDFPageWrapperProps) {
  return (
    <Page size="A4" style={s.page}>
      {/* Header fixo */}
      <View style={s.header} fixed>
        <Text style={s.headerBrand}>Intentus Real Estate</Text>
        <Text style={s.headerProject}>{projectName}</Text>
      </View>

      {/* Conteudo da pagina */}
      {children}

      {/* Footer fixo com numeracao de pagina */}
      <View style={s.footer} fixed>
        <Text style={s.footerText}>
          Relatorio Tecnico — {dateStr}
        </Text>
        <Text
          style={s.footerText}
          render={({ pageNumber, totalPages }) =>
            `Pagina ${pageNumber} de ${totalPages}`
          }
        />
      </View>
    </Page>
  );
}
