import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProperties, useCreateProperty, useInactivateProperty, useDeleteProperty, useSavePropertyFeatures, useUploadPropertyImage, useUploadPropertyAttachment, useAddPropertyOwner, type Property } from "@/hooks/useProperties";
import { useCreatePerson } from "@/hooks/usePeople";
import { useAuth } from "@/hooks/useAuth";
import { IntakeKanban } from "@/components/properties/IntakeKanban";
import { PropertyFormDialog, type PropertyFormSubmitData } from "@/components/properties/PropertyFormDialog";
import { FormCustomizationDialog } from "@/components/properties/FormCustomizationDialog";
import type { PropertyFormValues } from "@/lib/propertySchema";
import {
  propertyTypeLabels, propertyPurposeLabels, propertyStatusLabels, propertyStatusColors,
} from "@/lib/propertySchema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Search, Plus, Building2, Pencil, Archive, Settings2, Trash2,
} from "lucide-react";
import { FavoriteButton } from "@/features/favorites";
import {
  intakeStatusLabels,
} from "@/lib/intakeStatus";
import { toast } from "sonner";

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const inactivationReasons = [
  { value: "vendido", label: "Vendido" },
  { value: "saiu_administracao", label: "Saiu da administração" },
  { value: "outro", label: "Outro" },
];

