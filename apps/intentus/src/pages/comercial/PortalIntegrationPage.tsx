import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Loader2, Download, CheckCircle2, AlertTriangle, XCircle, Globe, FileCode, Shield, ChevronDown, ChevronRight } from "lucide-react";
import {
  usePortalDashboard,
  useValidateProperties,
  useGenerateXML,
  useTogglePropertyPortal,
  PORTAL_LABELS,
  PORTAL_COLORS,
  PORTAL_FORMAT,
  PROPERTY_TYPE_LABELS,
  PURPOSE_LABELS,
  type PropertyStatus,
  type ValidationError,
} from "@/hooks/usePortalIntegration";

function fmtBRL(v: number): string {
  if (!v) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

function KPI({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white border rounded-lg p-3 text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold ${color || ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function PortalCard({ portal, stats }: { portal: string; stats: { total: number; valid: number; errors: number; warnings: number } }) {
  const pct = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {PORTAL_LABELS[portal] || portal}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-lg font-bold">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground">Imóveis</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-600">{stats.valid}</p>
            <p className="text-[10px] text-muted-foreground">Válidos</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">{stats.errors}</p>
            <p className="text-[10px] text-muted-foreground">Erros</p>
          </div>
          <div>
            <p className="text-lg font-bold text-yellow-600">{stats.warnings}</p>
            <p className="text-[10px] text-muted-foreground">Avisos</p>
          </div>
        </div>
        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground text-right mt-0.5">{pct}% prontos</p>
      </CardContent>
    </Card>
  );
}

function PropertyRow({
  prop,
  onTogglePortal,
  isToggling,
}: {
  prop: PropertyStatus;
  onTogglePortal: (propertyId: string, portal: string, enabled: boolean) => void;
  isToggling: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const portals = prop.publishedPortals.length > 0 ? prop.publishedPortals : ["grupozap", "olx"];

  return (
    <div className="border rounded-lg p-3 mb-2">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{prop.title}</p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{PROPERTY_TYPE_LABELS[prop.propertyType] || prop.propertyType}</span>
            <span>•</span>
            <span>{PURPOSE_LABELS[prop.purpose] || prop.purpose}</span>
            {prop.city && <><span>•</span><span>{prop.city}</span></>}
            {prop.neighborhood && <><span>-</span><span>{prop.neighborhood}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className="text-[10px]">{prop.photoCount} fotos</Badge>
          {prop.salePrice > 0 && <Badge variant="secondary" className="text-[10px]">{fmtBRL(prop.salePrice)}</Badge>}
          {prop.rentalPrice > 0 && <Badge variant="secondary" className="text-[10px]">{fmtBRL(prop.rentalPrice)}/mês</Badge>}
        </div>
        <div className="flex gap-1 shrink-0">
          {prop.vrsyncValid ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" title="VrSync OK" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" title="VrSync com erros" />
          )}
          {prop.olxValid ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" title="OLX OK" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" title="OLX com erros" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <div className="flex items-center gap-4">
            {["grupozap", "olx"].map((portal) => (
              <div key={portal} className="flex items-center gap-2">
                <Switch
                  checked={portals.includes(portal)}
                  onCheckedChange={(checked) => onTogglePortal(prop.id, portal, checked)}
                  disabled={isToggling}
                />
                <span className="text-xs">{PORTAL_LABELS[portal]}</span>
              </div>
            ))}
          </div>
          {!prop.vrsyncValid && (
            <p className="text-[10px] text-red-600">VrSync: {prop.vrsyncErrors} problema(s) encontrado(s)</p>
          )}
          {!prop.olxValid && (
            <p className="text-[10px] text-red-600">OLX: {prop.olxErrors} problema(s) encontrado(s)</p>
          )}
        </div>
      )}
    </div>
  );
}

function ValidationErrorList({ errors }: { errors: ValidationError[] }) {
  if (errors.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Nenhum problema encontrado.</p>;

  const grouped = errors.reduce((acc, e) => {
    const key = e.propertyId;
    if (!acc[key]) acc[key] = { title: e.title, errors: [] };
    acc[key].errors.push(e);
    return acc;
  }, {} as Record<string, { title: string; errors: ValidationError[] }>);

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([pid, { title, errors: propErrors }]) => (
        <Card key={pid}>
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-xs">{title}</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {propErrors.map((e, i) => (
              <div key={i} className="flex items-start gap-1.5 py-0.5">
                {e.severity === "error" ? (
                  <XCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <span className="text-[10px] text-muted-foreground">
                    [{PORTAL_LABELS[e.portal] || e.portal}] {e.field}:
                  </span>{" "}
                  <span className="text-xs">{e.message}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PortalIntegrationPage() {
  const { data: dashboard, isLoading } = usePortalDashboard();
  const validateMutation = useValidateProperties("all");
  const generateMutation = useGenerateXML();
  const toggleMutation = useTogglePropertyPortal();
  const [activeTab, setActiveTab] = useState("dashboard");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const d = dashboard;
  const portalStats = d?.portalStats || {};
  const properties = d?.propertyStatuses || [];

  function handleGenerateXML(format: string) {
    generateMutation.mutate({ format }, {
      onSuccess: (data) => {
        const blob = new Blob([data.xml], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `feed-${format}-${new Date().toISOString().slice(0, 10)}.xml`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  function handleTogglePortal(propertyId: string, portal: string, enabled: boolean) {
    toggleMutation.mutate({ property_id: propertyId, portal, enabled });
  }

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Integração Portais BR</h1>
          <p className="text-xs text-muted-foreground">ZAP Imóveis, VivaReal, OLX — Geração XML multi-formato</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending}
          >
            {validateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
            Validar Tudo
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="properties">Imóveis ({properties.length})</TabsTrigger>
          <TabsTrigger value="generate">Gerar XML</TabsTrigger>
          {validateMutation.data && <TabsTrigger value="validation">Validação</TabsTrigger>}
        </TabsList>

        {/* ── Dashboard ────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Total Imóveis" value={d?.totalProperties || 0} />
            <KPI label="Disponíveis" value={d?.availableProperties || 0} color="text-green-600" />
            <KPI
              label="Prontos ZAP/Viva"
              value={portalStats.grupozap?.valid || 0}
              sub={`de ${portalStats.grupozap?.total || 0}`}
              color="text-purple-600"
            />
            <KPI
              label="Prontos OLX"
              value={portalStats.olx?.valid || 0}
              sub={`de ${portalStats.olx?.total || 0}`}
              color="text-orange-600"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(portalStats).map(([portal, stats]) => (
              <PortalCard key={portal} portal={portal} stats={stats} />
            ))}
          </div>

          {/* Quick status list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Imóveis com Problemas</CardTitle>
              <CardDescription className="text-xs">Imóveis que precisam de correção para publicar</CardDescription>
            </CardHeader>
            <CardContent>
              {properties.filter((p) => !p.vrsyncValid || !p.olxValid).length === 0 ? (
                <div className="flex items-center gap-2 py-3 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">Todos os imóveis estão prontos para publicação!</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {properties
                    .filter((p) => !p.vrsyncValid || !p.olxValid)
                    .slice(0, 10)
                    .map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-1 border-b last:border-0">
                        <span className="text-xs truncate max-w-[60%]">{p.title}</span>
                        <div className="flex gap-1">
                          {!p.vrsyncValid && <Badge variant="destructive" className="text-[9px]">VrSync: {p.vrsyncErrors}</Badge>}
                          {!p.olxValid && <Badge variant="destructive" className="text-[9px]">OLX: {p.olxErrors}</Badge>}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Properties ───────────────────────────────────────── */}
        <TabsContent value="properties">
          {properties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum imóvel disponível para publicação</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-3">
                Clique para expandir e gerenciar em quais portais cada imóvel será publicado.
                Ícones: <CheckCircle2 className="h-3 w-3 text-green-500 inline" /> VrSync &nbsp;
                <CheckCircle2 className="h-3 w-3 text-green-500 inline" /> OLX
              </p>
              {properties.map((p) => (
                <PropertyRow
                  key={p.id}
                  prop={p}
                  onTogglePortal={handleTogglePortal}
                  isToggling={toggleMutation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Generate XML ─────────────────────────────────────── */}
        <TabsContent value="generate" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: "grupozap", format: "vrsync", label: "ZAP / VivaReal", desc: "Formato VrSync — Padrão unificado Grupo OLX. Atende ZAP Imóveis e VivaReal simultaneamente.", color: "border-purple-300" },
              { key: "olx", format: "olx", label: "OLX", desc: "Formato OLX nativo — Schema real_estate_v2. Para anúncios diretos na OLX.", color: "border-orange-300" },
            ].map((portal) => (
              <Card key={portal.key} className={portal.color}>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileCode className="h-4 w-4" />
                    {portal.label}
                  </CardTitle>
                  <CardDescription className="text-xs">{portal.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {portalStats[portal.key]?.valid || 0} imóveis válidos de {portalStats[portal.key]?.total || 0}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleGenerateXML(portal.format)}
                      disabled={generateMutation.isPending}
                    >
                      {generateMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Download className="h-3 w-3 mr-1" />
                      )}
                      Gerar XML
                    </Button>
                  </div>
                  {generateMutation.isSuccess && generateMutation.data?.format === portal.format && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                      XML gerado com sucesso! {generateMutation.data.propertyCount} imóveis incluídos.
                      Arquivo baixado automaticamente.
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Como usar os XMLs gerados</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>
                <strong>ZAP / VivaReal (VrSync):</strong> Acesse{" "}
                <a href="https://developers.grupozap.com" target="_blank" rel="noopener" className="text-purple-600 underline">
                  developers.grupozap.com
                </a>{" "}
                e cadastre a URL do feed XML. O portal busca o arquivo automaticamente a cada 8h.
              </p>
              <p>
                <strong>OLX:</strong> Acesse{" "}
                <a href="https://developers.olx.com.br" target="_blank" rel="noopener" className="text-orange-600 underline">
                  developers.olx.com.br
                </a>{" "}
                e envie o arquivo XML via painel do integrador.
              </p>
              <p>
                Para automação completa, hospede os XMLs em URL pública (ex: Supabase Storage) e cadastre nos portais.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Validation ───────────────────────────────────────── */}
        {validateMutation.data && (
          <TabsContent value="validation" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KPI label="Total Imóveis" value={validateMutation.data.totalProperties} />
              <KPI label="Válidos VrSync" value={validateMutation.data.validVrSync} color="text-purple-600" />
              <KPI label="Válidos OLX" value={validateMutation.data.validOLX} color="text-orange-600" />
              <KPI label="Erros" value={validateMutation.data.errorCount} color="text-red-600" />
              <KPI label="Avisos" value={validateMutation.data.warningCount} color="text-yellow-600" />
            </div>
            <ValidationErrorList errors={validateMutation.data.errors} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
