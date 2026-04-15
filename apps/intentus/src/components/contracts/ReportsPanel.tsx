import { useState, useRef, lazy, Suspense } from "react";
import {
  useContractReports,
  formatCurrency,
  formatPercent,
  formatDate,
  STATUS_LABELS,
  TYPE_LABELS,
  STATUS_COLORS,
  PERIOD_LABELS,
  type ReportPeriod,
  type ReportFilters,
  type ContractReportData,
} from "@/hooks/useContractReports";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  FileDown,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileCheck,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdvancedMetricsPanel } from "./AdvancedMetricsPanel";

// ─── PDF Export ──────────────────────────────────────────────────
async function exportToPDF(data: ContractReportData, filters: ReportFilters) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setTextColor(226, 169, 59); // brand gold
  doc.text("Intentus Real Estate", 14, 20);
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("Relatório de Contratos", 14, 30);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Período: ${PERIOD_LABELS[filters.period]}`, 14, 38);
  doc.text(`Gerado em: ${new Date(data.generatedAt).toLocaleString("pt-BR")}`, 14, 44);

  if (filters.contractType) {
    doc.text(`Tipo: ${TYPE_LABELS[filters.contractType] || filters.contractType}`, 14, 50);
  }
  if (filters.status) {
    doc.text(`Status: ${STATUS_LABELS[filters.status] || filters.status}`, 14, 56);
  }

  // Summary cards
  let y = filters.contractType || filters.status ? 66 : 54;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("Resumo Geral", 14, y);
  y += 6;

  const summaryData = [
    ["Total de Contratos", String(data.totalContracts)],
    ["Valor Total", formatCurrency(data.financial.totalContractValue)],
    ["Valor Médio", formatCurrency(data.financial.averageContractValue)],
    ["Total Recebido", formatCurrency(data.financial.totalPaid)],
    ["Total a Receber", formatCurrency(data.financial.totalReceivable)],
    ["Total em Atraso", formatCurrency(data.financial.totalOverdue)],
    ["Taxa de Recebimento", formatPercent(data.financial.collectionRate)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: summaryData,
    theme: "grid",
    headStyles: { fillColor: [226, 169, 59], textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  // By Status table
  y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.text("Contratos por Status", 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Status", "Quantidade", "Valor Total"]],
    body: data.byStatus.map((s) => [s.label, String(s.count), formatCurrency(s.totalValue)]),
    theme: "grid",
    headStyles: { fillColor: [226, 169, 59], textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  // By Type table
  y = (doc as any).lastAutoTable.finalY + 10;
  if (y > 240) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.text("Contratos por Tipo", 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Tipo", "Quantidade", "Valor Total"]],
    body: data.byType.map((t) => [t.label, String(t.count), formatCurrency(t.totalValue)]),
    theme: "grid",
    headStyles: { fillColor: [226, 169, 59], textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  // Installments summary
  y = (doc as any).lastAutoTable.finalY + 10;
  if (y > 240) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.text("Parcelas", 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Status", "Quantidade", "Valor"]],
    body: [
      ["Pagas", String(data.installments.totalPago), formatCurrency(data.installments.amountPago)],
      ["Pendentes", String(data.installments.totalPendente), formatCurrency(data.installments.amountPendente)],
      ["Atrasadas", String(data.installments.totalAtrasado), formatCurrency(data.installments.amountAtrasado)],
    ],
    theme: "grid",
    headStyles: { fillColor: [226, 169, 59], textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  // Top 10 contracts
  if (data.topContracts.length > 0) {
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y > 200) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(11);
    doc.text("Top 10 Contratos por Valor", 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Nº", "Título", "Tipo", "Status", "Valor", "Início", "Fim"]],
      body: data.topContracts.map((c) => [
        c.contractNumber || "—",
        (c.title || "—").slice(0, 25),
        TYPE_LABELS[c.contractType] || c.contractType,
        STATUS_LABELS[c.status] || c.status,
        formatCurrency(c.totalValue),
        formatDate(c.startDate),
        formatDate(c.endDate),
      ]),
      theme: "grid",
      headStyles: { fillColor: [226, 169, 59], textColor: 255 },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Página ${i} de ${pageCount} — Intentus Real Estate`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  doc.save(`relatorio-contratos-${new Date().toISOString().split("T")[0]}.pdf`);
}

