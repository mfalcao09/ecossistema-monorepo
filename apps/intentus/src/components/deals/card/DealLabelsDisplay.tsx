import { useDealLabels } from "@/hooks/useLabels";
import { DealLabelsPopover } from "./DealLabelsPopover";
import { Plus, Tag } from "lucide-react";

interface DealLabelsDisplayProps {
  dealId: string;
}

export function DealLabelsDisplay({ dealId }: DealLabelsDisplayProps) {
  const { data: dealLabels } = useDealLabels(dealId);

  if (!dealLabels || dealLabels.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Tag className="h-4 w-4" />
        Etiquetas
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {dealLabels.map((dl: any) => (
          <div
            key={dl.id}
            className="h-7 rounded px-3 flex items-center text-xs font-medium text-white"
            style={{ backgroundColor: dl.labels?.color || "#94a3b8" }}
          >
            {dl.labels?.name || ""}
          </div>
        ))}
        <DealLabelsPopover
          dealId={dealId}
          trigger={
            <button className="h-7 w-7 rounded bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          }
        />
      </div>
    </div>
  );
}
