/**
 * LeadChatbotDialog — Chatbot conversacional de qualificação de leads.
 * Integra no LeadDetailDialog como tab "IA Chatbot".
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  useSendChatMessage,
  useQualifyLead,
  useLeadConversations,
  useConversationMessages,
  QUALIFICATION_LEVEL_LABELS,
  QUALIFICATION_LEVEL_COLORS,
  BANT_LABELS,
  PRIORITY_COLORS,
  type QualificationResult,
  type ChatMessage,
} from "@/hooks/useLeadChatbot";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Target,
  MessageSquare,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Props ───────────────────────────────────────────────────────────────────

interface LeadChatbotProps {
  leadId: string;
  leadName: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LeadChatbotPanel({ leadId, leadName }: LeadChatbotProps) {
  const [inputValue, setInputValue] = useState("");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showQualification, setShowQualification] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useLeadConversations(leadId);
  const { data: messages, isLoading: messagesLoading } = useConversationMessages(activeConvId);
  const sendMessage = useSendChatMessage();
  const qualifyLead = useQualifyLead();

  // Auto-select latest conversation
  useEffect(() => {
    if (!activeConvId && conversations && conversations.length > 0) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, activeConvId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || sendMessage.isPending) return;

    sendMessage.mutate(
      { lead_id: leadId, message: text, conversation_id: activeConvId },
      {
        onSuccess: (data) => {
          if (!activeConvId) setActiveConvId(data.conversation_id);
        },
      },
    );
    setInputValue("");
  }, [inputValue, leadId, activeConvId, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleNewConversation = useCallback(() => {
    setActiveConvId(null);
  }, []);

  const handleQualify = useCallback(() => {
    qualifyLead.mutate(leadId, {
      onSuccess: (data) => {
        setShowQualification(true);
        // If there's a latest conversation, its qualification_result was updated
      },
    });
  }, [leadId, qualifyLead]);

  // Get latest qualification from conversations
  const latestQualification = conversations?.find(
    (c) => c.qualification_result,
  )?.qualification_result as QualificationResult | undefined;

  const qualification = qualifyLead.data || latestQualification;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex items-center gap-2 border-b bg-muted/30">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium flex-1">
          Chatbot IA — {leadName}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={handleQualify}
          disabled={qualifyLead.isPending}
        >
          {qualifyLead.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Target className="h-3 w-3" />
          )}
          Qualificar BANT
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1"
          onClick={handleNewConversation}
        >
          <MessageSquare className="h-3 w-3" />
          Nova
        </Button>
      </div>

      {/* ── Qualification Result Panel ──────────────────────────────── */}
      {qualification && (
        <div className="border-b">
          <button
            className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-muted/50 transition-colors"
            onClick={() => setShowQualification(!showQualification)}
          >
            <Badge className={QUALIFICATION_LEVEL_COLORS[qualification.qualification_level] || ""}>
              {QUALIFICATION_LEVEL_LABELS[qualification.qualification_level] || qualification.qualification_level}
              {" "}{qualification.qualification_score}/100
            </Badge>
            <span className="text-muted-foreground flex-1 text-left truncate">
              {qualification.summary}
            </span>
            {showQualification ? (
              <ChevronUp className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            )}
          </button>

          {showQualification && (
            <div className="px-4 pb-3 space-y-3">
              {/* BANT bars */}
              <div className="grid grid-cols-2 gap-2">
                {(["budget", "authority", "need", "timeline"] as const).map((dim) => {
                  const d = qualification.bant_analysis[dim];
                  return (
                    <div key={dim} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-medium">{BANT_LABELS[dim]}</span>
                        <span className="text-muted-foreground">{d.score}/25</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            d.score >= 20 ? "bg-green-500" : d.score >= 10 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${(d.score / 25) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{d.notes}</p>
                    </div>
                  );
                })}
              </div>

              {/* Recommended actions */}
              {qualification.recommended_actions.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium mb-1">Ações Recomendadas</p>
                  <div className="space-y-1">
                    {qualification.recommended_actions.slice(0, 3).map((a, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[10px]">
                        <Badge className={`${PRIORITY_COLORS[a.priority] || ""} text-[9px] px-1 py-0`}>
                          {a.priority}
                        </Badge>
                        <span>{a.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested questions */}
              {qualification.suggested_questions.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium mb-1">Perguntas Sugeridas</p>
                  <div className="space-y-0.5">
                    {qualification.suggested_questions.slice(0, 3).map((q, i) => (
                      <button
                        key={i}
                        className="flex items-start gap-1.5 text-[10px] text-primary hover:underline cursor-pointer w-full text-left"
                        onClick={() => setInputValue(q)}
                      >
                        <HelpCircle className="h-3 w-3 shrink-0 mt-0.5" />
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {qualification.model_used && (
                <Badge variant="outline" className="text-[9px]">
                  {qualification.model_used === "rule_engine_v1" ? "Regras" : "IA Real"}
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Messages area ───────────────────────────────────────────── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-3 space-y-3">
          {!activeConvId && !messages?.length && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Sparkles className="h-8 w-8 text-primary/30 mb-2" />
              <p className="text-sm font-medium">Inicie uma conversa</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                Pergunte ao assistente IA sobre este lead. Ele analisa o perfil completo e sugere como qualificar melhor.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
                {[
                  "Analise este lead",
                  "Como devo abordar?",
                  "Quais perguntas fazer?",
                  "Este lead é qualificado?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="text-[10px] px-2 py-1 rounded-full border hover:bg-muted/50 transition-colors text-muted-foreground"
                    onClick={() => {
                      setInputValue(suggestion);
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messagesLoading && activeConvId && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {messages?.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {sendMessage.isPending && (
            <div className="flex items-start gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs">Pensando...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* ── Input area ──────────────────────────────────────────────── */}
      <div className="border-t px-4 py-3">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre este lead..."
            className="text-sm h-9"
            disabled={sendMessage.isPending}
          />
          <Button
            size="sm"
            className="h-9 px-3"
            onClick={handleSend}
            disabled={!inputValue.trim() || sendMessage.isPending}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
        {conversations && conversations.length > 1 && (
          <div className="mt-2 flex gap-1 overflow-x-auto">
            {conversations.slice(0, 5).map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${
                  conv.id === activeConvId
                    ? "bg-primary text-primary-foreground border-primary"
                    : "hover:bg-muted/50"
                }`}
              >
                {conv.title?.slice(0, 25) || format(new Date(conv.created_at), "dd/MM HH:mm")}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-primary/10"
        }`}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-primary" />
        )}
      </div>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/50"
        }`}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed text-[13px]">
          {message.content}
        </p>
        <p
          className={`text-[10px] mt-1 ${
            isUser ? "text-primary-foreground/60" : "text-muted-foreground"
          }`}
        >
          {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}
