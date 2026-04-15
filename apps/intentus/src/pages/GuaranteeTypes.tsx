import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Shield, Search, GripVertical, X } from "lucide-react";
import {
  useGuaranteeTypes,
  useCreateGuaranteeType,
  useUpdateGuaranteeType,
  useDeleteGuaranteeType,
  type GuaranteeType,
  type BusinessRules,
  type DocumentGroup,
  type ValidationStep,
} from "@/hooks/useGuaranteeTypes";

const EMPTY_RULES: BusinessRules = { document_groups: [], validation_steps: [], notes: "" };

function parseRules(gt: GuaranteeType): BusinessRules {
  const raw = gt.business_rules as any;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return {
      document_groups: Array.isArray(raw.document_groups) ? raw.document_groups : [],
      validation_steps: Array.isArray(raw.validation_steps) ? raw.validation_steps : [],
      notes: raw.notes || "",
    };
  }
  return { ...EMPTY_RULES };
}

export default function GuaranteeTypes() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GuaranteeType | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [rules, setRules] = useState<BusinessRules>({ ...EMPTY_RULES });

  const { data: types = [], isLoading } = useGuaranteeTypes();
  const create = useCreateGuaranteeType();
  const update = useUpdateGuaranteeType();
  const remove = useDeleteGuaranteeType();

  const filtered = types.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  function openNew() {
    setEditing(null);
    setForm({ name: "", description: "" });
    setRules({ document_groups: [], validation_steps: [], notes: "" });
    setDialogOpen(true);
  }

  function openEdit(t: GuaranteeType) {
    setEditing(t);
    setForm({ name: t.name, description: t.description || "" });
    setRules(parseRules(t));
    setDialogOpen(true);
  }

  function handleSave() {
    const payload = {
      name: form.name,
      description: form.description,
      business_rules: rules,
    };
    if (editing) {
      update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setDialogOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  }

  // --- Document Groups helpers ---
  function addDocGroup() {
    setRules((r) => ({
      ...r,
      document_groups: [...(r.document_groups || []), { party_role: "", label: "", documents: [] }],
    }));
  }
  function updateDocGroup(idx: number, patch: Partial<DocumentGroup>) {
    setRules((r) => {
      const groups = [...(r.document_groups || [])];
      groups[idx] = { ...groups[idx], ...patch };
      return { ...r, document_groups: groups };
    });
  }
  function removeDocGroup(idx: number) {
    setRules((r) => ({ ...r, document_groups: (r.document_groups || []).filter((_, i) => i !== idx) }));
  }

  // --- Validation Steps helpers ---
  function addStep() {
    const steps = rules.validation_steps || [];
    setRules((r) => ({
      ...r,
      validation_steps: [...steps, { order: steps.length + 1, name: "", description: "", required: true }],
    }));
  }
  function updateStep(idx: number, patch: Partial<ValidationStep>) {
    setRules((r) => {
      const steps = [...(r.validation_steps || [])];
      steps[idx] = { ...steps[idx], ...patch };
      return { ...r, validation_steps: steps };
    });
  }
  function removeStep(idx: number) {
    setRules((r) => ({
      ...r,
      validation_steps: (r.validation_steps || []).filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })),
    }));
  }

  // --- Summary helpers ---
  function rulesSummary(t: GuaranteeType) {
    const r = parseRules(t);
    const dg = r.document_groups?.length || 0;
    const vs = r.validation_steps?.length || 0;
    return { dg, vs };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Garantias Contratuais</h1>
          <p className="text-muted-foreground text-sm">Cadastro dos tipos de garantia aceitos pela imobiliária</p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Garantia
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar garantia..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Regras</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Nenhum tipo de garantia cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => {
                  const { dg, vs } = rulesSummary(t);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">{t.description || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {dg > 0 && <Badge variant="secondary" className="text-xs">{dg} grupo{dg > 1 ? "s" : ""} docs</Badge>}
                          {vs > 0 && <Badge variant="outline" className="text-xs">{vs} etapa{vs > 1 ? "s" : ""}</Badge>}
                          {dg === 0 && vs === 0 && <span className="text-muted-foreground text-sm">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.active ? "default" : "outline"}>{t.active ? "Ativo" : "Inativo"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => update.mutate({ id: t.id, active: !t.active })}>
                            <Switch checked={t.active} className="pointer-events-none" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove.mutate(t.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog with tabs */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Garantia" : "Nova Garantia"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="geral" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
              <TabsTrigger value="etapas">Etapas</TabsTrigger>
              <TabsTrigger value="observacoes">Observações</TabsTrigger>
            </TabsList>

            {/* Tab Geral */}
            <TabsContent value="geral" className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Seguro Fiança" />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descreva as características deste tipo de garantia..." rows={3} />
              </div>
            </TabsContent>

            {/* Tab Documentos */}
            <TabsContent value="documentos" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">Configure grupos de documentos por papel (locatário, fiador, proprietário, etc).</p>
              {(rules.document_groups || []).map((g, idx) => (
                <Card key={idx} className="p-4 space-y-3 relative">
                  <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={() => removeDocGroup(idx)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Papel da parte</Label>
                      <Input value={g.party_role} onChange={(e) => updateDocGroup(idx, { party_role: e.target.value })} placeholder="Ex: locatario, fiador" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rótulo</Label>
                      <Input value={g.label} onChange={(e) => updateDocGroup(idx, { label: e.target.value })} placeholder="Ex: Documentos do Locatário" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Documentos (separados por vírgula)</Label>
                    <Input
                      value={(g.documents || []).join(", ")}
                      onChange={(e) => updateDocGroup(idx, { documents: e.target.value.split(",").map((d) => d.trim()).filter(Boolean) })}
                      placeholder="RG, CPF, Comprovante de Renda..."
                    />
                  </div>
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={addDocGroup}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Grupo
              </Button>
            </TabsContent>

            {/* Tab Etapas */}
            <TabsContent value="etapas" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">Configure as etapas de validação para este tipo de garantia.</p>
              {(rules.validation_steps || []).map((s, idx) => (
                <Card key={idx} className="p-4 space-y-3 relative">
                  <div className="flex items-center gap-2 absolute top-2 right-2">
                    <span className="text-xs text-muted-foreground">#{s.order}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeStep(idx)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nome da etapa</Label>
                    <Input value={s.name} onChange={(e) => updateStep(idx, { name: e.target.value })} placeholder="Ex: Análise Cadastral" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Descrição</Label>
                    <Input value={s.description} onChange={(e) => updateStep(idx, { description: e.target.value })} placeholder="Ex: Verificar idoneidade financeira" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={s.required} onCheckedChange={(v) => updateStep(idx, { required: !!v })} id={`step-req-${idx}`} />
                    <Label htmlFor={`step-req-${idx}`} className="text-xs cursor-pointer">Obrigatória</Label>
                  </div>
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={addStep}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Etapa
              </Button>
            </TabsContent>

            {/* Tab Observações */}
            <TabsContent value="observacoes" className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label>Observações e regras adicionais</Label>
                <Textarea
                  value={rules.notes || ""}
                  onChange={(e) => setRules((r) => ({ ...r, notes: e.target.value }))}
                  placeholder="Texto livre com observações adicionais da regra de negócio..."
                  rows={6}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || create.isPending || update.isPending}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
