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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Building, CreditCard, Landmark, Key } from "lucide-react";
import {
  useBankAccounts,
  useCreateBankAccount,
  useUpdateBankAccount,
  useDeleteBankAccount,
  accountTypeLabels,
  type BankAccount,
} from "@/hooks/useBankAccounts";
import {
  useBankCredentials,
  useCreateBankCredential,
} from "@/hooks/useBankIntegration";

const emptyForm = {
  name: "",
  bank_name: "",
  agency: "",
  account_number: "",
  account_type: "operacional",
  pix_key: "",
  active: true,
  notes: "",
};

// ─── File to Base64 helper ───
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FinanceBankAccounts() {
  const [activeTab, setActiveTab] = useState("contas");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Contas Bancárias</h1>
        <p className="text-muted-foreground text-sm">Gestão de contas operacionais, transitórias e credenciais API</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="contas"><Landmark className="h-3.5 w-3.5 mr-1" />Contas</TabsTrigger>
          <TabsTrigger value="credenciais"><Key className="h-3.5 w-3.5 mr-1" />Credenciais API</TabsTrigger>
        </TabsList>
        <TabsContent value="contas"><AccountsTab /></TabsContent>
        <TabsContent value="credenciais"><CredentialsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Accounts Tab (original content) ───
function AccountsTab() {
  const { data: accounts = [], isLoading } = useBankAccounts();
  const create = useCreateBankAccount();
  const update = useUpdateBankAccount();
  const remove = useDeleteBankAccount();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState(emptyForm);

  const operacional = accounts.filter((a) => a.account_type === "operacional");
  const transitoria = accounts.filter((a) => a.account_type === "transitoria");

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(a: BankAccount) {
    setEditing(a);
    setForm({
      name: a.name,
      bank_name: a.bank_name || "",
      agency: a.agency || "",
      account_number: a.account_number || "",
      account_type: a.account_type,
      pix_key: a.pix_key || "",
      active: a.active,
      notes: a.notes || "",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (editing) {
      update.mutate({ id: editing.id, ...form } as any, { onSuccess: () => setDialogOpen(false) });
    } else {
      create.mutate(form as any, { onSuccess: () => setDialogOpen(false) });
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" />Nova Conta</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total de Contas</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{accounts.filter(a => a.active).length} ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Operacionais</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2"><Building className="h-5 w-5 text-primary" />{operacional.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Faturamento próprio da imobiliária</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Transitórias / Garantia</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2"><Landmark className="h-5 w-5 text-amber-500" />{transitoria.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Dinheiro de terceiros (aluguéis, sinais)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Agência / Conta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Chave PIX</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    Nenhuma conta cadastrada. Crie contas operacionais e transitórias.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.bank_name || "—"}</TableCell>
                    <TableCell>{a.agency && a.account_number ? `${a.agency} / ${a.account_number}` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={a.account_type === "transitoria" ? "secondary" : "default"}>
                        {accountTypeLabels[a.account_type] || a.account_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{a.pix_key || "—"}</TableCell>
                    <TableCell><Badge variant={a.active ? "default" : "outline"}>{a.active ? "Ativa" : "Inativa"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Conta" : "Nova Conta Bancária"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome da Conta *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Conta Principal Itaú" />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(accountTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Banco</Label>
                <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Ex: Itaú" />
              </div>
              <div className="space-y-1.5">
                <Label>Agência</Label>
                <Input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} placeholder="0001" />
              </div>
              <div className="space-y-1.5">
                <Label>Conta</Label>
                <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="12345-6" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Chave PIX</Label>
              <Input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} placeholder="CNPJ, e-mail, telefone ou chave aleatória" />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Conta Ativa</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || create.isPending || update.isPending}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Credentials Tab (moved from FinanceBankIntegration) ───
function CredentialsTab() {
  const { data: creds = [], isLoading } = useBankCredentials();
  const { data: accounts = [] } = useBankAccounts();
  const createCred = useCreateBankCredential();
  const [credDialog, setCredDialog] = useState(false);
  const [form, setForm] = useState({
    bank_account_id: "", provider: "inter" as const, client_id: "", client_secret: "",
    certificate_base64: "", certificate_key_base64: "", api_environment: "sandbox",
  });
  const [certFileName, setCertFileName] = useState("");
  const [keyFileName, setKeyFileName] = useState("");

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCertFileName(file.name);
    const b64 = await fileToBase64(file);
    setForm((prev) => ({ ...prev, certificate_base64: b64 }));
  };

  const handleKeyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKeyFileName(file.name);
    const b64 = await fileToBase64(file);
    setForm((prev) => ({ ...prev, certificate_key_base64: b64 }));
  };

  const handleSubmit = () => {
    if (!form.bank_account_id || !form.client_id || !form.client_secret) {
      return;
    }
    createCred.mutate(form, {
      onSuccess: () => {
        setCredDialog(false);
        setForm({ bank_account_id: "", provider: "inter", client_id: "", client_secret: "", certificate_base64: "", certificate_key_base64: "", api_environment: "sandbox" });
        setCertFileName("");
        setKeyFileName("");
      },
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Credenciais API Bancárias</CardTitle>
          <Button size="sm" onClick={() => setCredDialog(true)}><Plus className="h-3.5 w-3.5 mr-1" />Nova Credencial</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conta</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Ambiente</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : creds.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma credencial cadastrada</TableCell></TableRow>
              ) : creds.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.bank_accounts?.name || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{c.provider}</Badge></TableCell>
                  <TableCell>{c.api_environment}</TableCell>
                  <TableCell><Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Ativa" : "Inativa"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={credDialog} onOpenChange={setCredDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nova Credencial Bancária</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label>Conta Bancária *</Label>
              <Select value={form.bank_account_id} onValueChange={(v) => setForm({ ...form, bank_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name} — {a.bank_name || "Sem banco"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Provider *</Label>
                <Select value={form.provider} onValueChange={(v: any) => setForm({ ...form, provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inter">Inter</SelectItem>
                    <SelectItem value="itau">Itaú</SelectItem>
                    <SelectItem value="sicoob">Sicoob</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ambiente</Label>
                <Select value={form.api_environment} onValueChange={(v) => setForm({ ...form, api_environment: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Client ID *</Label>
              <Input value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Client Secret *</Label>
              <Input type="password" value={form.client_secret} onChange={(e) => setForm({ ...form, client_secret: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Certificado (.crt / .pem)</Label>
              <Input
                type="file"
                accept=".crt,.pem,.cer,.p12"
                onChange={handleCertUpload}
                className="file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {certFileName && <p className="text-xs text-muted-foreground">Arquivo: {certFileName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Chave do Certificado (.key)</Label>
              <Input
                type="file"
                accept=".key,.pem,.p12"
                onChange={handleKeyUpload}
                className="file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {keyFileName && <p className="text-xs text-muted-foreground">Arquivo: {keyFileName}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredDialog(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createCred.isPending}>{createCred.isPending ? "Salvando..." : "Salvar Credencial"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
