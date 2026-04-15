import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfiles, useAssignDeal } from "@/hooks/useDealCardFeatures";
import { useAuth } from "@/hooks/useAuth";
import { UserCircle } from "lucide-react";
import type { DealRequest } from "@/lib/dealRequestSchema";

export function DealAssignment({ deal }: { deal: DealRequest }) {
  const { data: profiles } = useProfiles();
  const assign = useAssignDeal();
  const { isAdminOrGerente } = useAuth();

  // Only gerentes/admins can assign
  if (!isAdminOrGerente) {
    const assignedProfile = profiles?.find((p) => p.user_id === deal.assigned_to);
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <UserCircle className="h-4 w-4" />
        <span>{assignedProfile?.name || "Sem responsável"}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select
        value={deal.assigned_to || "unassigned"}
        onValueChange={(val) =>
          assign.mutate({ dealId: deal.id, userId: val === "unassigned" ? null : val })
        }
      >
        <SelectTrigger className="h-7 text-xs w-48">
          <SelectValue placeholder="Atribuir responsável" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Sem responsável</SelectItem>
          {profiles?.map((p) => (
            <SelectItem key={p.user_id} value={p.user_id}>
              {p.name} {p.department ? `(${p.department})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
