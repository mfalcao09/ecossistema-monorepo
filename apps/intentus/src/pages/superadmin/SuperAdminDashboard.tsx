import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, FileText, Home, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function SuperAdminDashboard() {
  const { data: tenants = [] } = useQuery({
    queryKey: ["sa-dash-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["sa-dash-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, name, tenant_id, created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["sa-dash-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("id, tenant_id, contract_type, status, created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["sa-dash-properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("id, tenant_id, status, created_at");
      if (error) throw error;
      return data;
    },
  });

  const totalTenants = tenants.length;
  const totalUsers = profiles.length;
  const totalContracts = contracts.length;
  const totalProperties = properties.length;
  const activeContracts = contracts.filter((c) => c.status === "ativo").length;
  const usersWithoutTenant = profiles.filter((p) => !p.tenant_id).length;

  // Users per tenant for chart
  const usersPerTenant = tenants.map((t) => ({
    name: t.name.length > 18 ? t.name.slice(0, 18) + "…" : t.name,
    usuarios: profiles.filter((p) => p.tenant_id === t.id).length,
    contratos: contracts.filter((c) => c.tenant_id === t.id).length,
    imoveis: properties.filter((p) => p.tenant_id === t.id).length,
  }));

  // Contract type distribution
  const contractTypeMap: Record<string, number> = {};
  contracts.forEach((c) => {
    const label = c.contract_type === "locacao" ? "Locação" : c.contract_type === "venda" ? "Venda" : c.contract_type;
    contractTypeMap[label] = (contractTypeMap[label] || 0) + 1;
  });
  const contractTypeData = Object.entries(contractTypeMap).map(([name, value]) => ({ name, value }));

  // Recent tenants
  const recentTenants = tenants.slice(0, 5);

  // Tenants created per month (last 6 months)
  const now = new Date();
  const monthLabels: string[] = [];
  const tenantsByMonth: { month: string; empresas: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = format(d, "MM/yyyy");
    monthLabels.push(label);
    const count = tenants.filter((t) => {
      const created = new Date(t.created_at);
      return created.getMonth() === d.getMonth() && created.getFullYear() === d.getFullYear();
    }).length;
    tenantsByMonth.push({ month: label, empresas: count });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-gradient-to-r from-primary/90 to-primary p-6 text-primary-foreground">
        <p className="text-sm opacity-80">Painel Super Admin</p>
        <h1 className="text-2xl font-bold">Gestão Multi-Empresas</h1>
        <p className="text-sm opacity-70 mt-1">Visão consolidada de todas as empresas da plataforma</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard icon={Building2} label="Empresas" value={totalTenants} />
        <KpiCard icon={Users} label="Usuários" value={totalUsers} />
        <KpiCard icon={Home} label="Imóveis" value={totalProperties} />
        <KpiCard icon={FileText} label="Contratos" value={totalContracts} />
        <KpiCard icon={TrendingUp} label="Ativos" value={activeContracts} variant="success" />
        <KpiCard icon={AlertTriangle} label="Sem Empresa" value={usersWithoutTenant} variant="warning" />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Bar chart - resources per tenant */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recursos por Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            {usersPerTenant.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={usersPerTenant}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" fontSize={11} className="fill-muted-foreground" />
                  <YAxis fontSize={11} className="fill-muted-foreground" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="usuarios" name="Usuários" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="contratos" name="Contratos" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="imoveis" name="Imóveis" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-center py-12">Sem dados</div>
            )}
          </CardContent>
        </Card>

        {/* Pie chart - contract types */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipos de Contrato</CardTitle>
          </CardHeader>
          <CardContent>
            {contractTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={contractTypeData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {contractTypeData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-center py-12">Sem contratos</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Growth + recent tenants */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Growth chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novas Empresas (últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tenantsByMonth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" fontSize={11} className="fill-muted-foreground" />
                <YAxis fontSize={11} allowDecimals={false} className="fill-muted-foreground" />
                <Tooltip />
                <Bar dataKey="empresas" name="Empresas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent tenants table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empresas Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Usuários</TableHead>
                  <TableHead>Criada em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nenhuma empresa</TableCell>
                  </TableRow>
                ) : (
                  recentTenants.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                          </div>
                          {t.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{profiles.filter((p) => p.tenant_id === t.id).length}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(t.created_at), "dd/MM/yyyy")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, variant }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; variant?: "success" | "warning" }) {
  const valueColor = variant === "success" ? "text-emerald-600" : variant === "warning" ? "text-amber-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4 flex flex-col items-center text-center gap-1">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <span className={`text-2xl font-bold ${valueColor}`}>{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}
