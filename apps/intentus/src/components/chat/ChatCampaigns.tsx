import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Megaphone, RefreshCw, AlertTriangle } from "lucide-react";
import { useChatCampaigns, useCreateChatCampaign, useChatChannels } from "@/hooks/useChat";
import { format } from "date-fns";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "outline" },
  agendada: { label: "Agendada", variant: "secondary" },
  enviando: { label: "Enviando", variant: "default" },
  concluida: { label: "Concluída", variant: "secondary" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

export function ChatCampaigns() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", channel_id: "", message_template: "" });

  const { data: campaigns } = useChatCampaigns();
  const { data: channels } = useChatChannels();
  const createCampaign = useCreateChatCampaign();

  const connectedChannels = (channels ?? []).filter((c) => c.status === "conectado");

  const filtered = (campaigns ?? []).filter((c: any) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    createCampaign.mutate(
      { name: form.name, channel_id: form.channel_id || undefined, message_template: form.message_template || undefined },
      { onSuccess: () => { setDialogOpen(false); setForm({ name: "", channel_id: "", message_template: "" }); toast.success("Campanha criada"); } }
    );
  };

  return (
    <div className="space-y-4">
      {connectedChannels.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Nenhuma conta conectada. Conecte um canal na aba "Canais" antes de criar campanhas.</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar campanhas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-1" /> Sincronizar</Button>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova Campanha</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviados</TableHead>
              <TableHead>Falhou</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  Nenhuma campanha encontrada
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((campaign: any) => {
                const st = STATUS_MAP[campaign.status] || { label: campaign.status, variant: "outline" as const };
                return (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>{campaign.chat_channels?.name || "-"}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell>{campaign.sent_count}</TableCell>
                    <TableCell>{campaign.failed_count}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(campaign.created_at), "dd/MM/yyyy")}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Canal</Label>
              <Select value={form.channel_id} onValueChange={(v) => setForm({ ...form, channel_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
                <SelectContent>
                  {connectedChannels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Mensagem</Label><Textarea value={form.message_template} onChange={(e) => setForm({ ...form, message_template: e.target.value })} rows={4} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
