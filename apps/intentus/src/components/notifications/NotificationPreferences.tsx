import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Mail,
  Smartphone,
  FileText,
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  Brain,
  Settings2,
  Loader2,
  Moon,
} from "lucide-react";
import {
  useNotificationPreferences,
  useUpdatePreference,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  FREQUENCY_LABELS,
  type NotificationPreference,
} from "@/hooks/useNotifications";
import { useNotificationPreferences as useNotifPrefsWithUpsert } from "@/hooks/useNotificationPreferences";

// ── Ícone por categoria ──────────────────────────────────

const CategoryIcon = ({ category }: { category: string }) => {
  const iconClass = "h-5 w-5";
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

// ── Linha de preferência ─────────────────────────────────

function PreferenceRow({ pref }: { pref: NotificationPreference }) {
  const updatePref = useUpdatePreference();

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow">
      {/* Ícone + Nome */}
      <div
        className={`p-2 rounded-lg shrink-0 ${
          CATEGORY_COLORS[pref.category] ?? CATEGORY_COLORS.sistema
        }`}
      >
        <CategoryIcon category={pref.category} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {CATEGORY_LABELS[pref.category] ?? pref.category}
          </span>
          {pref.role && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {pref.role}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {getCategoryDescription(pref.category)}
        </p>
      </div>

      {/* Toggles e Frequência */}
      <div className="flex items-center gap-6 shrink-0">
        {/* In-app */}
        <div className="flex flex-col items-center gap-1">
          <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
          <Switch
            checked={pref.in_app_enabled}
            onCheckedChange={(checked) =>
              updatePref.mutate({ id: pref.id, in_app_enabled: checked })
            }
            disabled={updatePref.isPending}
          />
          <span className="text-[10px] text-muted-foreground">App</span>
        </div>

        {/* Email */}
        <div className="flex flex-col items-center gap-1">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          <Switch
            checked={pref.email_enabled}
            onCheckedChange={(checked) =>
              updatePref.mutate({ id: pref.id, email_enabled: checked })
            }
            disabled={updatePref.isPending}
          />
          <span className="text-[10px] text-muted-foreground">Email</span>
        </div>

        {/* Frequência */}
        <div className="flex flex-col items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <Select
            value={pref.frequency}
            onValueChange={(value) =>
              updatePref.mutate({
                id: pref.id,
                frequency: value as "immediate" | "daily" | "weekly",
              })
            }
            disabled={updatePref.isPending}
          >
            <SelectTrigger className="h-7 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">
                {FREQUENCY_LABELS.immediate}
              </SelectItem>
              <SelectItem value="daily">
                {FREQUENCY_LABELS.daily}
              </SelectItem>
              <SelectItem value="weekly">
                {FREQUENCY_LABELS.weekly}
              </SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground">Frequência</span>
        </div>
      </div>
    </div>
  );
}

// ── Descrição por categoria ──────────────────────────────

function getCategoryDescription(category: string): string {
  switch (category) {
    case "sistema":
      return "Atualizações do sistema, manutenções e avisos gerais";
    case "contrato":
      return "Novos contratos, alterações de status e atualizações";
    case "cobranca":
      return "Parcelas em atraso, pagamentos recebidos e cobranças";
    case "aprovacao":
      return "Solicitações de aprovação pendentes e respostas";
    case "vencimento":
      return "Contratos e parcelas próximos do vencimento";
    case "alerta":
      return "Alertas de risco, irregularidades e atenção necessária";
    case "ia":
      return "Resultados de análises IA, insights e sugestões";
    default:
      return "Notificações gerais";
  }
}

// ── Componente Principal ─────────────────────────────────

// ── Categorias padrão para seed automático ──────────────
const DEFAULT_CATEGORIES = [
  "sistema",
  "contrato",
  "cobranca",
  "aprovacao",
  "vencimento",
  "alerta",
  "ia",
];

export default function NotificationPreferences() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const { upsert } = useNotifPrefsWithUpsert();
  const seedingRef = useRef(false);

  // ── Seed automático: cria 7 categorias com defaults sensatos ──
  useEffect(() => {
    if (isLoading || seedingRef.current) return;
    if (preferences && preferences.length === 0) {
      seedingRef.current = true;
      const seedPromises = DEFAULT_CATEGORIES.map((category) =>
        upsert.mutateAsync({
          category,
          email_enabled: false,
          in_app_enabled: true,
          frequency: "immediate",
        })
      );
      Promise.allSettled(seedPromises).then(() => {
        seedingRef.current = false;
      });
    }
  }, [isLoading, preferences]);

  const isSeeding = preferences?.length === 0 && !isLoading;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-5 w-5 text-[#e2a93b]" />
          Preferências de Notificação
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure como e quando deseja receber cada tipo de notificação.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading || isSeeding ? (
          <div className="space-y-3">
            {isSeeding && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando preferências padrão...
              </div>
            )}
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !preferences || preferences.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma preferência configurada.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              As preferências serão criadas automaticamente pelo sistema.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Cabeçalho da tabela */}
            <div className="flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground">
              <div className="flex-1">Categoria</div>
              <div className="flex items-center gap-6 shrink-0">
                <div className="w-[52px] text-center">App</div>
                <div className="w-[52px] text-center">Email</div>
                <div className="w-[100px] text-center">Frequência</div>
              </div>
            </div>

            {/* Linhas */}
            {preferences.map((pref) => (
              <PreferenceRow key={pref.id} pref={pref} />
            ))}
          </div>
        )}

        {/* ── Quiet Hours ─────────────────────────────── */}
        {preferences && preferences.length > 0 && (
          <QuietHoursSection preferences={preferences} />
        )}
      </CardContent>
    </Card>
  );
}

