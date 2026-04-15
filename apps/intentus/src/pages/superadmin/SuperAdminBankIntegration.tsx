import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { toast } from "sonner";
import { Plus, Key, FileText, QrCode, Webhook, Copy, Eye, ShieldCheck, Pencil } from "lucide-react";
import {
  usePlatformBankCredentials,
  useCreatePlatformBankCredential,
  useUpdatePlatformBankCredential,
  usePlatformBoletos,
  usePlatformPixCharges,
  usePlatformWebhookEvents,
} from "@/hooks/usePlatformBankIntegration";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const boletoStatusLabels: Record<string, string> = {
  emitido: "Emitido", registrado: "Registrado", pago: "Pago", cancelado: "Cancelado", vencido: "Vencido",
};
const boletoStatusColors: Record<string, string> = {
  emitido: "bg-blue-100 text-blue-800", registrado: "bg-cyan-100 text-cyan-800",
  pago: "bg-green-100 text-green-800", cancelado: "bg-red-100 text-red-800", vencido: "bg-amber-100 text-amber-800",
};
const pixStatusLabels: Record<string, string> = {
  ativa: "Ativa", concluida: "Concluída", cancelada: "Cancelada", expirada: "Expirada",
};

export default function SuperAdminBankIntegration() {
  const [tab, setTab] = useState("credentials");
  const [credDialog, setCredDialog] = useState(false);
  const [editingCred, setEditingCred] = useState<any>(null);

  const openNewCred = () => { setEditingCred(null); setCredDialog(true); };
  const openEditCred = (c: any) => { setEditingCred(c); setCredDialog(true); };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-amber-500" />
          <h1 className="text-2xl font-bold font-display">Integração Bancária da Plataforma</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Credenciais e cobranças da empresa master (licenciadora). Separada das integrações dos tenants.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="credentials"><Key className="h-3.5 w-3.5 mr-1" />Credenciais</TabsTrigger>
          <TabsTrigger value="boletos"><FileText className="h-3.5 w-3.5 mr-1" />Boletos</TabsTrigger>
          <TabsTrigger value="pix"><QrCode className="h-3.5 w-3.5 mr-1" />PIX</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-3.5 w-3.5 mr-1" />Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="credentials"><PlatformCredentialsTab onAdd={openNewCred} onEdit={openEditCred} /></TabsContent>
        <TabsContent value="boletos"><PlatformBoletosTab /></TabsContent>
        <TabsContent value="pix"><PlatformPixTab /></TabsContent>
        <TabsContent value="webhooks"><PlatformWebhooksTab /></TabsContent>
      </Tabs>

      <PlatformCredentialFormDialog open={credDialog} onOpenChange={setCredDialog} editing={editingCred} />
    </div>
  );
}

