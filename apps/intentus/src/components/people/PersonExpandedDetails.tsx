import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { FileText, Ticket } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PersonTimeline } from "./PersonTimeline";

const contractStatusLabels: Record<string, string> = {
  rascunho: "Rascunho", ativo: "Ativo", encerrado: "Encerrado", cancelado: "Cancelado", renovado: "Renovado",
};
const contractStatusBadge: Record<string, string> = {
  ativo: "bg-emerald-100 text-emerald-800", rascunho: "bg-muted text-muted-foreground",
  encerrado: "bg-zinc-100 text-zinc-600", cancelado: "bg-red-100 text-red-800", renovado: "bg-blue-100 text-blue-800",
};
const contractTypeLabels: Record<string, string> = { venda: "Venda", locacao: "Locação", administracao: "Administração" };

const ticketStatusLabels: Record<string, string> = {
  aberto: "Aberto", em_atendimento: "Em Atendimento", aguardando_cliente: "Aguardando",
  resolvido: "Resolvido", cancelado: "Cancelado",
};
const ticketStatusBadge: Record<string, string> = {
  aberto: "bg-blue-100 text-blue-800", em_atendimento: "bg-amber-100 text-amber-800",
  aguardando_cliente: "bg-purple-100 text-purple-800", resolvido: "bg-emerald-100 text-emerald-800",
  cancelado: "bg-red-100 text-red-800",
};

function usePersonContracts(personId: string) {
  return useQuery({
    queryKey: ["person-contracts", personId],
    queryFn: async () => {
      const { data: parties, error: partiesError } = await supabase
        .from("contract_parties").select("contract_id, role").eq("person_id", personId);
      if (partiesError) throw partiesError;
      if (!parties || parties.length === 0) return [];
      const contractIds = parties.map((p) => p.contract_id);
      const { data: contracts, error } = await supabase
        .from("contracts").select("id, contract_type, status, start_date, end_date, monthly_value, total_value")
        .in("id", contractIds).in("status", ["ativo", "rascunho"]);
      if (error) throw error;
      const roleMap = Object.fromEntries(parties.map((p) => [p.contract_id, p.role]));
      return (contracts ?? []).map((c) => ({ ...c, party_role: roleMap[c.id] }));
    },
  });
}

function usePersonSupportTickets(personId: string) {
  return useQuery({
    queryKey: ["person-support-tickets", personId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, subject, status, category, priority, created_at")
        .eq("person_id", personId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
}

interface PersonExpandedDetailsProps {
  personId: string;
}

export function PersonExpandedDetails({ personId }: PersonExpandedDetailsProps) {
  const { data: contracts, isLoading: loadingContracts } = usePersonContracts(personId);
  const { data: tickets, isLoading: loadingTickets } = usePersonSupportTickets(personId);

  return (
    <div className="p-4">
      <Tabs defaultValue="resumo" className="space-y-3">
        <TabsList className="h-8">
          <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contratos */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4 text-primary" /> Contratos
              </div>
              {loadingContracts ? (
                <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : contracts && contracts.length > 0 ? (
                <div className="space-y-2">
                  {contracts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={contractStatusBadge[c.status] ?? ""}>
                          {contractStatusLabels[c.status] ?? c.status}
                        </Badge>
                        <span className="text-muted-foreground">{contractTypeLabels[c.contract_type] ?? c.contract_type}</span>
                      </div>
                      <span className="font-medium tabular-nums">
                        {c.monthly_value
                          ? `R$ ${Number(c.monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês`
                          : c.total_value
                          ? `R$ ${Number(c.total_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum contrato ativo.</p>
              )}
            </div>

            {/* Tickets */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Ticket className="h-4 w-4 text-primary" /> Tickets de Suporte
              </div>
              {loadingTickets ? (
                <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
              ) : tickets && tickets.length > 0 ? (
                <div className="space-y-2">
                  {tickets.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{t.subject}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <Badge variant="secondary" className={ticketStatusBadge[t.status] ?? ""}>
                        {ticketStatusLabels[t.status] ?? t.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum ticket encontrado.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <PersonTimeline personId={personId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
