import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, Users, FileText, Wrench, TrendingUp, AlertTriangle,
  DollarSign, ArrowUpRight, UserPlus, Shield, Gavel, Calendar, ChevronLeft, ChevronRight, Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useTenantModules } from "@/hooks/useTenantModules";
import { useProperties } from "@/hooks/useProperties";
import { usePeople } from "@/hooks/usePeople";
import { useContracts } from "@/hooks/useContracts";
import { useLeads } from "@/hooks/useLeads";
import { useTerminations } from "@/hooks/useTerminations";
import { useRentAdjustments } from "@/hooks/useRentAdjustments";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function useMonthlyFinancials(referenceDate: Date, includeCommissions: boolean) {
  const monthStart = format(startOfMonth(referenceDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(referenceDate), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["dashboard-financials", monthStart, includeCommissions],
    queryFn: async () => {
      const { data: installments } = await supabase
        .from("contract_installments")
        .select("amount, paid_amount, status, revenue_type")
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd);

      const total = installments || [];
      const received = total.filter(i => i.status === "pago").reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);
      const pending = total.filter(i => i.status === "pendente").reduce((s, i) => s + Number(i.amount), 0);
      const overdue = total.filter(i => i.status === "atrasado").reduce((s, i) => s + Number(i.amount), 0);
      const ownRevenue = total.filter(i => i.status === "pago" && i.revenue_type === "propria").reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);
      const transitFunds = total.filter(i => i.status === "pago" && i.revenue_type !== "propria").reduce((s, i) => s + Number(i.paid_amount || i.amount), 0);

      let commissionsPending = 0;
      let houseCommissionTotal = 0;

      if (includeCommissions) {
        const { count } = await supabase
          .from("commission_splits")
          .select("*", { count: "exact", head: true })
          .eq("status", "pendente");
        commissionsPending = count || 0;

        const { data: houseCommissions } = await supabase
          .from("commission_splits")
          .select("calculated_value, status")
          .eq("role", "house")
          .eq("status", "pago");
        houseCommissionTotal = (houseCommissions || []).reduce((s: number, c: any) => s + Number(c.calculated_value), 0);
      }

      return {
        received, pending, overdue,
        ownRevenue: ownRevenue + houseCommissionTotal,
        transitFunds,
        commissionsPending,
      };
    },
  });
}

function useMaintenanceCount(enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard-maintenance"],
    queryFn: async () => {
      const { count } = await supabase
        .from("maintenance_requests")
        .select("*", { count: "exact", head: true })
        .in("status", ["aberto", "em_andamento"]);
      return count || 0;
    },
    enabled,
  });
}

function usePendingDueDiligence(enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard-dd-pending"],
    queryFn: async () => {
      const { count } = await supabase
        .from("due_diligence_checks")
        .select("*", { count: "exact", head: true })
        .in("status", ["pendente", "em_andamento"]);
      return count || 0;
    },
    enabled,
  });
}

function usePendingInspections(enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard-inspections-pending"],
    queryFn: async () => {
      const { count } = await supabase
        .from("inspections")
        .select("*", { count: "exact", head: true })
        .in("status", ["agendada", "em_andamento"]);
      return count || 0;
    },
    enabled,
  });
}

