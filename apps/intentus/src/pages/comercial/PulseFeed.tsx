/**
 * PulseFeed.tsx — Feed Central de Ações CRM (equivalente ao Pipedrive Pulse)
 * Sessão 76 — Pair programming Claudinho + Buchecha (MiniMax M2.5)
 *
 * Timeline unificada com eventos de deals, leads, interações, automações,
 * comissões e follow-ups. IA prioriza por urgência e sugere ações.
 */
import { useState, useMemo, useCallback } from "react";
import {
  usePulseFeed,
  usePulseInsights,
  useMarkPulseRead,
  useBackfillPulse,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_ICONS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  type PulseEvent,
  type PulseEventType,
  type PulseEntityType,
  type PulsePriority,
  type PulseFeedFilters,
  type SuggestedAction,
} from "@/hooks/usePulseFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  AtSign,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  FileCheck,
  Filter,
  Lightbulb,
  Loader2,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trophy,
  UserCheck,
  UserPlus,
  XCircle,
  Zap,
  Bell,
  BellOff,
  Clock,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Icon resolver ────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  Plus, ArrowRight, Trophy, XCircle, MessageSquare, AtSign, Phone,
  UserPlus, UserCheck, Zap, DollarSign, Eye, Send, FileCheck,
  CheckCircle, AlertTriangle, Calendar,
};

function EventIcon({ eventType }: { eventType: PulseEventType }) {
  const iconName = EVENT_TYPE_ICONS[eventType] ?? "Activity";
  const Icon = ICON_MAP[iconName] ?? Activity;
  return <Icon className="h-4 w-4" />;
}

