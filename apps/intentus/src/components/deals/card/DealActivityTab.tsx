import { useState, useRef, useEffect, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useDealRequestComments, useDealRequestHistory, useAddDealComment, useTenantProfiles } from "@/hooks/useDealRequests";
import { dealRequestStatusLabels } from "@/lib/dealRequestSchema";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, MessageSquare, ArrowRight, Filter } from "lucide-react";

function getInitials(name?: string) {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

interface MentionUser { user_id: string; name: string }

export function DealActivityTab({ dealId, propertyTitle }: { dealId: string; propertyTitle?: string }) {
  const { data: comments } = useDealRequestComments(dealId);
  const { data: history } = useDealRequestHistory(dealId);
  const { data: profiles } = useTenantProfiles();
  const addComment = useAddDealComment();

  const [message, setMessage] = useState("");
  const [mentionedUsers, setMentionedUsers] = useState<MentionUser[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [filter, setFilter] = useState<"all" | "comments">("all");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build unified timeline
  const timeline = useMemo(() => {
    const items: any[] = [];
    if (filter !== "comments" && history) {
      history.forEach((h: any) => {
        items.push({ type: "activity", ...h });
      });
    }
    if (comments) {
      comments.forEach((c: any) => {
        items.push({ type: "comment", ...c });
      });
    }
    items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return items;
  }, [comments, history, filter]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [timeline.length]);

  // Handle @ mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : " ";
      if (charBefore === " " || charBefore === "\n" || atIndex === 0) {
        const query = textBeforeCursor.slice(atIndex + 1);
        if (!query.includes(" ") || query.length < 30) {
          setMentionFilter(query.toLowerCase());
          setShowMentions(true);
          return;
        }
      }
    }
    setShowMentions(false);
  };

  const filteredProfiles = useMemo(() => {
    if (!profiles) return [];
    return profiles.filter((p: any) =>
      p.name?.toLowerCase().includes(mentionFilter) &&
      !mentionedUsers.find((m) => m.user_id === p.user_id)
    ).slice(0, 8);
  }, [profiles, mentionFilter, mentionedUsers]);

  const selectMention = (profile: any) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart || 0;
    const textBeforeCursor = message.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    const before = message.slice(0, atIndex);
    const after = message.slice(cursorPos);
    const newMessage = `${before}@${profile.name} ${after}`;

    setMessage(newMessage);
    setMentionedUsers((prev) => [...prev, { user_id: profile.user_id, name: profile.name }]);
    setShowMentions(false);

    setTimeout(() => {
      const newPos = atIndex + profile.name.length + 2;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleSend = () => {
    if (!message.trim()) return;
    addComment.mutate(
      {
        dealId,
        message,
        mentionedUsers: mentionedUsers.map((m) => m.user_id),
        propertyTitle,
      },
      {
        onSuccess: () => {
          setMessage("");
          setMentionedUsers([]);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") setShowMentions(false);
  };

  // Render message with highlighted mentions
  const renderMessage = (text: string) => {
    const parts = text.split(/(@\S+(?:\s\S+)?)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className="text-primary font-medium">{part}</span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Atividade
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 gap-1"
          onClick={() => setFilter((f) => (f === "all" ? "comments" : "all"))}
        >
          <Filter className="h-3 w-3" />
          {filter === "all" ? "Ocultar detalhes" : "Mostrar detalhes"}
        </Button>
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 max-h-[45vh] space-y-3 pr-1 mb-3">
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">
            Nenhuma atividade registrada.
          </p>
        ) : (
          timeline.map((item) => (
            <div key={`${item.type}-${item.id}`} className="flex gap-2.5">
              <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                <AvatarFallback className={`text-[10px] ${item.type === "activity" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                  {getInitials((item.profiles as any)?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                {item.type === "activity" ? (
                  <div className="space-y-0.5">
                    <p className="text-xs leading-relaxed">
                      <span className="font-semibold">{(item.profiles as any)?.name || "Sistema"}</span>
                      {" moveu de "}
                      <Badge variant="outline" className="text-[10px] py-0 px-1 mx-0.5">
                        {dealRequestStatusLabels[item.from_status] || item.from_status || "Início"}
                      </Badge>
                      <ArrowRight className="inline h-2.5 w-2.5 mx-0.5" />
                      <Badge variant="outline" className="text-[10px] py-0 px-1 mx-0.5">
                        {dealRequestStatusLabels[item.to_status] || item.to_status}
                      </Badge>
                    </p>
                    {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold">{(item.profiles as any)?.name || "Usuário"}</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {renderMessage(item.message || "")}
                    </p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <Separator className="mb-3" />

      {/* Input area with @mentions */}
      <div className="relative space-y-2">
        {showMentions && filteredProfiles.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 right-0 z-50 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
            {filteredProfiles.map((p: any) => (
              <button
                key={p.user_id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectMention(p);
                }}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                    {getInitials(p.name)}
                  </AvatarFallback>
                </Avatar>
                {p.name}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Escreva um comentário... Use @ para mencionar"
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
        <div className="flex items-center justify-between">
          {mentionedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {mentionedUsers.map((m) => (
                <Badge key={m.user_id} variant="secondary" className="text-[10px] py-0 px-1.5 gap-1">
                  @{m.name}
                  <button
                    type="button"
                    className="ml-0.5 hover:text-destructive"
                    onClick={() => setMentionedUsers((prev) => prev.filter((u) => u.user_id !== m.user_id))}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <Button
            onClick={handleSend}
            disabled={!message.trim() || addComment.isPending}
            size="sm"
            className="ml-auto h-7 text-xs gap-1"
          >
            <Send className="h-3 w-3" />
            {addComment.isPending ? "Enviando..." : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
