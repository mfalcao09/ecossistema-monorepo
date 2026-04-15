import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck, CheckCircle2, AlertTriangle, Users, Handshake,
} from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { useDealRequests } from "@/hooks/useDealRequests";
import { useProfiles } from "@/hooks/useDealCardFeatures";
import { useSlaRules } from "@/hooks/useSlaRules";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays, differenceInHours } from "date-fns";
import { Navigate } from "react-router-dom";

function getProfileName(profiles: any[], userId: string | null | undefined): string {
  if (!userId) return "Não atribuído";
  const p = profiles.find((pr: any) => pr.user_id === userId);
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

const OPEN_STATUSES = ["rascunho", "enviado_juridico", "analise_documental", "aguardando_documentos", "parecer_em_elaboracao", "minuta_em_elaboracao", "em_validacao", "ajustes_pendentes", "aprovado_comercial", "contrato_finalizado", "em_assinatura"];

export default function CommercialSlaDetails() {
  const { isAdminOrGerente } = useAuth();
  const { rules } = useSlaRules();
  const { data: leads = [] } = useLeads();
  const { data: deals = [] } = useDealRequests();
  const { data: profiles = [] } = useProfiles();

  const now = new Date();

  // ── Leads SLA ──
  const leadRows = useMemo(() => {
    return leads
      .filter((l) => !["convertido", "perdido"].includes(l.status))
      .map((l) => {
        const lastContact = l.last_contact_at || l.created_at;
        const hoursSinceCreation = differenceInHours(now, new Date(l.created_at));
        const daysSinceContact = differenceInDays(now, new Date(lastContact));

        // SLA: primeiro contato (se nunca contatado, usar horas desde criação)
        const neverContacted = !l.last_contact_at && l.status === "novo";
        const firstContactBreached = rules.leads.enabled && neverContacted && hoursSinceCreation > rules.leads.primeiro_contato_hours;
        // SLA: follow-up (dias sem contato)
        const followupBreached = rules.leads.enabled && !neverContacted && daysSinceContact > rules.leads.followup_dias;

        const slaOk = !firstContactBreached && !followupBreached;

        return {
          id: l.id,
          description: l.name,
          responsible: getProfileName(profiles, l.assigned_to),
          responsibleId: l.assigned_to,
          created: l.created_at,
          elapsed: neverContacted ? `${hoursSinceCreation}h` : `${daysSinceContact}d`,
          slaOk,
          slaDeadline: neverContacted
            ? (rules.leads.enabled ? `${rules.leads.primeiro_contato_hours}h` : "—")
            : (rules.leads.enabled ? `${rules.leads.followup_dias}d` : "—"),
          status: l.status,
        };
      });
  }, [leads, profiles, rules, now]);

  // ── Deals SLA ──
  const dealRows = useMemo(() => {
    return (deals as any[])
      .filter((d) => OPEN_STATUSES.includes(d.status))
      .map((d) => {
        const daysSinceUpdate = differenceInDays(now, new Date(d.updated_at));
        const daysSinceCreation = differenceInDays(now, new Date(d.created_at));

        const stageBreached = rules.negocios.enabled && daysSinceUpdate > rules.negocios.tempo_etapa_dias;
        const totalBreached = rules.negocios.enabled && daysSinceCreation > rules.negocios.conclusao_total_dias;
        const slaOk = !stageBreached && !totalBreached;

        return {
          id: d.id,
          description: d.properties?.title || `Negócio #${d.id.slice(0, 8)}`,
          responsible: getProfileName(profiles, d.assigned_to),
          responsibleId: d.assigned_to,
          created: d.created_at,
          elapsed: `${daysSinceUpdate}d na etapa / ${daysSinceCreation}d total`,
          slaOk,
          slaDeadline: rules.negocios.enabled
            ? `${rules.negocios.tempo_etapa_dias}d etapa / ${rules.negocios.conclusao_total_dias}d total`
            : "—",
          status: d.status,
        };
      });
  }, [deals, profiles, rules, now]);

  // ── KPIs ──
  const allRows = [...leadRows, ...dealRows];
  const totalOk = allRows.filter((r) => r.slaOk).length;
  const totalBreached = allRows.filter((r) => !r.slaOk).length;
  const complianceRate = allRows.length > 0 ? ((totalOk / allRows.length) * 100).toFixed(0) : "–";

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

  function SlaTable({ rows }: { rows: any[] }) {
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
          <ShieldCheck className="h-6 w-6" /> SLA Comercial — Detalhes
        </h1>
        <p className="text-muted-foreground text-sm">Controle de SLA de leads e negócios por responsável</p>
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
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="negocios">Negócios</TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="geral" className="space-y-6">
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

        {/* Leads */}
        <TabsContent value="leads">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Leads</CardTitle>
            </CardHeader>
            <CardContent><SlaTable rows={leadRows} /></CardContent>
          </Card>
        </TabsContent>

        {/* Negócios */}
        <TabsContent value="negocios">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Handshake className="h-4 w-4" /> Negócios</CardTitle>
            </CardHeader>
            <CardContent><SlaTable rows={dealRows} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
