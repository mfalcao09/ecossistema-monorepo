import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export interface ObserverData {
  name: string;
  email: string;
  notify_on: string;
  receive_final: boolean;
}

export const EMPTY_OBSERVER: ObserverData = {
  name: "", email: "", notify_on: "completion", receive_final: true,
};

interface Props {
  observer: ObserverData;
  index: number;
  onChange: (index: number, field: keyof ObserverData, value: any) => void;
  onRemove: (index: number) => void;
}

export default function ObserverForm({ observer, index, onChange, onRemove }: Props) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Observador {index + 1}</span>
        <Button size="icon" variant="ghost" onClick={() => onRemove(index)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input value={observer.name} onChange={(e) => onChange(index, "name", e.target.value)} placeholder="Nome" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input value={observer.email} onChange={(e) => onChange(index, "email", e.target.value)} placeholder="email@exemplo.com" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Quando notificar</Label>
          <Select value={observer.notify_on} onValueChange={(v) => onChange(index, "notify_on", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="completion">Ao finalizar</SelectItem>
              <SelectItem value="each_signature">A cada assinatura</SelectItem>
              <SelectItem value="all">Todos os eventos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Receber documento final</Label>
          <div className="pt-1">
            <Switch checked={observer.receive_final} onCheckedChange={(v) => onChange(index, "receive_final", v)} />
          </div>
        </div>
      </div>
    </div>
  );
}
