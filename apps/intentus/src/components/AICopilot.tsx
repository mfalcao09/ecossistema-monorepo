import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, X, Send, Bot, ChevronDown, Loader2, Zap, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Custom event for Copilot → Contracts page communication
export interface CopilotPrefillEvent {
  prefill: Record<string, unknown>;
  parties: Array<{ person_id: string; role: string }>;
}

export const COPILOT_PREFILL_EVENT = "copilot:prefill-contract";
export const COPILOT_DATA_CHANGED_EVENT = "copilot:data-changed";

const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard Principal",
  "/contratos": "Gestão de Contratos",
  "/faturas": "Financeiro / Faturas",
  "/imoveis": "Imóveis",
  "/pessoas": "Pessoas / Clientes",
  "/leads": "CRM de Leads",
  "/atendimento": "HelpDesk / Atendimento",
  "/renovacoes": "Renovações de Contrato",
  "/financeiro/inadimplencia": "Inadimplência",
  "/comercial/dashboard": "Dashboard Comercial",
  "/relacionamento": "Dashboard de Relacionamento",
  "/contratos/analytics": "Analytics CLM",
  "/juridico": "Jurídico",
  "/financeiro": "Financeiro",
  "/juridico/assinaturas": "Assinaturas Digitais",
  "/manutencao": "Manutenção e Vistorias",
  "/lancamentos": "Lançamentos Imobiliários",
  "/parcelamento": "Parcelamento de Solo — Dashboard",
  "/parcelamento/novo": "Novo Estudo de Viabilidade",
};

function getPageLabel(pathname: string): string {
  // Parcelamento dynamic routes
  if (/^\/parcelamento\/[^/]+\/financeiro/.test(pathname)) return "Parcelamento — Análise Financeira";
  if (/^\/parcelamento\/[^/]+\/conformidade/.test(pathname)) return "Parcelamento — Conformidade Legal";
  if (/^\/parcelamento\/[^/]+\/terreno/.test(pathname)) return "Parcelamento — Análise do Terreno";
  if (/^\/parcelamento\/[^/]+\/premissas/.test(pathname)) return "Parcelamento — Premissas Profundas";
  if (/^\/parcelamento\/[^/]+\/cenarios/.test(pathname)) return "Parcelamento — Cenários Financeiros";
  if (/^\/parcelamento\/[^/]+/.test(pathname)) return "Parcelamento — Visão Geral do Projeto";

  for (const [path, label] of Object.entries(PAGE_LABELS)) {
    if (pathname === path || pathname.startsWith(path + "/")) return label;
  }
  return "Plataforma";
}

const SUGGESTIONS: Record<string, string[]> = {
  "/contratos": ["Quero criar um novo contrato", "Quais contratos vencem nos próximos 30 dias?", "Faça um resumo do portfólio de contratos"],
  "/leads": ["Quais leads estão mais quentes?", "Sugira ações para converter leads em visitas", "Como melhorar a taxa de conversão?"],
  "/atendimento": ["Quais tickets estão com SLA estourado?", "Qual a categoria de ticket mais frequente?", "Como priorizar os tickets abertos?"],
  "/financeiro": ["Qual o índice de inadimplência atual?", "Quando vence o próximo repasse?", "Mostre minhas notificações não-lidas"],
  "/parcelamento": [
    "Calcule o ITBI estimado do projeto",
    "Verifique as exigências ambientais (Lei do Verde)",
    "Detecte riscos e red flags do projeto ativo",
  ],
  "/": ["Quero criar um novo contrato", "Quais obrigações vencem essa semana?", "Mostre minhas notificações não-lidas"],
};

function getDefaultSuggestions(pathname: string): string[] {
  for (const [path, suggestions] of Object.entries(SUGGESTIONS)) {
    if (pathname.startsWith(path) && path !== "/") return suggestions;
  }
  return SUGGESTIONS["/"];
}

