import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { Plus, Bot, FileText, ThumbsUp, ThumbsDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";

interface ChatMessage {
  role: string;
  content: string;
  logId?: string | null;
  rated?: boolean;
}

export default function LegalDesk() {
  const [tab, setTab] = useState("docs");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const qc = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ["legal-desk-templates"],
    queryFn: async () => { const { data, error } = await supabase.from("legal_desk_templates").select("*").eq("is_active", true).order("name"); if (error) throw error; return data; },
  });

  const { data: generatedDocs = [] } = useQuery({
    queryKey: ["legal-desk-docs"],
    queryFn: async () => { const { data, error } = await supabase.from("legal_desk_generated_docs").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("legal-chatbot", { body: { messages: [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.content })) } });
      if (error) throw error;
      setChatMessages(prev => [...prev, { role: "assistant", content: data?.reply || "Sem resposta.", logId: data?.log_id || null }]);
    } catch (e: any) {
      toast.error("Erro no chatbot: " + e.message);
    } finally {
      setChatLoading(false);
    }
  };

  const rateMessage = async (index: number, rating: number) => {
    const msg = chatMessages[index];
    if (!msg.logId || msg.rated) return;
    try {
      await supabase.from("ai_interaction_logs").update({ rating }).eq("id", msg.logId);
      setChatMessages(prev => prev.map((m, i) => i === index ? { ...m, rated: true } : m));
      toast.success(rating >= 4 ? "Obrigado pelo feedback positivo!" : "Obrigado, vamos melhorar!");
    } catch {
      toast.error("Erro ao enviar feedback");
    }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Legal Desk</h1><p className="text-muted-foreground">Autoatendimento jurídico para corretores e captadores.</p></div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="docs"><FileText className="h-4 w-4 mr-1" />Gerar Documento</TabsTrigger><TabsTrigger value="chat"><Bot className="h-4 w-4 mr-1" />Consulta Jurídica</TabsTrigger></TabsList>

        <TabsContent value="docs" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {templates.length === 0 ? <p className="text-muted-foreground col-span-3">Nenhum template configurado. Configure templates no módulo de Modelos de Contrato.</p> : templates.map((t: any) => (
              <Card key={t.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><span className="font-medium">{t.name}</span></div>
                  <p className="text-xs text-muted-foreground mt-1">{t.template_type}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <h3 className="text-sm font-semibold mt-6">Documentos Gerados</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Template</TableHead><TableHead>Status</TableHead><TableHead>Gerado em</TableHead></TableRow></TableHeader>
              <TableBody>
                {generatedDocs.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhum documento gerado.</TableCell></TableRow> : generatedDocs.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.template_id}</TableCell>
                    <TableCell><Badge variant={d.status === "aprovado" ? "default" : "secondary"}>{d.status}</Badge></TableCell>
                    <TableCell>{format(new Date(d.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4" />Consulta Jurídica via IA</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-md p-4 min-h-[300px] max-h-[400px] overflow-y-auto space-y-3">
                {chatMessages.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">Faça perguntas sobre garantias, documentos necessários, exigências legais...</p>}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className="flex flex-col gap-1 max-w-[80%]">
                      <div className={`rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{msg.content}</div>
                      {msg.role === "assistant" && msg.logId && !msg.rated && (
                        <div className="flex gap-1 ml-1">
                          <button onClick={() => rateMessage(i, 5)} className="text-muted-foreground hover:text-green-600 transition-colors p-0.5" title="Boa resposta">
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => rateMessage(i, 1)} className="text-muted-foreground hover:text-red-500 transition-colors p-0.5" title="Resposta ruim">
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      {msg.role === "assistant" && msg.rated && (
                        <span className="text-xs text-muted-foreground ml-1">✓ Feedback enviado</span>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && <div className="text-muted-foreground text-sm">Pensando...</div>}
              </div>
              <div className="flex gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Sua dúvida jurídica..." onKeyDown={(e) => e.key === "Enter" && sendChat()} />
                <Button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>Enviar</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
