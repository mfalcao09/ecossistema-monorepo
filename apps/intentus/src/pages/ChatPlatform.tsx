import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, LayoutDashboard, FolderOpen, Users, Tag, Megaphone, Puzzle, Layers, Radio, Lock } from "lucide-react";
import { ChatDashboard } from "@/components/chat/ChatDashboard";
import { ChatConversations } from "@/components/chat/ChatConversations";
import { ChatFiles } from "@/components/chat/ChatFiles";
import { ChatContacts } from "@/components/chat/ChatContacts";
import { ChatTags } from "@/components/chat/ChatTags";
import { ChatCampaigns } from "@/components/chat/ChatCampaigns";
import { ChatIntegrations } from "@/components/chat/ChatIntegrations";
import { ChatQueues } from "@/components/chat/ChatQueues";
import { ChatChannels } from "@/components/chat/ChatChannels";
import { useChatSubscription } from "@/hooks/useChatSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const tabs = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard, module: "" },
  { value: "conversas", label: "Conversas", icon: MessageCircle, module: "chat_conversas" },
  { value: "arquivos", label: "Arquivos", icon: FolderOpen, module: "chat_arquivos" },
  { value: "contatos", label: "Contatos", icon: Users, module: "chat_contatos" },
  { value: "tags", label: "Tags", icon: Tag, module: "chat_tags" },
  { value: "campanhas", label: "Campanhas", icon: Megaphone, module: "chat_campanhas" },
  { value: "integracoes", label: "Integrações", icon: Puzzle, module: "chat_integracoes" },
  { value: "filas", label: "Filas", icon: Layers, module: "chat_filas" },
  { value: "canais", label: "Canais", icon: Radio, module: "chat_canais" },
];

export default function ChatPlatform() {
  const { hasSubscription, plan, status, blocked, hasChatModule, isLoading } = useChatSubscription();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!hasSubscription) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Atendimento WhatsApp</h1>
          <p className="text-muted-foreground">Plataforma multicanal de atendimento ao cliente</p>
        </div>

        <Card className="max-w-2xl mx-auto mt-8">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">
              {blocked ? "Assinatura Bloqueada" : "Contrate o Atendimento WhatsApp"}
            </h2>
            <p className="text-muted-foreground max-w-md">
              {blocked
                ? "Sua assinatura do Atendimento WhatsApp está bloqueada ou expirada. Entre em contato com o suporte para regularizar."
                : "O módulo de Atendimento WhatsApp é um produto adicional com planos próprios. Entre em contato com o administrador da plataforma para contratar."}
            </p>
            {status !== "none" && (
              <Badge variant="destructive">{status === "expirado" ? "Expirado" : status === "cancelado" ? "Cancelado" : "Bloqueado"}</Badge>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const visibleTabs = tabs.filter((t) => !t.module || hasChatModule(t.module));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Atendimento WhatsApp</h1>
          <p className="text-muted-foreground">Plataforma multicanal de atendimento ao cliente</p>
        </div>
        {plan && (
          <Badge variant="outline" className="text-xs">
            Plano: {plan.name}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1 gap-0.5">
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5 text-xs whitespace-nowrap">
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard" className="mt-4"><ChatDashboard /></TabsContent>
        <TabsContent value="conversas" className="mt-4"><ChatConversations /></TabsContent>
        <TabsContent value="arquivos" className="mt-4"><ChatFiles /></TabsContent>
        <TabsContent value="contatos" className="mt-4"><ChatContacts /></TabsContent>
        <TabsContent value="tags" className="mt-4"><ChatTags /></TabsContent>
        <TabsContent value="campanhas" className="mt-4"><ChatCampaigns /></TabsContent>
        <TabsContent value="integracoes" className="mt-4"><ChatIntegrations /></TabsContent>
        <TabsContent value="filas" className="mt-4"><ChatQueues /></TabsContent>
        <TabsContent value="canais" className="mt-4"><ChatChannels /></TabsContent>
      </Tabs>
    </div>
  );
}