export function AICopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastPrefillDataRef = useRef<CopilotPrefillEvent | null>(null);

  const pageLabel = getPageLabel(location.pathname);
  const suggestions = getDefaultSuggestions(location.pathname);

  useEffect(() => {
    if (scrollRef.current) {
      // Radix ScrollArea uses an internal viewport element for scrolling
      const viewport = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content || isLoading) return;

    const userMsg: Message = { role: "user", content };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          pageContext: pageLabel,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        if (resp.status === 429) toast.error(err.error || "Limite de requisições atingido");
        else if (resp.status === 402) toast.error(err.error || "Créditos esgotados");
        else toast.error("Erro ao conectar com a IA");
        setIsLoading(false);
        return;
      }

      // Stream SSE
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nlIdx: number;
        while ((nlIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || !line.trim()) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: assistantContent } : m
              ));
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
      // Check for PREFILL_CONTRACT action marker in the final content
      if (assistantContent.includes("<!--COPILOT_ACTION:PREFILL_CONTRACT-->")) {
        // Extract prefill data from the tool call results stored in the conversation
        // The backend returns the prefill data as part of the tool execution result
        // We need to parse it from a JSON block if present, or use the lastPrefillDataRef
        try {
          const jsonMatch = assistantContent.match(/```json\s*\n?([\s\S]*?)\n?```/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.prefill) {
              lastPrefillDataRef.current = {
                prefill: parsed.prefill,
                parties: parsed.parties || [],
              };
            }
          }
        } catch {
          // If no JSON block, the prefill data was already stored by the tool
        }

        // Clean the marker from visible message
        const cleanContent = assistantContent
          .replace(/<!--COPILOT_ACTION:PREFILL_CONTRACT-->/g, "")
          .trim();
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: cleanContent } : m
        ));

        // Navigate to contracts page and emit prefill event
        if (lastPrefillDataRef.current) {
          setTimeout(() => {
            if (location.pathname !== "/contratos") {
              navigate("/contratos");
            }
            // Emit custom event for Contracts page to open the form
            setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent(COPILOT_PREFILL_EVENT, {
                  detail: lastPrefillDataRef.current,
                })
              );
              lastPrefillDataRef.current = null;
            }, 500);
          }, 300);
        }
      }

      // Check for DATA_CHANGED action marker (execute actions like simulate/update)
      if (assistantContent.includes("<!--COPILOT_ACTION:DATA_CHANGED-->")) {
        const cleanContent = assistantContent
          .replace(/<!--COPILOT_ACTION:DATA_CHANGED-->/g, "")
          .trim();
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: cleanContent } : m
        ));
        // Emit event so parcelamento pages can refetch data
        window.dispatchEvent(new CustomEvent(COPILOT_DATA_CHANGED_EVENT));
      }

    } catch (e) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content === "") {
          return prev.slice(0, -1).concat({ role: "assistant", content: "❌ Erro ao conectar com a IA. Tente novamente." });
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg hover:bg-primary/90 transition-all hover:scale-110 group"
        title="Analista Intentus - IA"
      >
        <Sparkles className="h-6 w-6 text-primary-foreground group-hover:rotate-12 transition-transform" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[380px] max-h-[600px] rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="font-semibold text-xs whitespace-nowrap">Analista Intentus</span>
          <Badge variant="secondary" className="text-[10px] leading-tight px-1.5 py-0 bg-amber-400/30 text-primary-foreground border-0 gap-0.5">
            <Zap className="h-2.5 w-2.5" />
            Agentic
          </Badge>
        </div>
        <button onClick={() => setIsMinimized(p => !p)} className="opacity-70 hover:opacity-100 transition-opacity">
          <ChevronDown className={`h-4 w-4 transition-transform ${isMinimized ? "rotate-180" : ""}`} />
        </button>
        <button onClick={() => setIsOpen(false)} className="opacity-70 hover:opacity-100 transition-opacity">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3" ref={scrollRef as any}>
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm text-foreground max-w-[310px]">
                    Olá! Sou o Analista Intentus com <strong>modo agentic</strong> — posso consultar e agir nos seus dados. Estou na tela de <strong>{pageLabel}</strong>. Como posso ajudar?
                  </div>
                </div>
                <div className="ml-9 space-y-1.5">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="block w-full text-left text-xs text-muted-foreground bg-muted/50 hover:bg-muted rounded-lg px-2.5 py-1.5 transition-colors border border-border/50 hover:border-primary/30"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className={`rounded-2xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm max-w-[270px]"
                        : "bg-muted text-foreground rounded-tl-sm max-w-[310px]"
                    }`}>
                    {msg.role === "assistant" && msg.content === "" && isLoading ? (
                        <div className="flex items-center gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-muted-foreground text-xs">Consultando dados...</span>
                        </div>
                      ) : msg.role === "assistant" && msg.content.startsWith("❌") ? (
                        <div className="space-y-2">
                          <p className="text-destructive text-xs">{msg.content.replace("❌ ", "")}</p>
                          <button
                            className="text-xs text-primary underline underline-offset-2"
                            onClick={() => {
                              const lastUser = [...messages].reverse().find(m => m.role === "user");
                              if (lastUser) {
                                setMessages(prev => prev.slice(0, -1));
                                sendMessage(lastUser.content);
                              }
                            }}
                          >
                            Tentar novamente
                          </button>
                        </div>
                      ) : msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex items-end gap-2 border-t border-border px-3 py-2 shrink-0">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre seus dados..."
              className="min-h-0 h-9 max-h-24 resize-none rounded-xl text-sm border-muted"
              rows={1}
              disabled={isLoading}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
