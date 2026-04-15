/**
 * ClmAnalytics.tsx — Página de Analytics avançado do CLM
 * Criada do zero na sessão 70 (15/03/2026).
 *
 * 11 métricas (9 originais + 2 sugestões Buchecha):
 * 1. Revenue Leakage
 * 2. Exposição de Passivo
 * 3. Concentração de Risco (TOP 8)
 * 4. Clause Friction Heatmap (lazy)
 * 5. Approval SLA
 * 6. Índice de Retrabalho
 * 7. Contratos Estagnados
 * 8. Tendência de Volume Mensal
 * 9. Revenue por Tipo
 * 10. Revenue at Risk (Buchecha)
 * 11. Approval Velocity por Gestor (Buchecha)
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  ArrowLeft,
  AlertTriangle,
  DollarSign,
  Users,
  Clock,
  RefreshCw,
  FileEdit,
  Pause,
  TrendingUp,
  PieChart,
  Flame,
  ShieldAlert,
  Timer,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  useAnalyticsContracts,
  useAnalyticsAuditTrail,
  useAnalyticsApprovals,
  useAnalyticsParties,
  useAnalyticsRedlining,
  useDrillDownContracts,
  useRevenueLeakage,
  useLiabilityExposure,
  useRiskConcentration,
  useApprovalSLA,
  useRetrabalhIndex,
  useStalledContracts,
  useMonthlyVolume,
  useRevenueByType,
  useClauseFriction,
  useRevenueAtRisk,
  useApprovalVelocity,
} from "@/hooks/useAnalyticsMetrics";
import { CONTRACT_STATUS_LABELS, CONTRACT_TYPE_LABELS } from "@/lib/clmApi";

// ============================================================
// HELPERS
// ============================================================

function fmtBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function fmtMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

const CHART_COLORS = ["#e2a93b", "#3b82f6", "#10b981", "#f97316", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

// ============================================================
// DRILL-DOWN DIALOG
// ============================================================

function DrillDownDialog({
  open,
  onOpenChange,
  title,
  ids,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  ids: string[] | null;
}) {
  const { data: contracts, isLoading } = useDrillDownContracts(open ? ids : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !contracts?.length ? (
            <p className="text-muted-foreground text-center py-8">Nenhum contrato encontrado.</p>
          ) : (
            <div className="space-y-2">
              {contracts.map((c) => (
                <div key={c.id} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {c.properties?.title ?? c.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.properties?.neighborhood ? `${c.properties.neighborhood}, ${c.properties.city}` : "—"}{" "}
                      · {CONTRACT_STATUS_LABELS[c.status as keyof typeof CONTRACT_STATUS_LABELS] ?? c.status}
                    </p>
                  </div>
                  <span className="font-mono text-sm ml-2">{fmtBRL(c.monthly_value)}/mês</span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// METRIC CARD COMPONENT
// ============================================================

function MetricCard({
  icon: Icon,
  title,
  value,
  description,
  color = "text-foreground",
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  value: string | number;
  description?: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={onClick ? "cursor-pointer hover:border-[#e2a93b]/40 transition-colors" : ""}
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
        </div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </CardContent>
    </Card>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function ClmAnalytics() {
  const navigate = useNavigate();

  // ---- Data hooks (lightweight queries) ----
  const { data: contracts = [], isLoading: loadingContracts, isError: errorContracts } = useAnalyticsContracts();
  const { data: auditTrail = [], isLoading: loadingAudit } = useAnalyticsAuditTrail();
  const { data: approvals = [], isLoading: loadingApprovals } = useAnalyticsApprovals();
  const { data: parties = [], isLoading: loadingParties } = useAnalyticsParties();

  // Lazy: redlining & heatmap
  const [showHeatmap, setShowHeatmap] = useState(false);
  const { data: redlining = [] } = useAnalyticsRedlining(showHeatmap);

  // ---- Computed metrics ----
  const revenueLeakage = useRevenueLeakage(contracts, auditTrail);
  const liability = useLiabilityExposure(contracts);
  const riskConc = useRiskConcentration(contracts, parties);
  const approvalSLA = useApprovalSLA(approvals);
  const retrabalho = useRetrabalhIndex(contracts, auditTrail);
  const stalled = useStalledContracts(contracts);
  const monthlyVolume = useMonthlyVolume(contracts);
  const revenueByType = useRevenueByType(contracts);
  const clauseFriction = useClauseFriction(redlining);
  const revenueAtRisk = useRevenueAtRisk(contracts);
  const approvalVelocity = useApprovalVelocity(approvals);

  // ---- Drill-down state ----
  const [drillDown, setDrillDown] = useState<{ title: string; ids: string[] } | null>(null);

  const openDrill = useCallback((title: string, ids: string[]) => {
    if (ids.length > 0) setDrillDown({ title, ids });
  }, []);

  const isLoading = loadingContracts || loadingAudit || loadingApprovals || loadingParties;

  // ---- Error state ----
  if (errorContracts) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/contratos/command-center")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-[#e2a93b]" /> CLM Analytics
          </h1>
        </div>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="flex items-center gap-3 py-6">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-red-400">Erro ao carregar dados de contratos. Tente recarregar a página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/contratos/command-center")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-[#e2a93b]" /> CLM Analytics
            </h1>
            <p className="text-sm text-muted-foreground">Métricas avançadas e inteligência contratual</p>
          </div>
        </div>
        {isLoading && (
          <Badge variant="outline" className="animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin mr-1" /> Carregando...
          </Badge>
        )}
      </div>

      {/* ROW 1 — KPI CARDS (6 cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          icon={DollarSign}
          title="Revenue Leakage"
          value={fmtBRL(revenueLeakage.totalLeaked)}
          description={`${revenueLeakage.leaking.length} contratos sem reajuste`}
          color="text-red-400"
          onClick={() => openDrill("Revenue Leakage", revenueLeakage.leaking.map((l) => l.id))}
        />
        <MetricCard
          icon={ShieldAlert}
          title="Exposição de Passivo"
          value={fmtBRL(liability.total)}
          description={`${liability.items.length} contratos com exposição`}
          color="text-orange-400"
          onClick={() => openDrill("Exposição de Passivo", liability.items.map((l) => l.id))}
        />
        <MetricCard
          icon={AlertTriangle}
          title="Revenue at Risk"
          value={fmtBRL(revenueAtRisk.totalAtRisk)}
          description={`${revenueAtRisk.count} contratos expirando em 90d`}
          color="text-amber-400"
          onClick={() => openDrill("Revenue at Risk (< 90 dias)", revenueAtRisk.items.map((i) => i.id))}
        />
        <MetricCard
          icon={Clock}
          title="SLA Aprovação"
          value={`${approvalSLA.overallAvg}d`}
          description={`${approvalSLA.total} aprovações decididas`}
          color="text-blue-400"
        />
        <MetricCard
          icon={FileEdit}
          title="Retrabalho Médio"
          value={`${retrabalho.avg}×`}
          description={`${retrabalho.totalEdits} edições total`}
          color="text-purple-400"
        />
        <MetricCard
          icon={Pause}
          title="Estagnados"
          value={stalled.length}
          description={stalled.length > 0 ? `Mais antigo: ${stalled[0].days_stalled}d` : "Nenhum"}
          color={stalled.length > 0 ? "text-yellow-400" : "text-green-400"}
          onClick={() => openDrill("Contratos Estagnados", stalled.map((s) => s.id))}
        />
      </div>

      {/* ROW 2 — CHARTS (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Volume Mensal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#e2a93b]" /> Tendência de Volume Mensal
            </CardTitle>
            <CardDescription className="text-xs">Novos contratos nos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyVolume.map((m) => ({ ...m, label: fmtMonth(m.month) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                  labelStyle={{ color: "#e2a93b" }}
                />
                <Bar dataKey="count" name="Contratos" radius={[4, 4, 0, 0]}>
                  {monthlyVolume.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue por Tipo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChart className="h-4 w-4 text-[#e2a93b]" /> Revenue por Tipo de Contrato
            </CardTitle>
            <CardDescription className="text-xs">Valor total estimado (mensal × duração)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={revenueByType.slice(0, 6).map((r) => ({
                  ...r,
                  label: CONTRACT_TYPE_LABELS[r.type as keyof typeof CONTRACT_TYPE_LABELS] ?? r.type,
                }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" tickFormatter={(v) => fmtBRL(v)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                  formatter={(v: number) => fmtBRL(v)}
                />
                <Bar dataKey="value" name="Valor Total" radius={[0, 4, 4, 0]}>
                  {revenueByType.slice(0, 6).map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ROW 3 — TABLES (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Concentração de Risco TOP 8 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-[#e2a93b]" /> Concentração de Risco
            </CardTitle>
            <CardDescription className="text-xs">TOP 8 partes por valor mensal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {riskConc.top8.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
            ) : (
              riskConc.top8.map((p, i) => {
                const pct = riskConc.grandTotal > 0 ? (p.total / riskConc.grandTotal) * 100 : 0;
                return (
                  <div key={p.person_id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-mono w-16 text-right">{fmtBRL(p.total)}</span>
                    <Badge variant="outline" className="text-[10px] px-1">{p.contract_count}c</Badge>
                    <span className="text-[10px] text-muted-foreground w-10 text-right">{fmtPct(pct)}</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Approval SLA by Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#e2a93b]" /> SLA de Aprovações
            </CardTitle>
            <CardDescription className="text-xs">Tempo médio por decisão</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {approvalSLA.byStatus.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
            ) : (
              approvalSLA.byStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={s.status === "aprovado" ? "default" : s.status === "rejeitado" ? "destructive" : "secondary"} className="text-[10px]">
                      {s.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{s.count} decisões</span>
                  </div>
                  <span className={`text-sm font-mono ${s.avg_days > 5 ? "text-red-400" : s.avg_days > 2 ? "text-yellow-400" : "text-green-400"}`}>
                    {s.avg_days}d
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Revenue at Risk */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> Revenue at Risk{" "}
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">Buchecha</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Contratos expirando em 90 dias</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {revenueAtRisk.items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum contrato em risco</p>
            ) : (
              revenueAtRisk.items.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                  onClick={() => openDrill("Revenue at Risk", [item.id])}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={item.days_to_expiry <= 30 ? "destructive" : "secondary"} className="text-[10px]">
                      {item.days_to_expiry}d
                    </Badge>
                    <span className="text-xs font-mono">{item.id.slice(0, 8)}</span>
                  </div>
                  <span className="text-xs font-mono">{fmtBRL(item.monthly_value)}/mês</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ROW 4 — RETRABALHO + ESTAGNADOS + VELOCITY (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* TOP 5 mais editados */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-purple-400" /> TOP 5 Mais Editados
            </CardTitle>
            <CardDescription className="text-xs">Contratos com maior índice de retrabalho</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {retrabalho.top5.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
            ) : (
              retrabalho.top5.map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                  onClick={() => openDrill(`Contrato editado ${item.count}×`, [item.id])}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                    <span className="text-xs font-mono">{item.id.slice(0, 8)}</span>
                  </div>
                  <Badge variant={item.count > 10 ? "destructive" : "secondary"} className="text-[10px]">
                    {item.count} edições
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Contratos Estagnados */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Pause className="h-4 w-4 text-yellow-400" /> Contratos Estagnados
            </CardTitle>
            <CardDescription className="text-xs">Em revisão/rascunho há mais de 7 dias</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {stalled.length === 0 ? (
              <p className="text-xs text-green-400 text-center py-4">Nenhum contrato estagnado</p>
            ) : (
              stalled.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
                  onClick={() => openDrill("Contrato estagnado", [item.id])}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {CONTRACT_STATUS_LABELS[item.status as keyof typeof CONTRACT_STATUS_LABELS] ?? item.status}
                    </Badge>
                    <span className="text-xs font-mono">{item.id.slice(0, 8)}</span>
                  </div>
                  <span className={`text-xs font-mono ${item.days_stalled > 30 ? "text-red-400" : "text-yellow-400"}`}>
                    {item.days_stalled}d
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Approval Velocity por Gestor (Buchecha) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Timer className="h-4 w-4 text-blue-400" /> Velocity por Aprovador{" "}
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">Buchecha</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Quem está acelerando ou atrasando</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {approvalVelocity.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
            ) : (
              approvalVelocity.slice(0, 6).map((item) => (
                <div key={item.approver_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono">{item.approver_id.slice(0, 8)}</span>
                    <span className="text-[10px] text-muted-foreground">{item.count} decisões</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{item.fastest}d–{item.slowest}d</span>
                    <Badge
                      variant={item.avg_days > 5 ? "destructive" : item.avg_days > 2 ? "secondary" : "default"}
                      className="text-[10px]"
                    >
                      avg {item.avg_days}d
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ROW 5 — CLAUSE FRICTION HEATMAP (lazy) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Flame className="h-4 w-4 text-[#e2a93b]" /> Heatmap de Fricção de Cláusulas
          </CardTitle>
          <CardDescription className="text-xs">TOP 15 cláusulas com mais redlining (aceito/recusado/aberto)</CardDescription>
        </CardHeader>
        <CardContent>
          {!showHeatmap ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <p className="text-xs text-muted-foreground">Dados carregados sob demanda para melhor performance</p>
              <Button variant="outline" size="sm" onClick={() => setShowHeatmap(true)}>
                <Flame className="h-4 w-4 mr-1" /> Carregar Heatmap
              </Button>
            </div>
          ) : clauseFriction.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Sem dados de redlining</p>
          ) : (
            <div className="space-y-1.5">
              {clauseFriction.map((clause) => {
                const maxTotal = clauseFriction[0]?.total ?? 1;
                return (
                  <div key={clause.name} className="flex items-center gap-2">
                    <span className="text-xs w-40 truncate text-muted-foreground" title={clause.name}>
                      {clause.name}
                    </span>
                    <div className="flex-1 flex h-5 rounded overflow-hidden bg-muted">
                      {clause.aceito > 0 && (
                        <div
                          className="bg-green-500/60 h-full"
                          style={{ width: `${(clause.aceito / maxTotal) * 100}%` }}
                          title={`Aceito: ${clause.aceito}`}
                        />
                      )}
                      {clause.recusado > 0 && (
                        <div
                          className="bg-red-500/60 h-full"
                          style={{ width: `${(clause.recusado / maxTotal) * 100}%` }}
                          title={`Recusado: ${clause.recusado}`}
                        />
                      )}
                      {clause.aberto > 0 && (
                        <div
                          className="bg-yellow-500/60 h-full"
                          style={{ width: `${(clause.aberto / maxTotal) * 100}%` }}
                          title={`Aberto: ${clause.aberto}`}
                        />
                      )}
                    </div>
                    <span className="text-xs font-mono w-8 text-right">{clause.total}</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-4 mt-2 justify-center">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500/60" />
                  <span className="text-[10px] text-muted-foreground">Aceito</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-500/60" />
                  <span className="text-[10px] text-muted-foreground">Recusado</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-yellow-500/60" />
                  <span className="text-[10px] text-muted-foreground">Aberto</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DRILL-DOWN DIALOG */}
      <DrillDownDialog
        open={!!drillDown}
        onOpenChange={(v) => !v && setDrillDown(null)}
        title={drillDown?.title ?? ""}
        ids={drillDown?.ids ?? null}
      />
    </div>
  );
}
