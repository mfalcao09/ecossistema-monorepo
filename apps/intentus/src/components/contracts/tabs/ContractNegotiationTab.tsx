import { useState } from "react";
import { useContractDocuments } from "@/hooks/useContractDocuments";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { documentStatusLabels } from "@/lib/clmSchema";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { getAuthTenantId } from "@/lib/tenantUtils";

interface Props {
  contractId: string;
}

interface Comment {
  id: string;
  text: string;
  status: string;
  author: string;
  created_at: string;
  document_title: string;
}

export function ContractNegotiationTab({ contractId }: Props) {
  const { data: docs, isLoading } = useContractDocuments(contractId);
  const [selectedDoc, setSelectedDoc] = useState<string>("todos");
  const [newComment, setNewComment] = useState("");

  // Comments stored as audit trail entries with action = 'negociacao_comentario'
  const { data: commentData, refetch } = useContractAuditAsComments(contractId);

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const tenant_id = await getAuthTenantId();

    await supabase.from("contract_audit_trail").insert({
      contract_id: contractId,
      action: "negociacao_comentario",
      performed_by: user.id,
      performer_name: user.email || "Usuário",
      tenant_id,
      details: {
        text: newComment.trim(),
        document_id: selectedDoc !== "todos" ? selectedDoc : null,
        status: "aberto",
      },
    });

    setNewComment("");
    refetch();
    toast.success("Comentário adicionado!");
  };

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  const comments: Comment[] = (commentData ?? []).map((c: any) => ({
    id: c.id,
    text: (c.details as any)?.text ?? "",
    status: (c.details as any)?.status ?? "aberto",
    author: c.performer_name ?? "Usuário",
    created_at: c.created_at,
    document_title: (c.details as any)?.document_id
      ? docs?.find((d) => d.id === (c.details as any).document_id)?.title ?? "Documento"
      : "Geral",
  }));

  const filteredComments = selectedDoc === "todos"
    ? comments
    : comments.filter((c) => {
        const cDocId = (commentData?.find((cd: any) => cd.id === c.id)?.details as any)?.document_id;
        return cDocId === selectedDoc;
      });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Documento:</span>
        <Select value={selectedDoc} onValueChange={setSelectedDoc}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Documentos</SelectItem>
            {docs?.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.title} (v{d.version})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* New comment */}
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <Textarea
          placeholder="Adicionar comentário de negociação..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[60px]"
        />
        <Button size="sm" onClick={handleSendComment} disabled={!newComment.trim()}>
          <Send className="h-3.5 w-3.5 mr-1" /> Enviar
        </Button>
      </div>

      {/* Comments list */}
      {filteredComments.length > 0 ? (
        <div className="space-y-2">
          {filteredComments.map((c) => (
            <div key={c.id} className="rounded-lg border bg-card p-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">{c.author}</span>
                  <Badge variant="outline" className="text-[10px]">{c.document_title}</Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(c.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="text-sm">{c.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentário de negociação.</p>
      )}
    </div>
  );
}

// Internal hook to fetch negotiation comments from audit trail
import { useQuery } from "@tanstack/react-query";

function useContractAuditAsComments(contractId: string | undefined) {
  return useQuery({
    queryKey: ["contract-negotiation-comments", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_audit_trail")
        .select("*")
        .eq("contract_id", contractId!)
        .eq("action", "negociacao_comentario")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
