import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserPlus, FileText, AlertTriangle, Headset, Wrench, Lock } from "lucide-react";

const CATEGORIES = [
  { key: "contratos", label: "Contratos" },
  { key: "financeiro", label: "Financeiro" },
  { key: "manutencao", label: "Manutenção" },
  { key: "leads", label: "Leads" },
  { key: "atendimento", label: "Atendimento" },
  { key: "comercial", label: "Comercial" },
  { key: "juridico", label: "Jurídico" },
];

const FREQUENCIES = [
  { value: "immediate", label: "Imediato" },
  { value: "daily_digest", label: "Resumo Diário" },
  { value: "weekly_digest", label: "Resumo Semanal" },
];

const SYSTEM_TRIGGERS = [
  {
    name: "Novo Lead",
    category: "Leads",
    trigger: "Ao cadastrar um lead no sistema",
    recipients: "admin, gerente, corretor",
    icon: UserPlus,
    color: "text-cyan-600",
  },
  {
    name: "Contrato Ativado",
    category: "Contratos",
    trigger: "Ao mudar status do contrato para 'ativo'",
    recipients: "admin, gerente, financeiro",
    icon: FileText,
    color: "text-purple-600",
  },
  {
    name: "Parcela Vencida",
    category: "Financeiro",
    trigger: "Parcela muda para status 'atrasado'",
    recipients: "admin, gerente, financeiro",
    icon: AlertTriangle,
    color: "text-red-600",
  },
  {
    name: "Novo Ticket",
    category: "Atendimento",
    trigger: "Ao criar um ticket de suporte",
    recipients: "admin, gerente",
    icon: Headset,
    color: "text-blue-600",
  },
  {
    name: "Manutenção Atualizada",
    category: "Manutenção",
    trigger: "Ao mudar o status de uma manutenção",
    recipients: "admin, gerente, manutenção",
    icon: Wrench,
    color: "text-amber-600",
  },
  {
    name: "Exclusividade Vencendo",
    category: "Comercial",
    trigger: "Contrato de exclusividade próximo do vencimento",
    recipients: "admin, gerente",
    icon: Lock,
    color: "text-orange-600",
  },
];

export function NotificationsTab() {
  const { preferences, isLoading, upsert } = useNotificationPreferences();

  const getPref = (category: string) => preferences.find((p) => p.category === category && !p.role);

  const handleToggle = (category: string, field: "email_enabled" | "in_app_enabled", value: boolean) => {
    const existing = getPref(category);
    upsert.mutate({
      category,
      email_enabled: field === "email_enabled" ? value : (existing?.email_enabled ?? true),
      in_app_enabled: field === "in_app_enabled" ? value : (existing?.in_app_enabled ?? true),
      frequency: existing?.frequency ?? "immediate",
    });
  };

  const handleFrequency = (category: string, frequency: string) => {
    const existing = getPref(category);
    upsert.mutate({
      category,
      email_enabled: existing?.email_enabled ?? true,
      in_app_enabled: existing?.in_app_enabled ?? true,
      frequency,
    });
  };

  return (
    <div className="space-y-8">
      {/* Preferências por Categoria */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Preferências de Notificação</h3>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-center w-[100px]">E-mail</TableHead>
                    <TableHead className="text-center w-[100px]">No App</TableHead>
                    <TableHead className="w-[180px]">Frequência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CATEGORIES.map((cat) => {
                    const pref = getPref(cat.key);
                    return (
                      <TableRow key={cat.key}>
                        <TableCell className="font-medium">{cat.label}</TableCell>
                        <TableCell className="text-center">
                          <Switch checked={pref?.email_enabled ?? true} onCheckedChange={(v) => handleToggle(cat.key, "email_enabled", v)} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={pref?.in_app_enabled ?? true} onCheckedChange={(v) => handleToggle(cat.key, "in_app_enabled", v)} />
                        </TableCell>
                        <TableCell>
                          <Select value={pref?.frequency ?? "immediate"} onValueChange={(v) => handleFrequency(cat.key, v)}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {FREQUENCIES.map((f) => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Gatilhos Automáticos */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Gatilhos Automáticos do Sistema</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Estes são os gatilhos automáticos configurados no banco de dados que disparam notificações em tempo real. São regras do sistema e não podem ser desativadas individualmente.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SYSTEM_TRIGGERS.map((trigger) => {
            const Icon = trigger.icon;
            return (
              <Card key={trigger.name}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                      <Icon className={`h-4 w-4 ${trigger.color}`} />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{trigger.name}</span>
                        <Badge variant="outline" className="text-[10px]">{trigger.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{trigger.trigger}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Destinatários:</span> {trigger.recipients}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
