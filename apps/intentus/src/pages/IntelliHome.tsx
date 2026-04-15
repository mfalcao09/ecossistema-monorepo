/**
 * IntelliHome — F4: IntelliHome Concierge Multimodal
 *
 * Tabs: dashboard | chat | memory | tickets
 * Squad: Claudinho + Buchecha | 2026-03-21
 */
import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquare, Brain, Search, RefreshCw, Send, Bot,
  User, AlertTriangle, CheckCircle, Clock, Plus, Eye,
  Home, FileText, DollarSign, Ticket, ArrowUpRight,
  Star, ThumbsUp, ThumbsDown, Shield, Zap, Hash,
  ChevronRight, Phone, Mail, Globe, Smartphone,
} from "lucide-react";
import {
  useConversations,
  usePersonMemory,
  useContractLookup,
  usePaymentLookup,
  useSendMessage,
  useCreateTicket,
  useSearchKB,
  useSaveMemory,
  useEscalateConversation,
  useConciergeMetrics,
  getStatusColor,
  getStatusBgColor,
  getStatusLabel,
  getStatusEmoji,
  getSentimentColor,
  getSentimentEmoji,
  getIntentLabel,
  getIntentEmoji,
  getChannelLabel,
  getChannelEmoji,
  getMemoryTypeLabel,
  getMemoryTypeEmoji,
  getActionTypeIcon,
  type ConciergeConversation,
  type ConciergeMessage,
  type ConciergeMemory,
  type ChatResponse,
  type SuggestedAction,
  type ContractInfo,
  type PaymentInfo,
  type PaymentSummary,
  type KBResult,
} from "@/hooks/useConciergeAI";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { toast } from "sonner";