export default function Properties() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [purposeFilter, setPurposeFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [intakeFilter, setIntakeFilter] = useState("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editProperty, setEditProperty] = useState<Property | null>(null);
  const [inactivateTarget, setInactivateTarget] = useState<Property | null>(null);
  const [inactivateReason, setInactivateReason] = useState("vendido");
  const [inactivateNotes, setInactivateNotes] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "kanban" | "inativos">("table");
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);

  const { isAdminOrGerente, isSuperAdmin } = useAuth();

  const navigate = useNavigate();

  const effectiveStatus = viewMode === "inativos" ? "inativo" : statusFilter;
  const { data: properties, isLoading } = useProperties({
    search, property_type: typeFilter, purpose: purposeFilter, status: effectiveStatus, intake_status: intakeFilter,
  });
  const createProp = useCreateProperty();
  const inactivateProp = useInactivateProperty();
  const deleteProp = useDeleteProperty();
  const saveFeatures = useSavePropertyFeatures();
  const uploadImage = useUploadPropertyImage();
  const uploadAttachment = useUploadPropertyAttachment();
  const addOwner = useAddPropertyOwner();
  const createPerson = useCreatePerson();

  function openCreate() { setEditProperty(null); setFormOpen(true); }

  async function handleCreate(data: PropertyFormSubmitData) {
    const cleaned = cleanValues(data.property);
    createProp.mutate(cleaned as any, {
      onSuccess: async (createdProperty: any) => {
        const propertyId = createdProperty?.id;
        if (!propertyId) { setFormOpen(false); return; }

        try {
          if (data.features.length > 0) {
            saveFeatures.mutate({ propertyId, features: data.features });
          }
          if (data.owner?.name) {
            createPerson.mutate(data.owner as any, {
              onSuccess: (personData: any) => {
                if (personData?.id) {
                  addOwner.mutate({ propertyId, personId: personData.id });
                }
              },
            });
          }
          for (const photo of data.photos) {
            await uploadImage.mutateAsync({ propertyId, file: photo });
          }
          for (const att of data.attachments) {
            await uploadAttachment.mutateAsync({ propertyId, file: att.file });
          }
        } catch (err: any) {
          toast.error(`Erro ao processar uploads: ${err.message}`);
        }

        setFormOpen(false);
      },
    });
  }

  function handleInactivate() {
    if (!inactivateTarget) return;
    const reasonLabel = inactivationReasons.find(r => r.value === inactivateReason)?.label ?? inactivateReason;
    const fullReason = inactivateNotes ? `${reasonLabel}: ${inactivateNotes}` : reasonLabel;
    inactivateProp.mutate({ id: inactivateTarget.id, reason: fullReason }, {
      onSuccess: () => {
        setInactivateTarget(null);
        setInactivateReason("vendido");
        setInactivateNotes("");
      },
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Imóveis</h1>
          <p className="page-subtitle">
            {properties ? `${properties.length} imóveis encontrados` : "Carregando..."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={viewMode === "table" ? "default" : "outline"} size="sm" onClick={() => setViewMode("table")}>Tabela</Button>
          <Button variant={viewMode === "kanban" ? "default" : "outline"} size="sm" onClick={() => setViewMode("kanban")}>Pipeline</Button>
          <Button variant={viewMode === "inativos" ? "default" : "outline"} size="sm" onClick={() => setViewMode("inativos")}>
            <Archive className="h-4 w-4 mr-1" /> Inativos
          </Button>
          {isAdminOrGerente && (
            <Button variant="outline" size="sm" onClick={() => setCustomizeOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Personalizar Campos
            </Button>
          )}
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo Imóvel</Button>
        </div>
      </div>

      {(viewMode === "table" || viewMode === "inativos") && (
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar imóvel..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={purposeFilter} onValueChange={setPurposeFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Finalidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {Object.entries(propertyPurposeLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {Object.entries(propertyTypeLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {viewMode !== "inativos" && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(propertyStatusLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={intakeFilter} onValueChange={setIntakeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Pipeline" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos (Pipeline)</SelectItem>
              {Object.entries(intakeStatusLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Content */}
      {viewMode === "kanban" ? (
        <IntakeKanban />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}
        </div>
      ) : properties && properties.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imóvel</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Finalidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Venda</TableHead>
                <TableHead>Aluguel</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/imoveis/${p.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        {(p as any).property_code && (
                          <p className="text-xs text-muted-foreground">Cód. {(p as any).property_code}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{propertyTypeLabels[p.property_type] ?? p.property_type}</TableCell>
                  <TableCell className="text-sm">{propertyPurposeLabels[p.purpose] ?? p.purpose}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={propertyStatusColors[p.status] ?? ""}>
                      {propertyStatusLabels[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.city || "—"}</TableCell>
                  <TableCell className="text-sm">{fmt(p.sale_price)}</TableCell>
                  <TableCell className="text-sm">{fmt(p.rental_price)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <FavoriteButton propertyId={p.id} size="sm" />
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); navigate(`/imoveis/${p.id}`); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
                        onClick={(e) => { e.stopPropagation(); setInactivateTarget(p); }}>
                        <Archive className="h-4 w-4" />
                      </Button>
                      {isSuperAdmin && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum imóvel encontrado.</p>
          <Button variant="outline" className="mt-3" onClick={openCreate}>Cadastrar primeiro imóvel</Button>
        </div>
      )}

      {/* Form Dialog */}
      <PropertyFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        property={editProperty}
        onSubmit={handleCreate}
        isPending={createProp.isPending}
      />

      {/* Inactivation Dialog */}
      <Dialog open={!!inactivateTarget} onOpenChange={(o) => { if (!o) { setInactivateTarget(null); setInactivateReason("vendido"); setInactivateNotes(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inativar imóvel</DialogTitle>
            <DialogDescription>
              O imóvel "{inactivateTarget?.title}" será inativado e não aparecerá mais nas listagens padrão. Todos os dados e histórico serão preservados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Motivo da inativação</Label>
              <Select value={inactivateReason} onValueChange={setInactivateReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {inactivationReasons.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={inactivateNotes}
                onChange={(e) => setInactivateNotes(e.target.value)}
                placeholder="Detalhes adicionais..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInactivateTarget(null)}>Cancelar</Button>
            <Button onClick={handleInactivate} disabled={inactivateProp.isPending}>
              <Archive className="h-4 w-4 mr-1" />
              Inativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customization Dialog */}
      <FormCustomizationDialog open={customizeOpen} onOpenChange={setCustomizeOpen} />

      {/* Delete confirmation (superadmin only) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Excluir imóvel permanentemente</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Tem certeza que deseja excluir <strong>{deleteTarget?.title}</strong>?</p>
                <p className="mt-2 text-destructive font-semibold">Esta ação é irreversível. Todas as fotos, anexos, proprietários e dados vinculados serão removidos permanentemente do sistema.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { deleteProp.mutate(deleteTarget!.id, { onSuccess: () => setDeleteTarget(null) }); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProp.isPending}
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function cleanValues(values: PropertyFormValues) {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(values)) {
    if (val === "" || val === undefined) {
      result[key] = null;
    } else {
      result[key] = val;
    }
  }
  return result;
}
