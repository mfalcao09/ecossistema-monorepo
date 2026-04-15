import { useState, useRef } from "react";
import { Plus, Trash2, CheckCircle2, Circle, Clock, AlertCircle, ChevronRight, Flag } from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useUserTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  type UserTask,
  type TaskStatus,
  type TaskPriority,
} from "@/hooks/useUserTasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Config ───────────────────────────────────────────────────────────────────

const COLUMNS: { status: TaskStatus; label: string; color: string; dotColor: string }[] = [
  { status: "todo",  label: "A Fazer",      color: "text-muted-foreground", dotColor: "bg-muted-foreground" },
  { status: "doing", label: "Em Andamento", color: "text-amber-400",        dotColor: "bg-amber-400" },
  { status: "done",  label: "Concluído",    color: "text-emerald-400",      dotColor: "bg-emerald-400" },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; icon: string }> = {
  low:    { label: "Baixa",   color: "text-slate-400",   icon: "↓" },
  normal: { label: "Normal",  color: "text-blue-400",    icon: "→" },
  high:   { label: "Alta",    color: "text-amber-400",   icon: "↑" },
  urgent: { label: "Urgente", color: "text-red-400",     icon: "!!" },
};

// ── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task }: { task: UserTask }) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [hovered, setHovered] = useState(false);
  const pConf = PRIORITY_CONFIG[task.priority];

  const cycleStatus = () => {
    const next: Record<TaskStatus, TaskStatus> = { todo: "doing", doing: "done", done: "todo" };
    update.mutate({ id: task.id, status: next[task.status] });
  };

  const isDue = task.due_date && isPast(parseISO(task.due_date)) && task.status !== "done";
  const isToday_ = task.due_date && isToday(parseISO(task.due_date));

  return (
    <div
      className={`group relative bg-background border rounded-lg px-3 py-2.5 transition-all duration-150 cursor-pointer select-none
        ${task.status === "done" ? "opacity-60" : "hover:border-primary/30 hover:shadow-sm hover:shadow-primary/5"}
        ${isDue ? "border-red-500/40" : "border-border"}
      `}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={cycleStatus}
    >
      <div className="flex items-start gap-2">
        {/* Status icon */}
        <div className="mt-0.5 flex-shrink-0">
          {task.status === "done" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : task.status === "doing" ? (
            <Clock className="h-4 w-4 text-amber-400" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[11px] font-medium ${pConf.color}`}>
              {pConf.icon} {pConf.label}
            </span>
            {task.due_date && (
              <span className={`text-[11px] ${isDue ? "text-red-400 font-semibold" : isToday_ ? "text-amber-400" : "text-muted-foreground"}`}>
                {isDue ? "⚠ " : ""}{format(parseISO(task.due_date), "dd/MM", { locale: ptBR })}
              </span>
            )}
          </div>
        </div>

        {/* Delete button */}
        {hovered && (
          <button
            className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors p-0.5"
            onClick={(e) => { e.stopPropagation(); del.mutate(task.id); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Inline Create Form ───────────────────────────────────────────────────────

function InlineCreate({ status }: { status: TaskStatus }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const create = useCreateTask();

  const submit = () => {
    if (!title.trim()) return;
    create.mutate(
      { title: title.trim(), priority, due_date: dueDate || undefined, status },
      {
        onSuccess: () => {
          setTitle("");
          setPriority("normal");
          setDueDate("");
          setOpen(false);
        },
      }
    );
  };

  if (!open) {
    return (
      <button
        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar tarefa
      </button>
    );
  }

  return (
    <div className="bg-background border border-primary/30 rounded-lg p-2.5 space-y-2">
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
        placeholder="Título da tarefa..."
        className="h-7 text-sm border-0 bg-transparent px-0 focus-visible:ring-0 placeholder:text-muted-foreground/60"
      />
      <div className="flex items-center gap-2">
        <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
          <SelectTrigger className="h-6 text-xs w-28 border-border/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, any][]).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">
                <span className={v.color}>{v.icon}</span> {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-6 text-xs w-32 border-border/60"
        />
        <div className="flex gap-1 ml-auto">
          <Button size="sm" className="h-6 px-2 text-xs" onClick={submit} disabled={!title.trim() || create.isPending}>
            {create.isPending ? "..." : "Criar"}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setOpen(false)}>
            ✕
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function DashboardTasks() {
  const { data: tasks = [], isLoading } = useUserTasks();

  const todoCount = tasks.filter(t => t.status === "todo").length;
  const doingCount = tasks.filter(t => t.status === "doing").length;
  const doneCount = tasks.filter(t => t.status === "done").length;
  const total = tasks.length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const overdueCount = tasks.filter(t => t.due_date && isPast(parseISO(t.due_date)) && t.status !== "done").length;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Minhas Tarefas</span>
            {overdueCount > 0 && (
              <span className="flex items-center gap-1 text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-medium">
                <AlertCircle className="h-3 w-3" />
                {overdueCount} atrasada{overdueCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{doneCount}/{total} concluídas</span>
          </div>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="space-y-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{todoCount} a fazer · {doingCount} em andamento</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Columns */}
      {isLoading ? (
        <div className="p-5 space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter(t => t.status === col.status);
            return (
              <div key={col.status} className="flex flex-col p-3 min-h-[200px]">
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>
                    {col.label}
                  </span>
                  {colTasks.length > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md">
                      {colTasks.length}
                    </span>
                  )}
                </div>

                {/* Tasks */}
                <div className="flex-1 space-y-2">
                  {colTasks.length === 0 ? (
                    <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/50 border border-dashed border-border/50 rounded-lg">
                      Vazio
                    </div>
                  ) : (
                    colTasks.map(task => <TaskCard key={task.id} task={task} />)
                  )}
                </div>

                {/* Add task inline */}
                <div className="mt-2">
                  <InlineCreate status={col.status} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
