import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dealRequestStatusLabels, dealRequestStatusColors, type DealRequest } from "@/lib/dealRequestSchema";
import { useDealRequestHistory } from "@/hooks/useDealRequests";
import { useDealChecklists, useDealReminders } from "@/hooks/useDealCardFeatures";
import { getNextStatuses } from "@/lib/legalTransitions";
import { DealDetailsTab } from "./card/DealDetailsTab";
import { DealChecklistTab, AddChecklistDialog } from "./card/DealChecklistTab";
import { DealRemindersTab } from "./card/DealRemindersTab";
import { DealActivityTab } from "./card/DealActivityTab";
import { DealActionsTab } from "./card/DealActionsTab";
import { DealCommissionsTab } from "./card/DealCommissionsTab";
import { AttachmentUploadDialog, DealAttachmentsSection } from "./card/DealAttachmentsTab";
import { useDealAttachments } from "@/hooks/useDealAttachments";
import { DealAssignment } from "./card/DealAssignment";
import { DealLabelsDisplay } from "./card/DealLabelsDisplay";
import { DealDatesPanel } from "./card/DealDatesPanel";
import { DealDatesDisplay } from "./card/DealDatesDisplay";
import { DealMembersPopover } from "./card/DealMembersTab";
import { SalesAssistantPanel } from "./SalesAssistantPanel";
import { useLabels, useDealLabels, useToggleDealLabel, useCreateLabel, useUpdateLabel, useDeleteLabel } from "@/hooks/useLabels";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckSquare, Bell, ClipboardList, MessageSquare, Clock, Zap, DollarSign,
  MoreHorizontal, Archive, Eye, EyeOff, Image as ImageIcon, Users,
  Calendar, Tag, Plus, MapPin, Paperclip, LayoutList, Bot,
} from "lucide-react";
import { useDealFollowers, useToggleFollow } from "@/hooks/useDealCardFeatures";
import { useUpdateDealStatus } from "@/hooks/useDealRequests";
import { toast } from "sonner";

interface DealDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: DealRequest;
  showStatusActions?: boolean;
}

type ActiveSection = "detalhes" | "acoes" | "membros" | "assistente" | null;

