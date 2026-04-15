"use client";

import { useState } from "react";
import { Bot, X, Send, Sparkles } from "lucide-react";

interface Message {
  role: "assistant" | "user";
  content: string;
}

interface AIAssistantProps {
  context?: string;
  placeholder?: string;
  suggestions?: string[];
  onAction?: (action: string, data: Record<string, unknown>) => void;
}

export default function AIAssistant({
  context = "geral",
  placeholder = "Pergunte algo sobre o processo...",
  suggestions = [],
  onAction,
}: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: getWelcomeMessage(context),
    },
  ]);

  function getWelcomeMessage(ctx: string): string {
    const msgs: Record<string, string> = {
      instituicoes:
        "Olá! Sou o assistente de configuração da IES. Posso te ajudar a preencher os dados da instituição. Quer que eu busque informações pelo CNPJ?",
      cursos:
        "Olá! Posso te ajudar a configurar os cursos. Quer que eu busque dados do curso pelo código E-MEC?",
      diplomas:
        "Olá! Estou aqui para te ajudar com o processo de emissão do diploma digital. Em que posso ajudar?",
      geral:
        "Olá! Sou o assistente IA do Diploma Digital. Como posso te ajudar?",
    };
    return msgs[ctx] || msgs.geral;
  }

  async function handleSend() {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Simula resposta da IA (será substituído por API real)
    setTimeout(() => {
      const response: Message = {
        role: "assistant",
        content: getContextualResponse(input, context),
      };
      setMessages((prev) => [...prev, response]);
    }, 800);
  }

  function getContextualResponse(query: string, ctx: string): string {
    const q = query.toLowerCase();

    if (ctx === "instituicoes") {
      if (q.includes("cnpj") || q.includes("buscar"))
        return "Para buscar dados automaticamente, digite o CNPJ da instituição no campo acima. Vou preencher nome, endereço e dados cadastrais automaticamente via API da Receita Federal.";
      if (q.includes("credenciamento"))
        return "O credenciamento é o ato do MEC que autoriza o funcionamento da IES. Você encontra o número no portal e-MEC (emec.mec.gov.br). Posso te ajudar a localizar.";
      if (q.includes("registradora"))
        return "A IES Registradora é a universidade que registra o diploma da FIC. Se a FIC não tem autonomia para registro próprio, precisa de uma universidade registradora. Normalmente é definida por convênio.";
    }

    if (q.includes("ajuda") || q.includes("como"))
      return "Posso te ajudar com preenchimento automático de dados, explicações sobre campos obrigatórios, e dúvidas sobre o processo de diploma digital. O que precisa?";

    return "Entendi sua dúvida. Para o contexto de diploma digital, recomendo verificar a Portaria MEC 554/2019. Posso te explicar algum ponto específico?";
  }

  function handleSuggestion(suggestion: string) {
    setInput(suggestion);
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-primary-500 hover:bg-primary-600 text-white p-4 rounded-full shadow-lg transition-all z-50 group"
      >
        {isOpen ? (
          <X size={24} />
        ) : (
          <>
            <Bot size={24} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent-500 rounded-full animate-pulse" />
          </>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 max-h-[500px]">
          {/* Header */}
          <div className="bg-primary-500 text-white px-4 py-3 rounded-t-2xl flex items-center gap-2">
            <Sparkles size={18} />
            <span className="font-semibold text-sm">
              Assistente IA — Diploma Digital
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[320px]">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === "user"
                      ? "bg-primary-500 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && messages.length <= 2 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(s)}
                  className="text-xs bg-primary-50 text-primary-600 px-2 py-1 rounded-full hover:bg-primary-100 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={placeholder}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={handleSend}
              className="bg-primary-500 text-white p-2 rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