// ─── Excel Export ────────────────────────────────────────────────
async function exportToExcel(data: ContractReportData, filters: ReportFilters) {
  const XLSX = await import("xlsx");

  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumo
  const resumoData = [
    ["Relatório de Contratos — Intentus Real Estate"],
    [`Período: ${PERIOD_LABELS[filters.period]}`],
    [`Gerado em: ${new Date(data.generatedAt).toLocaleString("pt-BR")}`],
    [],
    ["RESUMO FINANCEIRO"],
    ["Total de Contratos", data.totalContracts],
    ["Valor Total", data.financial.totalContractValue],
    ["Valor Médio", data.financial.averageContractValue],
    ["Total Recebido", data.financial.totalPaid],
    ["Total a Receber", data.financial.totalReceivable],
    ["Total em Atraso", data.financial.totalOverdue],
    ["Taxa de Recebimento (%)", Number(data.financial.collectionRate.toFixed(1))],
    [],
    ["PARCELAS"],
    ["Pagas", data.installments.totalPago, data.installments.amountPago],
    ["Pendentes", data.installments.totalPendente, data.installments.amountPendente],
    ["Atrasadas", data.installments.totalAtrasado, data.installments.amountAtrasado],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // Sheet 2: Por Status
  const statusHeader = [["Status", "Quantidade", "Valor Total"]];
  const statusRows = data.byStatus.map((s) => [s.label, s.count, s.totalValue]);
  const wsStatus = XLSX.utils.aoa_to_sheet([...statusHeader, ...statusRows]);
  wsStatus["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsStatus, "Por Status");

  // Sheet 3: Por Tipo
  const typeHeader = [["Tipo", "Quantidade", "Valor Total"]];
  const typeRows = data.byType.map((t) => [t.label, t.count, t.totalValue]);
  const wsType = XLSX.utils.aoa_to_sheet([...typeHeader, ...typeRows]);
  wsType["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsType, "Por Tipo");

  // Sheet 4: Tendência Mensal
  const trendHeader = [["Mês", "Novos Contratos", "Encerrados", "Valor Total"]];
  const trendRows = data.monthlyTrend.map((t) => [
    t.monthLabel,
    t.newContracts,
    t.closedContracts,
    t.totalValue,
  ]);
  const wsTrend = XLSX.utils.aoa_to_sheet([...trendHeader, ...trendRows]);
  wsTrend["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsTrend, "Tendência Mensal");

  // Sheet 5: Top Contratos
  if (data.topContracts.length > 0) {
    const topHeader = [["Nº Contrato", "Título", "Tipo", "Status", "Valor", "Início", "Fim"]];
    const topRows = data.topContracts.map((c) => [
      c.contractNumber || "—",
      c.title || "—",
      TYPE_LABELS[c.contractType] || c.contractType,
      STATUS_LABELS[c.status] || c.status,
      c.totalValue,
      formatDate(c.startDate),
      formatDate(c.endDate),
    ]);
    const wsTop = XLSX.utils.aoa_to_sheet([...topHeader, ...topRows]);
    wsTop["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsTop, "Top Contratos");
  }

  XLSX.writeFile(wb, `relatorio-contratos-${new Date().toISOString().split("T")[0]}.xlsx`);
}

// ─── Pie Chart Colors ────────────────────────────────────────────
const PIE_COLORS = [
  "#e2a93b", "#3b82f6", "#22c55e", "#ef4444",
  "#8b5cf6", "#f59e0b", "#06b6d4", "#ec4899",
  "#6b7280", "#14b8a6",
];

// ─── Component ───────────────────────────────────────────────────
export default function ReportsPanel() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [contractType, setContractType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filters: ReportFilters = {
    period,
    dateFrom: period === "custom" ? dateFrom : undefined,
    dateTo: period === "custom" ? dateTo : undefined,
    contractType: contractType || undefined,
    status: status || undefined,
  };

  const { data, isLoading, error, refetch } = useContractReports(filters);

  const handleExportPDF = async () => {
    if (!data) return;
    try {
      toast({ title: "Gerando PDF...", description: "Aguarde um momento." });
      await exportToPDF(data, filters);
      toast({ title: "PDF exportado!", description: "O arquivo foi baixado." });
    } catch (err) {
      toast({ title: "Erro ao gerar PDF", description: String(err), variant: "destructive" });
    }
  };

  const handleExportExcel = async () => {
    if (!data) return;
    try {
      toast({ title: "Gerando Excel...", description: "Aguarde um momento." });
      await exportToExcel(data, filters);
      toast({ title: "Excel exportado!", description: "O arquivo foi baixado." });
    } catch (err) {
      toast({ title: "Erro ao gerar Excel", description: String(err), variant: "destructive" });
    }
  };

  // ─── Loading ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-[150px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
        <p className="text-red-600 font-medium">Erro ao carregar relatório</p>
        <p className="text-sm text-muted-foreground mt-1">{String(error)}</p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="reports" className="w-full">
        <TabsList>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="advanced">Métricas Avançadas</TabsTrigger>
        </TabsList>

        <TabsContent value="advanced" className="mt-4">
          <AdvancedMetricsPanel />
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-6">
      {/* ─── Filters Bar ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Período</label>
          <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {period === "custom" && (
          <>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">De</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Até</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
              />
            </div>
          </>
        )}

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
          <Select value={contractType} onValueChange={setContractType}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button
            size="sm"
            className="bg-[#e2a93b] hover:bg-[#c99430] text-white"
            onClick={handleExportExcel}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
        </div>
      </div>

      {/* ─── KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Contratos</p>
                <p className="text-2xl font-bold">{data.totalContracts}</p>
              </div>
              <FileCheck className="h-8 w-8 text-[#e2a93b] opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold">{formatCurrency(data.financial.totalContractValue)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Recebimento</p>
                <p className="text-2xl font-bold">{formatPercent(data.financial.collectionRate)}</p>
              </div>
              {data.financial.collectionRate >= 70 ? (
                <TrendingUp className="h-8 w-8 text-green-500 opacity-80" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500 opacity-80" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Atraso</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(data.financial.totalOverdue)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.installments.totalAtrasado} parcela{data.installments.totalAtrasado !== 1 ? "s" : ""}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Charts Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie: Por Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Contratos por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={data.byStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="label"
                    label={({ label, count }) => `${label}: ${count}`}
                    labelLine={false}
                  >
                    {data.byStatus.map((entry, index) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] || PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-10">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Bar: Por Tipo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Contratos por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.byType.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.byType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="label" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [value, "Contratos"]}
                  />
                  <Bar dataKey="count" fill="#e2a93b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-10">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Monthly Trend ────────────────────────────────────── */}
      {data.monthlyTrend.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Tendência Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "Valor Total") return [formatCurrency(value), name];
                    return [value, name];
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="newContracts"
                  name="Novos Contratos"
                  stroke="#e2a93b"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="closedContracts"
                  name="Encerrados"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Bar
                  yAxisId="right"
                  dataKey="totalValue"
                  name="Valor Total"
                  fill="#3b82f620"
                  stroke="#3b82f6"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ─── Installments + Financial ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Installments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Parcelas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                <div>
                  <p className="text-sm font-medium text-green-700">Pagas</p>
                  <p className="text-xs text-green-600">{data.installments.totalPago} parcelas</p>
                </div>
                <p className="text-lg font-bold text-green-700">
                  {formatCurrency(data.installments.amountPago)}
                </p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <div>
                  <p className="text-sm font-medium text-yellow-700">Pendentes</p>
                  <p className="text-xs text-yellow-600">{data.installments.totalPendente} parcelas</p>
                </div>
                <p className="text-lg font-bold text-yellow-700">
                  {formatCurrency(data.installments.amountPendente)}
                </p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                <div>
                  <p className="text-sm font-medium text-red-700">Atrasadas</p>
                  <p className="text-xs text-red-600">{data.installments.totalAtrasado} parcelas</p>
                </div>
                <p className="text-lg font-bold text-red-700">
                  {formatCurrency(data.installments.amountAtrasado)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Contracts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top 10 Contratos por Valor</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topContracts.length > 0 ? (
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {data.topContracts.map((c, i) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2 rounded border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5 text-right">
                        {i + 1}.
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {c.title || c.contractNumber || "Sem título"}
                        </p>
                        <div className="flex gap-1 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {TYPE_LABELS[c.contractType] || c.contractType}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0"
                            style={{
                              borderColor: STATUS_COLORS[c.status],
                              color: STATUS_COLORS[c.status],
                            }}
                          >
                            {STATUS_LABELS[c.status] || c.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-right whitespace-nowrap ml-2">
                      {formatCurrency(c.totalValue)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-10">Nenhum contrato encontrado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Footer ───────────────────────────────────────────── */}
      <div className="text-xs text-muted-foreground text-center pt-2 border-t">
        Relatório gerado em {new Date(data.generatedAt).toLocaleString("pt-BR")} •{" "}
        {data.totalContracts} contrato{data.totalContracts !== 1 ? "s" : ""} analisado{data.totalContracts !== 1 ? "s" : ""}
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