export function DealDetailDialog({ open, onOpenChange, deal, showStatusActions = false }: DealDetailDialogProps) {
  const dealId = deal?.id || "";
  const { data: history } = useDealRequestHistory(dealId);
  
  const { data: checklists } = useDealChecklists(dealId);
  const { data: reminders } = useDealReminders(dealId);
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);
  const [pendingChecklistGroups, setPendingChecklistGroups] = useState<string[]>([]);
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const { data: attachments } = useDealAttachments(dealId);
  

  const propertyId = deal?.property_id || "";
  const { data: propertyMedia } = useQuery({
    queryKey: ["property-media-cover", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_media")
        .select("id, media_url, display_order")
        .eq("property_id", propertyId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId,
  });

  const nextOptions = deal ? getNextStatuses(deal.status) : [];
  const checklistTotal = checklists?.length || 0;
  const checklistDone = checklists?.filter((i: any) => i.completed).length || 0;
  const overdueReminders = reminders?.filter((r: any) => new Date(r.remind_at) <= new Date() && !r.notified).length || 0;

  if (!deal) return null;

  const toggleSection = (section: ActiveSection) => {
    setActiveSection((prev) => (prev === section ? null : section));
  };

  const photos = propertyMedia || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden [&>button.absolute]:hidden">
        {/* Property Photos Strip */}
        <div className="relative w-full bg-muted shrink-0">
          {photos.length > 0 ? (
            <div className="flex overflow-x-auto gap-1 p-1 scrollbar-thin" style={{ scrollbarWidth: "thin" }}>
              {photos.map((photo: any, idx: number) => (
                <img
                  key={photo.id || idx}
                  src={photo.media_url}
                  alt={`Imóvel ${idx + 1}`}
                  className="h-32 min-w-[180px] max-w-[240px] object-cover rounded-md flex-shrink-0"
                />
              ))}
            </div>
          ) : (
            <div className="h-28 flex flex-col items-center justify-center gap-1 text-muted-foreground/50">
              <ImageIcon className="h-10 w-10" />
              <span className="text-xs">Sem foto do imóvel</span>
            </div>
          )}
          {/* Top-right actions on cover */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            <OptionsMenu dealId={dealId} deal={deal} onOpenChange={onOpenChange} />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-background/80 hover:bg-background backdrop-blur-sm rounded-full"
              onClick={() => onOpenChange(false)}
            >
              <span className="sr-only">Fechar</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </Button>
          </div>
        </div>

        {/* Title + Status */}
        <div className="px-6 pt-4 pb-2 space-y-2 shrink-0">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <span>{deal.properties?.title || "Solicitação"}</span>
            <Badge className={dealRequestStatusColors[deal.status] || ""} variant="outline">
              {dealRequestStatusLabels[deal.status] || deal.status}
            </Badge>
          </DialogTitle>
          <DealAssignment deal={deal} />
        </div>

        {/* Action Buttons Row */}
        <div className="px-6 pb-3 flex flex-wrap items-center gap-2 shrink-0">
          <ActionButton
            icon={<CheckSquare className="h-3.5 w-3.5" />}
            label="Checklist"
            badge={checklistTotal > 0 ? `${checklistDone}/${checklistTotal}` : undefined}
            onClick={() => setChecklistDialogOpen(true)}
          />
          <ActionButton
            icon={<Bell className="h-3.5 w-3.5" />}
            label="Lembretes"
            badge={overdueReminders > 0 ? `${overdueReminders}` : reminders?.length ? `${reminders.length}` : undefined}
            badgeVariant={overdueReminders > 0 ? "destructive" : "secondary"}
            onClick={() => setShowReminders(true)}
          />
          {showStatusActions && nextOptions.length > 0 && (
            <ActionButton icon={<Zap className="h-3.5 w-3.5" />} label="Ações" onClick={() => toggleSection("acoes")} />
          )}
          <ActionButton
            icon={<Bot className="h-3.5 w-3.5" />}
            label="Assistente IA"
            onClick={() => toggleSection("assistente")}
          />
          <CommissionPercentageButton dealId={dealId} currentPercentage={deal?.commission_percentage} />
          <DealMembersPopover dealId={dealId} />
          <AddToCardPopover
            dealId={dealId}
            deal={deal}
            onSelect={(item) => {
              if (item.startsWith("checklist:")) {
                const name = item.substring("checklist:".length);
                setPendingChecklistGroups((prev) => [...prev, name]);
              } else if (item === "checklist") {
                setChecklistDialogOpen(true);
              } else if (item === "lembretes") setShowReminders(true);
              else if (item === "anexo") setAttachmentDialogOpen(true);
              else if (item === "membros") toggleSection("membros");
            }}
          />
        </div>

        <AddChecklistDialog
          open={checklistDialogOpen}
          onOpenChange={setChecklistDialogOpen}
          onAdd={(name) => {
            setChecklistDialogOpen(false);
            setPendingChecklistGroups((prev) => [...prev, name]);
          }}
        />

        <AttachmentUploadDialog
          open={attachmentDialogOpen}
          onOpenChange={setAttachmentDialogOpen}
          dealId={dealId}
        />

        <Separator />

        {/* Two-column body */}
        <div className="flex-1 min-h-0 flex">
          {/* Left column — content */}
          <ScrollArea className="flex-1 border-r">
            <div className="p-6 space-y-6">
              {/* Labels */}
              <DealLabelsDisplay dealId={dealId} />

              {/* Dates */}
              <DealDatesDisplay startDate={deal.start_date} dueDate={deal.due_date} />

              {/* Detalhes section */}
              <SectionBlock
                icon={<ClipboardList className="h-4 w-4" />}
                title="Detalhes"
                defaultOpen
              >
                <DealDetailsTab deal={deal} />
              </SectionBlock>

              {/* Location section */}
              <LocationBlock deal={deal} />

              {/* Checklist — always visible if has data or pending groups */}
              {(checklistTotal > 0 || pendingChecklistGroups.length > 0) && (
                <SectionBlock icon={<CheckSquare className="h-4 w-4" />} title="Checklist" defaultOpen>
                  <DealChecklistTab
                    dealId={dealId}
                    externalPendingGroups={pendingChecklistGroups}
                    onPendingGroupsChange={setPendingChecklistGroups}
                  />
                </SectionBlock>
              )}

              {/* Reminders — always visible if has data or user opened */}
              {((reminders && reminders.length > 0) || showReminders) && (
                <SectionBlock icon={<Bell className="h-4 w-4" />} title="Lembretes" defaultOpen>
                  <DealRemindersTab dealId={dealId} />
                </SectionBlock>
              )}

              {/* Attachments — always visible if has data */}
              <DealAttachmentsSection dealId={dealId} />

              {/* Assistente IA — on-demand */}
              {activeSection === "assistente" && (
                <SectionBlock icon={<Bot className="h-4 w-4" />} title="Assistente IA" defaultOpen>
                  <SalesAssistantPanel dealId={dealId} propertyId={deal?.property_id} />
                </SectionBlock>
              )}

              {activeSection === "acoes" && showStatusActions && nextOptions.length > 0 && (
                <SectionBlock icon={<Zap className="h-4 w-4" />} title="Ações" defaultOpen>
                  <DealActionsTab deal={deal} />
                </SectionBlock>
              )}


              {activeSection === "membros" && (
                <SectionBlock icon={<Users className="h-4 w-4" />} title="Membros" defaultOpen>
                  <DealMembersPopover dealId={dealId} />
                </SectionBlock>
              )}
            </div>
          </ScrollArea>

          {/* Right column — unified activity */}
          <div className="w-80 shrink-0 hidden md:block p-4">
            <DealActivityTab dealId={dealId} propertyTitle={deal?.properties?.title} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActionButton({
  icon, label, badge, badgeVariant = "secondary", onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  badgeVariant?: "secondary" | "destructive";
  onClick?: () => void;
}) {
  return (
    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onClick}>
      {icon}
      {label}
      {badge && (
        <Badge variant={badgeVariant} className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px]">
          {badge}
        </Badge>
      )}
    </Button>
  );
}

function CommissionPercentageButton({ dealId, currentPercentage }: { dealId: string; currentPercentage?: number | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(currentPercentage ?? ""));
  const queryClient = useQueryClient();

  const handleSave = async () => {
    const pct = parseFloat(value);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("Informe um percentual válido (0-100).");
      return;
    }
    const { error } = await supabase
      .from("deal_requests")
      .update({ commission_percentage: pct })
      .eq("id", dealId);
    if (error) {
      toast.error("Erro ao salvar comissão.");
    } else {
      toast.success("Comissão atualizada.");
      queryClient.invalidateQueries({ queryKey: ["deal-requests"] });
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(String(currentPercentage ?? "")); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <DollarSign className="h-3.5 w-3.5" />
          Comissão
          {currentPercentage != null && (
            <Badge variant="secondary" className="ml-0.5 h-4 min-w-[16px] px-1 text-[10px]">
              {currentPercentage}%
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4 space-y-3" align="start">
        <div className="text-sm font-semibold">Percentual de Comissão</div>
        <p className="text-xs text-muted-foreground">Percentual sobre o valor do negócio.</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 text-sm"
            placeholder="Ex: 6"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
        <Button size="sm" className="w-full" onClick={handleSave}>Salvar</Button>
      </PopoverContent>
    </Popover>
  );
}

function SectionBlock({
  icon, title, children, defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function OptionsMenu({ dealId, deal, onOpenChange }: { dealId: string; deal: DealRequest; onOpenChange: (open: boolean) => void }) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { data: followers } = useDealFollowers(dealId);
  const toggleFollow = useToggleFollow();
  const updateStatus = useUpdateDealStatus();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useState(() => { supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null)); });

  const isFollowing = !!(followers || []).find((f: any) => f.user_id === currentUserId);

  const handleArchive = () => {
    updateStatus.mutate(
      { dealId, fromStatus: deal.status, toStatus: "cancelado", notes: "Negócio arquivado (cancelado)." },
      { onSuccess: () => { setArchiveOpen(false); onOpenChange(false); } }
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-background/80 hover:bg-background backdrop-blur-sm rounded-full"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => toggleFollow.mutate({ dealId, isFollowing })}>
            {isFollowing ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {isFollowing ? "Deixar de seguir" : "Seguir"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setArchiveOpen(true)} className="text-destructive focus:text-destructive">
            <Archive className="h-4 w-4 mr-2" /> Arquivar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar negócio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação finalizará o negócio como <strong>cancelado</strong> (negativo). Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AddToCardPopover({ dealId, deal, onSelect }: { dealId: string; deal: DealRequest; onSelect: (item: string) => void }) {
  const [open, setOpen] = useState(false);
  const [subView, setSubView] = useState<"menu" | "labels" | "dates">("menu");
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false);

  const items = [
    { key: "etiquetas", icon: <Tag className="h-5 w-5" />, label: "Etiquetas", desc: "Organize, categorize e priorize" },
    { key: "datas", icon: <Calendar className="h-5 w-5" />, label: "Datas", desc: "Datas de início, entrega e lembretes" },
    { key: "checklist", icon: <CheckSquare className="h-5 w-5" />, label: "Checklist", desc: "Adicionar subtarefas" },
    { key: "membros", icon: <Users className="h-5 w-5" />, label: "Membros", desc: "Vincular membros ao cartão" },
    { key: "anexo", icon: <Paperclip className="h-5 w-5" />, label: "Anexo", desc: "Adicione links, páginas e mais" },
    { key: "local", icon: <MapPin className="h-5 w-5" />, label: "Local", desc: "Exibir este cartão em um mapa" },
    { key: "campos", icon: <LayoutList className="h-5 w-5" />, label: "Campos Personalizados", desc: "Criar seus próprios campos" },
  ];

  return (
    <>
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSubView("menu"); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 max-h-[55vh] overflow-y-auto" align="start" side="top" sideOffset={8} avoidCollisions collisionPadding={16}>
        {subView === "menu" ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold">Adicionar ao cartão</span>
            </div>
            <div className="py-1">
              {items.map((item) => (
                <button
                  key={item.key}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-muted transition-colors"
                  onClick={() => {
                    if (item.key === "etiquetas") {
                      setSubView("labels");
                    } else if (item.key === "datas") {
                      setSubView("dates");
                    } else if (item.key === "checklist") {
                      setOpen(false);
                      setChecklistDialogOpen(true);
                    } else {
                      setOpen(false);
                      onSelect(item.key);
                    }
                  }}
                >
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted text-muted-foreground shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : subView === "labels" ? (
          <InlineLabelsPanel dealId={dealId} onBack={() => setSubView("menu")} onClose={() => setOpen(false)} />
        ) : (
          <DealDatesPanel
            dealId={dealId}
            currentStartDate={deal?.start_date || null}
            currentDueDate={deal?.due_date || null}
            onBack={() => setSubView("menu")}
            onClose={() => setOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>

    <AddChecklistDialog
      open={checklistDialogOpen}
      onOpenChange={setChecklistDialogOpen}
      onAdd={(name) => {
        setChecklistDialogOpen(false);
        onSelect("checklist:" + name);
      }}
    />
    </>
  );
}

const LABEL_COLORS = [
  ["#4ade80", "#facc15", "#fb923c", "#f87171", "#c084fc"],
  ["#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#9333ea"],
  ["#166534", "#a16207", "#9a3412", "#991b1b", "#6b21a8"],
  ["#7dd3fc", "#67e8f9", "#86efac", "#f9a8d4", "#d4d4d8"],
  ["#38bdf8", "#22d3ee", "#22c55e", "#ec4899", "#a3a3a3"],
  ["#0284c7", "#0891b2", "#15803d", "#be185d", "#525252"],
];

function InlineLabelsPanel({ dealId, onBack, onClose }: { dealId: string; onBack: () => void; onClose: () => void }) {
  const [view, setView] = useState<"list" | "edit" | "create">("list");
  const [search, setSearch] = useState("");
  const [editingLabel, setEditingLabel] = useState<{ id: string; name: string; color: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#4ade80");

  const { data: allLabels } = useLabels();
  const { data: dealLabels } = useDealLabels(dealId);
  const toggleLabel = useToggleDealLabel();
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();

  const activeLabelIds = new Set(dealLabels?.map((dl: any) => dl.label_id) || []);
  const filtered = (allLabels || []).filter((l: any) => l.name.toLowerCase().includes(search.toLowerCase()));

  const handleToggle = (labelId: string) => {
    toggleLabel.mutate({ dealId, labelId, active: activeLabelIds.has(labelId) });
  };

  const handleSave = () => {
    if (view === "edit" && editingLabel) {
      updateLabel.mutate({ id: editingLabel.id, name: newName, color: newColor });
    } else {
      createLabel.mutate({ name: newName, color: newColor });
    }
    setView("list");
  };

  const handleDelete = () => {
    if (editingLabel) {
      deleteLabel.mutate(editingLabel.id);
      setView("list");
    }
  };

  if (view === "list") {
    return (
      <>
        <div className="flex items-center gap-2 px-3 py-2.5 border-b">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onBack}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </Button>
          <span className="text-sm font-semibold flex-1 text-center">Etiquetas</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </Button>
        </div>
        <div className="px-3 pt-2">
          <Input placeholder="Buscar etiquetas..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="px-3 py-2 space-y-1.5 max-h-60 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Etiquetas</p>
          {filtered.map((label: any) => (
            <div key={label.id} className="flex items-center gap-2">
              <Checkbox checked={activeLabelIds.has(label.id)} onCheckedChange={() => handleToggle(label.id)} />
              <button
                className="flex-1 h-8 rounded text-left px-3 text-sm font-medium text-white truncate"
                style={{ backgroundColor: label.color }}
                onClick={() => handleToggle(label.id)}
              >
                {label.name}
              </button>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => {
                setEditingLabel(label);
                setNewName(label.name);
                setNewColor(label.color);
                setView("edit");
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </Button>
            </div>
          ))}
        </div>
        <div className="border-t px-3 py-2">
          <Button variant="secondary" className="w-full text-sm" onClick={() => { setEditingLabel(null); setNewName(""); setNewColor("#4ade80"); setView("create"); }}>
            Criar uma nova etiqueta
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2.5 border-b">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setView("list")}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Button>
        <span className="text-sm font-semibold flex-1 text-center">
          {view === "edit" ? "Editar etiqueta" : "Criar etiqueta"}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </Button>
      </div>
      <div className="px-3 py-3 space-y-3">
        <div className="flex justify-center">
          <div className="h-9 w-full max-w-[220px] rounded px-3 flex items-center text-sm font-medium text-white" style={{ backgroundColor: newColor }}>
            {newName}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Título</label>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Selecionar uma cor</label>
          <div className="mt-1.5 space-y-1">
            {LABEL_COLORS.map((row, ri) => (
              <div key={ri} className="flex gap-1">
                {row.map((c) => (
                  <button key={c} className="h-7 w-7 rounded transition-transform hover:scale-110 flex items-center justify-center" style={{ backgroundColor: c }} onClick={() => setNewColor(c)}>
                    {newColor === c && (
                      <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1" onClick={handleSave}>Salvar</Button>
          {view === "edit" && editingLabel && (
            <Button size="sm" variant="destructive" onClick={handleDelete}>Excluir</Button>
          )}
        </div>
      </div>
    </>
  );
}

function LocationBlock({ deal }: { deal: DealRequest }) {
  const property = deal?.properties;

  const parts = property ? [
    property.street,
    property.number,
    property.complement,
    property.neighborhood,
    property.city,
    property.state,
    property.zip_code,
  ].filter(Boolean) : [];

  const hasAddress = parts.length > 0;
  const address = parts.join(", ");
  const mapQuery = encodeURIComponent(address);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPin className="h-4 w-4" />
        Local
        {property?.id && (
          <Badge variant="outline" className="ml-auto text-[10px] font-mono">
            Cód: {property.id.slice(0, 8).toUpperCase()}
          </Badge>
        )}
      </div>
      <div className="rounded-lg border overflow-hidden">
        {hasAddress ? (
          <>
            <iframe
              title="Localização do imóvel"
              width="100%"
              height="200"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${mapQuery}&output=embed&z=15`}
            />
            <div className="px-3 py-2 bg-muted/50">
              <p className="text-sm font-medium">{property?.title}</p>
              <p className="text-xs text-muted-foreground">{address}</p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <MapPin className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm font-medium">Endereço não cadastrado</p>
            <p className="text-xs">Cadastre o endereço no imóvel para visualizar o mapa</p>
          </div>
        )}
      </div>
    </div>
  );
}
