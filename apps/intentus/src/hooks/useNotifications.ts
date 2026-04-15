import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { toast } from "sonner";

// ── Tipos ────────────────────────────────────────────────

export type NotificationCategory =
  | "sistema"
  | "contrato"
  | "cobranca"
  | "aprovacao"
  | "vencimento"
  | "alerta"
  | "ia";

export type NotificationPriority = "critical" | "high" | "normal" | "low";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  reference_type: string | null;
  reference_id: string | null;
  read: boolean;
  created_at: string;
  tenant_id: string;
  // Smart Notifications v2 fields
  priority: NotificationPriority | null;
  urgency_score: number | null;
  group_key: string | null;
  snoozed_until: string | null;
}

/** Notification with grouping metadata (collapsed view) */
export interface GroupedNotification extends Notification {
  is_grouped: boolean;
  group_count: number;
}

export interface NotificationPreference {
  id: string;
  tenant_id: string;
  role: string | null;
  category: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  frequency: "immediate" | "daily" | "weekly";
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdatePreferenceInput {
  id: string;
  email_enabled?: boolean;
  in_app_enabled?: boolean;
  frequency?: "immediate" | "daily" | "weekly";
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

export interface SnoozeInput {
  id: string;
  /** ISO timestamp or duration shorthand: "1h", "4h", "1d", "1w" */
  until: string;
}

// ── Constantes ───────────────────────────────────────────

export const CATEGORY_LABELS: Record<string, string> = {
  sistema: "Sistema",
  contrato: "Contratos",
  cobranca: "Cobrança",
  aprovacao: "Aprovações",
  vencimento: "Vencimentos",
  alerta: "Alertas",
  ia: "Inteligência Artificial",
};

export const CATEGORY_COLORS: Record<string, string> = {
  sistema: "bg-gray-100 text-gray-700 border-gray-200",
  contrato: "bg-blue-100 text-blue-700 border-blue-200",
  cobranca: "bg-red-100 text-red-700 border-red-200",
  aprovacao: "bg-purple-100 text-purple-700 border-purple-200",
  vencimento: "bg-orange-100 text-orange-700 border-orange-200",
  alerta: "bg-yellow-100 text-yellow-700 border-yellow-200",
  ia: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export const CATEGORY_ICONS: Record<string, string> = {
  sistema: "Settings",
  contrato: "FileText",
  cobranca: "DollarSign",
  aprovacao: "CheckCircle",
  vencimento: "Clock",
  alerta: "AlertTriangle",
  ia: "Brain",
};

export const FREQUENCY_LABELS: Record<string, string> = {
  immediate: "Imediato",
  daily: "Diário",
  weekly: "Semanal",
};

// ── Constantes v2 (Priority / Snooze) ───────────────────

export const PRIORITY_ORDER: Record<NotificationPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  critical: "Crítico",
  high: "Alto",
  normal: "Normal",
  low: "Baixo",
};

export const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  normal: "bg-blue-100 text-blue-800 border-blue-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

export const SNOOZE_OPTIONS = [
  { label: "1 hora", value: "1h" },
  { label: "4 horas", value: "4h" },
  { label: "Amanhã", value: "1d" },
  { label: "1 semana", value: "1w" },
] as const;

// ── Helpers v2 ──────────────────────────────────────────

function normalizePriority(p: string | null | undefined): NotificationPriority {
  if (p === "critical" || p === "high" || p === "normal" || p === "low") return p;
  return "normal";
}

/** Parse snooze shorthand ("1h", "4h", "1d", "1w") into ISO timestamp */
function parseSnoozeDuration(value: string): string {
  const now = new Date();
  const match = value.match(/^(\d+)([hdw])$/);
  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === "h") now.setHours(now.getHours() + amount);
    else if (unit === "d") now.setDate(now.getDate() + amount);
    else if (unit === "w") now.setDate(now.getDate() + amount * 7);
    return now.toISOString();
  }
  // Assume it's already an ISO date
  return value;
}

