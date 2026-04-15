import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateDealDates } from "@/hooks/useDealDates";
import { format, parse } from "date-fns";

interface DealDatesPanelProps {
  dealId: string;
  currentStartDate: string | null;
  currentDueDate: string | null;
  onBack: () => void;
  onClose: () => void;
}

export function DealDatesPanel({ dealId, currentStartDate, currentDueDate, onBack, onClose }: DealDatesPanelProps) {
  const [startEnabled, setStartEnabled] = useState(!!currentStartDate);
  const [dueEnabled, setDueEnabled] = useState(!!currentDueDate);
  const [startDate, setStartDate] = useState<Date | undefined>(currentStartDate ? new Date(currentStartDate) : undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(currentDueDate ? new Date(currentDueDate) : undefined);
  const [dueTime, setDueTime] = useState(() => {
    if (currentDueDate) {
      const d = new Date(currentDueDate);
      return format(d, "HH:mm");
    }
    return format(new Date(), "HH:mm");
  });
  const [reminder, setReminder] = useState("1_day");

  const updateDates = useUpdateDealDates();

  const handleSave = () => {
    let startVal: string | null = null;
    let dueVal: string | null = null;

    if (startEnabled && startDate) {
      startVal = startDate.toISOString();
    }
    if (dueEnabled && dueDate) {
      const [h, m] = dueTime.split(":").map(Number);
      const d = new Date(dueDate);
      d.setHours(h || 0, m || 0, 0, 0);
      dueVal = d.toISOString();
    }

    updateDates.mutate({ dealId, start_date: startVal, due_date: dueVal });
    onClose();
  };

  const handleRemove = () => {
    updateDates.mutate({ dealId, start_date: null, due_date: null });
    onClose();
  };

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onBack}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Button>
        <span className="text-sm font-semibold flex-1 text-center">Datas</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </Button>
      </div>

      <div className="px-2 py-2 space-y-3 overflow-y-auto">

        {/* Start date */}
        <div className="space-y-1">
          <label className="text-xs font-semibold">Data de início</label>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={startEnabled}
              onCheckedChange={(checked) => setStartEnabled(!!checked)}
              className="h-3.5 w-3.5"
            />
            <Input
              placeholder="D/M/AAAA"
              className="h-7 text-xs w-28"
              value={startEnabled && startDate ? format(startDate, "dd/MM/yyyy") : ""}
              onChange={(e) => {
                try {
                  const parsed = parse(e.target.value, "dd/MM/yyyy", new Date());
                  if (!isNaN(parsed.getTime())) {
                    setStartDate(parsed);
                    setStartEnabled(true);
                  }
                } catch {}
              }}
              disabled={!startEnabled}
            />
          </div>
        </div>

        {/* Due date */}
        <div className="space-y-1">
          <label className="text-xs font-semibold">Data de entrega</label>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={dueEnabled}
              onCheckedChange={(checked) => setDueEnabled(!!checked)}
              className="h-3.5 w-3.5"
            />
            <Input
              placeholder="D/M/AAAA"
              className="h-7 text-xs w-28"
              value={dueEnabled && dueDate ? format(dueDate, "dd/MM/yyyy") : ""}
              onChange={(e) => {
                try {
                  const parsed = parse(e.target.value, "dd/MM/yyyy", new Date());
                  if (!isNaN(parsed.getTime())) {
                    setDueDate(parsed);
                    setDueEnabled(true);
                  }
                } catch {}
              }}
              disabled={!dueEnabled}
            />
            <Input
              type="time"
              className="h-7 text-xs w-20"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              disabled={!dueEnabled}
            />
          </div>
        </div>

        {/* Reminder */}
        <div className="space-y-1">
          <label className="text-xs font-semibold">Definir lembrete</label>
          <Select value={reminder} onValueChange={setReminder}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">Nenhum</SelectItem>
              <SelectItem value="at_time" className="text-xs">No momento</SelectItem>
              <SelectItem value="5_min" className="text-xs">5 min antes</SelectItem>
              <SelectItem value="15_min" className="text-xs">15 min antes</SelectItem>
              <SelectItem value="1_hour" className="text-xs">1h antes</SelectItem>
              <SelectItem value="1_day" className="text-xs">1 dia antes</SelectItem>
              <SelectItem value="2_days" className="text-xs">2 dias antes</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Lembretes enviados a membros e seguidores deste cartão.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-1.5 pt-1">
          <Button className="w-full text-xs" size="sm" onClick={handleSave}>
            Salvar
          </Button>
          {(currentStartDate || currentDueDate) && (
            <Button variant="ghost" className="w-full text-xs" size="sm" onClick={handleRemove}>
              Remover
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