// ── People Selector Query ─────────────────────────────────────
function usePeople() {
  return useQuery({
    queryKey: ["concierge-people"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!profile) return [];
      const { data } = await supabase
        .from("people")
        .select("id, name, email, phone, type")
        .eq("tenant_id", profile.tenant_id)
        .in("type", ["tenant", "buyer", "owner", "lead"])
        .order("name")
        .limit(200);
      return data || [];
    },
    staleTime: 120_000,
  });
}

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({ title, value, subtitle, icon: Icon, color = "#3b82f6" }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="p-3 rounded-full" style={{ backgroundColor: `${color}15` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Chat Bubble ──────────────────────────────────────────────
function ChatBubble({ msg }: { msg: ConciergeMessage }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
        isSystem
          ? "bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs italic"
          : isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900"
      }`}>
        <div className="flex items-center gap-1.5 mb-1">
          {isUser ? <User className="h-3 w-3" /> : isSystem ? <Shield className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
          <span className="text-xs opacity-70">
            {isUser ? "Morador" : isSystem ? "Sistema" : "Concierge IA"}
          </span>
          {msg.intent && !isUser && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
              {getIntentEmoji(msg.intent)} {getIntentLabel(msg.intent)}
            </Badge>
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
        <p className={`text-[10px] mt-1 ${isUser ? "text-blue-200" : "text-gray-400"}`}>
          {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

// ── Suggested Action Button ──────────────────────────────────
function ActionButton({ action, onClick }: { action: SuggestedAction; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs gap-1"
      onClick={onClick}
    >
      {getActionTypeIcon(action.action_type)} {action.action_label}
    </Button>
  );
}

// ── Contract Quick Card ──────────────────────────────────────
function ContractCard({ contract }: { contract: ContractInfo }) {
  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-sm">{contract.property_name}</span>
          <Badge variant="outline" className="text-[10px]">{contract.status}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
          <span>Tipo: {contract.contract_type}</span>
          <span>Valor: R$ {contract.monthly_value?.toLocaleString("pt-BR")}</span>
          <span>Início: {new Date(contract.start_date).toLocaleDateString("pt-BR")}</span>
          <span>Fim: {new Date(contract.end_date).toLocaleDateString("pt-BR")}</span>
          <span>Vencimento: Dia {contract.payment_due_day}</span>
          <span>Reajuste: {contract.readjustment_index}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Payment Summary Card ─────────────────────────────────────
function PaymentSummaryCard({ summary }: { summary: PaymentSummary }) {
  return (
    <Card className="border-l-4 border-l-green-500">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-4 w-4 text-green-600" />
          <span className="font-semibold text-sm">Resumo Financeiro</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-green-600">{summary.paid}</p>
            <p className="text-[10px] text-muted-foreground">Pagos</p>
            <p className="text-xs font-medium">R$ {summary.total_paid?.toLocaleString("pt-BR")}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-yellow-600">{summary.pending}</p>
            <p className="text-[10px] text-muted-foreground">Pendentes</p>
            <p className="text-xs font-medium">R$ {summary.total_pending?.toLocaleString("pt-BR")}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">{summary.overdue}</p>
            <p className="text-[10px] text-muted-foreground">Atrasados</p>
            <p className="text-xs font-medium">R$ {summary.total_overdue?.toLocaleString("pt-BR")}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Memory Item ──────────────────────────────────────────────
function MemoryItem({ memory }: { memory: ConciergeMemory }) {
  return (
    <div className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span>{getMemoryTypeEmoji(memory.memory_type)}</span>
          <Badge variant="outline" className="text-[10px]">{getMemoryTypeLabel(memory.memory_type)}</Badge>
        </div>
        {memory.relevance_score != null && (
          <span className="text-[10px] text-muted-foreground">
            Relevância: {Math.round(memory.relevance_score * 100)}%
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-gray-700">{memory.memory_key}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{memory.memory_value}</p>
      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
        <span>Acessos: {memory.access_count || 0}</span>
        <span>Criado: {new Date(memory.created_at).toLocaleDateString("pt-BR")}</span>
      </div>
    </div>
  );
}

// ── Conversation List Item ───────────────────────────────────
function ConversationItem({ convo, selected, onClick }: {
  convo: ConciergeConversation;
  selected: boolean;
  onClick: () => void;
}) {
  const lastMsg = convo.messages?.[convo.messages.length - 1];
  return (
    <div
      className={`p-3 rounded-lg cursor-pointer transition-colors border ${
        selected ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50 border-transparent"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span>{getChannelEmoji(convo.channel)}</span>
          <span className="text-sm font-medium truncate max-w-[140px]">
            {convo.person_name || "Desconhecido"}
          </span>
        </div>
        <Badge className={`text-[10px] ${getStatusBgColor(convo.status)}`}>
          {getStatusEmoji(convo.status)} {getStatusLabel(convo.status)}
        </Badge>
      </div>
      {lastMsg && (
        <p className="text-xs text-muted-foreground truncate">
          {lastMsg.role === "user" ? "Morador: " : "IA: "}{lastMsg.content}
        </p>
      )}
      <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
        <span>{convo.message_count} msgs</span>
        <span>{new Date(convo.last_message_at).toLocaleDateString("pt-BR")}</span>
        {convo.satisfaction_rating && (
          <span className="flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5 text-yellow-500" /> {convo.satisfaction_rating}
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Main Page Component ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
export default function IntelliHome() {
  const [tab, setTab] = useState("dashboard");
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [selectedConvoId, setSelectedConvoId] = useState<string>("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ConciergeMessage[]>([]);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kbQuery, setKbQuery] = useState("");
  const [kbResults, setKbResults] = useState<KBResult[]>([]);
  const [showNewMemoryDialog, setShowNewMemoryDialog] = useState(false);
  const [newMemory, setNewMemory] = useState({ key: "", value: "", type: "context" });
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Data Hooks ──────────────────────────────────────────────
  const metrics = useConciergeMetrics();
  const people = usePeople();
  const conversations = useConversations(
    selectedPersonId || undefined,
    statusFilter === "all" ? undefined : statusFilter
  );
  const personMemory = usePersonMemory(selectedPersonId || undefined);
  const contractLookup = useContractLookup(selectedPersonId || undefined);
  const paymentLookup = usePaymentLookup(selectedPersonId || undefined);

  // ── Mutations ───────────────────────────────────────────────
  const sendMsg = useSendMessage();
  const createTicket = useCreateTicket();
  const searchKB = useSearchKB();
  const saveMemory = useSaveMemory();
  const escalate = useEscalateConversation();

  // ── Scroll to bottom on new messages ────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Load conversation messages when selected ────────────────
  useEffect(() => {
    if (selectedConvoId && conversations.data) {
      const convoList = (conversations.data as any)?.conversations || conversations.data;
      const found = (Array.isArray(convoList) ? convoList : []).find(
        (c: ConciergeConversation) => c.id === selectedConvoId
      );
      if (found?.messages) setChatMessages(found.messages);
    }
  }, [selectedConvoId, conversations.data]);

  // ── Handlers ────────────────────────────────────────────────
  function handleSendMessage() {
    if (!chatInput.trim() || !selectedPersonId) return;
    const userMsg: ConciergeMessage = {
      role: "user",
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    const input = chatInput.trim();
    setChatInput("");

    sendMsg.mutate(
      {
        person_id: selectedPersonId,
        message: input,
        conversation_id: selectedConvoId || undefined,
        channel: "portal",
      },
      {
        onSuccess: (data) => {
          const resp = data as ChatResponse;
          setLastResponse(resp);
          if (resp.conversation_id && !selectedConvoId) {
            setSelectedConvoId(resp.conversation_id);
          }
          const aiMsg: ConciergeMessage = {
            role: "assistant",
            content: resp.response_message,
            timestamp: new Date().toISOString(),
            intent: resp.detected_intent,
          };
          setChatMessages(prev => [...prev, aiMsg]);
          if (resp.should_escalate) {
            toast.warning(`Escalação sugerida: ${resp.escalation_reason || "Complexidade detectada"}`);
          }
        },
        onError: (err) => {
          toast.error("Erro ao enviar mensagem: " + (err as Error).message);
          setChatMessages(prev => prev.slice(0, -1));
        },
      }
    );
  }

  function handleCreateTicket() {
    if (!selectedPersonId) return;
    createTicket.mutate(
      {
        person_id: selectedPersonId,
        conversation_id: selectedConvoId || undefined,
        user_message: chatMessages.filter(m => m.role === "user").pop()?.content,
      },
      {
        onSuccess: (data) => {
          const resp = data as any;
          toast.success(`Chamado criado: ${resp?.ticket?.title || "OK"}`);
        },
        onError: (err) => toast.error("Erro ao criar chamado: " + (err as Error).message),
      }
    );
  }

  function handleEscalate() {
    if (!selectedConvoId) return;
    escalate.mutate(
      { conversation_id: selectedConvoId, reason: "Escalação manual pelo operador" },
      {
        onSuccess: () => toast.success("Conversa escalada para atendimento humano"),
        onError: (err) => toast.error("Erro na escalação: " + (err as Error).message),
      }
    );
  }

  function handleSearchKB() {
    if (!kbQuery.trim()) return;
    searchKB.mutate(
      { query: kbQuery.trim(), limit: 5 },
      {
        onSuccess: (data) => {
          const resp = data as any;
          setKbResults(resp?.results || []);
          if (!resp?.results?.length) toast.info("Nenhum resultado encontrado na Base de Conhecimento");
        },
        onError: (err) => toast.error("Erro na busca: " + (err as Error).message),
      }
    );
  }

  function handleSaveMemory() {
    if (!selectedPersonId || !newMemory.key || !newMemory.value) return;
    saveMemory.mutate(
      {
        person_id: selectedPersonId,
        memory_key: newMemory.key,
        memory_type: newMemory.type,
        memory_value: newMemory.value,
      },
      {
        onSuccess: () => {
          toast.success("Memória salva com sucesso");
          setShowNewMemoryDialog(false);
          setNewMemory({ key: "", value: "", type: "context" });
        },
        onError: (err) => toast.error("Erro ao salvar memória: " + (err as Error).message),
      }
    );
  }

  function handleNewConversation() {
    setSelectedConvoId("");
    setChatMessages([]);
    setLastResponse(null);
  }

  // ── Derived Data ────────────────────────────────────────────
  const m = metrics.data;
  const convoList: ConciergeConversation[] = (() => {
    const raw = conversations.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if ((raw as any)?.conversations) return (raw as any).conversations;
    return [];
  })();
  const memories: ConciergeMemory[] = (() => {
    const raw = personMemory.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if ((raw as any)?.memories) return (raw as any).memories;
    return [];
  })();
  const contracts: ContractInfo[] = (() => {
    const raw = contractLookup.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if ((raw as any)?.contracts) return (raw as any).contracts;
    return [];
  })();
  const paymentData = paymentLookup.data as any;
  const paymentSummary: PaymentSummary | null = paymentData?.summary || null;

  // ── Chart Data ──────────────────────────────────────────────
  const COLORS = ["#22c55e", "#eab308", "#ef4444", "#3b82f6", "#9ca3af"];
  const statusChartData = m ? [
    { name: "Ativas", value: m.activeConversations, color: "#22c55e" },
    { name: "Escaladas", value: m.escalated, color: "#ef4444" },
    { name: "Resolvidas", value: m.resolved, color: "#3b82f6" },
    { name: "Outras", value: Math.max(0, m.totalConversations - m.activeConversations - m.escalated - m.resolved), color: "#9ca3af" },
  ].filter(d => d.value > 0) : [];

  // ═══════════════════════════════════════════════════════════
  // ── RENDER ────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl text-white">
            <Home className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">IntelliHome Concierge</h1>
            <p className="text-sm text-muted-foreground">
              Concierge IA multimodal para moradores — atendimento, chamados, contratos e memória persistente
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { metrics.refetch(); conversations.refetch(); }}
          disabled={metrics.isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${metrics.isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="gap-1">
            <Zap className="h-3.5 w-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1">
            <MessageSquare className="h-3.5 w-3.5" /> Chat
          </TabsTrigger>
          <TabsTrigger value="memory" className="gap-1">
            <Brain className="h-3.5 w-3.5" /> Memória
          </TabsTrigger>
          <TabsTrigger value="kb" className="gap-1">
            <Search className="h-3.5 w-3.5" /> Base de Conhecimento
          </TabsTrigger>
        </TabsList>

        {/* ═══════ TAB: DASHBOARD ═══════ */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total Conversas" value={m?.totalConversations || 0} subtitle={`${m?.totalMessages || 0} mensagens`} icon={MessageSquare} color="#3b82f6" />
            <KpiCard title="Ativas Agora" value={m?.activeConversations || 0} subtitle="Conversas em andamento" icon={Zap} color="#22c55e" />
            <KpiCard title="Escaladas" value={m?.escalated || 0} subtitle="Aguardando humano" icon={AlertTriangle} color="#ef4444" />
            <KpiCard title="Satisfação Média" value={m?.avgSatisfaction ? `${m.avgSatisfaction}/5` : "—"} subtitle={`${m?.resolutionRate || 0}% resolução`} icon={Star} color="#eab308" />
          </div>

          {/* Charts + Recent Conversations */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Status Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Status das Conversas</CardTitle>
              </CardHeader>
              <CardContent>
                {statusChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                        {statusChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                    Nenhuma conversa registrada
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Metrics Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Métricas do Concierge</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Memórias Salvas</span>
                  <span className="text-lg font-bold text-purple-600">{m?.totalMemories || 0}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Taxa de Resolução</span>
                  <span className="text-lg font-bold text-green-600">{m?.resolutionRate || 0}%</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Resolvidas</span>
                  <span className="text-lg font-bold text-blue-600">{m?.resolved || 0}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Mensagens</span>
                  <span className="text-lg font-bold">{m?.totalMessages || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Recent Conversations */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Conversas Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[240px]">
                  {convoList.length > 0 ? (
                    <div className="space-y-2">
                      {convoList.slice(0, 8).map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => {
                          setSelectedPersonId(c.person_id);
                          setSelectedConvoId(c.id);
                          setTab("chat");
                        }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span>{getChannelEmoji(c.channel)}</span>
                            <span className="text-sm font-medium truncate">{c.person_name || "—"}</span>
                          </div>
                          <Badge className={`text-[10px] shrink-0 ${getStatusBgColor(c.status)}`}>
                            {getStatusLabel(c.status)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Nenhuma conversa ainda
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════ TAB: CHAT ═══════ */}
        <TabsContent value="chat" className="space-y-4">
          {/* Person Selector + Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={selectedPersonId} onValueChange={(v) => { setSelectedPersonId(v); setSelectedConvoId(""); setChatMessages([]); setLastResponse(null); }}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Selecionar pessoa..." />
              </SelectTrigger>
              <SelectContent>
                {(people.data || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.email ? `(${p.email})` : ""} — {p.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="waiting_human">Aguardando Humano</SelectItem>
                <SelectItem value="escalated">Escaladas</SelectItem>
                <SelectItem value="resolved">Resolvidas</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={handleNewConversation} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Nova Conversa
            </Button>
          </div>

          {/* Chat Layout: Conversations List + Chat Area + Context Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4" style={{ minHeight: 520 }}>
            {/* Conversations Sidebar */}
            <div className="lg:col-span-3">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Conversas ({convoList.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <ScrollArea className="h-[440px]">
                    <div className="space-y-1">
                      {convoList.map(c => (
                        <ConversationItem
                          key={c.id}
                          convo={c}
                          selected={c.id === selectedConvoId}
                          onClick={() => setSelectedConvoId(c.id)}
                        />
                      ))}
                      {convoList.length === 0 && (
                        <p className="text-xs text-center text-muted-foreground py-8">
                          {selectedPersonId ? "Nenhuma conversa encontrada" : "Selecione uma pessoa"}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Chat Area */}
            <div className="lg:col-span-5">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bot className="h-4 w-4 text-purple-600" /> Chat do Concierge
                    </CardTitle>
                    {lastResponse && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {getSentimentEmoji(lastResponse.sentiment)} {lastResponse.sentiment}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {Math.round(lastResponse.confidence * 100)}% conf.
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {lastResponse.response_time_ms}ms
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardHeader>

                {/* Messages */}
                <CardContent className="flex-1 overflow-hidden p-3">
                  <ScrollArea className="h-[360px]">
                    {chatMessages.length > 0 ? (
                      <div className="space-y-1">
                        {chatMessages.map((msg, i) => (
                          <ChatBubble key={i} msg={msg} />
                        ))}
                        <div ref={chatEndRef} />
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                        <Bot className="h-10 w-10 mb-2 text-purple-300" />
                        <p className="text-sm">
                          {selectedPersonId ? "Inicie uma conversa com o morador" : "Selecione uma pessoa para começar"}
                        </p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>

                {/* Suggested Actions */}
                {lastResponse?.suggested_actions && lastResponse.suggested_actions.length > 0 && (
                  <div className="px-3 pb-2 flex flex-wrap gap-1">
                    {lastResponse.suggested_actions.map((action, i) => (
                      <ActionButton key={i} action={action} onClick={() => {
                        if (action.action_type === "create_ticket") handleCreateTicket();
                        else if (action.action_type === "escalate_human") handleEscalate();
                        else toast.info(`Ação: ${action.action_label}`);
                      }} />
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="p-3 border-t shrink-0">
                  <div className="flex gap-2">
                    <Input
                      placeholder={selectedPersonId ? "Digite a mensagem do morador..." : "Selecione uma pessoa primeiro"}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      disabled={!selectedPersonId || sendMsg.isPending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!selectedPersonId || !chatInput.trim() || sendMsg.isPending}
                      size="sm"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-1 mt-2">
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleCreateTicket} disabled={!selectedPersonId || createTicket.isPending}>
                      <Ticket className="h-3 w-3 mr-1" /> Criar Chamado
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleEscalate} disabled={!selectedConvoId || escalate.isPending}>
                      <ArrowUpRight className="h-3 w-3 mr-1" /> Escalar
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Context Panel */}
            <div className="lg:col-span-4 space-y-3">
              {/* Contract */}
              {contracts.length > 0 && contracts.map((c, i) => <ContractCard key={i} contract={c} />)}

              {/* Payment Summary */}
              {paymentSummary && <PaymentSummaryCard summary={paymentSummary} />}

              {/* Person Memory Preview */}
              {memories.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-600" /> Memórias ({memories.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[140px]">
                      <div className="space-y-2">
                        {memories.slice(0, 5).map(mem => (
                          <div key={mem.id} className="text-xs p-2 bg-purple-50 rounded">
                            <span className="font-medium">{getMemoryTypeEmoji(mem.memory_type)} {mem.memory_key}:</span>{" "}
                            <span className="text-muted-foreground">{mem.memory_value}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* No person selected */}
              {!selectedPersonId && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center text-muted-foreground">
                      <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Selecione uma pessoa para ver o contexto</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ═══════ TAB: MEMORY ═══════ */}
        <TabsContent value="memory" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedPersonId} onValueChange={(v) => setSelectedPersonId(v)}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Selecionar pessoa..." />
              </SelectTrigger>
              <SelectContent>
                {(people.data || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.email ? `(${p.email})` : ""} — {p.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowNewMemoryDialog(true)} disabled={!selectedPersonId}>
              <Plus className="h-3.5 w-3.5" /> Nova Memória
            </Button>
            <Button variant="ghost" size="sm" onClick={() => personMemory.refetch()} disabled={!selectedPersonId}>
              <RefreshCw className={`h-3.5 w-3.5 ${personMemory.isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {memories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {memories.map(mem => <MemoryItem key={mem.id} memory={mem} />)}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground py-8">
                  <Brain className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">{selectedPersonId ? "Nenhuma memória encontrada para esta pessoa" : "Selecione uma pessoa para ver suas memórias"}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════ TAB: KB ═══════ */}
        <TabsContent value="kb" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Buscar na Base de Conhecimento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Pesquisar artigos, FAQs, procedimentos..."
                  value={kbQuery}
                  onChange={(e) => setKbQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearchKB(); }}
                />
                <Button onClick={handleSearchKB} disabled={!kbQuery.trim() || searchKB.isPending} size="sm">
                  <Search className="h-4 w-4 mr-1" /> Buscar
                </Button>
              </div>
            </CardContent>
          </Card>

          {kbResults.length > 0 && (
            <div className="space-y-3">
              {kbResults.map(r => (
                <Card key={r.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-sm">{r.title}</span>
                      {r.category && <Badge variant="outline" className="text-[10px]">{r.category}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{r.content?.substring(0, 300)}{r.content?.length > 300 ? "..." : ""}</p>
                    {r.tags && r.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.tags.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════ New Memory Dialog ═══════ */}
      <Dialog open={showNewMemoryDialog} onOpenChange={setShowNewMemoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Memória</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Chave</label>
              <Input
                placeholder="ex: preferencia_contato, nota_imovel..."
                value={newMemory.key}
                onChange={(e) => setNewMemory(p => ({ ...p, key: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <Select value={newMemory.type} onValueChange={(v) => setNewMemory(p => ({ ...p, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preference">Preferência</SelectItem>
                  <SelectItem value="issue_history">Histórico de Problemas</SelectItem>
                  <SelectItem value="context">Contexto</SelectItem>
                  <SelectItem value="sentiment">Sentimento</SelectItem>
                  <SelectItem value="interaction_style">Estilo de Interação</SelectItem>
                  <SelectItem value="property_note">Nota do Imóvel</SelectItem>
                  <SelectItem value="personal_note">Nota Pessoal</SelectItem>
                  <SelectItem value="ai_insight">Insight IA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Valor</label>
              <Textarea
                placeholder="Conteúdo da memória..."
                value={newMemory.value}
                onChange={(e) => setNewMemory(p => ({ ...p, value: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewMemoryDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveMemory} disabled={!newMemory.key || !newMemory.value || saveMemory.isPending}>
              Salvar Memória
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
