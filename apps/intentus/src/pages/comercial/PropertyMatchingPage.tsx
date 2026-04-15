/**
 * PropertyMatchingPage — Matching Imóvel-Cliente com scoring.
 * Rota: /comercial/matching
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePropertyMatching } from "@/hooks/usePropertyMatching";
import { ArrowLeft, Sparkles, Target, Users, Building2, DollarSign, Loader2, AlertTriangle, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

function fmtBRL(v: number): string { return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`; }

export function PropertyMatchingPage() {
  const navigate = useNavigate();
  const { dashboard, isLoading } = usePropertyMatching();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/leads")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Matching Imóvel-Cliente
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-sm text-muted-foreground">Cruzamento automático de leads com imóveis compatíveis</p>
        </div>
      </div>

      {dashboard && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Matches Encontrados" value={dashboard.totalMatches} icon={Target} />
            <KPI label="Matches Fortes (≥70)" value={dashboard.highMatches} icon={Sparkles} color="text-green-600" />
            <KPI label="Score Médio" value={`${dashboard.avgScore}/100`} icon={Target} color="text-primary" />
            <KPI label="Leads com Match" value={dashboard.matchesByLead.length} icon={Users} />
          </div>

          {/* Top matches */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">TOP 20 Melhores Matches</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.topMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum match encontrado. Certifique-se de que os leads têm orçamento e região preenchidos.</p>
              ) : (
                <div className="space-y-2">
                  {dashboard.topMatches.map((m, i) => (
                    <div key={`${m.leadId}-${m.propertyId}`} className="flex items-center gap-3 text-sm py-2 border-b last:border-0">
                      <span className="text-muted-foreground w-6 text-right">#{i + 1}</span>
                      <Badge className={m.matchScore >= 70 ? "bg-green-100 text-green-700" : m.matchScore >= 50 ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}>
                        {m.matchScore}%
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{m.leadName}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span>{m.propertyTitle}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{m.propertyCity}/{m.propertyNeighborhood}</span>
                      <span className="text-xs font-medium">{fmtBRL(m.propertyPrice)}</span>
                      <div className="flex gap-1">
                        {m.matchFactors.map((f) => (
                          <Badge key={f.factor} variant="outline" className={`text-[9px] ${f.score >= 70 ? "text-green-600" : f.score >= 40 ? "text-amber-600" : "text-red-600"}`}>
                            {f.factor}: {f.score}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leads with matches */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Leads com Mais Matches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dashboard.matchesByLead.map((l) => (
                  <div key={l.leadId} className="flex items-center gap-3 text-sm">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium flex-1">{l.leadName}</span>
                    <span className="text-muted-foreground">{l.count} imóveis</span>
                    <Badge className={l.bestScore >= 70 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                      Melhor: {l.bestScore}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: LucideIcon; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color || "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
