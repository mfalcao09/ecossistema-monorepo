/**
 * ClmCompliance — Compliance Dashboard
 * F2 Item #1 — Sessão 58
 *
 * Página de monitoramento de compliance contratual.
 * Score por contrato, violações abertas, heatmap por módulo, ações corretivas.
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, AlertTriangle, AlertOctagon, RefreshCw, CheckCircle2, XCircle, Eye, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useComplianceDashboard,
  useScanContract,
  useResolveViolation,
  type ComplianceViolation,
} from "@/hooks/useComplianceMonitor";

// ── Score color helpers ──────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-100 dark:bg-green-950/30";
  if (score >= 60) return "bg-yellow-100 dark:bg-yellow-950/30";
  return "bg-red-100 dark:bg-red-950/30";
}

function severityBadge(severity: string) {
  const map: Record<string, { variant: "destructive" | "default" | "secondary" | "outline"; label: string }> = {
    critical: { variant: "destructive", label: "Crítico" },
    high: { variant: "destructive", label: "Alto" },
    medium: { variant: "default", label: "Médio" },
    low: { variant: "secondary", label: "Baixo" },
    info: { variant: "outline", label: "Info" },
  };
  const config = map[severity] ?? map.info;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function moduleLabel(module: string): string {
  const labels: Record<string, string> = {
    prazos: "Prazos",
    garantias: "Garantias",
    obrigacoes: "Obrigações",
    documentacao: "Documentação",
    financeiro: "Financeiro",
  };
  return labels[module] ?? module;
}

// ── Main Component ──────────────────────────────────────────────────────

export default function ClmCompliance() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canView = can("clm.compliance.view" as any);
  const canManage = can("clm.compliance.manage" as any);

  const { data: dashboard, isLoading, error, refetch } = useComplianceDashboard();
  const scanContract = useScanContract();
  const resolveViolation = useResolveViolation();

  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveStatus, setResolveStatus] = useState<string>("resolved");
  const [activeTab, setActiveTab] = useState("overview");

  // Sort violations by severity (critical first)
  const sortedViolations = useMemo(() => {
    if (!dashboard?.open_violations) return [];
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return [...dashboard.open_violations].sort(
      (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9),
    );
  }, [dashboard?.open_violations]);

  // Guard: no permission
  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <ShieldCheck className="h-16 w-16 text-muted-foreground" />
        <p className="text-muted-foreground">Você não tem permissão para acessar o monitoramento de compliance.</p>
        <Button variant="outline" onClick={() => navigate("/contratos/command-center")}>Voltar</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertOctagon className="h-16 w-16 text-red-500" />
        <p className="text-muted-foreground">Erro ao carregar dados de compliance.</p>
        <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  const summary = dashboard?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/contratos/command-center")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Compliance Monitor</h1>
            <p className="text-sm text-muted-foreground">Monitoramento contínuo de conformidade contratual</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score Médio</p>
                <p className={`text-3xl font-bold ${scoreColor(summary?.avg_score ?? 0)}`}>
                  {summary?.avg_score ?? 0}/100
                </p>
              </div>
              <ShieldCheck className={`h-8 w-8 ${scoreColor(summary?.avg_score ?? 0)}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conformes</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {summary?.contracts_compliant ?? 0}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">de {summary?.total_contracts ?? 0} contratos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Risco</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {summary?.contracts_at_risk ?? 0}
                </p>
              </div>
              <AlertOctagon className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">score &lt; 60</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Violações Abertas</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {summary?.total_open_violations ?? 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {summary?.violations_by_severity?.critical ? (
                <Badge variant="destructive" className="text-xs">{summary.violations_by_severity.critical} crítico(s)</Badge>
              ) : null}
              {summary?.violations_by_severity?.high ? (
                <Badge variant="destructive" className="text-xs opacity-80">{summary.violations_by_severity.high} alto(s)</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Contratos</TabsTrigger>
          <TabsTrigger value="violations">
            Violações ({summary?.total_open_violations ?? 0})
          </TabsTrigger>
          <TabsTrigger value="modules">Por Módulo</TabsTrigger>
        </TabsList>

        {/* Tab: Contracts Overview */}
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Score de Compliance por Contrato</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard?.contracts && dashboard.contracts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Violações</TableHead>
                      <TableHead>Alertas</TableHead>
                      <TableHead>Última Verificação</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.contracts
                      .sort((a, b) => a.score - b.score)
                      .map((c) => (
                        <TableRow key={c.contract_id}>
                          <TableCell className="font-mono text-xs">{c.contract_id.slice(0, 8)}...</TableCell>
                          <TableCell>
                            <span className={`font-bold text-lg ${scoreColor(c.score)}`}>{c.score}</span>
                            <span className="text-muted-foreground text-xs">/100</span>
                          </TableCell>
                          <TableCell>
                            {c.failed > 0 ? (
                              <Badge variant="destructive">{c.failed}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600">0</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {c.warnings > 0 ? (
                              <Badge variant="default">{c.warnings}</Badge>
                            ) : (
                              <Badge variant="outline">0</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(c.last_checked).toLocaleDateString("pt-BR", {
                              day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {canManage && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => scanContract.mutate(c.contract_id)}
                                  disabled={scanContract.isPending}
                                >
                                  <RefreshCw className={`h-3 w-3 mr-1 ${scanContract.isPending ? "animate-spin" : ""}`} />
                                  Rescanear
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhuma verificação de compliance registrada.</p>
                  <p className="text-sm mt-1">O scan automático roda diariamente às 06:00 (BRT).</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Open Violations */}
        <TabsContent value="violations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Violações Abertas</CardTitle>
            </CardHeader>
            <CardContent>
              {sortedViolations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Regra</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Base Legal</TableHead>
                      {canManage && <TableHead>Ação</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedViolations.map((v: ComplianceViolation) => (
                      <TableRow key={v.id}>
                        <TableCell>{severityBadge(v.severity)}</TableCell>
                        <TableCell className="font-mono text-xs">{v.rule_code}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{moduleLabel(v.module)}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-sm">{v.description}</p>
                          {v.remediation && (
                            <p className="text-xs text-muted-foreground mt-1">💡 {v.remediation}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px]">{v.legal_basis ?? "—"}</TableCell>
                        {canManage && (
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Resolver
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Resolver Violação</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    <strong>{v.rule_code}</strong> — {v.rule_name}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <div className="space-y-3 py-2">
                                  <div>
                                    <label className="text-sm font-medium">Status</label>
                                    <Select value={resolveStatus} onValueChange={setResolveStatus}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="resolved">Resolvido</SelectItem>
                                        <SelectItem value="waived">Dispensado</SelectItem>
                                        <SelectItem value="false_positive">Falso Positivo</SelectItem>
                                        <SelectItem value="acknowledged">Reconhecido</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">Observações</label>
                                    <Textarea
                                      placeholder="Descreva a resolução..."
                                      value={resolveNotes}
                                      onChange={(e) => setResolveNotes(e.target.value)}
                                    />
                                  </div>
                                </div>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => {
                                      resolveViolation.mutate({
                                        violation_id: v.id,
                                        resolution_status: resolveStatus as any,
                                        resolution_notes: resolveNotes || undefined,
                                      });
                                      setResolveNotes("");
                                      setResolveStatus("resolved");
                                    }}
                                  >
                                    Confirmar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                  <p>Nenhuma violação aberta. Todos os contratos estão conformes!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: By Module */}
        <TabsContent value="modules" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {["prazos", "garantias", "obrigacoes", "documentacao", "financeiro"].map((mod) => {
              const count = summary?.violations_by_module?.[mod] ?? 0;
              const moduleViolations = sortedViolations.filter((v) => v.module === mod);
              return (
                <Card key={mod} className={count > 0 ? "border-amber-200 dark:border-amber-900" : "border-green-200 dark:border-green-900"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      {moduleLabel(mod)}
                      {count > 0 ? (
                        <Badge variant="destructive">{count} violação(ões)</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600">Conforme</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {moduleViolations.length > 0 ? (
                      <ul className="space-y-2">
                        {moduleViolations.slice(0, 5).map((v) => (
                          <li key={v.id} className="flex items-start gap-2 text-sm">
                            {v.severity === "critical" || v.severity === "high" ? (
                              <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                            )}
                            <span>{v.description}</span>
                          </li>
                        ))}
                        {moduleViolations.length > 5 && (
                          <li className="text-xs text-muted-foreground">+{moduleViolations.length - 5} mais...</li>
                        )}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sem violações neste módulo.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
