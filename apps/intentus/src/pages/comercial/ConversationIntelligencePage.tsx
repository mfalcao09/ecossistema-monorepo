/**
 * ConversationIntelligencePage — Análise de interações e engajamento.
 * Rota: /comercial/conversation-intelligence
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConversationIntelligence, CHANNEL_LABELS } from "@/hooks/useConversationIntelligence";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  ArrowLeft, MessageSquare, TrendingUp, TrendingDown, Users, Clock,
  AlertTriangle, Loader2, Activity, Minus, type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ConversationIntelligencePage() {
  const navigate = useNavigate();
  const { insights, isLoading } = useConversationIntelligence();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/negocios")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Conversation Intelligence
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-sm text-muted-foreground">Análise de interações, engajamento e padrões de comunicação</p>
        </div>
      </div>

      {insights && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Interações (90d)" value={insights.kpis.totalInteractions} icon={MessageSquare} />
            <KPI label="Esta Semana" value={insights.kpis.interactionsThisWeek} icon={Activity}
              sub={insights.kpis.weekOverWeekChange !== 0 ? `${insights.kpis.weekOverWeekChange > 0 ? "+" : ""}${insights.kpis.weekOverWeekChange}% vs anterior` : undefined}
              color={insights.kpis.weekOverWeekChange > 0 ? "text-green-600" : insights.kpis.weekOverWeekChange < 0 ? "text-red-600" : undefined} />
            <KPI label="Engagement Score" value={`${insights.kpis.engagementScore}/100`} icon={TrendingUp}
              color={insights.kpis.engagementScore >= 70 ? "text-green-600" : insights.kpis.engagementScore >= 40 ? "text-amber-600" : "text-red-600"} />
            <KPI label="Canal Principal" value={CHANNEL_LABELS[insights.kpis.mostActiveChannel] || insights.kpis.mostActiveChannel} icon={MessageSquare} color="text-primary" />
          </div>

          {/* Weekly trend chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tendência Semanal (12 semanas)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={insights.weeklyTrend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Interações" fill="#e2a93b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Channel breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Distribuição por Canal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.channelBreakdown.map((ch) => (
                    <div key={ch.channel} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{CHANNEL_LABELS[ch.channel] || ch.channel}</span>
                        <span className="text-muted-foreground">{ch.count} ({ch.pct}%)</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${ch.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Broker engagement */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Engajamento por Corretor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.brokerEngagement.map((b) => (
                    <div key={b.userId} className="flex items-center gap-2 text-sm">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium flex-1 truncate">{b.name}</span>
                      <span className="text-muted-foreground">{b.totalInteractions} total</span>
                      <Badge variant="outline" className="text-[10px]">{b.thisWeek} semana</Badge>
                      <Badge variant="outline" className="text-[10px]">{CHANNEL_LABELS[b.topChannel] || b.topChannel}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cold leads */}
          {insights.coldLeads.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Leads Frios — Sem Contato Recente ({insights.coldLeads.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {insights.coldLeads.slice(0, 10).map((l) => (
                    <div key={l.leadId} className="flex items-center gap-2 text-xs">
                      <Badge className={l.engagementLevel === "cold" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"} variant="secondary">
                        {l.daysSinceLastContact}d
                      </Badge>
                      <span className="font-medium">{l.leadName}</span>
                      <span className="text-muted-foreground">— {l.interactionCount} interação(ões)</span>
                      <span className="flex-1" />
                      {l.channels.map((ch) => (
                        <Badge key={ch} variant="outline" className="text-[9px]">{CHANNEL_LABELS[ch] || ch}</Badge>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function KPI({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: LucideIcon; color?: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color || "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold mt-1">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
