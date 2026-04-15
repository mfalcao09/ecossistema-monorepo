import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";
import { useMyGoals, getMetricLabel } from "@/hooks/useMyGoals";

function getStatusBadge(percentage: number) {
  if (percentage >= 100) return { label: "Meta atingida", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" };
  if (percentage >= 60) return { label: "No caminho", className: "bg-blue-500/15 text-blue-600 border-blue-500/20" };
  return { label: "Atrasado", className: "bg-amber-500/15 text-amber-600 border-amber-500/20" };
}

const PERIOD_LABELS: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export function GoalsProgress() {
  const { data: goals = [], isLoading } = useMyGoals();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="h-16 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (goals.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma meta ativa para este período</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {goals.map((goal) => {
        const status = getStatusBadge(goal.percentage);
        return (
          <Card key={goal.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {getMetricLabel(goal.metric)}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {PERIOD_LABELS[goal.period_type] || goal.period_type}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${status.className}`}>
                    {status.label}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between mb-2">
                <span className="text-2xl font-bold">{goal.current_value}</span>
                <span className="text-sm text-muted-foreground">/ {goal.target_value}</span>
              </div>
              <Progress value={goal.percentage} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1 text-right">{goal.percentage}%</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
