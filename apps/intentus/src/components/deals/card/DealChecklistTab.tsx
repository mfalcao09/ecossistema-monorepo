import { useState, useMemo } from "react";
import { format, isPast, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  useDealChecklists,
  useAddChecklistItem,
  useToggleChecklistItem,
  useDeleteChecklistItem,
  useDeleteChecklistGroup,
  useUpdateChecklistItem,
  useProfiles,
} from "@/hooks/useDealCardFeatures";
import {
  Plus,
  Trash2,
  CheckSquare,
  User,
  CalendarIcon,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AddChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string) => void;
}

export function AddChecklistDialog({ open, onOpenChange, onAdd }: AddChecklistDialogProps) {
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar Checklist</DialogTitle>
        </DialogHeader>
        <div>
          <label className="text-sm font-medium">Título</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Documentação"
            className="mt-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onAdd(name.trim());
                setName("");
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (name.trim()) {
                onAdd(name.trim());
                setName("");
              }
            }}
            disabled={!name.trim()}
          >
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DealChecklistTab({
  dealId,
  externalPendingGroups,
  onPendingGroupsChange,
}: {
  dealId: string;
  externalPendingGroups?: string[];
  onPendingGroupsChange?: (groups: string[]) => void;
}) {
  const { data: items } = useDealChecklists(dealId);
  const { data: profiles } = useProfiles();
  const deleteGroup = useDeleteChecklistGroup();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Group items by checklist_group
  const groups = useMemo(() => {
    if (!items) return [];
    const map = new Map<string, any[]>();
    for (const item of items) {
      const group = (item as any).checklist_group || "Checklist";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(item);
    }
    return Array.from(map.entries()).map(([name, groupItems]) => ({ name, items: groupItems }));
  }, [items]);

  // Use external pending groups if provided, otherwise internal state
  const [internalPendingGroups, setInternalPendingGroups] = useState<string[]>([]);
  const pendingGroups = externalPendingGroups ?? internalPendingGroups;
  const setPendingGroups = onPendingGroupsChange ?? setInternalPendingGroups;

  const handleAddChecklist = (name: string) => {
    setDialogOpen(false);
    setPendingGroups([...pendingGroups, name]);
  };

  // Merge existing groups with pending (empty) groups
  const allGroupNames = useMemo(() => {
    const existing = new Set(groups.map((g) => g.name));
    const merged = [...groups.map((g) => g.name)];
    for (const pg of pendingGroups) {
      if (!existing.has(pg)) merged.push(pg);
    }
    return merged;
  }, [groups, pendingGroups]);

  const getGroupItems = (name: string) => groups.find((g) => g.name === name)?.items || [];

  return (
    <div className="space-y-6">
      <ScrollArea className="max-h-[55vh]">
        <div className="space-y-6 pr-3">
          {allGroupNames.map((groupName) => (
            <ChecklistGroup
              key={groupName}
              dealId={dealId}
              groupName={groupName}
              items={getGroupItems(groupName)}
              profiles={profiles || []}
              onDelete={() => {
                deleteGroup.mutate({ dealId, groupName });
                setPendingGroups(pendingGroups.filter((p) => p !== groupName));
              }}
            />
          ))}
        </div>
      </ScrollArea>

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={() => setDialogOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Adicionar checklist
      </Button>

      <AddChecklistDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdd={handleAddChecklist}
      />
    </div>
  );
}

function ChecklistGroup({
  dealId,
  groupName,
  items,
  profiles,
  onDelete,
}: {
  dealId: string;
  groupName: string;
  items: any[];
  profiles: any[];
  onDelete: () => void;
}) {
  const addItem = useAddChecklistItem();
  const toggleItem = useToggleChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const updateItem = useUpdateChecklistItem();

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState<string | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);

  const total = items.length;
  const done = items.filter((i) => i.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addItem.mutate({
      dealId,
      title: newTitle.trim(),
      checklistGroup: groupName,
      assignedTo: newAssignee,
      dueDate: newDueDate ? format(newDueDate, "yyyy-MM-dd") : null,
    });
    setNewTitle("");
    setNewAssignee(null);
    setNewDueDate(undefined);
  };

  const resetForm = () => {
    setAdding(false);
    setNewTitle("");
    setNewAssignee(null);
    setNewDueDate(undefined);
  };

  const getProfileName = (userId: string) => {
    const p = profiles.find((pr) => pr.user_id === userId);
    return p?.name || "?";
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <div className="space-y-2">
      {/* Group Header */}
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold flex-1">{groupName}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          Excluir
        </Button>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span>
              {done}/{total} ({pct}%)
            </span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      )}

      {/* Items */}
      <div className="space-y-1">
        {items.map((item) => {
          const assignedTo = (item as any).assigned_to;
          const dueDate = (item as any).due_date;
          const isOverdue = dueDate && !item.completed && isPast(parseISO(dueDate));

          return (
            <div
              key={item.id}
              className="flex items-center gap-2 group rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={item.completed}
                onCheckedChange={(checked) =>
                  toggleItem.mutate({ id: item.id, completed: !!checked, dealId })
                }
              />
              <span
                className={`flex-1 text-sm ${item.completed ? "line-through text-muted-foreground" : ""}`}
              >
                {item.title}
              </span>

              {/* Due date badge */}
              {dueDate && (
                <Badge
                  variant={isOverdue ? "destructive" : "secondary"}
                  className="text-[10px] h-5 px-1.5 shrink-0"
                >
                  <CalendarIcon className="h-3 w-3 mr-0.5" />
                  {format(parseISO(dueDate), "dd/MM")}
                </Badge>
              )}

              {/* Assignee avatar */}
              {assignedTo && (
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {getInitials(getProfileName(assignedTo))}
                  </AvatarFallback>
                </Avatar>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={() => deleteItem.mutate({ id: item.id, dealId })}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Add item form */}
      {adding ? (
        <div className="space-y-2 pl-6">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Adicionar um item"
            className="h-8 text-sm"
            autoFocus
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newTitle.trim() || addItem.isPending}
            >
              Adicionar
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm}>
              Cancelar
            </Button>

            {/* Assign button */}
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                  <User className="h-3 w-3" />
                  {newAssignee ? getProfileName(newAssignee) : "Atribuir"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-1 max-h-48 overflow-y-auto" align="start">
                {newAssignee && (
                  <button
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted rounded text-destructive"
                    onClick={() => setNewAssignee(null)}
                  >
                    <X className="h-3 w-3" /> Remover
                  </button>
                )}
                {profiles.map((p) => (
                  <button
                    key={p.user_id}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted rounded",
                      newAssignee === p.user_id && "bg-muted font-medium"
                    )}
                    onClick={() => setNewAssignee(p.user_id)}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[9px]">
                        {getInitials(p.name || "?")}
                      </AvatarFallback>
                    </Avatar>
                    {p.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Due date button */}
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                  <CalendarIcon className="h-3 w-3" />
                  {newDueDate ? format(newDueDate, "dd/MM/yyyy") : "Data de Entrega"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={newDueDate}
                  onSelect={setNewDueDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground gap-1 ml-6"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-3 w-3" />
          Adicionar um item
        </Button>
      )}
    </div>
  );
}
