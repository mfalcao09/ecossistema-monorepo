/**
 * ContractSignaturesTab - Gestão de envelopes de assinatura digital
 *
 * Exibe o status dos envelopes de assinatura de um contrato,
 * incluindo signatários, datas e ações disponíveis.
 */

import { useContractSignatureEnvelopes, type SignatureEnvelope } from "@/hooks/useContractSignatureEnvelopes";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pen, Send, Eye, CheckCircle, XCircle, Clock, ExternalLink,
  Users, FileText, AlertTriangle, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ENVELOPE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  criado: { label: "Criado", color: "bg-gray-500/10 text-gray-400 border-gray-500/20", icon: FileText },
  enviado: { label: "Enviado", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Send },
  visualizado: { label: "Visualizado", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: Eye },
  assinado_parcial: { label: "Assinatura Parcial", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: Pen },
  assinado: { label: "Assinado", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle },
  recusado: { label: "Recusado", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
  expirado: { label: "Expirado", color: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: Clock },
};

const PROVIDER_LABELS: Record<string, string> = {
  clicksign: "Clicksign",
  docusign: "DocuSign",
  d4sign: "D4Sign",
  manual: "Manual",
};

interface ContractSignaturesTabProps {
  contractId: string;
}

export function ContractSignaturesTab({ contractId }: ContractSignaturesTabProps) {
  const { data: envelopes, isLoading, isError } = useContractSignatureEnvelopes(contractId);

  if (isLoading) {
    return (
      <div className="space-y-3 pt-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Erro ao carregar envelopes de assinatura.
      </div>
    );
  }

  if (!envelopes || envelopes.length === 0) {
    return (
      <div className="text-center py-8">
        <Pen className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          Nenhum envelope de assinatura criado ainda.
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Envelopes são criados automaticamente quando o contrato entra em "Aguardando Assinatura".
        </p>
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-4">
      <div className="flex items-center gap-2">
        <Pen className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Envelopes de Assinatura</h3>
        <Badge variant="outline" className="text-xs">{envelopes.length}</Badge>
      </div>

      {envelopes.map((envelope) => {
        const config = ENVELOPE_STATUS_CONFIG[envelope.status] || ENVELOPE_STATUS_CONFIG.criado;
        const StatusIcon = config.icon;
        const isExpiringSoon = envelope.expires_at &&
          new Date(envelope.expires_at).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 &&
          !["assinado", "recusado", "expirado"].includes(envelope.status);

        return (
          <Card key={envelope.id} className={cn("border", config.color)}>
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <StatusIcon className="h-4 w-4" />
                  <Badge className={cn("text-xs", config.color)}>{config.label}</Badge>
                  <Badge variant="outline" className="text-xs">
                    {PROVIDER_LABELS[envelope.provider] || envelope.provider}
                  </Badge>
                  {isExpiringSoon && (
                    <Badge variant="destructive" className="text-xs flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Expirando
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(envelope.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs">
                {envelope.sent_at && (
                  <div>
                    <span className="text-muted-foreground">Enviado: </span>
                    <span>{format(new Date(envelope.sent_at), "dd/MM HH:mm")}</span>
                  </div>
                )}
                {envelope.expires_at && (
                  <div>
                    <span className="text-muted-foreground">Expira: </span>
                    <span className={isExpiringSoon ? "text-red-400 font-medium" : ""}>
                      {format(new Date(envelope.expires_at), "dd/MM/yyyy")}
                    </span>
                  </div>
                )}
                {envelope.completed_at && (
                  <div>
                    <span className="text-muted-foreground">Concluído: </span>
                    <span className="text-green-400">{format(new Date(envelope.completed_at), "dd/MM HH:mm")}</span>
                  </div>
                )}
                {envelope.reminder_count > 0 && (
                  <div>
                    <span className="text-muted-foreground">Lembretes: </span>
                    <span>{envelope.reminder_count}</span>
                  </div>
                )}
              </div>

              {/* Signatários */}
              {envelope.signatories && envelope.signatories.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                    <Users className="h-3 w-3" />
                    Signatários
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {envelope.signatories.map((s, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border",
                          s.signed_at
                            ? "bg-green-500/10 border-green-500/20 text-green-400"
                            : "bg-muted/50 border-border"
                        )}
                      >
                        {s.signed_at ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span>{s.name || s.email}</span>
                        <span className="text-muted-foreground/60">({s.role})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex items-center gap-2">
                {envelope.external_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => window.open(envelope.external_url!, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Abrir no {PROVIDER_LABELS[envelope.provider]}
                  </Button>
                )}
                {envelope.signed_document_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-green-400"
                    onClick={() => window.open(envelope.signed_document_url!, "_blank")}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Documento Assinado
                  </Button>
                )}
                {["criado", "enviado", "visualizado", "assinado_parcial"].includes(envelope.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      // TODO: Integração real com Clicksign
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Enviar Lembrete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
