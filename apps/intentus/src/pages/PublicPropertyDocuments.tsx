import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, AlertTriangle, CheckCircle, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { propertyDocTypeLabels, propertyDocStatusLabels, propertyDocStatusColors } from "@/lib/propertyDocSchema";

export default function PublicPropertyDocuments() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (!id || !token) {
        setError("Link inválido ou expirado.");
        setLoading(false);
        return;
      }

      try {
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
        const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const resp = await fetch(
          `${SUPABASE_URL}/functions/v1/public-property-documents?property_id=${id}&token=${token}`,
          { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
        );

        const json = await resp.json();

        if (!resp.ok || json.error) {
          setError(json.error || "Link inválido ou expirado.");
          setLoading(false);
          return;
        }

        setProperty(json.property);
        setDocuments(json.documents || []);
      } catch {
        setError("Erro ao carregar documentos.");
      }
      setLoading(false);
    }
    load();
  }, [id, token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando documentos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Acesso Negado</h2>
            <p className="text-muted-foreground text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const regularDocs = documents.filter(d => d.status === "regular").length;
  const expiringDocs = documents.filter(d => {
    if (!d.expires_at) return false;
    const days = Math.ceil((new Date(d.expires_at).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  }).length;
  const expiredDocs = documents.filter(d => d.expires_at && new Date(d.expires_at) < new Date()).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-6 w-6" />
            <span className="text-sm opacity-80">Documentação do Imóvel</span>
          </div>
          <h1 className="text-xl font-bold">{property?.title || "Imóvel"}</h1>
          {property?.address && (
            <p className="text-sm opacity-80 mt-1">
              {property.address}{property.city ? `, ${property.city}` : ""}{property.state ? ` - ${property.state}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
              <div className="text-xl font-bold">{regularDocs}</div>
              <div className="text-xs text-muted-foreground">Regulares</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
              <div className="text-xl font-bold">{expiringDocs}</div>
              <div className="text-xs text-muted-foreground">A vencer (30d)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-1" />
              <div className="text-xl font-bold">{expiredDocs}</div>
              <div className="text-xs text-muted-foreground">Vencidos</div>
            </CardContent>
          </Card>
        </div>

        {/* Document list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Documentos ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {documents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum documento disponível.</p>
            )}
            {documents.map((doc) => {
              const isExpired = doc.expires_at && new Date(doc.expires_at) < new Date();
              const daysToExpiry = doc.expires_at
                ? Math.ceil((new Date(doc.expires_at).getTime() - Date.now()) / 86400000)
                : null;

              return (
                <div key={doc.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                  <FileText className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{doc.title}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${propertyDocStatusColors[doc.status] || ""}`}
                      >
                        {propertyDocStatusLabels[doc.status] || doc.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {propertyDocTypeLabels[doc.document_type] || doc.document_type}
                      {doc.expires_at && (
                        <span className={`ml-2 ${isExpired ? "text-destructive" : daysToExpiry !== null && daysToExpiry <= 30 ? "text-amber-600" : ""}`}>
                          · Vence: {format(new Date(doc.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                          {isExpired && " (vencido)"}
                          {!isExpired && daysToExpiry !== null && daysToExpiry <= 30 && ` (${daysToExpiry}d)`}
                        </span>
                      )}
                    </div>
                    {doc.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.notes}</p>}
                  </div>
                  {doc.file_url && (
                    <Button size="sm" variant="ghost" className="shrink-0" asChild>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Acesso seguro via link gerado em {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}
