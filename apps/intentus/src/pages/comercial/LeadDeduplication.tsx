/**
 * LeadDeduplication — Página de Detecção de Duplicados IA.
 * v2: Backend-powered via commercial-lead-dedup EF.
 * 3 tabs: Scan & Duplicados, Dashboard, Histórico.
 */

import { useState } from "react";
import {
  ArrowLeft, GitMerge, RefreshCw, Search, BarChart3, History,
  AlertTriangle, CheckCircle2, XCircle, Eye, Shield, Mail, Phone, User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useDedupDashboard,
  useDuplicateScan,
  useMergeDuplicates,
  useDismissDuplicate,
  useDedupHistory,
  MATCH_TYPE_LABELS,
  MATCH_TYPE_COLORS,
  CONFIDENCE_THRESHOLDS,
  type DuplicateCluster,
  type DuplicateMatch,
  type DedupHistoryEntry,
} from "@/hooks/useLeadDeduplication";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color = "text-gray-900 dark:text-white", suffix = "" }: {
  label: string; value: number | string; icon: React.ElementType; color?: string; suffix?: string;
}) {
  return (
    <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}{suffix}</p>
          </div>
          <Icon className="w-8 h-8 text-gray-300 dark:text-gray-700" />
        </div>
      </CardContent>
    </Card>
  );
}

