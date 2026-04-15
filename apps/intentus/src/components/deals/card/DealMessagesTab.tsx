import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDealRequestComments, useAddDealComment } from "@/hooks/useDealRequests";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Send } from "lucide-react";

const departmentLabels: Record<string, string> = { comercial: "Comercial", juridico: "Jurídico", financeiro: "Financeiro" };
const departmentColors: Record<string, string> = {
  comercial: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  juridico: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  financeiro: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export function DealMessagesTab({ dealId }: { dealId: string }) {
  const { data: comments } = useDealRequestComments(dealId);
  const addComment = useAddDealComment();
  const [commentMessage, setCommentMessage] = useState("");
  const [commentTarget, setCommentTarget] = useState("");

  const handleSend = () => {
    if (!commentMessage.trim()) return;
    addComment.mutate(
      { dealId, message: commentMessage, targetDepartment: commentTarget || undefined },
      { onSuccess: () => { setCommentMessage(""); setCommentTarget(""); } }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <ScrollArea className="max-h-[35vh]">
        {!comments || comments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">
            Nenhuma mensagem ainda. Envie a primeira comunicação.
          </p>
        ) : (
          <div className="space-y-3 pr-3">
            {comments.map((c: any) => (
              <div key={c.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  {c.target_department && (
                    <Badge className={`text-xs py-0 ${departmentColors[c.target_department] || ""}`} variant="outline">
                      Para: {departmentLabels[c.target_department] || c.target_department}
                    </Badge>
                  )}
                  <span className="text-muted-foreground/60 text-xs ml-auto">
                    {format(new Date(c.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.message}</p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <Separator />

      <div className="space-y-3">
        <Select value={commentTarget} onValueChange={setCommentTarget}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="Destinatário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="comercial">Comercial</SelectItem>
            <SelectItem value="juridico">Jurídico</SelectItem>
            <SelectItem value="financeiro">Financeiro</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          value={commentMessage}
          onChange={(e) => setCommentMessage(e.target.value)}
          placeholder="Digite sua mensagem..."
          rows={3}
        />
        <Button onClick={handleSend} disabled={!commentMessage.trim() || addComment.isPending} size="sm">
          <Send className="mr-1 h-4 w-4" />
          {addComment.isPending ? "Enviando..." : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
