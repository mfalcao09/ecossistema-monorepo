import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Search, Filter, UserCircle, Users as UsersIcon, MessageCircle } from "lucide-react";
import { useChatConversations, useChatMessages, useSendChatMessage } from "@/hooks/useChat";
import { format } from "date-fns";

export function ChatConversations() {
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useChatConversations(filterStatus);
  const { data: messages } = useChatMessages(selectedConv ?? undefined);
  const sendMessage = useSendChatMessage();

  const filtered = (conversations ?? []).filter((c: any) =>
    !search || c.chat_contacts?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedData = filtered.find((c: any) => c.id === selectedConv);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || !selectedConv) return;
    sendMessage.mutate({ conversation_id: selectedConv, content: message });
    setMessage("");
  };

  const filters = [
    { label: "Todas", value: undefined },
    { label: "Abertas", value: "aberta" },
    { label: "Aguardando", value: "aguardando" },
    { label: "Resolvidas", value: "resolvida" },
  ];

  return (
    <div className="flex h-[calc(100vh-220px)] border rounded-lg overflow-hidden bg-background">
      {/* Sidebar filtros */}
      <div className="w-14 border-r flex flex-col items-center py-3 gap-3 bg-muted/30">
        {filters.map((f) => (
          <Button
            key={f.label}
            variant={filterStatus === f.value ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9"
            title={f.label}
            onClick={() => setFilterStatus(f.value)}
          >
            {f.label === "Todas" && <MessageCircle className="h-4 w-4" />}
            {f.label === "Abertas" && <UserCircle className="h-4 w-4" />}
            {f.label === "Aguardando" && <Filter className="h-4 w-4" />}
            {f.label === "Resolvidas" && <UsersIcon className="h-4 w-4" />}
          </Button>
        ))}
      </div>

      {/* Lista de conversas */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa encontrada</div>
          ) : (
            filtered.map((conv: any) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConv(conv.id)}
                className={`w-full text-left px-3 py-3 border-b hover:bg-muted/50 transition-colors flex items-center gap-3 ${
                  selectedConv === conv.id ? "bg-muted" : ""
                }`}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {conv.chat_contacts?.name?.substring(0, 2).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">{conv.chat_contacts?.name || "Contato"}</span>
                    {conv.last_message_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(conv.last_message_at), "HH:mm")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground truncate">
                      {conv.chat_channels?.name || "Sem canal"}
                    </span>
                    {conv.unread_count > 0 && (
                      <Badge variant="default" className="h-5 min-w-[20px] text-[10px] px-1.5">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Área de chat */}
      <div className="flex-1 flex flex-col">
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Selecione uma conversa</p>
              <p className="text-sm">Escolha uma conversa na lista ao lado para começar</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header do chat */}
            <div className="h-14 border-b flex items-center px-4 gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {(selectedData as any)?.chat_contacts?.name?.substring(0, 2).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{(selectedData as any)?.chat_contacts?.name || "Contato"}</p>
                <p className="text-xs text-muted-foreground">{(selectedData as any)?.chat_contacts?.phone}</p>
              </div>
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {(messages ?? []).map((msg) => {
                  const isAgent = msg.sender_type === "agente" || msg.sender_type === "sistema";
                  return (
                    <div key={msg.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                          isAgent
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        }`}
                      >
                        <p>{msg.content}</p>
                        <span className={`text-[10px] block text-right mt-1 ${isAgent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {format(new Date(msg.created_at), "HH:mm")}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3 flex gap-2">
              <Input
                placeholder="Digite uma mensagem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                className="flex-1"
              />
              <Button size="icon" onClick={handleSend} disabled={!message.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
