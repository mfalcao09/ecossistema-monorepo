import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Users, Radio, Clock, Bot, Activity } from "lucide-react";
import { useChatDashboardStats } from "@/hooks/useChat";

export function ChatDashboard() {
  const { data: stats, isLoading } = useChatDashboardStats();

  const kpis = [
    {
      title: "Canais Conectados",
      value: stats?.connectedChannels ?? 0,
      total: stats?.totalChannels ?? 0,
      icon: Radio,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Conversas Abertas",
      value: stats?.openConversations ?? 0,
      icon: MessageCircle,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Aguardando Atribuição",
      value: stats?.waitingConversations ?? 0,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      title: "Contatos",
      value: stats?.totalContacts ?? 0,
      icon: Users,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      title: "Campanhas Ativas",
      value: stats?.activeCampaigns ?? 0,
      icon: Activity,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <div className={`rounded-lg p-2 ${kpi.bg}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? "..." : kpi.value}
                {kpi.total !== undefined && !isLoading && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">/ {kpi.total}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atividades Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-8">
              Nenhuma atividade registrada hoje.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atendimentos por IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Bot className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Configure um agente de IA na aba Integrações</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