/** Check if a notification is currently snoozed */
export function isSnoozed(notification: Notification): boolean {
  if (!notification.snoozed_until) return false;
  return new Date(notification.snoozed_until) > new Date();
}

/** Sort notifications by priority (critical first), then urgency_score desc, then created_at desc */
export function sortByPriorityAndUrgency(notifications: Notification[]): Notification[] {
  return [...notifications].sort((a, b) => {
    const pa = PRIORITY_ORDER[normalizePriority(a.priority)];
    const pb = PRIORITY_ORDER[normalizePriority(b.priority)];
    if (pa !== pb) return pa - pb;
    const ua = a.urgency_score ?? 0;
    const ub = b.urgency_score ?? 0;
    if (ua !== ub) return ub - ua;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/** Collapse notifications by group_key — keeps highest urgency as representative */
export function collapseByGroupKey(notifications: Notification[]): GroupedNotification[] {
  const groups = new Map<string, Notification[]>();
  const ungrouped: Notification[] = [];

  for (const n of notifications) {
    if (n.group_key) {
      const existing = groups.get(n.group_key);
      if (existing) existing.push(n);
      else groups.set(n.group_key, [n]);
    } else {
      ungrouped.push(n);
    }
  }

  const result: GroupedNotification[] = [];

  for (const [, items] of groups) {
    // Sort within group — highest urgency first
    items.sort((a, b) => (b.urgency_score ?? 0) - (a.urgency_score ?? 0));
    const representative = items[0];
    result.push({
      ...representative,
      title: items.length > 1 ? `${representative.title} (+${items.length - 1})` : representative.title,
      is_grouped: items.length > 1,
      group_count: items.length,
    });
  }

  for (const n of ungrouped) {
    result.push({ ...n, is_grouped: false, group_count: 1 });
  }

  return result;
}

// ── Hook: Lista de Notificações ──────────────────────────

export function useNotifications(limit = 50, options?: {
  /** If true, snoozed notifications are hidden (default: true) */
  hideSnoozed?: boolean;
  /** If true, sort by priority/urgency instead of created_at (default: true) */
  sortByPriority?: boolean;
  /** If true, collapse notifications with same group_key (default: false) */
  grouped?: boolean;
}) {
  const qc = useQueryClient();
  const hideSnoozed = options?.hideSnoozed ?? true;
  const sortByPri = options?.sortByPriority ?? true;
  const grouped = options?.grouped ?? false;

  // Realtime listener
  useEffect(() => {
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["notifications"] });
          qc.invalidateQueries({ queryKey: ["notifications-unread"] });
          // Toast visual para notificação nova — with priority-aware styling
          const newNotif = payload.new as Record<string, unknown> | undefined;
          if (newNotif?.title) {
            const priority = normalizePriority(newNotif.priority as string | null);
            const icon = priority === "critical" ? "🚨" : priority === "high" ? "⚠️" : "";
            toast(`${icon} ${newNotif.title as string}`.trim(), {
              description: (newNotif.message as string) || undefined,
              duration: priority === "critical" ? 10000 : priority === "high" ? 7000 : 5000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const query = useQuery({
    queryKey: ["notifications", limit],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as Notification[];
    },
  });

  // Post-process: filter snoozed, sort by priority, collapse groups
  const processed = useMemo(() => {
    let items = query.data ?? [];

    // Filter out snoozed
    if (hideSnoozed) {
      items = items.filter((n) => !isSnoozed(n));
    }

    // Sort by priority + urgency
    if (sortByPri) {
      items = sortByPriorityAndUrgency(items);
    }

    // Collapse groups
    if (grouped) {
      return collapseByGroupKey(items) as GroupedNotification[];
    }

    return items;
  }, [query.data, hideSnoozed, sortByPri, grouped]);

  return {
    ...query,
    data: processed,
  };
}

// ── Hook: Contagem de não lidas ──────────────────────────

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications-unread"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 15_000,
  });
}

// ── Hook: Marcar uma como lida ───────────────────────────

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });
}

