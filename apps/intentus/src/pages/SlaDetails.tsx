import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck, CheckCircle2, AlertTriangle, Clock, Headset, Wrench, FileX, Scale, ScrollText, KeyRound, Users,
} from "lucide-react";
import { useTickets } from "@/hooks/useTickets";
import { useMaintenanceRequests } from "@/hooks/useMaintenanceRequests";
import { useTerminations } from "@/hooks/useTerminations";
import { useRentAdjustments } from "@/hooks/useRentAdjustments";
import { useContractRenewals } from "@/hooks/useContractRenewals";
import { useGuaranteeReleases } from "@/hooks/useGuaranteeRelease";
import { useProfiles } from "@/hooks/useDealCardFeatures";
import { useSlaRules } from "@/hooks/useSlaRules";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays, differenceInHours, isPast } from "date-fns";
import { Navigate } from "react-router-dom";

function getProfileName(profiles: any[], userId: string | null | undefined): string {
  if (!userId) return "Não atribuído";
  const p = profiles.find((pr) => pr.user_id === userId);
  return p?.name || "Desconhecido";
}

function SlaBadge({ ok }: { ok: boolean }) {
  return ok ? (
    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Dentro do SLA</Badge>
  ) : (
    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">SLA Estourado</Badge>
  );
}

