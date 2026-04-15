import { useState, useEffect } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Palette, Image, Building2, Share2, MessageCircle, Copy, RefreshCw, TestTube } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function generateSecret() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function SiteSettings() {
  const { data, isLoading, save, isSaving } = useSiteSettings();
  const { tenantId } = useAuth();

  const [customDomain, setCustomDomain] = useState("");
  const [n8nWebhookMarket, setN8nWebhookMarket] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1E40AF");
  const [secondaryColor, setSecondaryColor] = useState("#64748B");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [linkedin, setLinkedin] = useState("");

  useEffect(() => {
    if (data) {
      setCustomDomain(data.custom_domain || "");
      setN8nWebhookMarket((data.settings?.n8n_webhook_market_analysis as string) || "");
      setWebhookUrl(data.webhook_url || "");
      setWebhookSecret(data.webhook_secret || "");
      setPrimaryColor(data.settings?.primary_color || "#1E40AF");
      setSecondaryColor(data.settings?.secondary_color || "#64748B");
      setHeroTitle(data.settings?.hero_title || "");
      setHeroSubtitle(data.settings?.hero_subtitle || "");
      setAboutText(data.settings?.about_text || "");
      setPhone(data.settings?.phone || "");
      setEmail(data.settings?.email || "");
      setAddress(data.settings?.address || "");
      setWhatsappNumber(data.settings?.whatsapp_number || "");
      setWhatsappMessage(data.settings?.whatsapp_message || "");
      setInstagram(data.settings?.social_links?.instagram || "");
      setFacebook(data.settings?.social_links?.facebook || "");
      setLinkedin(data.settings?.social_links?.linkedin || "");
    }
  }, [data]);

  const handleSave = () => {
    save({
      custom_domain: customDomain,
      webhook_url: webhookUrl,
      webhook_secret: webhookSecret,
        settings: {
        ...data?.settings,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        hero_title: heroTitle,
        hero_subtitle: heroSubtitle,
        about_text: aboutText,
        phone,
        email,
        address,
        whatsapp_number: whatsappNumber,
        whatsapp_message: whatsappMessage,
        social_links: { instagram, facebook, linkedin },
        n8n_webhook_market_analysis: n8nWebhookMarket || undefined,
      },
    });
  };

  const handleGenerateSecret = () => {
    const secret = generateSecret();
    setWebhookSecret(secret);
    toast.success("Novo secret gerado. Salve para confirmar.");
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      toast.error("Configure a URL do webhook primeiro");
      return;
    }
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Secret": webhookSecret || "",
        },
        body: JSON.stringify({
          event: "test",
          tenant_id: tenantId,
          property_id: null,
          timestamp: new Date().toISOString(),
          data: { message: "Teste de webhook do painel administrativo" },
        }),
      });
      if (res.ok) {
        toast.success("Webhook enviado com sucesso! Status: " + res.status);
      } else {
        toast.error("Webhook retornou status: " + res.status);
      }
    } catch (e: any) {
      toast.error("Erro ao enviar webhook: " + e.message);
    }
  };

  const apiBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api`;
  const domainParam = customDomain ? `domain=${customDomain}` : `slug=${data?.custom_domain || "seu-slug"}`;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações do Site</h1>
        <p className="text-muted-foreground">Configure a API pública e os dados do site externo da sua imobiliária.</p>
      </div>

      <Tabs defaultValue="integration" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="integration" className="text-xs"><Globe className="h-3.5 w-3.5 mr-1" />Integração</TabsTrigger>
          <TabsTrigger value="branding" className="text-xs"><Palette className="h-3.5 w-3.5 mr-1" />Branding</TabsTrigger>
          <TabsTrigger value="banners" className="text-xs"><Image className="h-3.5 w-3.5 mr-1" />Banners</TabsTrigger>
          <TabsTrigger value="institutional" className="text-xs"><Building2 className="h-3.5 w-3.5 mr-1" />Institucional</TabsTrigger>
          <TabsTrigger value="social" className="text-xs"><Share2 className="h-3.5 w-3.5 mr-1" />Redes Sociais</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs"><MessageCircle className="h-3.5 w-3.5 mr-1" />WhatsApp</TabsTrigger>
        </TabsList>

        <TabsContent value="integration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Domínio e Integração</CardTitle>
              <CardDescription>Configure o domínio do site e a integração via webhook.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Domínio Customizado</Label>
                <Input placeholder="minhaimobiliaria.com.br" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} />
                <p className="text-xs text-muted-foreground">O domínio que seu site externo utiliza. Será usado para identificar sua empresa na API.</p>
              </div>

              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <Input placeholder="https://meusite.com/api/webhook" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
                <p className="text-xs text-muted-foreground">Endpoint do seu site que receberá notificações quando imóveis forem publicados, atualizados ou removidos.</p>
              </div>

              <div className="space-y-2">
                <Label>Secret do Webhook</Label>
                <div className="flex gap-2">
                  <Input value={webhookSecret} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => handleCopy(webhookSecret, "Secret")}><Copy className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" onClick={handleGenerateSecret}><RefreshCw className="h-4 w-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">Enviado no header X-Webhook-Secret para validação.</p>
              </div>

              <Button variant="outline" onClick={handleTestWebhook} disabled={!webhookUrl}>
                <TestTube className="h-4 w-4 mr-2" />Testar Webhook
              </Button>

              <div className="border-t pt-4 space-y-2">
                <Label>Webhook n8n — Análise de Mercado</Label>
                <Input
                  placeholder="https://n8n.example.com/webhook/market-analysis"
                  value={n8nWebhookMarket}
                  onChange={(e) => setN8nWebhookMarket(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  URL do webhook n8n que receberá as solicitações de análise de mercado da tela de Avaliações (CMA). 
                  O n8n deve retornar o resultado fazendo UPDATE em <code className="bg-muted px-1 rounded">market_evaluations</code> com <code className="bg-muted px-1 rounded">preco_m2_estimado</code>.
                </p>
              </div>

              <div className="mt-6 rounded-lg border bg-muted/50 p-4 space-y-2">
                <h4 className="font-medium text-sm">Endpoints da API Pública</h4>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold">GET</span>
                    <code className="text-muted-foreground">{apiBaseUrl}?action=tenant&{domainParam}</code>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopy(`${apiBaseUrl}?action=tenant&${domainParam}`, "URL")}><Copy className="h-3 w-3" /></Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold">GET</span>
                    <code className="text-muted-foreground">{apiBaseUrl}?action=properties&{domainParam}</code>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopy(`${apiBaseUrl}?action=properties&${domainParam}`, "URL")}><Copy className="h-3 w-3" /></Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold">GET</span>
                    <code className="text-muted-foreground">{apiBaseUrl}?action=property&{domainParam}&id=UUID</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-accent-foreground font-bold">POST</span>
                    <code className="text-muted-foreground">{apiBaseUrl}?action=lead&{domainParam}</code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Cores e identidade visual do site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor Primária</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-12 rounded border cursor-pointer" />
                    <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor Secundária</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-10 w-12 rounded border cursor-pointer" />
                    <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">As cores serão disponibilizadas na API para uso pelo site externo.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banners" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Banners do Hero</CardTitle>
              <CardDescription>Título, subtítulo e textos do banner principal do site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Título do Hero</Label>
                <Input placeholder="Encontre o imóvel dos seus sonhos" value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Subtítulo do Hero</Label>
                <Input placeholder="Os melhores imóveis da região" value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">As imagens do hero podem ser gerenciadas via campo settings no banco. Em breve, upload direto será suportado aqui.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="institutional" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados Institucionais</CardTitle>
              <CardDescription>Informações da empresa exibidas no site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Sobre Nós</Label>
                <Textarea rows={4} placeholder="Texto institucional da empresa..." value={aboutText} onChange={(e) => setAboutText(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input placeholder="(44) 3000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input placeholder="contato@imobiliaria.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input placeholder="Av. Brasil, 1000 - Centro - Maringá/PR" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Redes Sociais</CardTitle>
              <CardDescription>Links das redes sociais da imobiliária.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input placeholder="https://instagram.com/suaimobiliaria" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input placeholder="https://facebook.com/suaimobiliaria" value={facebook} onChange={(e) => setFacebook(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn</Label>
                <Input placeholder="https://linkedin.com/company/suaimobiliaria" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp</CardTitle>
              <CardDescription>Configurações do botão de WhatsApp do site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Número do WhatsApp</Label>
                <Input placeholder="5544999990000" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
                <p className="text-xs text-muted-foreground">Formato internacional sem sinais: 5544999990000</p>
              </div>
              <div className="space-y-2">
                <Label>Mensagem Padrão</Label>
                <Textarea rows={2} placeholder="Olá! Gostaria de mais informações sobre um imóvel." value={whatsappMessage} onChange={(e) => setWhatsappMessage(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
