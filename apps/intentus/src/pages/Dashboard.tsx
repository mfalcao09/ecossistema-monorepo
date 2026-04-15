import { DashboardKpiRow } from "@/components/dashboard/DashboardKpiRow";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { DashboardUpcoming } from "@/components/dashboard/DashboardUpcoming";
import { DashboardTasks } from "@/components/dashboard/DashboardTasks";
import { DashboardDepartments } from "@/components/dashboard/DashboardDepartments";
import { GoalsProgress } from "@/components/dashboard/GoalsProgress";
import { AnnouncementsFeed } from "@/components/dashboard/AnnouncementsFeed";

// Sessão 131 Passo 7: HeroBar e Alertas Inteligentes migrados daqui pra Home.
// Dashboard agora foca exclusivamente em KPIs, BI e operação.

export default function Dashboard() {
  return (
    <div className="space-y-5">
      {/* Zona 1 — KPIs contextuais por role */}
      <DashboardKpiRow />

      {/* Zona 2 — Gráficos BI */}
      <DashboardCharts />

      {/* Zona 3 — Painéis departamentais (BI por área) + Vencimentos */}
      <div className="grid lg:grid-cols-[3fr_2fr] gap-5">
        <DashboardDepartments />
        <DashboardUpcoming />
      </div>

      {/* Zona 4 — Tarefas (kanban) */}
      <DashboardTasks />

      {/* Zona 5 — Metas + Anúncios */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Metas do Período
          </h2>
          <GoalsProgress />
        </div>
        <AnnouncementsFeed />
      </div>
    </div>
  );
}
