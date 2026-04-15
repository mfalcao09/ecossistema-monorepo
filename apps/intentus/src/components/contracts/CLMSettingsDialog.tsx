import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useClmSettings } from "@/hooks/useClmSettings";
import {
  CONTRACT_OPTIONAL_FIELDS,
} from "@/lib/formCustomizationDefaults";
import {
  type ClmConfig,
  type ClmExtraField,
  CLM_ADJUSTMENT_INDICES,
  CLM_APPROVAL_ROLES,
  CLM_CLAUSE_CATEGORIES,
  CLM_DOCUMENT_TYPES,
  CLM_OBLIGATION_TYPES,
  CLM_RESPONSIBLE_PARTIES,
  CLM_AUDIT_ACTIONS,
  DEFAULT_CLM_CONFIG,
} from "@/lib/clmSettingsDefaults";
import {
  Plus, RotateCcw, Save, X, Trash2,
  FileText, ShieldCheck, RefreshCw, Scale, FolderOpen, Bell, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ── Reusable: add custom item inline ── */
function CustomItemAdder({
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  items: ClmExtraField[];
  onAdd: (item: ClmExtraField) => void;
  onRemove: (key: string) => void;
  placeholder: string;
}) {
  const [value, setValue] = useState("");

  function handleAdd() {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (items.some((i) => i.key === key)) {
      toast.error("Item já existe.");
      return;
    }
    onAdd({ key, label: trimmed });
    setValue("");
  }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50">
              <span className="text-sm">{item.label}</span>
              <button onClick={() => onRemove(item.key)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          className="h-8 text-sm flex-1"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
        />
        <Button type="button" size="sm" variant="outline" onClick={handleAdd}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

export function CLMSettingsDialog({ open, onOpenChange }: Props) {
  const { config, save, isSaving, reset, isResetting } = useClmSettings();
  const [draft, setDraft] = useState<ClmConfig>({ ...DEFAULT_CLM_CONFIG });

  useEffect(() => {
    if (open && config) {
      setDraft(JSON.parse(JSON.stringify(config)));
    }
  }, [open, config]);

  const patch = <K extends keyof ClmConfig>(key: K, value: ClmConfig[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function toggleArrayItem(arr: string[], item: string) {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  }

  async function handleSave() {
    await save(draft);
    onOpenChange(false);
  }

  async function handleReset() {
    await reset();
    onOpenChange(false);
  }

  // ── Extra fields (campos) ──
  const [newFieldLabel, setNewFieldLabel] = useState("");
  function addExtraField() {
    const trimmed = newFieldLabel.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if ([...CONTRACT_OPTIONAL_FIELDS, ...draft.contract_extra_fields].some((f) => f.key === key || f.label === trimmed)) {
      toast.error("Campo já existe.");
      return;
    }
    patch("contract_extra_fields", [...draft.contract_extra_fields, { key, label: trimmed }]);
    setNewFieldLabel("");
  }

  // ── Approval steps ──
  const [newStepName, setNewStepName] = useState("");
  const [newStepRole, setNewStepRole] = useState("gerente");
  const allApprovalRoles = [...CLM_APPROVAL_ROLES, ...draft.custom_approval_roles.map((r) => ({ value: r.key, label: r.label }))];

  function addApprovalStep() {
    if (!newStepName.trim()) return;
    patch("default_approval_steps", [...draft.default_approval_steps, { step_name: newStepName.trim(), role: newStepRole }]);
    setNewStepName("");
  }

  // ── Renewal checklist ──
  const [newChecklistLabel, setNewChecklistLabel] = useState("");
  function addChecklistItem() {
    if (!newChecklistLabel.trim()) return;
    const key = newChecklistLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    patch("renewal_checklist_items", [...draft.renewal_checklist_items, { key, label: newChecklistLabel.trim(), required: false }]);
    setNewChecklistLabel("");
  }

  // ── Custom document types ──
  const [newDocType, setNewDocType] = useState("");
  function addCustomDocType() {
    if (!newDocType.trim()) return;
    const key = newDocType.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    patch("custom_document_types", [...draft.custom_document_types, { key, label: newDocType.trim() }]);
    setNewDocType("");
  }

  // ── Alert days ──
  const [newAlertDay, setNewAlertDay] = useState("");
  function addAlertDay() {
    const num = parseInt(newAlertDay);
    if (isNaN(num) || num <= 0) return;
    if (draft.default_alert_days.includes(num)) return;
    patch("default_alert_days", [...draft.default_alert_days, num].sort((a, b) => b - a));
    setNewAlertDay("");
  }

  // Merged lists (default + custom)
  const allClauseCategories = [...CLM_CLAUSE_CATEGORIES, ...draft.custom_clause_categories.map((c) => ({ value: c.key, label: c.label }))];
  const allObligationTypes = [...CLM_OBLIGATION_TYPES, ...draft.custom_obligation_types.map((c) => ({ value: c.key, label: c.label }))];
  const allResponsibleParties = [...CLM_RESPONSIBLE_PARTIES, ...draft.custom_responsible_parties.map((c) => ({ value: c.key, label: c.label }))];
  const allAuditActions = [...CLM_AUDIT_ACTIONS, ...draft.custom_audit_actions.map((c) => ({ value: c.key, label: c.label }))];
  const allAdjustmentIndices = [...CLM_ADJUSTMENT_INDICES, ...draft.custom_adjustment_indices.map((c) => ({ value: c.key, label: c.label }))];

  const tabs = [
    { value: "campos", label: "Campos", icon: <FileText className="h-4 w-4" /> },
    { value: "aprovacao", label: "Aprovação", icon: <ShieldCheck className="h-4 w-4" /> },
    { value: "renovacao", label: "Renovação", icon: <RefreshCw className="h-4 w-4" /> },
    { value: "clausulas", label: "Cláusulas", icon: <Scale className="h-4 w-4" /> },
    { value: "documentos", label: "Documentos", icon: <FolderOpen className="h-4 w-4" /> },
    { value: "obrigacoes", label: "Obrigações", icon: <Bell className="h-4 w-4" /> },
    { value: "auditoria", label: "Auditoria", icon: <ClipboardList className="h-4 w-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-lg">Configurações CLM</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Central de configuração do ciclo de vida contratual. Isoladas por empresa.
          </p>
        </DialogHeader>

        <Tabs defaultValue="campos" orientation="vertical" className="flex-1 min-h-0">
          <div className="grid grid-cols-[180px_1fr] border-t border-border min-h-0" style={{ height: "calc(90vh - 160px)", maxHeight: "560px" }}>
            {/* Sidebar */}
            <TabsList className="flex flex-col h-full justify-start gap-0.5 rounded-none bg-muted/40 border-r border-border p-2">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="w-full justify-start gap-2 text-xs px-3 py-2 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  {tab.icon}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Content */}
            <ScrollArea className="h-full">
              <div className="p-5">
                {/* ── 1. Campos ── */}
                <TabsContent value="campos" className="space-y-4 mt-0">
                  <p className="text-xs text-muted-foreground">Oculte campos opcionais ou adicione campos personalizados ao formulário de contratos.</p>
                  <div className="space-y-2">
                    {[...CONTRACT_OPTIONAL_FIELDS, ...draft.contract_extra_fields].map((f) => (
                      <div key={f.key} className="flex items-center gap-2 py-1">
                        <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                          <Checkbox
                            checked={!draft.contract_hidden_fields.includes(f.key)}
                            onCheckedChange={() => patch("contract_hidden_fields", toggleArrayItem(draft.contract_hidden_fields, f.key))}
                          />
                          {f.label}
                        </label>
                        {draft.contract_extra_fields.some((x) => x.key === f.key) && (
                          <button
                            onClick={() => {
                              patch("contract_extra_fields", draft.contract_extra_fields.filter((x) => x.key !== f.key));
                              patch("contract_hidden_fields", draft.contract_hidden_fields.filter((h) => h !== f.key));
                            }}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex gap-2">
                    <Input className="h-8 text-sm flex-1" placeholder="Nome do novo campo..." value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtraField(); } }} />
                    <Button type="button" size="sm" variant="outline" onClick={addExtraField}><Plus className="h-4 w-4" /></Button>
                  </div>
                </TabsContent>

                {/* ── 2. Aprovação ── */}
                <TabsContent value="aprovacao" className="space-y-4 mt-0">
                  <p className="text-xs text-muted-foreground">Configure a cadeia de aprovação padrão para novos contratos.</p>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Cadeia de aprovação habilitada</Label>
                    <Switch checked={draft.approval_chain_enabled} onCheckedChange={(v) => patch("approval_chain_enabled", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Criar aprovação ao cadastrar contrato</Label>
                    <Switch checked={draft.auto_create_approval_on_new_contract} onCheckedChange={(v) => patch("auto_create_approval_on_new_contract", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Exigir todas as aprovações para ativar</Label>
                    <Switch checked={draft.require_all_approvals_for_activation} onCheckedChange={(v) => patch("require_all_approvals_for_activation", v)} />
                  </div>

                  <Separator />
                  <p className="text-xs font-medium text-foreground">Etapas padrão</p>
                  <div className="space-y-2">
                    {draft.default_approval_steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        <Badge variant="secondary" className="text-xs">{i + 1}</Badge>
                        <span className="text-sm flex-1">{step.step_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {allApprovalRoles.find((r) => r.value === step.role)?.label ?? step.role}
                        </Badge>
                        <button onClick={() => patch("default_approval_steps", draft.default_approval_steps.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input className="h-8 text-sm flex-1" placeholder="Nome da etapa..." value={newStepName} onChange={(e) => setNewStepName(e.target.value)} />
                    <Select value={newStepRole} onValueChange={setNewStepRole}>
                      <SelectTrigger className="w-[140px] h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allApprovalRoles.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="outline" onClick={addApprovalStep}><Plus className="h-4 w-4" /></Button>
                  </div>

                  <Separator />
                  <p className="text-xs font-medium text-foreground">Papéis/cargos customizados</p>
                  <CustomItemAdder
                    items={draft.custom_approval_roles}
                    onAdd={(item) => patch("custom_approval_roles", [...draft.custom_approval_roles, item])}
                    onRemove={(key) => patch("custom_approval_roles", draft.custom_approval_roles.filter((i) => i.key !== key))}
                    placeholder="Novo papel (ex: Compliance)..."
                  />
                </TabsContent>

                {/* ── 3. Renovação ── */}
                <TabsContent value="renovacao" className="space-y-4 mt-0">
                  <p className="text-xs text-muted-foreground">Defina regras padrão para renovação de contratos.</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Prazo padrão (meses)</Label>
                      <Input type="number" className="h-8 text-sm" value={draft.default_renewal_term_months} onChange={(e) => patch("default_renewal_term_months", parseInt(e.target.value) || 12)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Índice de reajuste padrão</Label>
                      <Select value={draft.default_adjustment_index} onValueChange={(v) => patch("default_adjustment_index", v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {allAdjustmentIndices.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Alertar X dias antes</Label>
                      <Input type="number" className="h-8 text-sm" value={draft.renewal_alert_days_before} onChange={(e) => patch("renewal_alert_days_before", parseInt(e.target.value) || 60)} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Criar aditivo automaticamente</Label>
                    <Switch checked={draft.auto_create_addendum} onCheckedChange={(v) => patch("auto_create_addendum", v)} />
                  </div>

                  <Separator />
                  <p className="text-xs font-medium text-foreground">Checklist de renovação</p>
                  <div className="space-y-2">
                    {draft.renewal_checklist_items.map((item, i) => (
                      <div key={item.key} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                        <span className="text-sm flex-1">{item.label}</span>
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Checkbox checked={item.required} onCheckedChange={(v) => {
                            const items = [...draft.renewal_checklist_items];
                            items[i] = { ...items[i], required: !!v };
                            patch("renewal_checklist_items", items);
                          }} />
                          Obrigatório
                        </label>
                        <button onClick={() => patch("renewal_checklist_items", draft.renewal_checklist_items.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input className="h-8 text-sm flex-1" placeholder="Nome do item..." value={newChecklistLabel} onChange={(e) => setNewChecklistLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }} />
                    <Button type="button" size="sm" variant="outline" onClick={addChecklistItem}><Plus className="h-4 w-4" /></Button>
                  </div>

                  <Separator />
                  <p className="text-xs font-medium text-foreground">Índices de reajuste customizados</p>
                  <CustomItemAdder
                    items={draft.custom_adjustment_indices}
                    onAdd={(item) => patch("custom_adjustment_indices", [...draft.custom_adjustment_indices, item])}
                    onRemove={(key) => patch("custom_adjustment_indices", draft.custom_adjustment_indices.filter((i) => i.key !== key))}
                    placeholder="Novo índice (ex: INCC)..."
                  />
                </TabsContent>

                {/* ── 4. Cláusulas ── */}
                <TabsContent value="clausulas" className="space-y-4 mt-0">
                  <p className="text-xs text-muted-foreground">Configure categorias de cláusulas e regras de renegociação.</p>

                  <p className="text-xs font-medium text-foreground">Categorias habilitadas</p>
                  <div className="grid grid-cols-2 gap-2">
                    {allClauseCategories.map((cat) => (
                      <label key={cat.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={draft.clause_categories_enabled.includes(cat.value)}
                          onCheckedChange={() => patch("clause_categories_enabled", toggleArrayItem(draft.clause_categories_enabled, cat.value))}
                        />
                        {cat.label}
                      </label>
                    ))}
                  </div>

                  <Separator />
                  <p className="text-xs font-medium text-foreground">Categorias customizadas</p>
                  <CustomItemAdder
                    items={draft.custom_clause_categories}
                    onAdd={(item) => {
                      patch("custom_clause_categories", [...draft.custom_clause_categories, item]);
                      patch("clause_categories_enabled", [...draft.clause_categories_enabled, item.key]);
                    }}
                    onRemove={(key) => {
                      patch("custom_clause_categories", draft.custom_clause_categories.filter((i) => i.key !== key));
                      patch("clause_categories_enabled", draft.clause_categories_enabled.filter((v) => v !== key));
                    }}
                    placeholder="Nova categoria (ex: Penalidade)..."
                  />

                  <Separator />
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Exigir aprovação de cláusulas</Label>
                    <Switch checked={draft.require_clause_approval} onCheckedChange={(v) => patch("require_clause_approval", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Permitir comentários inline</Label>
                    <Switch checked={draft.allow_inline_comments} onCheckedChange={(v) => patch("allow_inline_comments", v)} />
                  </div>
                </TabsContent>

                {/* ── 5. Documentos ── */}
                <TabsContent value="documentos" className="space-y-4 mt-0">
                  <p className="text-xs text-muted-foreground">Configure o repositório de documentos contratuais.</p>

                  <p className="text-xs font-medium text-foreground">Tipos de documento habilitados</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CLM_DOCUMENT_TYPES.map((dt) => (
                      <label key={dt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={draft.document_types_enabled.includes(dt.value)}
                          onCheckedChange={() => patch("document_types_enabled", toggleArrayItem(draft.document_types_enabled, dt.value))}
                        />
                        {dt.label}
                      </label>
                    ))}
                  </div>

                  <Separator />
                  <p className="text-xs font-medium text-foreground">Tipos customizados</p>
                  {draft.custom_document_types.length > 0 && (
                    <div className="space-y-1">
                      {draft.custom_document_types.map((dt) => (
                        <div key={dt.key} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50">
                          <span className="text-sm">{dt.label}</span>
                          <button onClick={() => patch("custom_document_types", draft.custom_document_types.filter((x) => x.key !== dt.key))} className="text-muted-foreground hover:text-destructive">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input className="h-8 text-sm flex-1" placeholder="Novo tipo de documento..." value={newDocType} onChange={(e) => setNewDocType(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomDocType(); } }} />
                    <Button type="button" size="sm" variant="outline" onClick={addCustomDocType}><Plus className="h-4 w-4" /></Button>
                  </div>

                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-xs">Tamanho máximo de arquivo (MB)</Label>
                    <Input type="number" className="h-8 text-sm w-24" value={draft.max_file_size_mb} onChange={(e) => patch("max_file_size_mb", parseInt(e.target.value) || 25)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Exigir aprovação antes de assinar</Label>
                    <Switch checked={draft.require_approval_before_signing} onCheckedChange={(v) => patch("require_approval_before_signing", v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Versionar automaticamente ao fazer upload</Label>
                    <Switch checked={draft.auto_version_on_upload} onCheckedChange={(v) => patch("auto_version_on_upload", v)} />
                  </div>
                </TabsContent>

                {/* ── 6. Obrigações ── */}
                <TabsContent value="obrigacoes" className="space-y-4 mt-0">
                  <p className="text-xs text-muted-foreground">Configure tipos de obrigação, alertas e recorrência.</p>

                  <p className="text-xs font-medium text-foreground">Tipos de obrigação habilitados</p>
                  <div className="grid grid-cols-2 gap-2">
                    {allObligationTypes.map((ot) => (
                      <label key={ot.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={draft.obligation_types_enabled.includes(ot.value)}
                          onCheckedChange={() => patch("obligation_types_enabled", toggleArrayItem(draft.obligation_types_enabled, ot.value))}
                        />
                        {ot.label}
                      </label>
                    ))}
                  </div>

                  <Separator />
                  <p className="text-xs font-medium text-foreground">Tipos customizados</p>
                  <CustomItemAdder
                    items={draft.custom_obligation_types}
                    onAdd={(item) => {
                      patch("custom_obligation_types", [...draft.custom_obligation_types, item]);
                      patch("obligation_types_enabled", [...draft.obligation_types_enabled, item.key]);
                    }}
                    onRemove={(key) => {
                      patch("custom_obligation_types", draft.custom_obligation_types.filter((i) => i.key !== key));
                      patch("obligation_types_enabled", draft.obligation_types_enabled.filter((v) => v !== key));
                    }}
                    placeholder="Novo tipo (ex: Ambiental)..."
                  />

                  <Separator />
                  <p className="text-xs font-medium text-foreground">Dias de alerta</p>
                  <div className="flex flex-wrap gap-2">
                    {draft.default_alert_days.map((day) => (
                      <Badge key={day} variant="secondary" className="gap-1">
                        {day} dias
                        <button onClick={() => patch("default_alert_days", draft.default_alert_days.filter((d) => d !== day))} className="text-muted-foreground hover:text-destructive ml-1">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input type="number" className="h-8 text-sm w-24" placeholder="Dias..." value={newAlertDay} onChange={(e) => setNewAlertDay(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAlertDay(); } }} />
                    <Button type="button" size="sm" variant="outline" onClick={addAlertDay}><Plus className="h-4 w-4" /></Button>
                  </div>

                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-xs">Responsável padrão</Label>
                    <Select value={draft.default_responsible_party} onValueChange={(v) => patch("default_responsible_party", v)}>
                      <SelectTrigger className="h-8 text-sm w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allResponsibleParties.map((rp) => <SelectItem key={rp.value} value={rp.value}>{rp.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />
                  <p className="text-xs font-medium text-foreground">Responsáveis customizados</p>
                  <CustomItemAdder
                    items={draft.custom_responsible_parties}
                    onAdd={(item) => patch("custom_responsible_parties", [...draft.custom_responsible_parties, item])}
                    onRemove={(key) => patch("custom_responsible_parties", draft.custom_responsible_parties.filter((i) => i.key !== key))}
                    placeholder="Novo responsável (ex: Síndico)..."
                  />

                  <Separator />
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Gerar próxima recorrência automaticamente</Label>
                    <Switch checked={draft.auto_generate_next_recurrence} onCheckedChange={(v) => patch("auto_generate_next_recurrence", v)} />
                  </div>
                </TabsContent>

                {/* ── 7. Auditoria ── */}
                <TabsContent value="auditoria" className="space-y-4 mt-0">
                  <p className="text-xs text-muted-foreground">Configure quais ações são rastreadas e por quanto tempo os logs são mantidos.</p>

                  <p className="text-xs font-medium text-foreground">Ações rastreadas</p>
                  <div className="grid grid-cols-2 gap-2">
                    {allAuditActions.map((a) => (
                      <label key={a.value} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={draft.audit_actions_tracked.includes(a.value)}
                          onCheckedChange={() => patch("audit_actions_tracked", toggleArrayItem(draft.audit_actions_tracked, a.value))}
                        />
                        {a.label}
                      </label>
                    ))}
                  </div>

                  <Separator />
                  <p className="text-xs font-medium text-foreground">Ações customizadas</p>
                  <CustomItemAdder
                    items={draft.custom_audit_actions}
                    onAdd={(item) => {
                      patch("custom_audit_actions", [...draft.custom_audit_actions, item]);
                      patch("audit_actions_tracked", [...draft.audit_actions_tracked, item.key]);
                    }}
                    onRemove={(key) => {
                      patch("custom_audit_actions", draft.custom_audit_actions.filter((i) => i.key !== key));
                      patch("audit_actions_tracked", draft.audit_actions_tracked.filter((v) => v !== key));
                    }}
                    placeholder="Nova ação (ex: Notificação Enviada)..."
                  />

                  <Separator />
                  <div className="space-y-1">
                    <Label className="text-xs">Retenção de logs (dias)</Label>
                    <Input type="number" className="h-8 text-sm w-32" value={draft.audit_retention_days} onChange={(e) => patch("audit_retention_days", parseInt(e.target.value) || 365)} />
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </div>
        </Tabs>

        <DialogFooter className="px-6 pb-5 pt-3 border-t border-border flex-row gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleReset} disabled={isResetting}>
            <RotateCcw className="h-4 w-4 mr-1" />
            {isResetting ? "Restaurando..." : "Restaurar Padrão"}
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
