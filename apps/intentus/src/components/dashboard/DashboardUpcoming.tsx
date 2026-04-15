import { useNavigate } from "react-router-dom";
import { Calendar, ArrowRight } from "lucide-react";
import { useBiDashboard } from "@/hooks/useBiDashboard";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function DashboardUpcoming() {
  const { data, isLoading } = useBiDashboard();
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="h-48 rounded-xl bg-card border border-border animate-pulse" />;
  }

  const items = data?.upcomingDue || [];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Vencimentos Próximos</span>
          {items.length > 0 && (
            <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
              {items.length}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate("/financeiro/receitas")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Ver todos <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          ✅ Nenhum vencimento nos próximos 30 dias
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => {
            const urgent = item.daysLeft <= 3;
            const warning = item.daysLeft <= 7;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${urgent ? "bg-red-500" : warning ? "bg-amber-500" : "bg-emerald-500"}`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm text-foreground font-medium truncate">{item.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(item.dueDate), "dd 'de' MMM", { locale: ptBR })}
                      {" · "}
                      <span className={urgent ? "text-red-400" : warning ? "text-amber-400" : "text-muted-foreground"}>
                        {item.daysLeft === 0 ? "Vence hoje" : `${item.daysLeft}d restantes`}
                      </span>
                    </div>
                  </div>
                </div>
                <span
                  className="text-sm font-semibold text-foreground ml-4 flex-shrink-0"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fmt(item.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
