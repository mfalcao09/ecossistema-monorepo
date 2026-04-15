import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  FileText,
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  Brain,
  Settings2,
  Search,
  BellOff,
  ArrowUpDown,
  Layers,
  X,
} from "lucide-react";
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllRead,
  useDeleteNotification,
  useSnoozeNotification,
  usePriorityCounts,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  SNOOZE_OPTIONS,
  getNotificationLink,
  formatRelativeTime,
  isSnoozed,
  type Notification,
  type NotificationPriority,
} from "@/hooks/useNotifications";

// ── Ícone por categoria ──────────────────────────────────

const CategoryIcon = ({ category }: { category: string }) => {
  const iconClass = "h-4 w-4";
  switch (category) {
    case "contrato":
      return <FileText className={iconClass} />;
    case "cobranca":
      return <DollarSign className={iconClass} />;
    case "aprovacao":
      return <CheckCircle className={iconClass} />;
    case "vencimento":
      return <Clock className={iconClass} />;
    case "alerta":
      return <AlertTriangle className={iconClass} />;
    case "ia":
      return <Brain className={iconClass} />;
    default:
      return <Settings2 className={iconClass} />;
  }
};

// ── Priority badge ───────────────────────────────────────

function PriorityBadge({ priority }: { priority: NotificationPriority | null }) {
  if (!priority || priority === "normal") return null;
  return (
    <span
      className={`text-[9px] px-1 py-0 rounded font-semibold uppercase tracking-wider ${
        PRIORITY_COLORS[priority] ?? ""
      }`}
    >
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

// ── Item de notificação ──────────────────────────────────

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onSnooze: (id: string, until: string) => void;
  onNavigate: (path: string) => void;
  onClose: () => void;
}

function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  onSnooze,
  onNavigate,
  onClose,
}: NotificationItemProps) {
  const link = getNotificationLink(notification);
  const snoozed = isSnoozed(notification);
  const isCritical = notification.priority === "critical";
  const isHigh = notification.priority === "high";

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
    if (link) {
      onNavigate(link);
      onClose();
    }
  };

  return (
    <div
      className={`flex items-start gap-3 p-3 border-b last:border-0 transition-colors cursor-pointer hover:bg-muted/50 ${
        snoozed
          ? "opacity-50 bg-muted/20"
          : !notification.read
          ? isCritical
            ? "bg-red-50/60 dark:bg-red-950/15 border-l-2 border-l-red-500"
            : isHigh
            ? "bg-orange-50/40 dark:bg-orange-950/10 border-l-2 border-l-orange-400"
            : "bg-blue-50/50 dark:bg-blue-950/10"
          : ""
      }`}
      onClick={handleClick}
    >
      {/* Ícone da categoria */}
      <div
        className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
          CATEGORY_COLORS[notification.category] ?? CATEGORY_COLORS.sistema
        }`}
      >
        <CategoryIcon category={notification.category} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p
              className={`text-sm leading-tight ${
                !notification.read ? "font-semibold" : "font-normal"
              }`}
            >
              {notification.title}
            </p>
            <PriorityBadge priority={notification.priority} />
          </div>
          {!notification.read && !snoozed && (
            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground">
            {formatRelativeTime(notification.created_at)}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1 py-0 ${
              CATEGORY_COLORS[notification.category] ?? ""
            }`}
          >
            {CATEGORY_LABELS[notification.category] ?? notification.category}
          </Badge>
          {snoozed && (
            <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
              <BellOff className="h-2.5 w-2.5" />
              Adiada
            </span>
          )}
          {notification.urgency_score != null && notification.urgency_score >= 80 && (
            <span className="text-[10px] text-red-600 font-medium">
              Urgência {notification.urgency_score}
            </span>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-col gap-1 shrink-0">
        {!notification.read && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
            className="p-1 rounded hover:bg-muted"
            title="Marcar como lida"
          >
            <Check className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
        {/* Snooze dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded hover:bg-muted"
              title="Adiar"
            >
              <BellOff className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            {SNOOZE_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={(e) => {
                  e.stopPropagation();
                  onSnooze(notification.id, opt.value);
                }}
              >
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          className="p-1 rounded hover:bg-red-100"
          title="Excluir"
        >
          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
        </button>
      </div>
    </div>
  );
}

// ── Filtro por categoria ─────────────────────────────────

function CategoryFilter({
  selected,
  onSelect,
  notifications,
}: {
  selected: string | null;
  onSelect: (cat: string | null) => void;
  notifications: Notification[];
}) {
  const categories = [...new Set(notifications.map((n) => n.category))];

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 px-4">
      <button
        onClick={() => onSelect(null)}
        className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap border transition-colors ${
          !selected
            ? "bg-[#e2a93b] text-white border-[#e2a93b]"
            : "bg-muted/50 border-transparent hover:border-muted-foreground/20"
        }`}
      >
        Todas
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat === selected ? null : cat)}
          className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap border transition-colors ${
            cat === selected
              ? "bg-[#e2a93b] text-white border-[#e2a93b]"
              : "bg-muted/50 border-transparent hover:border-muted-foreground/20"
          }`}
        >
          {CATEGORY_LABELS[cat] ?? cat}
        </button>
      ))}
    </div>
  );
}

// ── Priority summary bar ─────────────────────────────────

function PrioritySummary() {
  const { data: counts } = usePriorityCounts();
  if (!counts) return null;
  const hasAny = counts.critical > 0 || counts.high > 0;
  if (!hasAny) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/30 border-b text-[10px]">
      {counts.critical > 0 && (
        <span className="flex items-center gap-1 text-red-700 font-semibold">
          🚨 {counts.critical} crítica{counts.critical !== 1 ? "s" : ""}
        </span>
      )}
      {counts.high > 0 && (
        <span className="flex items-center gap-1 text-orange-700 font-medium">
          ⚠️ {counts.high} alta{counts.high !== 1 ? "s" : ""}
        </span>
      )}
      {counts.snoozed > 0 && (
        <span className="flex items-center gap-1 text-muted-foreground ml-auto">
          <BellOff className="h-2.5 w-2.5" /> {counts.snoozed} adiada{counts.snoozed !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

// ── Componente Principal ─────────────────────────────────

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showGrouped, setShowGrouped] = useState(false);
  const navigate = useNavigate();

  const { data: notifications = [], isLoading } = useNotifications(100, {
    hideSnoozed: false, // Show snoozed but dimmed
    sortByPriority: true,
    grouped: showGrouped,
  });
  const { data: unreadCount = 0 } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();
  const deleteNotification = useDeleteNotification();
  const snoozeNotification = useSnoozeNotification();

  // Apply filters
  const filteredNotifications = notifications.filter((n) => {
    if (categoryFilter && n.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSnooze = useCallback(
    (id: string, until: string) => {
      snoozeNotification.mutate({ id, until });
    },
    [snoozeNotification]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificações"
        >
          <Bell className={`h-5 w-5 transition-transform ${unreadCount > 0 ? "animate-[wiggle_1s_ease-in-out]" : ""}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[420px] p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#e2a93b]" />
            <span className="font-semibold text-sm">Notificações</span>
            {unreadCount > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700"
              >
                {unreadCount} nova{unreadCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Toggle grouping */}
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${showGrouped ? "text-[#e2a93b]" : ""}`}
              onClick={() => setShowGrouped(!showGrouped)}
              title={showGrouped ? "Desagrupar" : "Agrupar similares"}
            >
              <Layers className="h-3.5 w-3.5" />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Ler todas
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setOpen(false);
                navigate("/contratos/configuracoes");
              }}
              title="Preferências"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Priority summary */}
        <PrioritySummary />

        {/* Search bar */}
        <div className="px-3 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar notificações..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 text-xs pl-8 pr-7"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Filtros */}
        {notifications.length > 0 && (
          <div className="py-2 border-b">
            <CategoryFilter
              selected={categoryFilter}
              onSelect={setCategoryFilter}
              notifications={notifications}
            />
          </div>
        )}

        {/* Lista */}
        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#e2a93b]" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Bell className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "Nenhuma notificação encontrada."
                  : categoryFilter
                  ? "Nenhuma notificação nesta categoria."
                  : "Nenhuma notificação ainda."}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Você receberá alertas de contratos, vencimentos e aprovações aqui.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={(id) => markRead.mutate(id)}
                onDelete={(id) => deleteNotification.mutate(id)}
                onSnooze={handleSnooze}
                onNavigate={(path) => navigate(path)}
                onClose={() => setOpen(false)}
              />
            ))
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {filteredNotifications.length} de {notifications.length} notificações
              {" · "}
              {unreadCount} não lida{unreadCount !== 1 ? "s" : ""}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <ArrowUpDown className="h-2.5 w-2.5" />
              Por prioridade
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
