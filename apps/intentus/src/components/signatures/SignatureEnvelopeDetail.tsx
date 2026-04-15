import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SIGNER_ROLE_LABELS, AUTH_METHOD_LABELS } from "@/lib/signatureProvidersDefaults";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { FileText, Users, Eye, Shield, Clock, Hash, Monitor, MapPin } from "lucide-react";
import { PROVIDER_LABELS, type SignatureProviderKey } from "@/lib/signatureProvidersDefaults";
import { useSignatureAuditLog } from "@/hooks/useSignatureAuditLog";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  enviado: { label: "Enviado", variant: "outline" },
  parcialmente_assinado: { label: "Parcial", variant: "outline" },
  concluido: { label: "Concluído", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
  expirado: { label: "Expirado", variant: "destructive" },
};

const SIG_TYPE_LABEL: Record<string, string> = {
  simples: "Simples",
  avancada: "Avançada",
  qualificada: "Qualificada",
};

const SIGNER_STATUS_COLOR: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700",
  assinado: "bg-green-100 text-green-700",
  recusado: "bg-red-100 text-red-700",
};

const ACTION_LABELS: Record<string, string> = {
  criado: "Envelope criado",
  visualizado: "Documento visualizado",
  assinado: "Documento assinado",
  recusado: "Assinatura recusada",
  cancelado: "Envelope cancelado",
  lembrete_enviado: "Lembrete enviado",
  expirado: "Envelope expirado",
};

interface Props {
  envelopeId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function SignatureEnvelopeDetail({ envelopeId, open, onOpenChange }: Props) {
  const { data: envelope } = useQuery({
    queryKey: ["signature-envelope-detail", envelopeId],
    enabled: !!envelopeId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_signature_envelopes")
        .select("*")
        .eq("id", envelopeId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: signers = [] } = useQuery({
    queryKey: ["signature-detail-signers", envelopeId],
    enabled: !!envelopeId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_signature_signers")
        .select("*")
        .eq("envelope_id", envelopeId!)
        .order("sign_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["signature-detail-docs", envelopeId],
    enabled: !!envelopeId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_signature_documents")
        .select("*")
        .eq("envelope_id", envelopeId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: observers = [] } = useQuery({
    queryKey: ["signature-detail-observers", envelopeId],
    enabled: !!envelopeId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_signature_observers")
        .select("*")
        .eq("envelope_id", envelopeId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { logs } = useSignatureAuditLog(envelopeId);

  if (!envelope) return null;

  const status = STATUS_MAP[envelope.status] ?? STATUS_MAP.rascunho;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">{envelope.title}</DialogTitle>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant={status.variant}>{status.label}</Badge>
                <Badge variant="outline">{PROVIDER_LABELS[envelope.provider as SignatureProviderKey] || envelope.provider}</Badge>
                <Badge variant="outline">{SIG_TYPE_LABEL[envelope.signature_type] || "Avançada"}</Badge>
                {envelope.deadline_at && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Prazo: {format(new Date(envelope.deadline_at), "dd/MM/yyyy")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="timeline" className="flex-1">
          <TabsList className="px-6 pt-2">
            <TabsTrigger value="timeline"><Shield className="h-3.5 w-3.5 mr-1" />Trilha de Auditoria</TabsTrigger>
            <TabsTrigger value="signers"><Users className="h-3.5 w-3.5 mr-1" />Signatários</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="h-3.5 w-3.5 mr-1" />Documentos</TabsTrigger>
            <TabsTrigger value="observers"><Eye className="h-3.5 w-3.5 mr-1" />Observadores</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[50vh] px-6 pb-6">
            {/* Timeline / Audit Log */}
            <TabsContent value="timeline" className="mt-4 space-y-3">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento registrado.</p>
              ) : (
                <div className="relative border-l-2 border-muted ml-3 space-y-4">
                  {logs.map((log: any) => (
                    <div key={log.id} className="relative pl-6">
                      <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary" />
                      <div className="text-sm">
                        <p className="font-medium">{ACTION_LABELS[log.action] || log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.performer_name ?? "Sistema"} — {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                        </p>
                        {(log.ip_address || log.user_agent) && (
                          <div className="flex flex-wrap gap-3 mt-1 text-[11px] text-muted-foreground/70">
                            {log.ip_address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{log.ip_address}</span>}
                            {log.user_agent && <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />{log.user_agent.slice(0, 60)}…</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Signers */}
            <TabsContent value="signers" className="mt-4 space-y-3">
              {signers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum signatário.</p>
              ) : signers.map((s: any) => (
                <Card key={s.id}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{s.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                        {s.cpf && <p className="text-xs text-muted-foreground">CPF: {s.cpf}</p>}
                      </div>
                      <div className="text-right space-y-1">
                         <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${SIGNER_STATUS_COLOR[s.status] || "bg-muted"}`}>
                           {s.status}
                         </span>
                         <p className="text-[11px] text-muted-foreground">
                           Autenticação: {(() => {
                             try { const arr = JSON.parse(s.auth_method); return Array.isArray(arr) ? arr.map((a: string) => AUTH_METHOD_LABELS[a] || a).join(", ") : AUTH_METHOD_LABELS[s.auth_method] || s.auth_method; } catch { return AUTH_METHOD_LABELS[s.auth_method] || s.auth_method || "email"; }
                           })()}
                         </p>
                       </div>
                     </div>
                     <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
                       <span>Ordem: {s.sign_order}</span>
                       <span>Papel: {(() => {
                         try { const arr = JSON.parse(s.role); return Array.isArray(arr) ? arr.map((r: string) => SIGNER_ROLE_LABELS[r] || r).join(", ") : SIGNER_ROLE_LABELS[s.role] || s.role; } catch { return SIGNER_ROLE_LABELS[s.role] || s.role; }
                       })()}</span>
                       {s.viewed_at && <span>Visualizado: {format(new Date(s.viewed_at), "dd/MM HH:mm")}</span>}
                       {s.signed_at && <span>Assinado: {format(new Date(s.signed_at), "dd/MM HH:mm")}</span>}
                       {s.ip_address && <span>IP: {s.ip_address}</span>}
                     </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Documents */}
            <TabsContent value="documents" className="mt-4 space-y-3">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento anexado.</p>
              ) : documents.map((doc: any) => (
                <Card key={doc.id}>
                  <CardContent className="pt-4 pb-3 flex items-center gap-3">
                    <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.file_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {doc.mime_type} — {doc.file_size ? (doc.file_size / 1024).toFixed(0) + " KB" : ""}
                      </p>
                      {doc.hash_sha256 && (
                        <p className="text-[11px] text-muted-foreground/70 font-mono flex items-center gap-1 mt-0.5">
                          <Hash className="h-3 w-3" />SHA-256: {doc.hash_sha256}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Observers */}
            <TabsContent value="observers" className="mt-4 space-y-3">
              {observers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum observador.</p>
              ) : observers.map((obs: any) => (
                <Card key={obs.id}>
                  <CardContent className="pt-4 pb-3">
                    <p className="font-medium text-sm">{obs.name || obs.email}</p>
                    <p className="text-xs text-muted-foreground">{obs.email}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Notificar: {obs.notify_on === "completion" ? "Ao finalizar" : obs.notify_on === "each_signature" ? "A cada assinatura" : "Todos os eventos"}
                      {obs.receive_final && " — Recebe documento final"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
