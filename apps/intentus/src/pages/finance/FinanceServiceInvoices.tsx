import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Download, FileText, Search } from "lucide-react";
import {
  useServiceInvoices, useCreateServiceInvoice, useUpdateServiceInvoice, useDeleteServiceInvoice,
  revenueSourceLabels, invoiceStatusLabels, invoiceStatusColors,
} from "@/hooks/useServiceInvoices";
import { exportToCSV } from "@/lib/csvExport";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function FinanceServiceInvoices() {
  const { data: invoices = [], isLoading } = useServiceInvoices();
  const create = useCreateServiceInvoice();
  const update = useUpdateServiceInvoice();
  const remove = useDeleteServiceInvoice();

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ invoice_number: "", issue_date: "", amount: 0, tax_amount: 0, net_amount: 0, service_description: "", tomador_name: "", tomador_cpf_cnpj: "", revenue_source: "administracao", status: "emitida", notes: "" });

  const emitidas = invoices.filter((i: any) => i.status === "emitida");
  const totalMes = emitidas.reduce((s: number, i: any) => s + Number(i.amount), 0);

  const filtered = invoices.filter((i: any) => !search || i.invoice_number?.includes(search) || i.tomador_name?.toLowerCase().includes(search.toLowerCase()));

  function openNew() {
    setEditing(null);
    setForm({ invoice_number: "", issue_date: "", amount: 0, tax_amount: 0, net_amount: 0, service_description: "", tomador_name: "", tomador_cpf_cnpj: "", revenue_source: "administracao", status: "emitida", notes: "" });
    setDialogOpen(true);
  }

  function openEdit(inv: any) {
    setEditing(inv);
    setForm({ invoice_number: inv.invoice_number, issue_date: inv.issue_date, amount: Number(inv.amount), tax_amount: Number(inv.tax_amount), net_amount: Number(inv.net_amount), service_description: inv.service_description, tomador_name: inv.tomador_name, tomador_cpf_cnpj: inv.tomador_cpf_cnpj || "", revenue_source: inv.revenue_source, status: inv.status, notes: inv.notes || "" });
    setDialogOpen(true);
  }

  function handleSave() {
    const payload = { ...form, tomador_cpf_cnpj: form.tomador_cpf_cnpj || null, notes: form.notes || null };
    if (editing) { update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setDialogOpen(false) }); }
    else { create.mutate(payload, { onSuccess: () => setDialogOpen(false) }); }
  }

  function handleExport() {
    exportToCSV(filtered, "notas-fiscais", { invoice_number: "Número", issue_date: "Data Emissão", amount: "Valor", tax_amount: "Impostos", net_amount: "Líquido", tomador_name: "Tomador", revenue_source: "Origem", status: "Status" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Notas Fiscais de Serviço</h1>
          <p className="text-muted-foreground text-sm">Controle de NFS-e emitidas pela imobiliária</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" /> Exportar CSV</Button>
          <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Nota</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Emitidas no Mês</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{emitidas.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(totalMes)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Canceladas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{invoices.filter((i: any) => i.status === "cancelada").length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Registradas</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{invoices.length}</div></CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por número ou tomador..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Número</TableHead><TableHead>Data Emissão</TableHead><TableHead>Tomador</TableHead><TableHead>Valor</TableHead><TableHead>Impostos</TableHead><TableHead>Líquido</TableHead><TableHead>Origem</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />Nenhuma nota fiscal.</TableCell></TableRow>
              : filtered.map((inv: any) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono font-bold">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.issue_date}</TableCell>
                  <TableCell className="font-medium">{inv.tomador_name}</TableCell>
                  <TableCell>{fmt(Number(inv.amount))}</TableCell>
                  <TableCell>{fmt(Number(inv.tax_amount))}</TableCell>
                  <TableCell className="font-bold">{fmt(Number(inv.net_amount))}</TableCell>
                  <TableCell><Badge variant="secondary">{revenueSourceLabels[inv.revenue_source] || inv.revenue_source}</Badge></TableCell>
                  <TableCell><Badge className={invoiceStatusColors[inv.status]}>{invoiceStatusLabels[inv.status] || inv.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(inv)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove.mutate(inv.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Nota Fiscal" : "Registrar NFS-e"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Número *</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Data Emissão *</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Valor (R$) *</Label><Input type="number" value={form.amount} onChange={(e) => { const v = Number(e.target.value); setForm({ ...form, amount: v, net_amount: v - form.tax_amount }); }} /></div>
              <div className="space-y-1.5"><Label>Impostos (R$)</Label><Input type="number" value={form.tax_amount} onChange={(e) => { const v = Number(e.target.value); setForm({ ...form, tax_amount: v, net_amount: form.amount - v }); }} /></div>
              <div className="space-y-1.5"><Label>Líquido (R$)</Label><Input type="number" value={form.net_amount} readOnly className="bg-muted" /></div>
            </div>
            <div className="space-y-1.5"><Label>Descrição do Serviço *</Label><Input value={form.service_description} onChange={(e) => setForm({ ...form, service_description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Tomador *</Label><Input value={form.tomador_name} onChange={(e) => setForm({ ...form, tomador_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>CPF/CNPJ</Label><Input value={form.tomador_cpf_cnpj} onChange={(e) => setForm({ ...form, tomador_cpf_cnpj: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Origem da Receita</Label>
                <Select value={form.revenue_source} onValueChange={(v) => setForm({ ...form, revenue_source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(revenueSourceLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(invoiceStatusLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.invoice_number || !form.issue_date || !form.tomador_name || create.isPending || update.isPending}>{editing ? "Salvar" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
