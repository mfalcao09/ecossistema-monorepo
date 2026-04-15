import { useState, useMemo } from "react";
import { useChartOfAccounts, ChartAccount, ChartAccountInput } from "@/hooks/useChartOfAccounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, ChevronRight, ChevronDown, FolderTree, Pencil, Trash2, Download, Upload } from "lucide-react";
import { downloadChartTemplate } from "@/lib/chartOfAccountsTemplate";
import ChartImportDialog from "@/components/finance/ChartImportDialog";

const ACCOUNT_TYPES = [
  { value: "ativo", label: "Ativo" },
  { value: "passivo", label: "Passivo" },
  { value: "receita", label: "Receita" },
  { value: "despesa", label: "Despesa" },
  { value: "patrimonio_liquido", label: "Patrimônio Líquido" },
];

const NATURES = [
  { value: "devedora", label: "Devedora" },
  { value: "credora", label: "Credora" },
];

const typeColors: Record<string, string> = {
  ativo: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  passivo: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  receita: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  despesa: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  patrimonio_liquido: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

interface TreeNode extends ChartAccount {
  children: TreeNode[];
}

function buildTree(accounts: ChartAccount[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  accounts.forEach((a) => map.set(a.id, { ...a, children: [] }));
  accounts.forEach((a) => {
    const node = map.get(a.id)!;
    if (a.parent_id && map.has(a.parent_id)) {
      map.get(a.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function matchesSearch(node: TreeNode, q: string): boolean {
  const lower = q.toLowerCase();
  if (node.code.toLowerCase().includes(lower) || node.name.toLowerCase().includes(lower)) return true;
  return node.children.some((c) => matchesSearch(c, q));
}

const emptyForm: ChartAccountInput = {
  code: "",
  name: "",
  account_type: "ativo",
  nature: "devedora",
  parent_id: null,
  level: 1,
  is_active: true,
  notes: "",
};

export default function FinanceChartOfAccounts() {
  const { accounts, isLoading, create, update, remove, bulkCreate } = useChartOfAccounts();
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ChartAccountInput>(emptyForm);

  const tree = useMemo(() => buildTree(accounts), [accounts]);

  const filteredTree = useMemo(() => {
    if (!search) return tree;
    const filter = (nodes: TreeNode[]): TreeNode[] =>
      nodes
        .filter((n) => matchesSearch(n, search))
        .map((n) => ({ ...n, children: filter(n.children) }));
    return filter(tree);
  }, [tree, search]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openCreate = (parentId?: string, parentCode?: string, parentLevel?: number) => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      parent_id: parentId || null,
      code: parentCode ? parentCode + "." : "",
      level: parentLevel ? parentLevel + 1 : 1,
    });
    setDialogOpen(true);
  };

  const openEdit = (account: ChartAccount) => {
    setEditingId(account.id);
    setForm({
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      nature: account.nature,
      parent_id: account.parent_id,
      level: account.level,
      is_active: account.is_active,
      notes: account.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const level = form.code.split(".").length;
    const payload = { ...form, level };
    if (editingId) {
      update.mutate({ id: editingId, ...payload }, { onSuccess: () => setDialogOpen(false) });
    } else {
      create.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  };

  // KPIs
  const total = accounts.length;
  const active = accounts.filter((a) => a.is_active).length;
  const byType = ACCOUNT_TYPES.map((t) => ({
    ...t,
    count: accounts.filter((a) => a.account_type === t.value).length,
  }));

  const renderNode = (node: TreeNode) => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const typeLabel = ACCOUNT_TYPES.find((t) => t.value === node.account_type)?.label || node.account_type;

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md group transition-colors"
          style={{ paddingLeft: `${(node.level - 1) * 24 + 12}px` }}
        >
          <button
            onClick={() => hasChildren && toggleExpand(node.id)}
            className="w-5 h-5 flex items-center justify-center shrink-0"
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <span className="w-4" />
            )}
          </button>
          <span className="font-mono text-sm text-muted-foreground w-24 shrink-0">{node.code}</span>
          <span className={`flex-1 text-sm ${!node.is_active ? "line-through text-muted-foreground" : ""}`}>
            {node.name}
          </span>
          <Badge variant="outline" className={`text-[10px] ${typeColors[node.account_type] || ""}`}>
            {typeLabel}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {node.nature === "devedora" ? "D" : "C"}
          </Badge>
          <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCreate(node.id, node.code, node.level)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(node)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(node.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {hasChildren && isExpanded && node.children.map(renderNode)}
      </div>
    );
  };

  // Potential parents for the dialog selector
  const parentOptions = accounts.filter((a) => editingId ? a.id !== editingId : true);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plano de Contas</h1>
          <p className="text-muted-foreground text-sm">Estrutura hierárquica de contas contábeis</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadChartTemplate}>
            <Download className="h-4 w-4 mr-2" /> Baixar Modelo
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Importar CSV
          </Button>
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4 mr-2" /> Nova Conta
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Ativas</p>
            <p className="text-2xl font-bold text-green-600">{active}</p>
          </CardContent>
        </Card>
        {byType.map((t) => (
          <Card key={t.value}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="text-2xl font-bold">{t.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Tree */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <FolderTree className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Árvore de Contas</CardTitle>
            <div className="flex-1" />
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
          ) : filteredTree.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderTree className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma conta cadastrada</p>
              <p className="text-xs mt-1">Clique em "Nova Conta" para começar</p>
            </div>
          ) : (
            <div className="divide-y">{filteredTree.map(renderNode)}</div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Conta" : "Nova Conta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  placeholder="Ex: 1.1.01"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Conta Pai</Label>
                <Select
                  value={form.parent_id || "__none__"}
                  onValueChange={(v) => setForm({ ...form, parent_id: v === "__none__" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Nenhuma (raiz)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma (raiz)</SelectItem>
                    {parentOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Caixa e Equivalentes"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Natureza</Label>
                <Select value={form.nature} onValueChange={(v) => setForm({ ...form, nature: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NATURES.map((n) => (
                      <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.notes || ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Conta ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.code || !form.name || create.isPending || update.isPending}>
              {editingId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChartImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existingCodes={new Set(accounts.map((a) => a.code))}
        isPending={bulkCreate.isPending}
        onConfirm={(inputs) => {
          bulkCreate.mutate(inputs, { onSuccess: () => setImportOpen(false) });
        }}
      />
    </div>
  );
}
