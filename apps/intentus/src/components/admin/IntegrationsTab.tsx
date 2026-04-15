import { useApiIntegrations } from "@/hooks/useApiIntegrations";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RefreshCw, CheckCircle2, XCircle, AlertTriangle, MinusCircle,
  Building2, Shield, DollarSign, FileSignature, MessageSquare, Bot, Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface IntegrationDef {
  key: string;
  name: string;
  description: string;
  category: string;
  type: "nova" | "existente";
}

const CATALOG: IntegrationDef[] = [
  { key: "cnpj_query", name: "Consulta CNPJ", description: "Preenchimento automático via ReceitaWS", category: "Cadastro", type: "nova" },
  { key: "cpf_validation", name: "Validação CPF", description: "Validação local de CPF", category: "Cadastro", type: "nova" },
  { key: "cep_query", name: "Consulta CEP", description: "Preenchimento de endereço via ViaCEP", category: "Cadastro", type: "existente" },
  { key: "cnd_receita", name: "CND Receita/PGFN", description: "Consulta CND via API SERPRO (RFB + PGFN)", category: "Due Diligence", type: "existente" },
  { key: "cadin", name: "CADIN", description: "Cadastro de Inadimplentes da União", category: "Due Diligence", type: "nova" },
  { key: "divida_ativa", name: "Dívida Ativa PGFN", description: "Consulta inscrições em Dívida Ativa", category: "Due Diligence", type: "nova" },
  { key: "crf_fgts", name: "CRF/FGTS (Caixa)", description: "Regularidade do empregador via Infosimples", category: "Due Diligence", type: "existente" },
  { key: "bcb_indices", name: "Índices Econômicos BCB", description: "IGP-M, IPCA, SELIC e outros índices", category: "Financeiro", type: "existente" },
  { key: "bank_integration", name: "Integração Bancária", description: "Inter, Itaú, Sicoob via API", category: "Financeiro", type: "existente" },
  { key: "stripe", name: "Stripe", description: "Pagamentos e cobranças SaaS", category: "Financeiro", type: "existente" },
  { key: "assinaturas_digitais", name: "DocuSign / ClickSign / D4Sign", description: "Assinatura eletrônica de documentos", category: "Documentos", type: "existente" },
  { key: "govbr_assinatura", name: "Assinatura gov.br", description: "Assinatura digital avançada ICP-Brasil", category: "Documentos", type: "nova" },
  { key: "registro_imoveis", name: "Registro de Imóveis (ONR)", description: "Protocolo eletrônico de registros", category: "Documentos", type: "existente" },
  { key: "parse_contract_ai", name: "Parse de Contratos (IA)", description: "Importação inteligente de contratos", category: "Documentos", type: "existente" },
  { key: "whatsapp", name: "WhatsApp", description: "Comunicação via Hunion / Z-API", category: "Comunicação", type: "existente" },
  { key: "email_resend", name: "E-mail (Resend)", description: "Envio de e-mails transacionais", category: "Comunicação", type: "existente" },
  { key: "webhook_n8n", name: "Webhook N8n", description: "Automação externa via webhooks", category: "Automação", type: "existente" },
];

const CATEGORY_ICONS: Record<string, any> = {
  Cadastro: Building2,
  "Due Diligence": Shield,
  Financeiro: DollarSign,
  Documentos: FileSignature,
  Comunicação: MessageSquare,
  Automação: Bot,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: "Ativo", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  error: { label: "Erro", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
  unconfigured: { label: "Não configurado", color: "bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400", icon: MinusCircle },
  unavailable: { label: "Indisponível", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", icon: AlertTriangle },
};

export function IntegrationsTab() {
  const { integrations, isLoading, checkHealth, isChecking, toggleIntegration } = useApiIntegrations();

  const getStatus = (key: string) => {
    const integration = integrations.find(i => i.integration_key === key);
    return integration?.status || "unconfigured";
  };

  const getEnabled = (key: string) => {
    const integration = integrations.find(i => i.integration_key === key);
    return integration?.enabled ?? true;
  };

  const getLastCheck = () => {
    const checks = integrations.filter(i => i.last_check_at).map(i => new Date(i.last_check_at!).getTime());
    if (checks.length === 0) return null;
    return new Date(Math.max(...checks));
  };

  const getError = (key: string) => {
    return integrations.find(i => i.integration_key === key)?.last_error;
  };

  const categories = [...new Set(CATALOG.map(c => c.category))];
  const lastCheck = getLastCheck();

  return (
    <div className="space-y-6 mt-4">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          {lastCheck && (
            <p className="text-sm text-muted-foreground">
              Última verificação: {format(lastCheck, "dd/MM/yyyy HH:mm")}
            </p>
          )}
        </div>
        <Button onClick={() => checkHealth()} disabled={isChecking}>
          {isChecking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Verificar Conectividade
        </Button>
      </div>

      {/* Categories */}
      {categories.map(category => {
        const CategoryIcon = CATEGORY_ICONS[category] || Bot;
        const items = CATALOG.filter(c => c.category === category);

        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CategoryIcon className="h-5 w-5 text-primary" />
                {category}
              </CardTitle>
              <CardDescription>{items.length} integrações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map(item => {
                const status = getStatus(item.key);
                const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.unconfigured;
                const StatusIcon = statusCfg.icon;
                const enabled = getEnabled(item.key);
                const error = getError(item.key);
                const isPlaceholder = status === "unavailable";

                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between rounded-lg border p-3 gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <StatusIcon className={`h-5 w-5 shrink-0 ${
                        status === "active" ? "text-green-500" :
                        status === "error" ? "text-red-500" :
                        status === "unavailable" ? "text-amber-500" :
                        "text-muted-foreground"
                      }`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{item.name}</span>
                          {item.type === "nova" && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Nova</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                        {error && status !== "active" && (
                          <p className="text-xs text-destructive mt-0.5 truncate">{error}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className={`${statusCfg.color} text-[11px] font-medium`}>
                        {statusCfg.label}
                      </Badge>
                      {!isPlaceholder && (
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) => toggleIntegration({ key: item.key, enabled: v })}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
