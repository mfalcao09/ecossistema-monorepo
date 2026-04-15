/**
 * ParcelamentoRelatorios.tsx — Página de Relatórios do Parcelamento
 * Bloco K — Sessão 146
 *
 * Cards de download:
 * - Executivo (2 páginas): capa + KPIs financeiros + terreno + conformidade
 * - Técnico (10-20 páginas): detalhamento completo de TODOS os módulos
 *
 * Pair programming: Claudinho + Buchecha (MiniMax M2.7)
 */
import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import {
  useParcelamentoFinancial,
  useLatestLegalAnalysis,
} from "@/hooks/useParcelamentoProjects";
import { useAuth } from "@/hooks/useAuth";
import { useReportTecnicoData } from "@/hooks/useReportTecnicoData";
import { useShareLinks } from "@/hooks/useShareLinks";
import type { ShareLink } from "@/hooks/useShareLinks";
import ReportExecutivoPDF from "./ReportExecutivoPDF";
import type { ParcelamentoDevelopment } from "@/lib/parcelamento/types";
import { exportExcelFull } from "./exportExcelFull";
import {
  FileText,
  Download,
  Loader2,
  FileBarChart,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  Link2,
  Copy,
  Trash2,
  Share2,
} from "lucide-react";

// Lazy load do PDF técnico para não pesar o bundle inicial
const ReportTecnicoPDF = lazy(
  () => import("./pdf-tecnico/ReportTecnicoPDF")
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ParcelamentoRelatoriosProps {
  project: ParcelamentoDevelopment;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParcelamentoRelatorios({
  project,
}: ParcelamentoRelatoriosProps) {
  const { tenantId, user } = useAuth();
  const { data: financial, isLoading: loadingFin } = useParcelamentoFinancial(
    project.id,
  );
  const { data: legalAnalysis, isLoading: loadingLegal } =
    useLatestLegalAnalysis(project.id);

  const isLoadingExec = loadingFin || loadingLegal;

  // Share links (US-31)
  const {
    links: shareLinks,
    isLoading: loadingLinks,
    isCreating: creatingLink,
    error: shareError,
    createLink,
    listLinks,
    revokeLink,
  } = useShareLinks();

  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [shareExpiry, setShareExpiry] = useState<number>(72);

  // Load existing share links on mount
  useEffect(() => {
    if (tenantId) {
      listLinks(tenantId, project.id);
    }
  }, [tenantId, project.id, listLinks]);

  const handleCreateShareLink = async () => {
    if (!tenantId || !user?.id) return;
    await createLink({
      tenantId,
      developmentId: project.id,
      reportType: "tecnico",
      expiresInHours: shareExpiry,
      createdBy: user.id,
    });
  };

  const handleCopyLink = (link: ShareLink) => {
    const url =
      link.url ??
      `https://app.intentusrealestate.com.br/share/${link.token}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkId(link.id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const handleRevokeLink = async (linkId: string) => {
    if (!tenantId) return;
    await revokeLink(tenantId, linkId);
  };

  // Technical report data
  const {
    data: tecnicoData,
    isLoading: loadingTecnico,
    progress: tecnicoProgress,
    error: tecnicoError,
    fetchAll: fetchTecnicoData,
    reset: resetTecnico,
  } = useReportTecnicoData();

  const [tecnicoReady, setTecnicoReady] = useState(false);

  const handleGenerateTecnico = async () => {
    if (!tenantId) return;
    setTecnicoReady(false);
    const result = await fetchTecnicoData(project, tenantId);
    if (result) {
      setTecnicoReady(true);
    }
  };

  const handleResetTecnico = () => {
    resetTecnico();
    setTecnicoReady(false);
  };

  // File names
  const execFileName = useMemo(() => {
    const slug = project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const date = new Date().toISOString().slice(0, 10);
    return `relatorio-executivo-${slug}-${date}.pdf`;
  }, [project.name]);

  const tecnicoFileName = useMemo(() => {
    const slug = project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const date = new Date().toISOString().slice(0, 10);
    return `relatorio-tecnico-${slug}-${date}.pdf`;
  }, [project.name]);

  // Count how many data sections are available
  const sectionCount = useMemo(() => {
    if (!tecnicoData) return 0;
    let count = 2; // terreno + urbanistico always present
    if (tecnicoData.financial) count++;
    if (tecnicoData.legalAnalysis) count++;
    if (tecnicoData.itbi || tecnicoData.outorga || tecnicoData.leiVerde) count++;
    if (tecnicoData.sinapi || tecnicoData.secovi || tecnicoData.abrainc) count++;
    if (tecnicoData.censusIncome?.length || tecnicoData.censusDemographics?.length) count++;
    if (tecnicoData.ibamaResult || tecnicoData.icmbioResult) count++;
    if (tecnicoData.mapBiomasLatest || tecnicoData.mapBiomasTrend) count++;
    if (tecnicoData.zoneamento) count++;
    if (tecnicoData.memorial) count++;
    if (tecnicoData.matriculas?.length) count++;
    if (tecnicoData.fiiCra) count++;
    return count;
  }, [tecnicoData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800">
          Relatorios do Empreendimento
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Gere relatorios PDF profissionais para investidores e parceiros
        </p>
      </div>

      {/* Cards de relatório */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Relatório Executivo */}
        <div className="border border-gray-200 rounded-xl p-5 bg-white hover:shadow-sm transition-shadow">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-800">
                Relatorio Executivo
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                2 paginas — Capa + KPIs financeiros, terreno, conformidade
                legal. Ideal para apresentar a investidores.
              </p>
            </div>
          </div>

          {/* Status dos dados */}
          <div className="mt-4 space-y-1.5">
            <StatusRow
              label="Dados do terreno"
              ready={!!(project.area_m2 && project.geometry)}
            />
            <StatusRow
              label="Analise financeira"
              ready={!!(financial && financial.is_calculated)}
              loading={loadingFin}
            />
            <StatusRow
              label="Conformidade legal"
              ready={!!legalAnalysis}
              loading={loadingLegal}
            />
          </div>

          {/* Botão de download */}
          <div className="mt-4">
            {isLoadingExec ? (
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-400 text-sm font-medium"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando dados...
              </button>
            ) : (
              <PDFDownloadLink
                document={
                  <ReportExecutivoPDF
                    project={project}
                    financial={financial}
                    legalAnalysis={legalAnalysis}
                  />
                }
                fileName={execFileName}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                {({ loading }) =>
                  loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando PDF...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Baixar Relatorio Executivo
                    </>
                  )
                }
              </PDFDownloadLink>
            )}
          </div>
        </div>

        {/* Card 2: Relatório Técnico Completo */}
        <div className="border border-gray-200 rounded-xl p-5 bg-white hover:shadow-sm transition-shadow">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <FileBarChart className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-800">
                Relatorio Tecnico Completo
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                10-20 paginas — Terreno, financeiro, fluxo de caixa, Monte
                Carlo, conformidade legal, regulacoes, benchmarks, censo,
                embargos, MapBiomas, zoneamento, memorial descritivo e mais.
              </p>
            </div>
          </div>

          {/* Progress / Status */}
          <div className="mt-4">
            {loadingTecnico && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
                  <span className="text-xs text-gray-600">
                    Coletando dados... {tecnicoProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${tecnicoProgress}%` }}
                  />
                </div>
              </div>
            )}

            {tecnicoError && (
              <div className="flex items-center gap-2 text-xs text-red-600 mb-3">
                <AlertCircle className="w-3.5 h-3.5" />
                {tecnicoError}
              </div>
            )}

            {tecnicoReady && tecnicoData && (
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-xs text-gray-700">
                    {sectionCount} secoes com dados disponíveis
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="mt-2 space-y-2">
            {!tecnicoReady ? (
              <button
                onClick={handleGenerateTecnico}
                disabled={loadingTecnico}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium transition-colors"
              >
                {loadingTecnico ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Coletando dados...
                  </>
                ) : (
                  <>
                    <FileBarChart className="w-4 h-4" />
                    Preparar Relatorio Tecnico
                  </>
                )}
              </button>
            ) : (
              <>
                <Suspense
                  fallback={
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-100 text-gray-400 text-sm font-medium"
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Carregando componente PDF...
                    </button>
                  }
                >
                  <PDFDownloadLink
                    document={
                      <ReportTecnicoPDF
                        project={project}
                        financial={tecnicoData!.financial}
                        legalAnalysis={tecnicoData!.legalAnalysis}
                        itbi={tecnicoData!.itbi}
                        outorga={tecnicoData!.outorga}
                        leiVerde={tecnicoData!.leiVerde}
                        cnpjSpe={tecnicoData!.cnpjSpe}
                        sinapi={tecnicoData!.sinapi}
                        secovi={tecnicoData!.secovi}
                        abrainc={tecnicoData!.abrainc}
                        censusIncome={tecnicoData!.censusIncome}
                        censusDemographics={tecnicoData!.censusDemographics}
                        censusHousing={tecnicoData!.censusHousing}
                        ibamaResult={tecnicoData!.ibamaResult}
                        icmbioResult={tecnicoData!.icmbioResult}
                        mapBiomasLatest={tecnicoData!.mapBiomasLatest}
                        mapBiomasTrend={tecnicoData!.mapBiomasTrend}
                        zoneamento={tecnicoData!.zoneamento}
                        memorial={tecnicoData!.memorial}
                        matriculas={tecnicoData!.matriculas}
                        fiiCra={tecnicoData!.fiiCra}
                      />
                    }
                    fileName={tecnicoFileName}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
                  >
                    {({ loading }) =>
                      loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Gerando PDF...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Baixar Relatorio Tecnico
                        </>
                      )
                    }
                  </PDFDownloadLink>
                </Suspense>
                <button
                  onClick={handleResetTecnico}
                  className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50 text-xs transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Recarregar dados
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Card 3: Export Excel Full */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-xl p-5 bg-white hover:shadow-sm transition-shadow">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-800">
                Export Excel Completo
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Planilha .xlsx com todas as abas: financeiro, legal, regulacoes,
                benchmarks, censo, embargos, MapBiomas, zoneamento, CRI e FII/CRA.
              </p>
            </div>
          </div>

          <div className="mt-4">
            {!tecnicoReady ? (
              <p className="text-xs text-gray-400 italic">
                Clique em "Preparar Relatorio Tecnico" primeiro para coletar os dados.
              </p>
            ) : (
              <button
                onClick={() => {
                  if (tecnicoData) {
                    exportExcelFull({ project, data: tecnicoData });
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Baixar Excel Completo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Card 4: Share Links (US-31) */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white hover:shadow-sm transition-shadow">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
            <Share2 className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-800">
              Compartilhar Relatorio
            </h4>
            <p className="text-xs text-gray-500 mt-0.5">
              Gere links expiraveis para compartilhar relatorios com investidores
              e parceiros sem necessidade de login.
            </p>
          </div>
        </div>

        {/* Create new link */}
        <div className="mt-4 flex items-center gap-2">
          <select
            value={shareExpiry}
            onChange={(e) => setShareExpiry(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-300"
          >
            <option value={24}>24 horas</option>
            <option value={48}>48 horas</option>
            <option value={72}>72 horas</option>
            <option value={168}>7 dias</option>
            <option value={720}>30 dias</option>
          </select>
          <button
            onClick={handleCreateShareLink}
            disabled={creatingLink || !tenantId}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-gray-100 disabled:text-gray-400 text-white text-sm font-medium transition-colors"
          >
            {creatingLink ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Gerar Link
              </>
            )}
          </button>
        </div>

        {shareError && (
          <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5" />
            {shareError}
          </div>
        )}

        {/* Active links list */}
        {loadingLinks ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Carregando links...
          </div>
        ) : shareLinks.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">
              Links ativos
            </p>
            {shareLinks.map((link) => (
              <ShareLinkRow
                key={link.id}
                link={link}
                copied={copiedLinkId === link.id}
                onCopy={() => handleCopyLink(link)}
                onRevoke={() => handleRevokeLink(link.id)}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Info */}
      <div className="bg-blue-50/50 rounded-lg border border-blue-100 px-4 py-3">
        <p className="text-xs text-blue-700">
          Os relatorios sao gerados no seu navegador com os dados mais recentes
          do projeto. Nenhum dado e enviado para servidores externos. O PDF
          inclui automaticamente disclaimer legal informando que nao substitui
          parecer tecnico profissional.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusRow({
  label,
  ready,
  loading,
}: {
  label: string;
  ready: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
      ) : ready ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
      )}
      <span
        className={`text-xs ${
          ready ? "text-gray-700" : "text-gray-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function ShareLinkRow({
  link,
  copied,
  onCopy,
  onRevoke,
}: {
  link: ShareLink;
  copied: boolean;
  onCopy: () => void;
  onRevoke: () => void;
}) {
  const isExpired = new Date(link.expires_at) < new Date();
  const isActive = link.is_active !== false && !isExpired;
  const accessCount = link.accessed_count ?? 0;

  const expiresDate = new Date(link.expires_at);
  const now = new Date();
  const hoursLeft = Math.max(
    0,
    Math.round((expiresDate.getTime() - now.getTime()) / 3600_000),
  );

  const expiryLabel = isExpired
    ? "Expirado"
    : hoursLeft < 24
      ? `${hoursLeft}h restantes`
      : `${Math.round(hoursLeft / 24)}d restantes`;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
        isActive
          ? "border-gray-200 bg-white"
          : "border-gray-100 bg-gray-50 opacity-60"
      }`}
    >
      <Link2
        className={`w-3.5 h-3.5 flex-shrink-0 ${
          isActive ? "text-violet-500" : "text-gray-400"
        }`}
      />

      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-700">
          Link de compartilhamento
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={`text-[10px] ${
              isActive ? "text-gray-500" : "text-red-500"
            }`}
          >
            {expiryLabel}
          </span>
          {accessCount > 0 && (
            <span className="text-[10px] text-gray-400">
              {accessCount} {accessCount === 1 ? "acesso" : "acessos"}
            </span>
          )}
          <span className="text-[10px] text-gray-400 capitalize">
            {link.report_type}
          </span>
        </div>
      </div>

      {isActive && (
        <div className="flex items-center gap-1">
          <button
            onClick={onCopy}
            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
            title="Copiar link"
          >
            {copied ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
          <button
            onClick={onRevoke}
            className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
            title="Revogar link"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
          </button>
        </div>
      )}
    </div>
  );
}
