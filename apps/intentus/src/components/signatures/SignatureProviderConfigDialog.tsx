import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSignatureProviders } from "@/hooks/useSignatureProviders";
import type { SignatureProvidersConfig } from "@/lib/signatureProvidersDefaults";
import { Loader2, Shield } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function SignatureProviderConfigDialog({ open, onOpenChange }: Props) {
  const { config, isLoading, save, isSaving } = useSignatureProviders();
  const [local, setLocal] = useState<SignatureProvidersConfig>(config);

  useEffect(() => { setLocal(config); }, [config]);

  const update = <K extends keyof SignatureProvidersConfig>(key: K, field: string, value: any) => {
    setLocal(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSave = async () => { await save(local); onOpenChange(false); };

  if (isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Configurar Provedores de Assinatura</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          As credenciais são armazenadas de forma segura e nunca expostas no frontend. Apenas a função de backend acessa as chaves.
        </div>

        <Tabs defaultValue="docusign" className="mt-2">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="docusign">DocuSign</TabsTrigger>
            <TabsTrigger value="clicksign">ClickSign</TabsTrigger>
            <TabsTrigger value="d4sign">D4Sign</TabsTrigger>
            <TabsTrigger value="registro_imoveis">Reg. Imóveis</TabsTrigger>
            <TabsTrigger value="govbr">gov.br</TabsTrigger>
          </TabsList>

          {/* DocuSign */}
          <TabsContent value="docusign" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label>Habilitado</Label>
              <Switch checked={local.docusign.enabled} onCheckedChange={v => update("docusign", "enabled", v)} />
            </div>
            <div className="space-y-2"><Label>Integration Key</Label><Input type="password" value={local.docusign.integration_key} onChange={e => update("docusign", "integration_key", e.target.value)} placeholder="Sua Integration Key" /></div>
            <div className="space-y-2"><Label>Secret Key</Label><Input type="password" value={local.docusign.secret_key} onChange={e => update("docusign", "secret_key", e.target.value)} placeholder="Sua Secret Key" /></div>
            <div className="space-y-2"><Label>Account ID</Label><Input value={local.docusign.account_id} onChange={e => update("docusign", "account_id", e.target.value)} placeholder="Account ID" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ambiente</Label>
                <Select value={local.docusign.environment} onValueChange={v => update("docusign", "environment", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="sandbox">Sandbox (Demo)</SelectItem><SelectItem value="production">Produção</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Base URL</Label><Input value={local.docusign.base_url} onChange={e => update("docusign", "base_url", e.target.value)} /></div>
            </div>
          </TabsContent>

          {/* ClickSign */}
          <TabsContent value="clicksign" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label>Habilitado</Label>
              <Switch checked={local.clicksign.enabled} onCheckedChange={v => update("clicksign", "enabled", v)} />
            </div>
            <div className="space-y-2"><Label>API Token</Label><Input type="password" value={local.clicksign.api_token} onChange={e => update("clicksign", "api_token", e.target.value)} placeholder="Token de API" /></div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={local.clicksign.environment} onValueChange={v => update("clicksign", "environment", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="sandbox">Sandbox</SelectItem><SelectItem value="production">Produção</SelectItem></SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* D4Sign */}
          <TabsContent value="d4sign" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label>Habilitado</Label>
              <Switch checked={local.d4sign.enabled} onCheckedChange={v => update("d4sign", "enabled", v)} />
            </div>
            <div className="space-y-2"><Label>Token API</Label><Input type="password" value={local.d4sign.token_api} onChange={e => update("d4sign", "token_api", e.target.value)} placeholder="Token de API" /></div>
            <div className="space-y-2"><Label>Crypt Key (opcional)</Label><Input type="password" value={local.d4sign.crypt_key} onChange={e => update("d4sign", "crypt_key", e.target.value)} placeholder="Crypt Key" /></div>
            <div className="space-y-2"><Label>UUID do Cofre</Label><Input value={local.d4sign.uuid_safe} onChange={e => update("d4sign", "uuid_safe", e.target.value)} placeholder="UUID do Cofre" /></div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={local.d4sign.environment} onValueChange={v => update("d4sign", "environment", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="sandbox">Sandbox</SelectItem><SelectItem value="production">Produção</SelectItem></SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Registro de Imóveis */}
          <TabsContent value="registro_imoveis" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label>Habilitado</Label>
              <Switch checked={local.registro_imoveis.enabled} onCheckedChange={v => update("registro_imoveis", "enabled", v)} />
            </div>
            <div className="space-y-2"><Label>Login</Label><Input value={local.registro_imoveis.login} onChange={e => update("registro_imoveis", "login", e.target.value)} placeholder="Login ONR" /></div>
            <div className="space-y-2"><Label>Senha</Label><Input type="password" value={local.registro_imoveis.password} onChange={e => update("registro_imoveis", "password", e.target.value)} placeholder="Senha" /></div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={local.registro_imoveis.environment} onValueChange={v => update("registro_imoveis", "environment", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="testes">Testes</SelectItem><SelectItem value="producao">Produção</SelectItem></SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* gov.br */}
          <TabsContent value="govbr" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label>Habilitado</Label>
              <Switch checked={local.govbr.enabled} onCheckedChange={v => update("govbr", "enabled", v)} />
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
              A Assinatura Digital gov.br utiliza o protocolo ICP-Brasil e requer credenciamento formal junto ao gov.br. Após credenciamento, insira as credenciais OAuth abaixo.
            </div>
            <div className="space-y-2"><Label>Client ID (OAuth)</Label><Input value={local.govbr.client_id} onChange={e => update("govbr", "client_id", e.target.value)} placeholder="Client ID do credenciamento gov.br" /></div>
            <div className="space-y-2"><Label>Client Secret</Label><Input type="password" value={local.govbr.client_secret} onChange={e => update("govbr", "client_secret", e.target.value)} placeholder="Client Secret" /></div>
            <div className="space-y-2"><Label>Redirect URI</Label><Input value={local.govbr.redirect_uri} onChange={e => update("govbr", "redirect_uri", e.target.value)} placeholder="https://seudominio.com/callback" /></div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={local.govbr.environment} onValueChange={v => update("govbr", "environment", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="staging">Homologação (Staging)</SelectItem><SelectItem value="production">Produção</SelectItem></SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={isSaving} onClick={handleSave}>
            {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
