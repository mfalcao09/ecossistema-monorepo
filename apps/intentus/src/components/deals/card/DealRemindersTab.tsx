import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDealReminders, useAddReminder, useDeleteReminder } from "@/hooks/useDealCardFeatures";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Plus, Trash2 } from "lucide-react";

export function DealRemindersTab({ dealId }: { dealId: string }) {
  const { data: reminders } = useDealReminders(dealId);
  const addReminder = useAddReminder();
  const deleteReminder = useDeleteReminder();
  const [message, setMessage] = useState("");
  const [remindAt, setRemindAt] = useState("");

  const handleAdd = () => {
    if (!remindAt || !message.trim()) return;
    addReminder.mutate({ dealId, remindAt: new Date(remindAt).toISOString(), message: message.trim() });
    setMessage("");
    setRemindAt("");
  };

  const now = new Date();

  return (
    <div className="space-y-4">
      <ScrollArea className="max-h-[40vh]">
        {!reminders || reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">Nenhum lembrete cadastrado.</p>
        ) : (
          <div className="space-y-2 pr-3">
            {reminders.map((r: any) => {
              const isPast = new Date(r.remind_at) <= now;
              return (
                <div key={r.id} className={`flex items-start gap-3 rounded-lg border p-3 ${isPast ? "border-destructive/40 bg-destructive/5" : ""}`}>
                  <Bell className={`h-4 w-4 mt-0.5 shrink-0 ${isPast ? "text-destructive" : "text-muted-foreground"}`} />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">{r.message}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(r.remind_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {isPast && <Badge variant="destructive" className="text-xs py-0">Vencido</Badge>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => deleteReminder.mutate({ id: r.id, dealId })}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="space-y-2 border-t pt-3">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Descrição do lembrete..."
          className="h-8 text-sm"
        />
        <div className="flex gap-2">
          <Input
            type="datetime-local"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
            className="h-8 text-sm flex-1"
          />
          <Button size="sm" variant="outline" onClick={handleAdd} disabled={!message.trim() || !remindAt || addReminder.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>
      </div>
    </div>
  );
}