// ── Hook: Marcar todas como lidas ────────────────────────

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true } as any)
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });
}

// ── Hook: Excluir notificação ────────────────────────────

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("notifications")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });
}

// ── Hook: Snooze notificação ────────────────────────────

export function useSnoozeNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SnoozeInput) => {
      const snoozedUntil = parseSnoozeDuration(input.until);
      const { error } = await supabase
        .from("notifications")
        .update({ snoozed_until: snoozedUntil } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
      toast.success("Notificação adiada");
    },
  });
}

// ── Hook: Unsnooze (cancelar snooze) ────────────────────

export function useUnsnoozeNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ snoozed_until: null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });
}

// ── Hook: Contagem por prioridade ───────────────────────

export function usePriorityCounts() {
  return useQuery({
    queryKey: ["notifications-priority-counts"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { critical: 0, high: 0, normal: 0, low: 0, snoozed: 0 };

      const { data, error } = await supabase
        .from("notifications")
        .select("priority, snoozed_until")
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;

      const now = new Date();
      const counts = { critical: 0, high: 0, normal: 0, low: 0, snoozed: 0 };
      for (const row of data ?? []) {
        const r = row as { priority: string | null; snoozed_until: string | null };
        if (r.snoozed_until && new Date(r.snoozed_until) > now) {
          counts.snoozed++;
          continue;
        }
        const p = normalizePriority(r.priority);
        counts[p]++;
      }
      return counts;
    },
    refetchInterval: 30_000,
  });
}

// ── Hook: Preferências de notificação ────────────────────

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("notification_preferences")
        .select("*")
        .order("category");
      if (error) throw error;
      return (data ?? []) as NotificationPreference[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Hook: Atualizar preferência ──────────────────────────

export function useUpdatePreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePreferenceInput) => {
      const { id, ...updates } = input;
      const { error } = await (supabase as any)
        .from("notification_preferences")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
  });
}

// ── Função utilitária: criar notificação ─────────────────

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  category?: string;
  referenceType?: string;
  referenceId?: string;
  // Smart Notifications v2 fields
  priority?: NotificationPriority;
  urgencyScore?: number;
  groupKey?: string;
}) {
  const tenant_id = await getAuthTenantId();
  await supabase.from("notifications").insert({
    user_id: params.userId,
    title: params.title,
    message: params.message,
    category: params.category || "sistema",
    reference_type: params.referenceType || null,
    reference_id: params.referenceId || null,
    tenant_id,
    priority: params.priority || "normal",
    urgency_score: params.urgencyScore ?? 50,
    group_key: params.groupKey || null,
  } as any);
}

// ── Helpers para navegação por referência ─────────────────

export function getNotificationLink(notification: Notification): string | null {
  if (!notification.reference_type || !notification.reference_id) return null;

  switch (notification.reference_type) {
    case "contract":
      return `/contratos/${notification.reference_id}`;
    case "installment":
      return `/contratos/cobranca`;
    case "approval":
      return `/contratos/configuracoes`;
    case "template":
      return `/contratos/configuracoes`;
    case "renewal":
      return `/contratos/${notification.reference_id}`;
    case "pricing":
      return `/contratos/${notification.reference_id}`;
    case "insight":
      return `/contratos/${notification.reference_id}`;
    case "draft":
      return `/contratos/${notification.reference_id}`;
    case "compliance":
      return `/contratos/compliance`;
    case "obligation":
      return `/contratos/${notification.reference_id}`;
    case "deal":
      return `/comercial/deals`;
    default:
      return null;
  }
}

/**
 * Formata tempo relativo (ex: "há 2 min", "há 3h", "há 1 dia")
 */
export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
  return date.toLocaleDateString("pt-BR");
}