// ── Quiet Hours Section ──────────────────────────────────

function QuietHoursSection({ preferences }: { preferences: NotificationPreference[] }) {
  const updatePref = useUpdatePreference();

  // Use first preference as representative for quiet hours (shared setting)
  const representative = preferences[0];
  const [enabled, setEnabled] = useState(representative?.quiet_hours_enabled ?? false);
  const [start, setStart] = useState(representative?.quiet_hours_start ?? "22:00");
  const [end, setEnd] = useState(representative?.quiet_hours_end ?? "07:00");

  // Sync state when representative changes
  useEffect(() => {
    if (representative) {
      setEnabled(representative.quiet_hours_enabled ?? false);
      setStart(representative.quiet_hours_start ?? "22:00");
      setEnd(representative.quiet_hours_end ?? "07:00");
    }
  }, [representative]);

  const saveQuietHours = (newEnabled: boolean, newStart: string, newEnd: string) => {
    // Update all preferences with the same quiet hours
    for (const pref of preferences) {
      updatePref.mutate({
        id: pref.id,
        quiet_hours_enabled: newEnabled,
        quiet_hours_start: newStart,
        quiet_hours_end: newEnd,
      });
    }
  };

  return (
    <div className="mt-6 pt-6 border-t">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
          <Moon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-medium text-sm">Horário Silencioso</span>
            <Switch
              checked={enabled}
              onCheckedChange={(checked) => {
                setEnabled(checked);
                saveQuietHours(checked, start, end);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Notificações não-críticas serão retidas durante este período. Notificações <strong>críticas</strong> sempre passam.
          </p>
        </div>
      </div>

      {enabled && (
        <div className="flex items-center gap-4 ml-12 mb-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="quiet-start" className="text-xs text-muted-foreground whitespace-nowrap">
              Início
            </Label>
            <Input
              id="quiet-start"
              type="time"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                saveQuietHours(enabled, e.target.value, end);
              }}
              className="h-8 w-[100px] text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground">até</span>
          <div className="flex items-center gap-2">
            <Label htmlFor="quiet-end" className="text-xs text-muted-foreground whitespace-nowrap">
              Fim
            </Label>
            <Input
              id="quiet-end"
              type="time"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                saveQuietHours(enabled, start, e.target.value);
              }}
              className="h-8 w-[100px] text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground">(Fuso: Brasília)</span>
        </div>
      )}
    </div>
  );
}