export function DepartmentKpis() {
  const [refDate, setRefDate] = useState(new Date());
  const { roles } = useAuth();
  const { hasModule } = useTenantModules();

  const hasCommissions = hasModule("addon_comissoes");
  const hasMaintenance = hasModule("addon_manutencao_vistorias");
  const hasJuridico = hasModule("juridico_intermediario");
  const hasReajustes = hasModule("relacionamento_intermediario");

  const { data: properties = [] } = useProperties({});
  const { data: people = [] } = usePeople({});
  const { data: contracts = [] } = useContracts({ status: "ativo" });
  const { data: allContracts = [] } = useContracts({});
  const { data: leads = [] } = useLeads({});
  const { data: terminations = [] } = useTerminations();
  const { data: adjustments = [] } = useRentAdjustments();
  const { data: financials } = useMonthlyFinancials(refDate, hasCommissions);
  const { data: maintenanceCount = 0 } = useMaintenanceCount(hasMaintenance);
  const { data: ddPending = 0 } = usePendingDueDiligence(hasJuridico);
  const { data: inspectionsPending = 0 } = usePendingInspections(hasMaintenance);

  const activeLeads = leads.filter(l => !["convertido", "perdido"].includes(l.status));
  const pendingAdj = hasReajustes ? adjustments.filter((a: any) => a.status === "pendente").length : 0;
  const activeTerminations = terminations.filter(t => !["encerrado", "cancelado"].includes(t.status)).length;
  const monthLabel = format(refDate, "MMMM yyyy", { locale: ptBR });

  // Determine default tab based on user role
  const defaultTab = roles.includes("corretor")
    ? "comercial"
    : roles.includes("financeiro")
      ? "financeiro"
      : roles.includes("juridico")
        ? "juridico"
        : roles.includes("manutencao")
          ? "manutencao"
          : "geral";

  return (
    <div className="space-y-4">
      {/* Core counts */}
      <div className={`grid gap-4 sm:grid-cols-2 ${hasMaintenance ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Imóveis</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{properties.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{properties.filter(p => p.status === "disponivel").length} disponíveis</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pessoas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{people.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Clientes, proprietários, fiadores</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Contratos Ativos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contracts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {allContracts.filter((c: any) => c.contract_type === "locacao" && c.status === "ativo").length} locações, {allContracts.filter((c: any) => c.contract_type === "venda" && c.status === "ativo").length} vendas
            </p>
          </CardContent>
        </Card>
        {hasMaintenance && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Manutenções Abertas</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{maintenanceCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Chamados em aberto</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setRefDate(d => subMonths(d, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize min-w-[140px] text-center">{monthLabel}</span>
        <Button variant="outline" size="icon" onClick={() => setRefDate(d => addMonths(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setRefDate(new Date())} className="text-xs">Hoje</Button>
      </div>

      {/* Financial KPIs */}
      <div className={`grid gap-4 sm:grid-cols-2 ${hasCommissions ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receita Própria</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{fmt(financials?.ownRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Taxas de adm. + intermediação{hasCommissions ? " + comissões" : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dinheiro em Trânsito</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{fmt(financials?.transitFunds || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Aluguéis de terceiros (passivo)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">A Receber</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(financials?.pending || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Parcelas pendentes no mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inadimplência</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{fmt(financials?.overdue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Parcelas atrasadas no mês</p>
          </CardContent>
        </Card>
        {hasCommissions && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Comissões Pendentes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{financials?.commissionsPending || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Aguardando pagamento</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Department tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="geral">Visão Geral</TabsTrigger>
          {(roles.includes("corretor") || roles.includes("admin") || roles.includes("gerente")) && (
            <TabsTrigger value="comercial">Comercial</TabsTrigger>
          )}
          {(roles.includes("financeiro") || roles.includes("admin") || roles.includes("gerente")) && (
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          )}
          {hasJuridico && (roles.includes("juridico") || roles.includes("admin") || roles.includes("gerente")) && (
            <TabsTrigger value="juridico">Jurídico</TabsTrigger>
          )}
          {hasMaintenance && (roles.includes("manutencao") || roles.includes("admin") || roles.includes("gerente")) && (
            <TabsTrigger value="manutencao">Manutenção</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="geral">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Leads Ativos</CardTitle>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeLeads.length}</div>
                <p className="text-xs text-muted-foreground mt-1">{leads.filter(l => l.status === "novo").length} novos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Rescisões em Andamento</CardTitle>
                <Calendar className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeTerminations}</div>
                <p className="text-xs text-muted-foreground mt-1">Processos não finalizados</p>
              </CardContent>
            </Card>
            {hasReajustes && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Reajustes Pendentes</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingAdj}</div>
                  <p className="text-xs text-muted-foreground mt-1">Reajustes a aplicar</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="comercial">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Briefcase className="h-4 w-4" /> Leads por Converter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leads.filter(l => l.status === "qualificado").length}</div>
                <p className="text-xs text-muted-foreground mt-1">Qualificados aguardando proposta</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Imóveis Disponíveis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{properties.filter(p => p.status === "disponivel").length}</div>
                <p className="text-xs text-muted-foreground mt-1">Prontos para captação de clientes</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Visitas Agendadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{leads.filter(l => l.status === "visita_agendada").length}</div>
                <p className="text-xs text-muted-foreground mt-1">Leads com visita marcada</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financeiro">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hasCommissions && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Comissões Pendentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{financials?.commissionsPending || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Aguardando NF/RPA e pagamento</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Inadimplência
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{fmt(financials?.overdue || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">Parcelas atrasadas no mês</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" /> Receita Própria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{fmt(financials?.ownRevenue || 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">Taxas de administração + intermediação</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {hasJuridico && (
          <TabsContent value="juridico">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Gavel className="h-4 w-4" /> Rescisões Ativas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeTerminations}</div>
                  <p className="text-xs text-muted-foreground mt-1">Processos em andamento</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Due Diligence Pendente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{ddPending}</div>
                  <p className="text-xs text-muted-foreground mt-1">Verificações em andamento</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Reajustes com Aditivo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{adjustments.filter((a: any) => a.requires_addendum && a.status === "pendente").length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Aditivos pendentes de elaboração</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {hasMaintenance && (
          <TabsContent value="manutencao">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Wrench className="h-4 w-4" /> Chamados Abertos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{maintenanceCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">Ordens de serviço em aberto</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Vistorias Pendentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{inspectionsPending}</div>
                  <p className="text-xs text-muted-foreground mt-1">Vistorias agendadas ou em andamento</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
