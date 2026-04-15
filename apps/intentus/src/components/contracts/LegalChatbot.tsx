import { useState, useRef, useEffect } from "react";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Scale,
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  FileText,
  Trash2,
  RotateCcw,
  Info,
  ExternalLink,
} from "lucide-react";
import {
  useLegalChatbot,
  type LegalChatInput,
  type LegalChatOutput,
} from "@/hooks/useContractAI";

// ── Types ─────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  relatedClauses?: string[];
  confidence?: number;
  model_used?: string;
  timestamp: Date;
}

// ── Suggested Questions ───────────────────────────────────

const SUGGESTED_QUESTIONS = [
  "Quais são os prazos legais para rescisão de contrato de locação?",
  "Como funciona a multa por quebra de contrato?",
  "Quais garantias são aceitas pela Lei do Inquilinato?",
  "Quando o locador pode pedir o imóvel de volta?",
  "Como calcular reajuste de aluguel pelo IGP-M?",
  "Quais são os direitos do locatário na renovação?",
];

// ── Component ─────────────────────────────────────────────

interface LegalChatbotProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId?: string;
  contractTitle?: string;
}

export default function LegalChatbot({
  open,
  onOpenChange,
  contractId,
  contractTitle,
}: LegalChatbotProps) {
  const { checkAutoComplete } = useOnboardingProgress();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasUsedChatbot, setHasUsedChatbot] = useState(false);

  const chatMutation = useLegalChatbot();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Actions ──

  async function handleSend(customMessage?: string) {
    const message = customMessage || input.trim();
    if (!message) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const conversationHistory = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const chatInput: LegalChatInput = {
      message,
      contractId: contractId || undefined,
      conversationHistory:
        conversationHistory.length > 0 ? conversationHistory : undefined,
    };

    try {
      const data: LegalChatOutput = await chatMutation.mutateAsync(chatInput);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.response,
        sources: data.sources,
        relatedClauses: data.relatedClauses,
        confidence: data.confidence,
        model_used: data.model_used,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      // Wire onboarding: mark chatbot usage as complete on first message
      if (!hasUsedChatbot) {
        checkAutoComplete("chatbot_used");
        setHasUsedChatbot(true);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          "Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }

  function handleClear() {
    setMessages([]);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Confidence Badge ──

  function ConfidenceBadge({ confidence }: { confidence?: number }) {
    if (!confidence) return null;
    const pct = Math.round(confidence * 100);
    const color =
      pct >= 80
        ? "bg-green-100 text-green-700"
        : pct >= 60
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";

    return (
      <Badge className={`text-[10px] ${color}`} variant="secondary">
        {pct}% confiança
      </Badge>
    );
  }

  // ── Message Bubble ──

  function MessageBubble({ msg }: { msg: ChatMessage }) {
    const isUser = msg.role === "user";

    return (
      <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
        {!isUser && (
          <div className="w-7 h-7 rounded-full bg-[#e2a93b]/10 flex items-center justify-center shrink-0 mt-1">
            <Bot className="h-4 w-4 text-[#e2a93b]" />
          </div>
        )}
        <div
          className={`max-w-[80%] rounded-lg p-3 ${
            isUser
              ? "bg-[#e2a93b] text-white"
              : "bg-muted"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>

          {/* Sources */}
          {msg.sources && msg.sources.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200/30 space-y-1">
              <p className="text-[10px] font-medium opacity-70">Fontes:</p>
              {msg.sources.map((s, idx) => (
                <div key={idx} className="flex items-center gap-1 text-[10px] opacity-70">
                  <ExternalLink className="h-2.5 w-2.5" />
                  {s}
                </div>
              ))}
            </div>
          )}

          {/* Related Clauses */}
          {msg.relatedClauses && msg.relatedClauses.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200/30">
              <p className="text-[10px] font-medium opacity-70 mb-1">
                Cláusulas relacionadas:
              </p>
              <div className="flex flex-wrap gap-1">
                {msg.relatedClauses.map((c, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="text-[10px] bg-white/20"
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {!isUser && (msg.confidence || msg.model_used) && (
            <div className="mt-2 pt-2 border-t border-gray-200/30 flex items-center gap-2">
              <ConfidenceBadge confidence={msg.confidence} />
              {msg.model_used && (
                <span className="text-[10px] opacity-50">{msg.model_used}</span>
              )}
            </div>
          )}
        </div>
        {isUser && (
          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-1">
            <User className="h-4 w-4 text-gray-500" />
          </div>
        )}
      </div>
    );
  }

  // ── Welcome View ──

  function renderWelcome() {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-8">
        <div className="w-16 h-16 rounded-full bg-[#e2a93b]/10 flex items-center justify-center">
          <Scale className="h-8 w-8 text-[#e2a93b]" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Assistente Jurídico IA</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Tire dúvidas sobre contratos, legislação imobiliária, cláusulas e
            obrigações. Respostas baseadas na legislação brasileira.
          </p>
        </div>

        {contractId && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs">
            <FileText className="h-4 w-4 shrink-0" />
            Contexto: {contractTitle || contractId}
          </div>
        )}

        <div className="w-full max-w-md space-y-2 pt-2">
          <p className="text-xs text-muted-foreground font-medium">
            Perguntas sugeridas:
          </p>
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="w-full text-left text-sm p-2.5 rounded-lg border hover:bg-muted transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Main Render ──

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="p-4 pb-2 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-[#e2a93b]" />
              Chatbot Jurídico
              {contractTitle && (
                <Badge variant="outline" className="text-xs font-normal">
                  {contractTitle}
                </Badge>
              )}
            </DialogTitle>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="gap-1 text-xs text-muted-foreground"
              >
                <Trash2 className="h-3 w-3" />
                Limpar
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
          {messages.length === 0 ? (
            renderWelcome()
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
          )}

          {/* Loading indicator */}
          {chatMutation.isPending && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full bg-[#e2a93b]/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-[#e2a93b]" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#e2a93b]" />
                <span className="text-sm text-muted-foreground">Analisando...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 pt-2 border-t shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua pergunta jurídica..."
              disabled={chatMutation.isPending}
              className="flex-1"
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || chatMutation.isPending}
              className="bg-[#e2a93b] hover:bg-[#c99430] px-4"
            >
              {chatMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Este assistente fornece orientações gerais. Para decisões jurídicas importantes,
            consulte um advogado.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