function KpiCard({ icon: Icon, label, value, className }: { icon: any; label: string; value: number | string; className?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-5 pb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${className || "bg-primary/10"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SlaDetails() {
  const { isAdminOrGerente } = useAuth();
  const { rules } = useSlaRules();
  const { data: tickets = [] } = useTickets();
  const { data: maintenance = [] } = useMaintenanceRequests();
  const { data: terminations = [] } = useTerminations();
  const { data: adjustments = [] } = useRentAdjustments();
  const { data: renewals = [] } = useContractRenewals();
  const { data: releases = [] } = useGuaranteeReleases();
  const { data: profiles = [] } = useProfiles();

  const now = new Date();

  // ── Tickets SLA ──
  const ticketRows = useMemo(() => {
    return tickets
      .filter((t) => t.status !== "cancelado")
      .map((t) => {
        const elapsed = differenceInHours(now, new Date(t.created_at));
        const slaOk = t.sla_deadline
          ? (t.status === "resolvido" ? new Date(t.updated_at) <= new Date(t.sla_deadline) : !isPast(new Date(t.sla_deadline)))
          : true;
        return {
          id: t.id,
          description: t.subject,
          responsible: getProfileName(profiles, t.assigned_to),
          responsibleId: t.assigned_to,
          created: t.created_at,
          elapsed: `${elapsed}h`,
          slaOk,
          slaDeadline: t.sla_deadline ? `${differenceInHours(new Date(t.sla_deadline), new Date(t.created_at))}h` : "—",
          status: t.status,
        };
      });
  }, [tickets, profiles, now]);

  // ── Maintenance SLA ──
  const maintenanceRows = useMemo(() => {
    return maintenance
      .filter((m) => m.status !== "cancelado" && m.status !== "concluido")
      .map((m) => {
        const elapsed = differenceInHours(now, new Date(m.created_at));
        const priorityHours = rules.manutencao[`${m.priority}_hours` as keyof typeof rules.manutencao] as number || 72;
        const slaOk = rules.manutencao.enabled ? elapsed <= priorityHours : true;
        return {
          id: m.id,
          description: m.title,
          property: m.properties?.title || "—",
          responsible: getProfileName(profiles, m.assigned_to),
          responsibleId: m.assigned_to,
          created: m.created_at,
          elapsed: `${elapsed}h`,
          slaOk,
          slaDeadline: rules.manutencao.enabled ? `${priorityHours}h` : "—",
          priority: m.priority,
        };
      });
  }, [maintenance, profiles, rules, now]);

  // ── Terminations SLA ──
  const terminationRows = useMemo(() => {
    return terminations
      .filter((t) => t.status !== "encerrado" && t.status !== "cancelado")
      .map((t) => {
        const elapsed = differenceInDays(now, new Date(t.created_at));
        const slaOk = rules.rescisoes.enabled ? elapsed <= rules.rescisoes.prazo_max_dias : true;
        return {
          id: t.id,
          description: t.contracts?.properties?.title || "—",
          responsible: getProfileName(profiles, t.assigned_to),
          responsibleId: t.assigned_to,
          created: t.created_at,
          elapsed: `${elapsed}d`,
          slaOk,
          slaDeadline: rules.rescisoes.enabled ? `${rules.rescisoes.prazo_max_dias}d` : "—",
          status: t.status,
        };
      });
  }, [terminations, profiles, rules, now]);

  // ── Adjustments SLA ──
  const adjustmentRows = useMemo(() => {
    return adjustments
      .filter((a: any) => a.status === "pendente")
      .map((a: any) => {
        const elapsed = differenceInDays(now, new Date(a.created_at));
        return {
          id: a.id,
          description: a.contracts?.properties?.title || "—",
          responsible: getProfileName(profiles, a.assigned_to),
          responsibleId: a.assigned_to,
          created: a.created_at,
          elapsed: `${elapsed}d`,
          slaOk: elapsed <= 30,
          slaDeadline: "30d",
        };
      });
  }, [adjustments, profiles, now]);

  // ── Renewals SLA ──
  const renewalRows = useMemo(() => {
    return renewals
      .filter((r: any) => ["rascunho", "em_analise", "aprovada"].includes(r.status))
      .map((r: any) => {
        const elapsed = differenceInDays(now, new Date(r.created_at));
        const slaOk = rules.renovacoes.enabled ? elapsed <= rules.renovacoes.prazo_finalizacao_dias : true;
        return {
          id: r.id,
          description: r.contract_id,
          responsible: getProfileName(profiles, r.assigned_to),
          responsibleId: r.assigned_to,
          created: r.created_at,
          elapsed: `${elapsed}d`,
          slaOk,
          slaDeadline: rules.renovacoes.enabled ? `${rules.renovacoes.prazo_finalizacao_dias}d` : "—",
          status: r.status,
        };
      });
  }, [renewals, profiles, rules, now]);

  // ── Guarantee releases SLA ──
  const releaseRows = useMemo(() => {
    return releases
      .filter((r) => r.status === "pendente" || r.status === "em_andamento")
      .map((r) => {
        const elapsed = differenceInDays(now, new Date(r.created_at));
        return {
          id: r.id,
          description: r.guarantee_type_name || "—",
          responsible: getProfileName(profiles, r.assigned_to),
          responsibleId: r.assigned_to,
          created: r.created_at,
          elapsed: `${elapsed}d`,
          slaOk: elapsed <= 30,
          slaDeadline: "30d",
        };
      });
  }, [releases, profiles, now]);

  // ── KPIs ──
  const allRows = [...ticketRows, ...maintenanceRows, ...terminationRows, ...adjustmentRows, ...renewalRows, ...releaseRows];
  const totalOk = allRows.filter((r) => r.slaOk).length;
  const totalBreached = allRows.filter((r) => !r.slaOk).length;
  const complianceRate = allRows.length > 0 ? ((totalOk / allRows.length) * 100).toFixed(0) : "–";

  // Ranking by breached
  const breachedByPerson = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {};
    allRows.filter((r) => !r.slaOk).forEach((r) => {
      const key = r.responsibleId || "__none__";
      if (!map[key]) map[key] = { name: r.responsible, count: 0 };
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [allRows]);

  if (!isAdminOrGerente) return <Navigate to="/" replace />;

  function SlaTable({ rows, columns }: { rows: any[]; columns?: string[] }) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead>Tempo</TableHead>
            <TableHead>Prazo SLA</TableHead>
            <TableHead>Status SLA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Nenhum item encontrado.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium max-w-[200px] truncate">{row.description}</TableCell>
                <TableCell>
                  <Badge variant={row.responsibleId ? "secondary" : "outline"} className="text-xs">
                    {row.responsible}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(row.created).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="font-mono text-sm">{row.elapsed}</TableCell>
                <TableCell className="text-sm">{row.slaDeadline}</TableCell>
                <TableCell><SlaBadge ok={row.slaOk} /></TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <ShieldCheck className="h-6 w-6" /> Controle de SLA — Detalhes
        </h1>
        <p className="text-muted-foreground text-sm">Visão detalhada de todos os processos por status de SLA e responsável</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={CheckCircle2} label="Dentro do SLA" value={totalOk} className="bg-green-100 dark:bg-green-900/30" />
        <KpiCard icon={AlertTriangle} label="SLA Estourado" value={totalBreached} className="bg-red-100 dark:bg-red-900/30" />
        <KpiCard icon={ShieldCheck} label="Taxa Cumprimento" value={`${complianceRate}%`} className="bg-emerald-100 dark:bg-emerald-900/30" />
        <KpiCard icon={Users} label="Responsáveis c/ Estouro" value={breachedByPerson.length} className="bg-orange-100 dark:bg-orange-900/30" />
      </div>

      <Tabs defaultValue="geral">
        <TabsList className="flex-wrap">
          <TabsTrigger value="geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="atendimento">Atendimento</TabsTrigger>
          <TabsTrigger value="manutencao">Manutenção</TabsTrigger>
          <TabsTrigger value="rescisoes">Rescisões</TabsTrigger>
          <TabsTrigger value="reajustes">Reajustes</TabsTrigger>
          <TabsTrigger value="renovacoes">Renovações</TabsTrigger>
          <TabsTrigger value="garantias">Garantias</TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="geral" className="space-y-6">
          {/* Ranking */}
          {breachedByPerson.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> Ranking — SLA Estourado por Responsável
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Estouros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breachedByPerson.map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-bold">{i + 1}</TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell><Badge variant="destructive">{p.count}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* All breached items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" /> Itens com SLA Estourado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SlaTable rows={allRows.filter((r) => !r.slaOk)} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Atendimento */}
        <TabsContent value="atendimento">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Headset className="h-4 w-4" /> Tickets</CardTitle>
            </CardHeader>
            <CardContent><SlaTable rows={ticketRows} /></CardContent>
          </Card>
        </TabsContent>

        {/* Manutenção */}
        <TabsContent value="manutencao">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4" /> Manutenções</CardTitle>
            </CardHeader>
            <CardContent><SlaTable rows={maintenanceRows} /></CardContent>
          </Card>
        </TabsContent>

        {/* Rescisões */}
        <TabsContent value="rescisoes">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileX className="h-4 w-4" /> Rescisões</CardTitle>
            </CardHeader>
            <CardContent><SlaTable rows={terminationRows} /></CardContent>
          </Card>
        </TabsContent>

        {/* Reajustes */}
        <TabsContent value="reajustes">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Scale className="h-4 w-4" /> Reajustes</CardTitle>
            </CardHeader>
            <CardContent><SlaTable rows={adjustmentRows} /></CardContent>
          </Card>
        </TabsContent>

        {/* Renovações */}
        <TabsContent value="renovacoes">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><ScrollText className="h-4 w-4" /> Renovações</CardTitle>
            </CardHeader>
            <CardContent><SlaTable rows={renewalRows} /></CardContent>
          </Card>
        </TabsContent>

        {/* Garantias */}
        <TabsContent value="garantias">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Liberação de Garantias</CardTitle>
            </CardHeader>
            <CardContent><SlaTable rows={releaseRows} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
