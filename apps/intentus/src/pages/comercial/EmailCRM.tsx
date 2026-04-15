/**
 * EmailCRM — Email integrado ao CRM com configuração de contas e composição.
 * Rota: /comercial/email
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useEmailAccounts, useEmailMessages, useSendEmail, useSaveEmailAccount, useDeleteEmailAccount,
  PROVIDER_LABELS, PROVIDER_DESCRIPTIONS, STATUS_COLORS,
  type EmailProvider, type SaveAccountParams,
} from "@/hooks/useEmailCRM";
import {
  ArrowLeft, Mail, Plus, Send, Trash2, Settings, CheckCircle2,
  XCircle, Clock, Loader2, AlertTriangle, Globe, type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function EmailCRM() {
  const navigate = useNavigate();
  const { data: accounts } = useEmailAccounts();
  const { data: messages } = useEmailMessages();
  const sendEmail = useSendEmail();
  const saveAccount = useSaveEmailAccount();
  const deleteAccount = useDeleteEmailAccount();

  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SaveAccountParams | null>(null);

  const [composeForm, setComposeForm] = useState({ to: "", subject: "", body_text: "", cc: "", bcc: "" });
  const [accountForm, setAccountForm] = useState<SaveAccountParams>({
    provider: "smtp",
    display_name: "",
    email_address: "",
    smtp_host: "",
    smtp_port: 465,
    smtp_secure: true,
    smtp_user: "",
    smtp_password: "",
    is_default: false,
  });

  const handleOpenNewAccount = () => {
    setEditingAccount(null);
    setAccountForm({ provider: "smtp", display_name: "", email_address: "", smtp_host: "", smtp_port: 465, smtp_secure: true, smtp_user: "", smtp_password: "", is_default: false });
    setShowAccountDialog(true);
  };

  const handleSaveAccount = () => {
    saveAccount.mutate(accountForm, { onSuccess: () => setShowAccountDialog(false) });
  };

  const handleSendEmail = () => {
    if (!composeForm.to || !composeForm.subject) { toast.error("Preencha destinatário e assunto"); return; }
    sendEmail.mutate(composeForm, { onSuccess: () => { setShowComposeDialog(false); setComposeForm({ to: "", subject: "", body_text: "", cc: "", bcc: "" }); } });
  };

  const hasAccounts = accounts && accounts.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/comercial/negocios")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            Email CRM
          </h1>
          <p className="text-sm text-muted-foreground">Envie emails vinculados a leads e negócios</p>
        </div>
        {hasAccounts && (
          <Button onClick={() => setShowComposeDialog(true)} className="gap-1.5">
            <Send className="h-4 w-4" /> Novo Email
          </Button>
        )}
      </div>

      <Tabs defaultValue={hasAccounts ? "emails" : "accounts"}>
        <TabsList>
          <TabsTrigger value="emails">Emails Enviados</TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1">
            <Settings className="h-3.5 w-3.5" /> Contas ({accounts?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Emails tab */}
        <TabsContent value="emails" className="mt-4">
          {!hasAccounts ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">Configure uma conta de email primeiro</p>
                <p className="text-xs text-muted-foreground mt-1">Vá na aba "Contas" para conectar seu email</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => {}}>
                  <Settings className="h-3.5 w-3.5 mr-1" /> Configurar Conta
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4">
                {!messages || messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum email enviado ainda</p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div key={msg.id} className="flex items-center gap-3 text-sm py-2 border-b last:border-0">
                        <Badge className={`${STATUS_COLORS[msg.status] || ""} text-[10px]`}>{msg.status === "sent" ? "Enviado" : msg.status === "failed" ? "Falhou" : msg.status}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{msg.subject}</p>
                          <p className="text-xs text-muted-foreground">Para: {msg.to_email}</p>
                        </div>
                        {msg.sent_at && <span className="text-xs text-muted-foreground">{format(new Date(msg.sent_at), "dd/MM HH:mm", { locale: ptBR })}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Accounts tab */}
        <TabsContent value="accounts" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Conecte sua conta de email para enviar diretamente do CRM</p>
            <Button size="sm" onClick={handleOpenNewAccount}><Plus className="h-3.5 w-3.5 mr-1" /> Nova Conta</Button>
          </div>

          {/* Provider guide cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["gmail_smtp", "outlook_smtp", "smtp", "resend"] as EmailProvider[]).map((p) => (
              <Card key={p} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setAccountForm((f) => ({ ...f, provider: p })); handleOpenNewAccount(); }}>
                <CardContent className="p-3">
                  <p className="text-xs font-medium">{PROVIDER_LABELS[p]}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{PROVIDER_DESCRIPTIONS[p]}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Connected accounts */}
          {accounts && accounts.length > 0 && (
            <div className="space-y-2">
              {accounts.map((acc) => (
                <Card key={acc.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${acc.is_active ? "bg-green-100" : "bg-gray-100"}`}>
                      <Mail className={`h-4 w-4 ${acc.is_active ? "text-green-600" : "text-gray-400"}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{acc.display_name}</span>
                        <Badge variant="outline" className="text-[10px]">{PROVIDER_LABELS[acc.provider as EmailProvider]}</Badge>
                        {acc.is_default && <Badge className="text-[9px] bg-primary/10 text-primary">Padrão</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{acc.email_address}{acc.smtp_host ? ` — ${acc.smtp_host}:${acc.smtp_port}` : ""}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteAccount.mutate(acc.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Account config dialog */}
      <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar Conta de Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Provedor</Label>
              <Select value={accountForm.provider} onValueChange={(v) => setAccountForm((f) => ({ ...f, provider: v as EmailProvider }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["gmail_smtp", "outlook_smtp", "smtp", "resend"] as EmailProvider[]).map((p) => (
                    <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-0.5">{PROVIDER_DESCRIPTIONS[accountForm.provider]}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Nome de Exibição</Label><Input value={accountForm.display_name} onChange={(e) => setAccountForm((f) => ({ ...f, display_name: e.target.value }))} placeholder="Marcelo Silva" className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Email</Label><Input value={accountForm.email_address} onChange={(e) => setAccountForm((f) => ({ ...f, email_address: e.target.value }))} placeholder="marcelo@empresa.com" className="h-8 text-sm" /></div>
            </div>
            {["smtp", "gmail_smtp", "outlook_smtp"].includes(accountForm.provider) && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><Label className="text-xs">Servidor SMTP</Label><Input value={accountForm.smtp_host || ""} onChange={(e) => setAccountForm((f) => ({ ...f, smtp_host: e.target.value }))} placeholder={accountForm.provider === "gmail_smtp" ? "smtp.gmail.com" : accountForm.provider === "outlook_smtp" ? "smtp-mail.outlook.com" : "smtp.seudominio.com"} className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Porta</Label><Input type="number" value={accountForm.smtp_port || 465} onChange={(e) => setAccountForm((f) => ({ ...f, smtp_port: Number(e.target.value) }))} className="h-8 text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Usuário SMTP</Label><Input value={accountForm.smtp_user || ""} onChange={(e) => setAccountForm((f) => ({ ...f, smtp_user: e.target.value }))} placeholder="seu@email.com" className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Senha / App Password</Label><Input type="password" value={accountForm.smtp_password || ""} onChange={(e) => setAccountForm((f) => ({ ...f, smtp_password: e.target.value }))} placeholder="••••••••" className="h-8 text-sm" /></div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={accountForm.smtp_secure ?? true} onCheckedChange={(v) => setAccountForm((f) => ({ ...f, smtp_secure: v }))} />
                  <Label className="text-xs">Conexão segura (SSL/TLS)</Label>
                </div>
                {accountForm.provider === "gmail_smtp" && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                    Para Gmail: acesse myaccount.google.com → Segurança → Senhas de app → Gere uma senha específica para o Intentus.
                  </div>
                )}
              </>
            )}
            {accountForm.provider === "resend" && (
              <div><Label className="text-xs">API Key do Resend</Label><Input type="password" value={accountForm.resend_api_key || ""} onChange={(e) => setAccountForm((f) => ({ ...f, resend_api_key: e.target.value }))} placeholder="re_..." className="h-8 text-sm" /></div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={accountForm.is_default ?? false} onCheckedChange={(v) => setAccountForm((f) => ({ ...f, is_default: v }))} />
              <Label className="text-xs">Conta padrão para envio</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccountDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveAccount} disabled={!accountForm.display_name || !accountForm.email_address || saveAccount.isPending}>
              {saveAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose dialog */}
      <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Novo Email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Para *</Label><Input value={composeForm.to} onChange={(e) => setComposeForm((f) => ({ ...f, to: e.target.value }))} placeholder="destinatario@email.com" className="h-8 text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">CC</Label><Input value={composeForm.cc} onChange={(e) => setComposeForm((f) => ({ ...f, cc: e.target.value }))} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">BCC</Label><Input value={composeForm.bcc} onChange={(e) => setComposeForm((f) => ({ ...f, bcc: e.target.value }))} className="h-8 text-sm" /></div>
            </div>
            <div><Label className="text-xs">Assunto *</Label><Input value={composeForm.subject} onChange={(e) => setComposeForm((f) => ({ ...f, subject: e.target.value }))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs">Mensagem</Label><Textarea value={composeForm.body_text} onChange={(e) => setComposeForm((f) => ({ ...f, body_text: e.target.value }))} rows={6} className="text-sm" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComposeDialog(false)}>Cancelar</Button>
            <Button onClick={handleSendEmail} disabled={sendEmail.isPending} className="gap-1.5">
              {sendEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