// ─── Priority badge ──────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: PulsePriority }) {
  const colors = PRIORITY_COLORS[priority];
  return (
    <Badge variant="outline" className={`text-xs ${colors}`}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────
function KpiCard({
  label, value, icon: Icon, color,
}: {
  label: string; value: number; icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg p-2 ${color}`}>
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

// ─── Suggested Action Card ───────────────────────────────────────
function ActionCard({ action }: { action: SuggestedAction }) {
  const prioColors: Record<string, string> = {
    alta: "border-red-300 bg-red-50 dark:bg-red-950/20",
    media: "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20",
    baixa: "border-green-300 bg-green-50 dark:bg-green-950/20",
  };
  return (
    <div className={`rounded-md border p-3 ${prioColors[action.priority] ?? ""}`}>
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{action.action}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{action.reason}</p>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {action.priority}
        </Badge>
      </div>
    </div>
  );
}

// ─── Event Card ──────────────────────────────────────────────────
function EventCard({
  event, onMarkRead, isSelected, onSelect,
}: {
  event: PulseEvent;
  onMarkRead: (id: string) => void;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
}) {
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(event.created_at), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return "";
    }
  }, [event.created_at]);

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        event.is_read
          ? "bg-background opacity-70"
          : "bg-card border-l-4 border-l-blue-400"
      }`}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={(checked) => onSelect(event.id, checked === true)}
        className="mt-1"
      />

      <div className={`rounded-full p-2 shrink-0 ${
        event.priority === "critical"
          ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
          : event.priority === "high"
          ? "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
          : "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
      }`}>
        <EventIcon eventType={event.event_type} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">
            {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
          </span>
          <PriorityBadge priority={event.priority} />
          {event.urgency_score >= 80 && (
            <Badge variant="secondary" className="text-[10px]">
              ⚡ {event.urgency_score}
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground mt-0.5">
          <span className="font-medium">{event.actor_name || "Sistema"}</span>
          {event.entity_name && (
            <>
              {" — "}
              <span className="text-foreground">{event.entity_name}</span>
            </>
          )}
        </p>

        {event.event_label && (
          <p className="text-xs text-muted-foreground mt-1">{event.event_label}</p>
        )}

        <div className="flex items-center gap-2 mt-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
      </div>

      {!event.is_read && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => onMarkRead(event.id)}
          title="Marcar como lido"
        >
          <Eye className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ═══ Main Page ═══════════════════════════════════════════════════
export default function PulseFeed() {
  const navigate = useNavigate();

  // ── Filters ──────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<string>("all");
  const [eventType, setEventType] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const pageSize = 20;

  const filters = useMemo<PulseFeedFilters>(() => {
    const f: PulseFeedFilters = { page, page_size: pageSize };
    if (entityType !== "all") f.entity_type = entityType as PulseEntityType;
    if (eventType !== "all") f.event_type = eventType as PulseEventType;
    if (priority !== "all") f.priority = priority as PulsePriority;
    if (unreadOnly) f.unread_only = true;
    return f;
  }, [page, entityType, eventType, priority, unreadOnly]);

  // ── Data hooks ───────────────────────────────────────────────
  const { data: feed, isLoading, isError } = usePulseFeed(filters);
  const { data: insights, isLoading: insightsLoading } = usePulseInsights();
  const markRead = useMarkPulseRead();
  const backfill = useBackfillPulse();

  // ── Selection ────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showMarkAllDialog, setShowMarkAllDialog] = useState(false);

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const handleMarkRead = useCallback(
    (id: string) => markRead.mutate({ event_ids: [id] }),
    [markRead]
  );

  const handleMarkSelectedRead = useCallback(() => {
    if (selected.size === 0) return;
    markRead.mutate({ event_ids: Array.from(selected) });
    setSelected(new Set());
  }, [markRead, selected]);

  const handleMarkAllRead = useCallback(() => {
    markRead.mutate({ mark_all: true });
    setShowMarkAllDialog(false);
    setSelected(new Set());
  }, [markRead]);

  const handleBackfill = useCallback(() => {
    backfill.mutate();
  }, [backfill]);

  // ── Pagination ───────────────────────────────────────────────
  const totalPages = feed ? Math.ceil(feed.total / pageSize) : 1;

  const events = feed?.events ?? [];

  // ── Reset page on filter change ──────────────────────────────
  const changeFilter = useCallback(
    (setter: (v: string) => void) => (value: string) => {
      setter(value);
      setPage(1);
      setSelected(new Set());
    },
    []
  );

  // ═══ Render ════════════════════════════════════════════════════
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/comercial/negocios")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-amber-500" />
              Pulse
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" /> IA
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Feed central de ações do CRM — priorizado por IA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkSelectedRead}
              disabled={markRead.isPending}
            >
              <Eye className="h-4 w-4 mr-1" />
              Marcar {selected.size} como lidas
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMarkAllDialog(true)}
            disabled={markRead.isPending}
          >
            <BellOff className="h-4 w-4 mr-1" />
            Marcar tudo como lido
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackfill}
            disabled={backfill.isPending}
          >
            {backfill.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Importar histórico
          </Button>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Atividades 24h"
          value={insights?.stats.total_24h ?? 0}
          icon={TrendingUp}
          color="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
        />
        <KpiCard
          label="Atividades 7d"
          value={insights?.stats.total_7d ?? 0}
          icon={Activity}
          color="bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"
        />
        <KpiCard
          label="Não lidas"
          value={insights?.stats.unread ?? 0}
          icon={Bell}
          color="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
        />
        <KpiCard
          label="Críticas não lidas"
          value={insights?.stats.critical_unread ?? 0}
          icon={AlertTriangle}
          color="bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
        />
      </div>

      {/* ── IA Insights ─────────────────────────────────────── */}
      {insights && (insights.summary || insights.suggested_actions.length > 0) && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Insights IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.summary && (
              <p className="text-sm text-muted-foreground">{insights.summary}</p>
            )}
            {insights.suggested_actions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Ações sugeridas
                </p>
                {insights.suggested_actions.map((a, i) => (
                  <ActionCard key={`action-${i}`} action={a} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />

        <Select value={entityType} onValueChange={changeFilter(setEntityType)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Entidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas entidades</SelectItem>
            <SelectItem value="deal">Negócios</SelectItem>
            <SelectItem value="lead">Leads</SelectItem>
            <SelectItem value="person">Pessoas</SelectItem>
            <SelectItem value="contract">Contratos</SelectItem>
            <SelectItem value="automation">Automações</SelectItem>
          </SelectContent>
        </Select>

        <Select value={eventType} onValueChange={changeFilter(setEventType)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Tipo de evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="deal_created">Negócio criado</SelectItem>
            <SelectItem value="deal_stage_changed">Estágio alterado</SelectItem>
            <SelectItem value="deal_won">Negócio ganho</SelectItem>
            <SelectItem value="deal_lost">Negócio perdido</SelectItem>
            <SelectItem value="comment_added">Comentário</SelectItem>
            <SelectItem value="mention">Menção</SelectItem>
            <SelectItem value="interaction_logged">Interação</SelectItem>
            <SelectItem value="lead_created">Lead criado</SelectItem>
            <SelectItem value="lead_converted">Lead convertido</SelectItem>
            <SelectItem value="automation_executed">Automação</SelectItem>
            <SelectItem value="commission_split">Comissão</SelectItem>
            <SelectItem value="follow_started">Seguindo</SelectItem>
            <SelectItem value="proposal_sent">Proposta</SelectItem>
            <SelectItem value="document_signed">Documento assinado</SelectItem>
            <SelectItem value="payment_received">Pagamento recebido</SelectItem>
            <SelectItem value="payment_overdue">Pagamento atrasado</SelectItem>
            <SelectItem value="visit_scheduled">Visita agendada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={changeFilter(setPriority)}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="high">Alto</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Baixo</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={unreadOnly ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            setUnreadOnly(!unreadOnly);
            setPage(1);
          }}
        >
          {unreadOnly ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
          {unreadOnly ? "Apenas não lidas" : "Todas"}
        </Button>

        {(entityType !== "all" || eventType !== "all" || priority !== "all" || unreadOnly) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setEntityType("all");
              setEventType("all");
              setPriority("all");
              setUnreadOnly(false);
              setPage(1);
            }}
          >
            Limpar filtros
          </Button>
        )}

        {feed && (
          <span className="text-xs text-muted-foreground ml-auto">
            {feed.total} {feed.total === 1 ? "evento" : "eventos"}
          </span>
        )}
      </div>

      {/* ── Feed Timeline ───────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Carregando feed...</span>
        </div>
      ) : isError ? (
        <Card className="border-red-200">
          <CardContent className="flex items-center gap-3 p-6">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-600">
              Erro ao carregar o feed. Tente novamente em alguns instantes.
            </p>
          </CardContent>
        </Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="font-medium text-muted-foreground">Nenhum evento encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {unreadOnly
                ? "Todas as atividades foram lidas."
                : "Use o botão \"Importar histórico\" para popular o feed com dados existentes."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onMarkRead={handleMarkRead}
              isSelected={selected.has(event.id)}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => { setPage((p) => p - 1); setSelected(new Set()); }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => { setPage((p) => p + 1); setSelected(new Set()); }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Mark All Dialog ─────────────────────────────────── */}
      <AlertDialog open={showMarkAllDialog} onOpenChange={setShowMarkAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar tudo como lido?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os eventos não lidos serão marcados como lidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkAllRead}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