function MatchBadge({ type }: { type: string }) {
  return (
    <Badge className={MATCH_TYPE_COLORS[type] || "bg-gray-100 text-gray-700"}>
      {MATCH_TYPE_LABELS[type] || type}
    </Badge>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= CONFIDENCE_THRESHOLDS.high
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
    : score >= CONFIDENCE_THRESHOLDS.medium
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  const label = score >= CONFIDENCE_THRESHOLDS.high ? "Alta" : score >= CONFIDENCE_THRESHOLDS.medium ? "Média" : "Baixa";
  return <Badge className={color}>{label} ({score})</Badge>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LeadDeduplication() {
  const navigate = useNavigate();
  const { data: dashboard, isLoading: dashLoading } = useDedupDashboard();
  const scanMutation = useDuplicateScan();
  const mergeMutation = useMergeDuplicates();
  const dismissMutation = useDismissDuplicate();
  const { data: historyData } = useDedupHistory(100);

  const [scanResults, setScanResults] = useState<DuplicateCluster[] | null>(null);
  const [mergeTarget, setMergeTarget] = useState<{ cluster: DuplicateCluster; dup: DuplicateMatch } | null>(null);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("scan");

  // ── Scan ──
  const handleScan = () => {
    scanMutation.mutate({ min_score: 40 }, {
      onSuccess: (data) => {
        setScanResults(data.clusters);
        toast.success(`Scan concluído: ${data.total_clusters} clusters encontrados em ${data.total_scanned} registros`);
      },
      onError: (err) => toast.error(`Erro no scan: ${err.message}`),
    });
  };

  // ── Merge ──
  const openMerge = (cluster: DuplicateCluster, dup: DuplicateMatch) => {
    setMergeTarget({ cluster, dup });
    setShowMergeDialog(true);
  };

  const confirmMerge = () => {
    if (!mergeTarget) return;
    mergeMutation.mutate({
      primary_id: mergeTarget.cluster.primary_id,
      duplicate_id: mergeTarget.dup.id,
      entity_type: mergeTarget.dup.entity_type || "lead",
    }, {
      onSuccess: (res) => {
        toast.success(`Mesclado! ${res.merged.fields_filled.length} campos preenchidos.`);
        setShowMergeDialog(false);
        setMergeTarget(null);
        // Remove from local scan results
        if (scanResults) {
          setScanResults(scanResults.map(c => {
            if (c.primary_id === mergeTarget.cluster.primary_id) {
              return { ...c, duplicates: c.duplicates.filter(d => d.id !== mergeTarget.dup.id) };
            }
            return c;
          }).filter(c => c.duplicates.length > 0));
        }
      },
      onError: (err) => toast.error(`Erro: ${err.message}`),
    });
  };

  // ── Dismiss ──
  const handleDismiss = (cluster: DuplicateCluster, dup: DuplicateMatch) => {
    dismissMutation.mutate({
      primary_id: cluster.primary_id,
      duplicate_id: dup.id,
    }, {
      onSuccess: () => {
        toast.success("Par ignorado — não aparecerá novamente");
        if (scanResults) {
          setScanResults(scanResults.map(c => {
            if (c.primary_id === cluster.primary_id) {
              return { ...c, duplicates: c.duplicates.filter(d => d.id !== dup.id) };
            }
            return c;
          }).filter(c => c.duplicates.length > 0));
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1419] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/negocios")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Detecção de Duplicados IA</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Encontre e mescle registros duplicados com IA</p>
            </div>
          </div>
          <Button onClick={handleScan} disabled={scanMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
            {scanMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            {scanMutation.isPending ? "Escaneando..." : "Escanear Duplicados"}
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <KpiCard label="Duplicados Potenciais" value={dashboard?.total_potential_duplicates ?? "—"} icon={AlertTriangle} color="text-red-600 dark:text-red-400" />
          <KpiCard label="Mesclados (30d)" value={dashboard?.recently_merged ?? 0} icon={GitMerge} color="text-green-600 dark:text-green-400" />
          <KpiCard label="Qualidade de Dados" value={dashboard?.data_quality_score ?? "—"} icon={Shield} color="text-blue-600 dark:text-blue-400" suffix="%" />
          <KpiCard label="Completude de Dados" value={dashboard?.data_completeness_score ?? "—"} icon={CheckCircle2} color="text-purple-600 dark:text-purple-400" suffix="%" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="scan" className="gap-2"><Search className="w-4 h-4" />Duplicados{scanResults ? ` (${scanResults.length})` : ""}</TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="w-4 h-4" />Dashboard</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><History className="w-4 h-4" />Histórico</TabsTrigger>
          </TabsList>

          {/* ── Tab: Scan Results ── */}
          <TabsContent value="scan">
            {scanMutation.isPending ? (
              <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardContent className="py-16 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
                  <p className="text-gray-600 dark:text-gray-400">Escaneando leads e pessoas por duplicados...</p>
                </CardContent>
              </Card>
            ) : !scanResults ? (
              <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardContent className="py-16 text-center">
                  <Search className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nenhum scan realizado</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">Clique em "Escanear Duplicados" para iniciar a detecção</p>
                  <Button onClick={handleScan} className="bg-blue-600 hover:bg-blue-700">
                    <Search className="w-4 h-4 mr-2" />Iniciar Scan
                  </Button>
                </CardContent>
              </Card>
            ) : scanResults.length === 0 ? (
              <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                <CardContent className="py-16 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nenhum duplicado encontrado!</h3>
                  <p className="text-gray-600 dark:text-gray-400">Sua base de dados está limpa.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {scanResults.map((cluster) => (
                  <Card key={cluster.primary_id} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardContent className="pt-6">
                      {/* Primary */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <h3 className="font-semibold text-gray-900 dark:text-white">{cluster.primary_name}</h3>
                            <Badge variant="outline">{cluster.entity_type === "lead" ? "Lead" : "Pessoa"}</Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {cluster.primary_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{cluster.primary_email}</span>}
                            {cluster.primary_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{cluster.primary_phone}</span>}
                          </div>
                        </div>
                        <ConfidenceBadge score={cluster.cluster_score} />
                      </div>

                      {/* Duplicates */}
                      <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          {cluster.duplicates.length} duplicado{cluster.duplicates.length !== 1 ? "s" : ""} encontrado{cluster.duplicates.length !== 1 ? "s" : ""}
                        </p>
                        {cluster.duplicates.map((dup) => (
                          <div key={dup.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white">{dup.name}</p>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                {dup.email && <span>{dup.email}</span>}
                                {dup.phone && <span>{dup.phone}</span>}
                                {dup.cpf_cnpj && <span>CPF: {dup.cpf_cnpj}</span>}
                              </div>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-xs text-gray-400">
                                  {dup.entity_type === "lead" ? "Lead" : "Pessoa"} • Score: {dup.score} • {new Date(dup.created_at).toLocaleDateString("pt-BR")}
                                </span>
                              </div>
                              <div className="flex gap-1.5 mt-2 flex-wrap">
                                {dup.match_types.map((t) => <MatchBadge key={t} type={t} />)}
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4 shrink-0">
                              <Button size="sm" variant="outline" onClick={() => handleDismiss(cluster, dup)}
                                disabled={dismissMutation.isPending} title="Ignorar — não é duplicado">
                                <XCircle className="w-4 h-4" />
                              </Button>
                              <Button size="sm" onClick={() => openMerge(cluster, dup)}
                                disabled={mergeMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                                <GitMerge className="w-4 h-4 mr-1" />Mesclar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Dashboard ── */}
          <TabsContent value="dashboard">
            {dashLoading ? (
              <div className="flex justify-center py-16"><RefreshCw className="w-8 h-8 animate-spin text-gray-400" /></div>
            ) : !dashboard ? (
              <Card className="bg-white dark:bg-gray-900"><CardContent className="py-12 text-center text-gray-500">Sem dados disponíveis</CardContent></Card>
            ) : (
              <div className="space-y-6">
                {/* Quality & Completeness */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader><CardTitle className="text-base">Qualidade de Dados</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">{dashboard.data_quality_score}%</div>
                      <Progress value={dashboard.data_quality_score} className="h-3 mb-4" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {dashboard.data_quality_score >= 90 ? "Excelente — poucos duplicados detectados" :
                         dashboard.data_quality_score >= 70 ? "Boa — alguns duplicados para revisar" :
                         "Atenção — muitos duplicados detectados"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                    <CardHeader><CardTitle className="text-base">Completude de Dados</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">{dashboard.data_completeness_score}%</div>
                      <Progress value={dashboard.data_completeness_score} className="h-3 mb-4" />
                      <div className="grid grid-cols-3 gap-4 text-center text-sm">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{dashboard.records_with_email}</p>
                          <p className="text-gray-500 dark:text-gray-400">c/ Email</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{dashboard.records_with_phone}</p>
                          <p className="text-gray-500 dark:text-gray-400">c/ Telefone</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{dashboard.records_with_cpf}</p>
                          <p className="text-gray-500 dark:text-gray-400">c/ CPF</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Duplicates by type */}
                <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
                  <CardHeader><CardTitle className="text-base">Duplicados por Tipo de Match</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "CPF/CNPJ", value: dashboard.duplicates_by_type.cpf, color: "text-purple-600 dark:text-purple-400" },
                        { label: "Email", value: dashboard.duplicates_by_type.email, color: "text-red-600 dark:text-red-400" },
                        { label: "Telefone", value: dashboard.duplicates_by_type.phone, color: "text-orange-600 dark:text-orange-400" },
                        { label: "Nome", value: dashboard.duplicates_by_type.name, color: "text-amber-600 dark:text-amber-400" },
                      ].map((item) => (
                        <div key={item.label} className="text-center p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Activity summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <KpiCard label="Total de Registros" value={dashboard.total_records} icon={User} />
                  <KpiCard label="Mesclados (30d)" value={dashboard.recently_merged} icon={GitMerge} color="text-green-600 dark:text-green-400" />
                  <KpiCard label="Ignorados (30d)" value={dashboard.recently_dismissed} icon={XCircle} color="text-gray-600 dark:text-gray-400" />
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Tab: History ── */}
          <TabsContent value="history">
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" />Histórico de Ações</CardTitle>
              </CardHeader>
              <CardContent>
                {!historyData?.history || historyData.history.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
                    <p className="text-gray-500 dark:text-gray-400">Nenhuma ação registrada ainda</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyData.history.map((entry: DedupHistoryEntry) => (
                      <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {entry.action_type === "merge_duplicate" ? (
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                              <GitMerge className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                              <XCircle className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-white">
                              {entry.action_type === "merge_duplicate" ? "Duplicado mesclado" : "Duplicado ignorado"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {entry.entity_type} • {new Date(entry.created_at).toLocaleString("pt-BR")}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {entry.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Merge Confirmation Dialog ── */}
      <AlertDialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <AlertDialogContent className="dark:bg-gray-900">
          <AlertDialogTitle>Confirmar Mesclagem</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Tem certeza que deseja mesclar os registros?
              </p>
              {mergeTarget && (
                <div className="space-y-3">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">MANTER (Principal)</p>
                    <p className="font-semibold text-green-900 dark:text-green-100">{mergeTarget.cluster.primary_name}</p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {mergeTarget.cluster.primary_email} {mergeTarget.cluster.primary_phone && `• ${mergeTarget.cluster.primary_phone}`}
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">REMOVER (Duplicado)</p>
                    <p className="font-semibold text-red-900 dark:text-red-100">{mergeTarget.dup.name}</p>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {mergeTarget.dup.email} {mergeTarget.dup.phone && `• ${mergeTarget.dup.phone}`}
                    </p>
                  </div>
                </div>
              )}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3 text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">O que acontecerá:</p>
                <p>• Campos vazios do principal serão preenchidos com dados do duplicado</p>
                <p>• Negócios e interações serão movidos para o registro principal</p>
                <p>• O duplicado será marcado como deletado (soft delete)</p>
              </div>
            </div>
          </AlertDialogDescription>
          <div className="flex gap-3 mt-4">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMerge} disabled={mergeMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700">
              {mergeMutation.isPending ? "Mesclando..." : "Confirmar Mesclagem"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default LeadDeduplication;
