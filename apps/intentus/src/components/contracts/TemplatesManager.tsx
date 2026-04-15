import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useOnboardingProgress, useShowEmptyState } from "@/hooks/useOnboardingProgress";
import { TemplatesEmptyState } from "@/components/contracts/CLMEmptyStates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  Eye,
  Variable,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  useContractTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useDuplicateTemplate,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_TYPE_COLORS,
  CATEGORY_LABELS,
  type ContractTemplate,
  type CreateTemplateInput,
  type TemplateVariable,
} from "@/hooks/useContractTemplates";

export default function TemplatesManager() {
  const { data: templates, isLoading } = useContractTemplates();
  const { canManageTemplates } = usePermissions();
  const { checkAutoComplete } = useOnboardingProgress();
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();
  const duplicateMutation = useDuplicateTemplate();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("outro");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formContent, setFormContent] = useState("");

  // Filtro
  const filtered = (templates ?? []).filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || t.template_type === filterType;
    return matchSearch && matchType;
  });

  // Extrair variáveis do conteúdo (padrão {{nome_variavel}})
  function extractVariables(content: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const vars = new Set<string>();
    let match;
    while ((match = regex.exec(content)) !== null) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  }

  function resetForm() {
    setFormName("");
    setFormType("outro");
    setFormCategory("");
    setFormDescription("");
    setFormContent("");
  }

  function openCreate() {
    resetForm();
    setShowCreateDialog(true);
  }

  function openEdit(template: ContractTemplate) {
    setSelectedTemplate(template);
    setFormName(template.name);
    setFormType(template.template_type);
    setFormCategory(template.category ?? "");
    setFormDescription(template.description ?? "");
    setFormContent(template.content);
    setShowEditDialog(true);
  }

  function openPreview(template: ContractTemplate) {
    setSelectedTemplate(template);
    setShowPreviewDialog(true);
  }

  function openDelete(template: ContractTemplate) {
    setSelectedTemplate(template);
    setShowDeleteDialog(true);
  }

  async function handleCreate() {
    const detectedVars = extractVariables(formContent);
    const variables: Record<string, TemplateVariable> = {};
    for (const v of detectedVars) {
      variables[v] = {
        type: "text",
        label: v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        required: true,
      };
    }

    const input: CreateTemplateInput = {
      name: formName,
      template_type: formType,
      content: formContent,
      variables,
      category: formCategory || undefined,
      description: formDescription || undefined,
    };

    await createMutation.mutateAsync(input);
    // Wire onboarding: mark template creation as complete
    checkAutoComplete("template_created");
    setShowCreateDialog(false);
    resetForm();
  }

  async function handleUpdate() {
    if (!selectedTemplate) return;

    const detectedVars = extractVariables(formContent);
    const existingVars = selectedTemplate.variables ?? {};
    const variables: Record<string, TemplateVariable> = {};

    for (const v of detectedVars) {
      variables[v] = existingVars[v] ?? {
        type: "text",
        label: v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        required: true,
      };
    }

    await updateMutation.mutateAsync({
      id: selectedTemplate.id,
      name: formName,
      template_type: formType,
      content: formContent,
      variables,
      category: formCategory || undefined,
      description: formDescription || undefined,
    });

    setShowEditDialog(false);
  }

  async function handleDelete() {
    if (!selectedTemplate) return;
    await deleteMutation.mutateAsync(selectedTemplate.id);
    setShowDeleteDialog(false);
    setSelectedTemplate(null);
  }

  async function handleDuplicate(template: ContractTemplate) {
    await duplicateMutation.mutateAsync(template.id);
  }

  async function handleToggleActive(template: ContractTemplate) {
    await updateMutation.mutateAsync({
      id: template.id,
      is_active: !template.is_active,
    });
  }

  // ── Render ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Busca */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TEMPLATE_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManageTemplates && (
          <Button onClick={openCreate} className="bg-[#e2a93b] hover:bg-[#c99430] text-white">
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        )}
      </div>

      {/* Contador */}
      <p className="text-sm text-muted-foreground">
        {filtered.length} template(s) encontrado(s)
      </p>

      {/* Lista de Templates */}
      {filtered.length === 0 ? (
        search || filterType !== "all" ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhum template encontrado com os filtros selecionados.</p>
            </CardContent>
          </Card>
        ) : (
          <TemplatesEmptyState onAction={(action) => {
            if (action === "create_template") openCreate();
          }} />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => {
            const varCount = Object.keys(template.variables ?? {}).length;
            const typeColor =
              TEMPLATE_TYPE_COLORS[template.template_type] ?? "bg-gray-100 text-gray-800";

            return (
              <Card
                key={template.id}
                className={`hover:shadow-md transition-shadow ${
                  !template.is_active ? "opacity-60" : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">
                        {template.name}
                      </CardTitle>
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleActive(template)}
                      className="ml-2 flex-shrink-0"
                      title={template.is_active ? "Desativar" : "Ativar"}
                    >
                      {template.is_active ? (
                        <ToggleRight className="h-5 w-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge variant="outline" className={typeColor}>
                      {TEMPLATE_TYPE_LABELS[template.template_type] ?? template.template_type}
                    </Badge>
                    {template.category && (
                      <Badge variant="outline" className="bg-slate-50">
                        {CATEGORY_LABELS[template.category] ?? template.category}
                      </Badge>
                    )}
                    {varCount > 0 && (
                      <Badge variant="outline" className="bg-violet-50 text-violet-700">
                        <Variable className="h-3 w-3 mr-1" />
                        {varCount} var
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>v{template.version}</span>
                    <span>{template.use_count ?? 0} usos</span>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPreview(template)}
                      className="flex-1"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Ver
                    </Button>
                    {canManageTemplates && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(template)}
                        className="flex-1"
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                    )}
                    {canManageTemplates && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(template)}
                        title="Duplicar"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canManageTemplates && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDelete(template)}
                        className="text-red-500 hover:text-red-700"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog Criar */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Template de Contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome do Template *</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Contrato de Locação Residencial"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Tipo *</label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TEMPLATE_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Breve descrição do template"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Conteúdo do Template *
              </label>
              <p className="text-xs text-muted-foreground mb-1">
                Use {"{{nome_variavel}}"} para criar campos dinâmicos. Ex: {"{{comprador_nome}}"}, {"{{valor_total}}"}
              </p>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder={"CONTRATO DE LOCAÇÃO\n\nPelo presente instrumento, {{locador_nome}}, CPF {{locador_cpf}}..."}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            {formContent && (
              <div className="bg-violet-50 p-3 rounded-md">
                <p className="text-xs font-medium text-violet-800 mb-1">
                  <Variable className="h-3 w-3 inline mr-1" />
                  Variáveis detectadas:
                </p>
                <div className="flex flex-wrap gap-1">
                  {extractVariables(formContent).length > 0 ? (
                    extractVariables(formContent).map((v) => (
                      <Badge key={v} variant="outline" className="bg-white text-violet-700 text-xs">
                        {`{{${v}}}`}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-violet-600">
                      Nenhuma variável detectada. Use {"{{nome}}"} no texto.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formName || !formContent || createMutation.isPending}
              className="bg-[#e2a93b] hover:bg-[#c99430] text-white"
            >
              {createMutation.isPending ? "Criando..." : "Criar Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome *</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Tipo *</label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TEMPLATE_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Conteúdo *</label>
              <p className="text-xs text-muted-foreground mb-1">
                Use {"{{nome_variavel}}"} para campos dinâmicos
              </p>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
            </div>
            {formContent && (
              <div className="bg-violet-50 p-3 rounded-md">
                <p className="text-xs font-medium text-violet-800 mb-1">
                  <Variable className="h-3 w-3 inline mr-1" />
                  Variáveis detectadas:
                </p>
                <div className="flex flex-wrap gap-1">
                  {extractVariables(formContent).map((v) => (
                    <Badge key={v} variant="outline" className="bg-white text-violet-700 text-xs">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formName || !formContent || updateMutation.isPending}
              className="bg-[#e2a93b] hover:bg-[#c99430] text-white"
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Preview */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {selectedTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className={TEMPLATE_TYPE_COLORS[selectedTemplate.template_type] ?? ""}
                >
                  {TEMPLATE_TYPE_LABELS[selectedTemplate.template_type] ?? selectedTemplate.template_type}
                </Badge>
                {selectedTemplate.category && (
                  <Badge variant="outline">
                    {CATEGORY_LABELS[selectedTemplate.category] ?? selectedTemplate.category}
                  </Badge>
                )}
                <Badge variant="outline">v{selectedTemplate.version}</Badge>
                <Badge variant="outline">{selectedTemplate.use_count ?? 0} usos</Badge>
              </div>

              {selectedTemplate.description && (
                <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
              )}

              {/* Variáveis */}
              {Object.keys(selectedTemplate.variables ?? {}).length > 0 && (
                <div className="bg-violet-50 p-3 rounded-md">
                  <p className="text-xs font-medium text-violet-800 mb-2">
                    <Variable className="h-3 w-3 inline mr-1" />
                    Variáveis ({Object.keys(selectedTemplate.variables).length})
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedTemplate.variables).map(([key, v]) => (
                      <div key={key} className="text-xs bg-white p-2 rounded border">
                        <span className="font-mono font-semibold text-violet-700">{`{{${key}}}`}</span>
                        <span className="text-muted-foreground ml-1">— {v.label}</span>
                        {v.required && <span className="text-red-500 ml-1">*</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conteúdo */}
              <div>
                <p className="text-sm font-medium mb-2">Conteúdo do Template</p>
                <div className="bg-gray-50 p-4 rounded-md border font-mono text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {selectedTemplate.content}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar Delete */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template "{selectedTemplate?.name}" será excluído permanentemente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
