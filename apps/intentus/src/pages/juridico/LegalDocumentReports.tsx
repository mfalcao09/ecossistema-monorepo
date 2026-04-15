import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { propertyDocTypeLabels, propertyDocStatusLabels, propertyDocStatusColors } from "@/lib/propertyDocSchema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Download, Search, FileText, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { exportToCSV } from "@/lib/csvExport";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_CHART_COLORS = [
  "hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16",
];

export default function LegalDocumentReports() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterType, setFilterType] = useState("todos");
  const [filterExpiry, setFilterExpiry] = useState("todos");

  const { data: allDocs = [], isLoading } = useQuery({
    queryKey: ["all-property-documents-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_documents")
        .select("*, properties(title, city)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = allDocs.filter((d: any) => {
    const searchOk = !search || d.title?.toLowerCase().includes(search.toLowerCase()) || (d.properties as any)?.title?.toLowerCase().includes(search.toLowerCase());
    const statusOk = filterStatus === "todos" || d.status === filterStatus;
    const typeOk = filterType === "todos" || d.document_type === filterType;
    let expiryOk = true;
    if (filterExpiry === "vencido") expiryOk = !!d.expires_at && differenceInDays(new Date(d.expires_at), new Date()) < 0;
    if (filterExpiry === "a_vencer_30") expiryOk = !!d.expires_at && differenceInDays(new Date(d.expires_at), new Date()) >= 0 && differenceInDays(new Date(d.expires_at), new Date()) <= 30;
    if (filterExpiry === "sem_vencimento") expiryOk = !d.expires_at;
    return searchOk && statusOk && typeOk && expiryOk;
  });

  // Pie chart data by status
  const statusCounts = Object.entries(propertyDocStatusLabels).map(([k, v]) => ({
    name: v,
    value: allDocs.filter((d: any) => d.status === k).length,
    key: k,
  })).filter(s => s.value > 0);

  const vencidos = allDocs.filter((d: any) => d.expires_at && differenceInDays(new Date(d.expires_at), new Date()) < 0).length;
  const aVencer = allDocs.filter((d: any) => d.expires_at && differenceInDays(new Date(d.expires_at), new Date()) >= 0 && differenceInDays(new Date(d.expires_at), new Date()) <= 30).length;

  function handleExport() {
    exportToCSV(filtered.map((d: any) => ({
      imovel: (d.properties as any)?.title || "",
      titulo: d.title,
      tipo: propertyDocTypeLabels[d.document_type] || d.document_type,
      status: propertyDocStatusLabels[d.status] || d.status,
      vencimento: d.expires_at ? format(new Date(d.expires_at), "dd/MM/yyyy") : "",
      criado_em: format(new Date(d.created_at), "dd/MM/yyyy"),
    })), "relatorio_documentos");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatório de Documentos</h1>
          <p className="text-muted-foreground text-sm">Visão consolidada de todos os documentos por imóvel</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3"><div className="text-2xl font-bold">{allDocs.length}</div><p className="text-xs text-muted-foreground">Total de Documentos</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><div className="text-2xl font-bold text-destructive">{vencidos}</div><p className="text-xs text-muted-foreground">Vencidos</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><div className="text-2xl font-bold text-yellow-600">{aVencer}</div><p className="text-xs text-muted-foreground">A Vencer (30d)</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><div className="text-2xl font-bold text-green-600">{allDocs.filter((d: any) => d.status === "regular").length}</div><p className="text-xs text-muted-foreground">Regulares</p></CardContent></Card>
      </div>

      {/* Charts */}
      {statusCounts.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Distribuição por Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {statusCounts.map((_, idx) => (
                    <Cell key={idx} fill={STATUS_CHART_COLORS[idx % STATUS_CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por documento ou imóvel..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(propertyDocStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(propertyDocTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterExpiry} onValueChange={setFilterExpiry}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Vencimento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
            <SelectItem value="a_vencer_30">A vencer (30d)</SelectItem>
            <SelectItem value="sem_vencimento">Sem vencimento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum documento encontrado com os filtros atuais.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imóvel</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc: any) => {
                const prop = doc.properties as any;
                const expiryDays = doc.expires_at ? differenceInDays(new Date(doc.expires_at), new Date()) : null;
                return (
                  <TableRow key={doc.id}>
                    <TableCell className="text-sm">
                      <p className="font-medium">{prop?.title || "—"}</p>
                      {prop?.property_code && <p className="text-xs text-muted-foreground">Cód. {prop.property_code}</p>}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{doc.title}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{propertyDocTypeLabels[doc.document_type] || doc.document_type}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] ${propertyDocStatusColors[doc.status] || ""}`}>
                        {propertyDocStatusLabels[doc.status] || doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {doc.expires_at ? (
                        <span className={expiryDays !== null && expiryDays < 0 ? "text-destructive font-medium" : expiryDays !== null && expiryDays <= 30 ? "text-yellow-600 font-medium" : ""}>
                          {format(new Date(doc.expires_at), "dd/MM/yyyy")}
                          {expiryDays !== null && expiryDays < 0 && <AlertTriangle className="h-3.5 w-3.5 inline ml-1" />}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(doc.created_at), "dd/MM/yyyy")}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
