/**
 * useClientDNA — Hook for Client Behavioral Profile (DNA) (F1)
 *
 * Provides:
 * - useClientDNAProfiles(): All profiles for tenant
 * - useClientDNAByPerson(personId): Single person profile (latest version)
 * - useRunDNAQuiz(): Mutation to submit quiz and generate profile
 * - useRunDNAInference(): Mutation to infer profile from interaction data
 * - getDISCColor(), getDISCLabel(), getDISCEmoji(): DISC profile helpers
 * - useDNAMetrics(): Aggregate metrics
 *
 * Squad: Claudinho + Buchecha | 2026-03-21
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────

export interface CommunicationStyle {
  preferred_channel: "whatsapp" | "phone" | "email" | "in_person";
  response_speed: "instant" | "fast" | "moderate" | "slow";
  formality: "formal" | "balanced" | "informal";
  detail_level: "minimal" | "moderate" | "detailed" | "exhaustive";
  score: number;
}

export interface DecisionProfile {
  speed: "impulsive" | "quick" | "deliberate" | "slow";
  influencers?: string[];
  risk_tolerance: "risk_averse" | "conservative" | "moderate" | "adventurous";
  data_driven: boolean;
  score: number;
}

export interface EngagementPattern {
  best_time: "morning" | "afternoon" | "evening" | "flexible";
  frequency_preference: "daily" | "weekly" | "biweekly" | "monthly" | "on_demand";
  proactivity: "proactive" | "reactive" | "passive";
  digital_comfort: number;
  score: number;
}

export interface ValuePriorities {
  top_values: string[];
  deal_breakers: string[];
  loyalty_drivers: string[];
  score: number;
}

export interface PersonalityTraits {
  disc_profile: "D" | "I" | "S" | "C";
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface RiskFactor {
  factor: string;
  severity: "low" | "medium" | "high";
  mitigation: string;
}

export interface OpportunityArea {
  area: string;
  potential: "low" | "medium" | "high";
  action: string;
}

export interface QuizResponse {
  question_id: string;
  answer: string;
}

export interface ClientDNAProfile {
  id: string;
  tenant_id: string;
  person_id: string;
  communication_style: CommunicationStyle;
  decision_profile: DecisionProfile;
  engagement_pattern: EngagementPattern;
  value_priorities: ValuePriorities;
  personality_traits: PersonalityTraits;
  overall_dna_score: number;
  adaptability_index: number;
  satisfaction_predictor: number;
  ai_summary: string | null;
  ai_approach_guide: string | null;
  ai_risk_factors: RiskFactor[];
  ai_opportunity_areas: OpportunityArea[];
  quiz_responses: QuizResponse[];
  quiz_completed_at: string | null;
  quiz_version: string;
  source: "quiz" | "ai_inferred" | "interaction_analysis" | "manual" | "hybrid";
  confidence_score: number;
  version: number;
  previous_profile_id: string | null;
  evolution_notes: string | null;
  created_at: string;
  updated_at: string;
  last_analyzed_at: string | null;
  next_review_at: string | null;
  // Joined
  person?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    type: string | null;
  };
}

// ── Quiz Questions (must match Edge Function) ──────────────────

export const QUIZ_QUESTIONS = [
  {
    id: "comm_channel",
    category: "communication_style",
    question: "Como você prefere ser contactado?",
    options: [
      { value: "whatsapp", label: "WhatsApp" },
      { value: "phone", label: "Ligação telefônica" },
      { value: "email", label: "E-mail" },
      { value: "in_person", label: "Presencialmente" },
    ],
  },
  {
    id: "comm_frequency",
    category: "engagement_pattern",
    question: "Com que frequência gostaria de receber atualizações sobre seu imóvel?",
    options: [
      { value: "daily", label: "Diariamente" },
      { value: "weekly", label: "Semanalmente" },
      { value: "biweekly", label: "Quinzenalmente" },
      { value: "monthly", label: "Mensalmente" },
      { value: "only_needed", label: "Apenas quando necessário" },
    ],
  },
  {
    id: "comm_time",
    category: "engagement_pattern",
    question: "Qual o melhor horário para entrarmos em contato?",
    options: [
      { value: "morning", label: "Manhã (8h-12h)" },
      { value: "afternoon", label: "Tarde (12h-18h)" },
      { value: "evening", label: "Noite (18h-21h)" },
      { value: "flexible", label: "Qualquer horário" },
    ],
  },
  {
    id: "decision_style",
    category: "decision_profile",
    question: "Quando precisa tomar uma decisão sobre seu imóvel, como age?",
    options: [
      { value: "quick", label: "Decido rápido, confio no instinto" },
      { value: "research", label: "Pesquiso bastante antes de decidir" },
      { value: "consult", label: "Consulto família/amigos/advogado" },
      { value: "delegate", label: "Prefiro que a administradora decida" },
    ],
  },
  {
    id: "problem_reaction",
    category: "personality_traits",
    question: "Quando surge um problema no imóvel, como você reage?",
    options: [
      { value: "proactive", label: "Resolvo eu mesmo e aviso depois" },
      { value: "contact_immediately", label: "Entro em contato imediatamente" },
      { value: "wait_escalate", label: "Espero um pouco, se não resolver, escalo" },
      { value: "ignore", label: "Só ligo se for muito grave" },
    ],
  },
  {
    id: "value_priority",
    category: "value_priorities",
    question: "O que mais valoriza no relacionamento com a administradora?",
    options: [
      { value: "speed", label: "Rapidez nas respostas" },
      { value: "transparency", label: "Transparência total" },
      { value: "personal_touch", label: "Atendimento personalizado" },
      { value: "tech_innovation", label: "Tecnologia e inovação" },
      { value: "cost_efficiency", label: "Custo-benefício" },
    ],
  },
  {
    id: "deal_breaker",
    category: "value_priorities",
    question: "O que faria você considerar trocar de administradora?",
    options: [
      { value: "slow_response", label: "Demora nas respostas" },
      { value: "hidden_fees", label: "Cobranças surpresa" },
      { value: "poor_maintenance", label: "Manutenção mal feita" },
      { value: "bad_communication", label: "Falta de comunicação" },
      { value: "outdated_tech", label: "Sistema antiquado" },
    ],
  },
  {
    id: "digital_comfort",
    category: "engagement_pattern",
    question: "Como se sente usando plataformas digitais para gerenciar seu imóvel?",
    options: [
      { value: "love_it", label: "Adoro! Uso tudo pelo app" },
      { value: "comfortable", label: "Uso tranquilamente" },
      { value: "some_difficulty", label: "Tenho alguma dificuldade" },
      { value: "prefer_person", label: "Prefiro atendimento pessoal" },
    ],
  },
  {
    id: "feedback_style",
    category: "personality_traits",
    question: "Como costuma dar feedback sobre os serviços?",
    options: [
      { value: "spontaneous", label: "Dou feedback espontaneamente" },
      { value: "when_asked", label: "Apenas quando perguntam" },
      { value: "detailed_written", label: "Prefiro escrever com detalhes" },
      { value: "rarely", label: "Raramente dou feedback" },
    ],
  },
  {
    id: "loyalty_driver",
    category: "value_priorities",
    question: "O que mais te motivaria a indicar a administradora para amigos?",
    options: [
      { value: "excellent_service", label: "Serviço excelente" },
      { value: "good_price", label: "Bom preço" },
      { value: "personal_relationship", label: "Bom relacionamento pessoal" },
      { value: "innovation", label: "Inovação e tecnologia" },
      { value: "trust", label: "Confiança e credibilidade" },
    ],
  },
];

// ── Helpers ─────────────────────────────────────────────────────

export function getDISCColor(disc: string): string {
  switch (disc) {
    case "D": return "#ef4444"; // Red - Dominant
    case "I": return "#f59e0b"; // Yellow - Influential
    case "S": return "#22c55e"; // Green - Steady
    case "C": return "#3b82f6"; // Blue - Conscientious
    default: return "#6b7280";
  }
}

export function getDISCLabel(disc: string): string {
  switch (disc) {
    case "D": return "Dominante";
    case "I": return "Influente";
    case "S": return "Estável";
    case "C": return "Consciente";
    default: return "Indefinido";
  }
}

export function getDISCEmoji(disc: string): string {
  switch (disc) {
    case "D": return "🔴";
    case "I": return "🟡";
    case "S": return "🟢";
    case "C": return "🔵";
    default: return "⚪";
  }
}

export function getDISCDescription(disc: string): string {
  switch (disc) {
    case "D": return "Direto, decidido e orientado a resultados. Prefere comunicação objetiva e rápida.";
    case "I": return "Entusiasmado, otimista e colaborativo. Valoriza relacionamento pessoal e comunicação calorosa.";
    case "S": return "Paciente, confiável e cooperativo. Prefere estabilidade, consistência e mudanças graduais.";
    case "C": return "Analítico, preciso e orientado a qualidade. Valoriza dados, detalhes e processos claros.";
    default: return "Perfil ainda não definido.";
  }
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#3b82f6";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return "Excelente";
  if (score >= 60) return "Bom";
  if (score >= 40) return "Moderado";
  return "Atenção";
}

export function getConfidenceLabel(score: number): string {
  if (score >= 80) return "Alta";
  if (score >= 60) return "Média-Alta";
  if (score >= 40) return "Média";
  return "Baixa";
}

// ── Queries ─────────────────────────────────────────────────────

export function useClientDNAProfiles(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["client-dna-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_behavioral_profiles")
        .select(`
          *,
          person:people!client_behavioral_profiles_person_id_fkey(id, name, email, phone, type)
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Deduplicate: keep latest version per person
      const latestByPerson = new Map<string, any>();
      for (const profile of data || []) {
        const existing = latestByPerson.get(profile.person_id);
        if (!existing || profile.version > existing.version) {
          latestByPerson.set(profile.person_id, profile);
        }
      }

      return Array.from(latestByPerson.values()) as ClientDNAProfile[];
    },
    enabled: options?.enabled !== false,
  });
}

export function useClientDNAByPerson(personId: string | undefined) {
  return useQuery({
    queryKey: ["client-dna-profile", personId],
    queryFn: async () => {
      if (!personId) return null;
      const { data, error } = await supabase
        .from("client_behavioral_profiles")
        .select(`
          *,
          person:people!client_behavioral_profiles_person_id_fkey(id, name, email, phone, type)
        `)
        .eq("person_id", personId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as ClientDNAProfile | null;
    },
    enabled: !!personId,
  });
}

export function useClientDNAHistory(personId: string | undefined) {
  return useQuery({
    queryKey: ["client-dna-history", personId],
    queryFn: async () => {
      if (!personId) return [];
      const { data, error } = await supabase
        .from("client_behavioral_profiles")
        .select("id, version, overall_dna_score, source, confidence_score, created_at")
        .eq("person_id", personId)
        .order("version", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!personId,
  });
}

// ── Mutations ───────────────────────────────────────────────────

export function useRunDNAQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { person_id: string; quiz_responses: QuizResponse[] }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke("relationship-client-dna", {
        body: {
          person_id: params.person_id,
          mode: "quiz",
          quiz_responses: params.quiz_responses,
        },
      });

      if (response.error) throw new Error(response.error.message || "Erro ao processar quiz");
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-dna-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["client-dna-profile", data?.person?.id] });
      toast.success("DNA do cliente gerado com sucesso!", {
        description: `Score geral: ${data?.dna?.overall_dna_score}/100 | DISC: ${data?.dna?.personality_traits?.disc_profile}`,
      });
    },
    onError: (err: Error) => {
      toast.error("Erro ao gerar DNA", { description: err.message });
    },
  });
}

export function useRunDNAInference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { person_id: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke("relationship-client-dna", {
        body: {
          person_id: params.person_id,
          mode: "infer",
        },
      });

      if (response.error) throw new Error(response.error.message || "Erro ao inferir perfil");
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-dna-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["client-dna-profile", data?.person?.id] });
      toast.success("Perfil inferido por IA!", {
        description: `Score: ${data?.dna?.overall_dna_score}/100 (confiança: ${data?.meta?.confidence_score}%)`,
      });
    },
    onError: (err: Error) => {
      toast.error("Erro ao inferir perfil", { description: err.message });
    },
  });
}

export function useRunDNAHybrid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { person_id: string; quiz_responses: QuizResponse[] }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Não autenticado");

      const response = await supabase.functions.invoke("relationship-client-dna", {
        body: {
          person_id: params.person_id,
          mode: "hybrid",
          quiz_responses: params.quiz_responses,
        },
      });

      if (response.error) throw new Error(response.error.message || "Erro no modo híbrido");
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-dna-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["client-dna-profile", data?.person?.id] });
      toast.success("DNA completo gerado (Quiz + Dados)!", {
        description: `Score: ${data?.dna?.overall_dna_score}/100 | Confiança: ${data?.meta?.confidence_score}%`,
      });
    },
    onError: (err: Error) => {
      toast.error("Erro no modo híbrido", { description: err.message });
    },
  });
}

// ── Metrics ─────────────────────────────────────────────────────

export function useDNAMetrics() {
  const { data: profiles } = useClientDNAProfiles();

  if (!profiles || profiles.length === 0) {
    return {
      totalProfiles: 0,
      avgDNAScore: 0,
      avgAdaptability: 0,
      avgSatisfactionPredictor: 0,
      avgConfidence: 0,
      discDistribution: { D: 0, I: 0, S: 0, C: 0 },
      sourceDistribution: {} as Record<string, number>,
      needsReview: 0,
    };
  }

  const totalProfiles = profiles.length;
  const avgDNAScore = Math.round(profiles.reduce((s, p) => s + (p.overall_dna_score || 0), 0) / totalProfiles);
  const avgAdaptability = Math.round(profiles.reduce((s, p) => s + (p.adaptability_index || 0), 0) / totalProfiles);
  const avgSatisfactionPredictor = Math.round(profiles.reduce((s, p) => s + (p.satisfaction_predictor || 0), 0) / totalProfiles);
  const avgConfidence = Math.round(profiles.reduce((s, p) => s + (p.confidence_score || 0), 0) / totalProfiles);

  const discDistribution = { D: 0, I: 0, S: 0, C: 0 };
  for (const p of profiles) {
    const disc = (p.personality_traits as any)?.disc_profile;
    if (disc && disc in discDistribution) {
      discDistribution[disc as keyof typeof discDistribution]++;
    }
  }

  const sourceDistribution: Record<string, number> = {};
  for (const p of profiles) {
    sourceDistribution[p.source] = (sourceDistribution[p.source] || 0) + 1;
  }

  const now = new Date();
  const needsReview = profiles.filter(p => {
    if (!p.next_review_at) return false;
    return new Date(p.next_review_at) <= now;
  }).length;

  return {
    totalProfiles,
    avgDNAScore,
    avgAdaptability,
    avgSatisfactionPredictor,
    avgConfidence,
    discDistribution,
    sourceDistribution,
    needsReview,
  };
}
