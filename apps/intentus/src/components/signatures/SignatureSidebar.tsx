import { FileText, Send, CheckCircle2, XCircle, FileEdit, Trash2, Clock, Bell, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnvelopeFilter } from "@/hooks/useSignatureEnvelopes";

interface Props {
  activeFilter: EnvelopeFilter;
  onFilterChange: (f: EnvelopeFilter) => void;
  onOpenConfig: () => void;
  kpis: Record<string, number>;
}

const SECTIONS = [
  {
    label: "Documentos",
    items: [
      { key: "todos" as EnvelopeFilter, label: "Todos", icon: FileText, countKey: "total" },
      { key: "em_processo" as EnvelopeFilter, label: "Em processo", icon: Send, countKey: "em_processo" },
      { key: "finalizados" as EnvelopeFilter, label: "Finalizados", icon: CheckCircle2, countKey: "finalizados" },
      { key: "cancelados" as EnvelopeFilter, label: "Cancelados", icon: XCircle, countKey: "cancelados" },
      { key: "rascunhos" as EnvelopeFilter, label: "Rascunhos", icon: FileEdit, countKey: "rascunhos" },
      { key: "lixeira" as EnvelopeFilter, label: "Lixeira", icon: Trash2, countKey: "lixeira" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { key: "prazos" as EnvelopeFilter, label: "Prazos", icon: Clock, countKey: null },
      { key: "lembretes" as EnvelopeFilter, label: "Lembretes", icon: Bell, countKey: null },
      { key: "contatos" as EnvelopeFilter, label: "Contatos", icon: Users, countKey: null },
    ],
  },
];

export default function SignatureSidebar({ activeFilter, onFilterChange, onOpenConfig, kpis }: Props) {
  return (
    <div className="w-56 shrink-0 border-r bg-card/50 py-4 pr-2 space-y-5">
      {SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="px-4 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.label}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = activeFilter === item.key;
              const count = item.countKey ? kpis[item.countKey] ?? 0 : null;
              return (
                <button
                  key={item.key}
                  onClick={() => onFilterChange(item.key)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-4 py-1.5 text-sm rounded-r-md transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                      : "text-muted-foreground hover:bg-muted/50 border-l-2 border-transparent"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {count !== null && count > 0 && (
                    <span className="text-[11px] tabular-nums bg-muted rounded-full px-1.5 py-0.5">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="pt-2 border-t mx-4">
        <button
          onClick={onOpenConfig}
          className="w-full flex items-center gap-2.5 px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 rounded-r-md transition-colors"
        >
          <Settings className="h-4 w-4" />
          <span>Configurações</span>
        </button>
      </div>
    </div>
  );
}