// ─── Credentials Tab ───
function PlatformCredentialsTab({ onAdd, onEdit }: { onAdd: () => void; onEdit: (c: any) => void }) {
  const { data: creds = [], isLoading } = usePlatformBankCredentials();
  const updateCred = useUpdatePlatformBankCredential();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Credenciais API da Plataforma</CardTitle>
        <Button size="sm" onClick={onAdd}><Plus className="h-3.5 w-3.5 mr-1" />Nova Credencial</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Banco</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Ambiente</TableHead>
              <TableHead>Chave PIX</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : creds.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma credencial cadastrada</TableCell></TableRow>
            ) : creds.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.bank_name || "—"}</TableCell>
                <TableCell><Badge variant="outline">{c.provider}</Badge></TableCell>
                <TableCell>{c.api_environment}</TableCell>
                <TableCell className="text-xs font-mono">{c.pix_key || "—"}</TableCell>
                <TableCell><Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Ativa" : "Inativa"}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateCred.mutate({ id: c.id, active: !c.active })}
                    >
                      {c.active ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Boletos Tab ───
function PlatformBoletosTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: boletos = [], isLoading } = usePlatformBoletos(statusFilter && statusFilter !== "all" ? { status: statusFilter } : undefined);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Boletos da Plataforma</CardTitle>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(boletoStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pagador</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : boletos.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum boleto da plataforma</TableCell></TableRow>
            ) : boletos.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{b.payer_name}</p>
                    <p className="text-xs text-muted-foreground">{b.payer_document}</p>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{fmt(Number(b.amount))}</TableCell>
                <TableCell>{format(new Date(b.due_date), "dd/MM/yyyy")}</TableCell>
                <TableCell><Badge className={boletoStatusColors[b.status] || ""}>{boletoStatusLabels[b.status] || b.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {b.linha_digitavel && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(b.linha_digitavel); toast.success("Copiado!"); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {b.pdf_url && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={b.pdf_url} target="_blank" rel="noopener"><Eye className="h-3.5 w-3.5" /></a>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── PIX Tab ───
function PlatformPixTab() {
  const { data: charges = [], isLoading } = usePlatformPixCharges();
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Cobranças PIX da Plataforma</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>TXID</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Pagador</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>QR Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : charges.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma cobrança PIX</TableCell></TableRow>
            ) : charges.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.txid || "—"}</TableCell>
                <TableCell className="font-medium">{fmt(Number(c.amount))}</TableCell>
                <TableCell>{c.payer_name || "—"}</TableCell>
                <TableCell><Badge variant="outline">{pixStatusLabels[c.status] || c.status}</Badge></TableCell>
                <TableCell>
                  {c.qr_code && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(c.qr_code); toast.success("QR Code copiado!"); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Webhooks Tab ───
function PlatformWebhooksTab() {
  const { data: events = [], isLoading } = usePlatformWebhookEvents();
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Eventos de Webhook da Plataforma</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Processado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : events.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum evento recebido</TableCell></TableRow>
            ) : events.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs">{format(new Date(e.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                <TableCell><Badge variant="outline">{e.event_type}</Badge></TableCell>
                <TableCell>{e.provider}</TableCell>
                <TableCell>{e.processed ? <Badge className="bg-green-100 text-green-800">Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Credential Form Dialog ───
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

function PlatformCredentialFormDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: any | null }) {
  const createCred = useCreatePlatformBankCredential();
  const updateCred = useUpdatePlatformBankCredential();
  const isEdit = !!editing;

  const emptyForm = {
    provider: "inter", client_id: "", client_secret: "",
    certificate_base64: "", certificate_key_base64: "", api_environment: "sandbox",
    pix_key: "", bank_name: "", agency: "", account_number: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [certFileName, setCertFileName] = useState("");
  const [keyFileName, setKeyFileName] = useState("");

  useEffect(() => {
    if (open && editing) {
      const acctParts = (editing.account_info || "").split(" / ");
      setForm({
        provider: editing.provider || "inter",
        client_id: editing.client_id || "",
        client_secret: "",
        certificate_base64: "",
        certificate_key_base64: "",
        api_environment: editing.api_environment || "sandbox",
        pix_key: editing.pix_key || "",
        bank_name: editing.bank_name || "",
        agency: acctParts[0]?.trim() || "",
        account_number: acctParts[1]?.trim() || "",
      });
      setCertFileName(editing.certificate_base64 ? "certificado existente" : "");
      setKeyFileName(editing.certificate_key_base64 ? "chave existente" : "");
    } else if (open && !editing) {
      setForm(emptyForm);
      setCertFileName("");
      setKeyFileName("");
    }
  }, [open, editing]);

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
    if (!form.client_id || (!isEdit && !form.client_secret)) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    const accountInfo = [form.agency, form.account_number].filter(Boolean).join(" / ");

    if (isEdit) {
      const payload: any = {
        id: editing.id,
        bank_name: form.bank_name,
        pix_key: form.pix_key,
        api_environment: form.api_environment,
        account_info: accountInfo || undefined,
        client_id: form.client_id,
      };
      if (form.client_secret) payload.client_secret = form.client_secret;
      if (form.certificate_base64) payload.certificate_base64 = form.certificate_base64;
      if (form.certificate_key_base64) payload.certificate_key_base64 = form.certificate_key_base64;
      updateCred.mutate(payload, { onSuccess: () => onOpenChange(false) });
    } else {
      createCred.mutate({ ...form, account_info: accountInfo || undefined } as any, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Editar Credencial" : "Nova Credencial da Plataforma"}</DialogTitle></DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Provider *</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
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
            <Label>Nome do Banco</Label>
            <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Ex: Banco Inter" />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <Input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} placeholder="CNPJ, e-mail ou chave aleatória" />
          </div>
          <div className="space-y-1.5">
            <Label>Client ID *</Label>
            <Input value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Client Secret {isEdit ? "(deixe vazio para manter)" : "*"}</Label>
            <Input type="password" value={form.client_secret} onChange={(e) => setForm({ ...form, client_secret: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Certificado (.crt / .pem)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".crt,.pem,.cer,.p12"
                onChange={handleCertUpload}
                className="file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
            {certFileName && <p className="text-xs text-muted-foreground">Arquivo: {certFileName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Chave do Certificado (.key)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".key,.pem,.p12"
                onChange={handleKeyUpload}
                className="file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
            {keyFileName && <p className="text-xs text-muted-foreground">Arquivo: {keyFileName}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createCred.isPending || updateCred.isPending}>
            {(createCred.isPending || updateCred.isPending) ? "Salvando..." : isEdit ? "Salvar Alterações" : "Salvar Credencial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
