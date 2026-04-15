import { PenTool, MoreHorizontal, Trash2, Eye, RotateCcw, Trash, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { PROVIDER_LABELS, PROVIDER_COLORS, type SignatureProviderKey } from "@/lib/signatureProvidersDefaults";
import type { EnvelopeFilter } from "@/hooks/useSignatureEnvelopes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  enviado: { label: "Enviado", variant: "outline" },
  parcialmente_assinado: { label: "Parcial", variant: "outline" },
  concluido: { label: "Concluído", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
  expirado: { label: "Expirado", variant: "destructive" },
};

const SIG_TYPE_MAP: Record<string, { label: string; color: string }> = {
  simples: { label: "Simples", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  avancada: { label: "Avançada", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  qualificada: { label: "Qualificada", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

interface Props {
  envelopes: any[];
  signersByEnvelope: Record<string, any[]>;
  filter: EnvelopeFilter;
  search: string;
  onViewDetail: (id: string) => void;
  onSoftDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  isLoading: boolean;
}

export default function SignatureEnvelopeTable({
  envelopes, signersByEnvelope, filter, search, onViewDetail, onSoftDelete, onRestore, onPermanentDelete, isLoading,
}: Props) {
  const filtered = envelopes.filter((e: any) =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <PenTool className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhum envelope encontrado.</p>
      </div>
    );
  }

  const isTrash = filter === "lixeira";

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Provedor</TableHead>
            <TableHead>Signatários</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((envelope: any) => {
            const signers = signersByEnvelope[envelope.id] ?? [];
            const sigType = SIG_TYPE_MAP[envelope.signature_type] ?? SIG_TYPE_MAP.avancada;

            return (
              <TableRow key={envelope.id} className="cursor-pointer" onClick={() => onViewDetail(envelope.id)}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <PenTool className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate max-w-[200px]">{envelope.title}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${sigType.color}`}>
                    {sigType.label}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={PROVIDER_COLORS[envelope.provider as SignatureProviderKey] || ""}>
                    {PROVIDER_LABELS[envelope.provider as SignatureProviderKey] || envelope.provider}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex -space-x-1.5">
                    {signers.slice(0, 3).map((s: any, i: number) => (
                      <Tooltip key={s.id}>
                        <TooltipTrigger>
                          <Avatar className="h-6 w-6 border-2 border-background">
                            <AvatarFallback className="text-[10px]">
                              {(s.name || "?").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{s.name} — {s.status}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {signers.length > 3 && (
                      <Avatar className="h-6 w-6 border-2 border-background">
                        <AvatarFallback className="text-[10px]">+{signers.length - 3}</AvatarFallback>
                      </Avatar>
                    )}
                    {signers.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_MAP[envelope.status]?.variant || "secondary"}>
                    {STATUS_MAP[envelope.status]?.label || envelope.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {envelope.deadline_at ? (
                    <div className="flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      {format(new Date(envelope.deadline_at), "dd/MM/yyyy")}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(envelope.created_at), "dd/MM/yyyy")}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewDetail(envelope.id)}>
                        <Eye className="h-4 w-4 mr-2" />Detalhes
                      </DropdownMenuItem>
                      {isTrash ? (
                        <>
                          <DropdownMenuItem onClick={() => onRestore(envelope.id)}>
                            <RotateCcw className="h-4 w-4 mr-2" />Restaurar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => onPermanentDelete(envelope.id)}>
                            <Trash className="h-4 w-4 mr-2" />Excluir permanentemente
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem className="text-destructive" onClick={() => onSoftDelete(envelope.id)}>
                          <Trash2 className="h-4 w-4 mr-2" />Mover para lixeira
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
