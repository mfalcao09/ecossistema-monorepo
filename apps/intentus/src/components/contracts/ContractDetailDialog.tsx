import { useContract } from "@/hooks/useContracts";
import { ContractInstallments } from "./ContractInstallments";
import {
  contractTypeLabels,
  contractStatusLabels,
  contractStatusColors,
  contractTypeColors,
  partyRoleLabels,
} from "@/lib/contractSchema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, CalendarDays, DollarSign, FileText, CheckSquare, MessageSquare, ClipboardList, History, GitBranch, Activity, Pen, BarChart3 } from "lucide-react";
import { lazy, Suspense, Component, type ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

const ContractDocumentsTab = lazy(() => import("./tabs/ContractDocumentsTab").then((m) => ({ default: m.ContractDocumentsTab })));
const ContractApprovalsTab = lazy(() => import("./tabs/ContractApprovalsTab").then((m) => ({ default: m.ContractApprovalsTab })));
const ContractObligationsTab = lazy(() => import("./tabs/ContractObligationsTab").then((m) => ({ default: m.ContractObligationsTab })));
const ContractNegotiationTab = lazy(() => import("./tabs/ContractNegotiationTab").then((m) => ({ default: m.ContractNegotiationTab })));
const ContractAuditTab = lazy(() => import("./tabs/ContractAuditTab").then((m) => ({ default: m.ContractAuditTab })));
const ContractRedliningTab = lazy(() => import("./tabs/ContractRedliningTab").then((m) => ({ default: m.ContractRedliningTab })));
const ContractLifecycleTab = lazy(() => import("./tabs/ContractLifecycleTab").then((m) => ({ default: m.ContractLifecycleTab })));
const ContractSignaturesTab = lazy(() => import("./tabs/ContractSignaturesTab").then((m) => ({ default: m.ContractSignaturesTab })));
const ContractPricingTab = lazy(() => import("./tabs/ContractPricingTab").then((m) => ({ default: m.ContractPricingTab })));

// ── Helpers extraídos para fora do componente (evita recriação a cada render) ──

function formatCurrency(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date + "T00:00:00").toLocaleDateString("pt-BR");
}

function TabFallback() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

// ── ErrorBoundary para proteger tabs lazy-loaded de crashes ──

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class TabErrorBoundary extends Component<
  { children: ReactNode; tabName: string },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; tabName: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center space-y-2">
          <p className="text-sm text-destructive font-medium">
            Erro ao carregar aba "{this.props.tabName}"
          </p>
          <p className="text-xs text-muted-foreground">
            {this.state.error?.message || "Erro inesperado"}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Lookup seguro de classes CSS (previne CSS injection) ──

function safeStatusColor(status: string): string {
  return contractStatusColors[status] ?? "";
}

function safeTypeColor(type: string): string {
  return contractTypeColors[type] ?? "";
}

// ── Componente principal ──

interface ContractDetailDialogProps {
  contractId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContractDetailDialog({ contractId, open, onOpenChange }: ContractDetailDialogProps) {
  const { data: contract, isLoading, error } = useContract(contractId ?? undefined);
  const { canUsePricingAI } = usePermissions();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Detalhes do Contrato</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : error ? (
          <div className="p-6 text-center space-y-2">
            <p className="text-sm text-destructive font-medium">Erro ao carregar contrato</p>
            <p className="text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "Erro inesperado ao buscar dados do contrato."}
            </p>
          </div>
        ) : contract ? (
          <Tabs defaultValue="resumo" className="w-full">
            <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1 overflow-x-auto">
              <TabsTrigger value="resumo" className="text-xs gap-1"><DollarSign className="h-3 w-3" /> Resumo</TabsTrigger>
              <TabsTrigger value="lifecycle" className="text-xs gap-1"><Activity className="h-3 w-3" /> Ciclo de Vida</TabsTrigger>
              <TabsTrigger value="assinaturas" className="text-xs gap-1"><Pen className="h-3 w-3" /> Assinaturas</TabsTrigger>
              <TabsTrigger value="documentos" className="text-xs gap-1"><FileText className="h-3 w-3" /> Documentos</TabsTrigger>
              <TabsTrigger value="aprovacoes" className="text-xs gap-1"><CheckSquare className="h-3 w-3" /> Aprovações</TabsTrigger>
              <TabsTrigger value="negociacao" className="text-xs gap-1"><MessageSquare className="h-3 w-3" /> Negociação</TabsTrigger>
              <TabsTrigger value="obrigacoes" className="text-xs gap-1"><ClipboardList className="h-3 w-3" /> Obrigações</TabsTrigger>
              <TabsTrigger value="auditoria" className="text-xs gap-1"><History className="h-3 w-3" /> Auditoria</TabsTrigger>
              <TabsTrigger value="redlining" className="text-xs gap-1"><GitBranch className="h-3 w-3" /> Redlining</TabsTrigger>
              {canUsePricingAI && <TabsTrigger value="precificacao" className="text-xs gap-1"><BarChart3 className="h-3 w-3" /> Precificação IA</TabsTrigger>}
            </TabsList>

            {/* Resumo Tab - existing content */}
            <TabsContent value="resumo">
              <div className="space-y-6 pt-2">
                <div className="flex flex-wrap gap-3 items-center">
                  <Badge variant="secondary" className={safeTypeColor(contract.contract_type)}>
                    {contractTypeLabels[contract.contract_type]}
                  </Badge>
                  <Badge variant="secondary" className={safeStatusColor(contract.status)}>
                    {contractStatusLabels[contract.status]}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Building2 className="h-4 w-4 text-primary" /> Imóvel
                    </div>
                    <p className="text-sm">{contract.properties?.title ?? "—"}</p>
                  </div>

                  <div className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CalendarDays className="h-4 w-4 text-primary" /> Vigência
                    </div>
                    <p className="text-sm">{formatDate(contract.start_date)} — {formatDate(contract.end_date)}</p>
                  </div>

                  <div className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <DollarSign className="h-4 w-4 text-primary" /> Valores
                    </div>
                    <div className="text-sm space-y-1">
                      {contract.total_value != null && <p>Total: <strong>{formatCurrency(contract.total_value)}</strong></p>}
                      {contract.monthly_value != null && <p>Mensal: <strong>{formatCurrency(contract.monthly_value)}</strong></p>}
                      {contract.commission_percentage != null && <p>Comissão: {contract.commission_percentage}% ({formatCurrency(contract.commission_value)})</p>}
                      {contract.adjustment_index && <p>Reajuste: {contract.adjustment_index}</p>}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Users className="h-4 w-4 text-primary" /> Partes
                    </div>
                    <div className="text-sm space-y-1">
                      {contract.contract_parties && contract.contract_parties.length > 0 ? (
                        contract.contract_parties.map((p) => (
                          <p key={p.id}>
                            <Badge variant="outline" className="mr-2 text-xs">{partyRoleLabels[p.role] ?? p.role}</Badge>
                            {p.people?.name ?? "—"}
                          </p>
                        ))
                      ) : (
                        <p className="text-muted-foreground">Nenhuma parte vinculada</p>
                      )}
                    </div>
                  </div>
                </div>

                {contract.notes && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-semibold mb-1">Observações</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contract.notes}</p>
                    </div>
                  </>
                )}

                <Separator />
                <ContractInstallments
                  contractId={contract.id}
                  totalValue={contract.total_value}
                  monthlyValue={contract.monthly_value}
                  startDate={contract.start_date}
                  contractType={contract.contract_type}
                />
              </div>
            </TabsContent>

            {/* Ciclo de Vida Tab */}
            <TabsContent value="lifecycle">
              <TabErrorBoundary tabName="Ciclo de Vida">
                <Suspense fallback={<TabFallback />}>
                  <ContractLifecycleTab contractId={contract.id} />
                </Suspense>
              </TabErrorBoundary>
            </TabsContent>

            {/* Assinaturas Tab */}
            <TabsContent value="assinaturas">
              <TabErrorBoundary tabName="Assinaturas">
                <Suspense fallback={<TabFallback />}>
                  <ContractSignaturesTab contractId={contract.id} />
                </Suspense>
              </TabErrorBoundary>
            </TabsContent>

            {/* Documentos Tab */}
            <TabsContent value="documentos">
              <TabErrorBoundary tabName="Documentos">
                <Suspense fallback={<TabFallback />}>
                  <ContractDocumentsTab contractId={contract.id} />
                </Suspense>
              </TabErrorBoundary>
            </TabsContent>

            {/* Aprovações Tab */}
            <TabsContent value="aprovacoes">
              <TabErrorBoundary tabName="Aprovações">
                <Suspense fallback={<TabFallback />}>
                  <ContractApprovalsTab contractId={contract.id} />
                </Suspense>
              </TabErrorBoundary>
            </TabsContent>

            {/* Negociação Tab */}
            <TabsContent value="negociacao">
              <TabErrorBoundary tabName="Negociação">
                <Suspense fallback={<TabFallback />}>
                  <ContractNegotiationTab contractId={contract.id} />
                </Suspense>
              </TabErrorBoundary>
            </TabsContent>

            {/* Obrigações Tab */}
            <TabsContent value="obrigacoes">
              <TabErrorBoundary tabName="Obrigações">
                <Suspense fallback={<TabFallback />}>
                  <ContractObligationsTab contractId={contract.id} />
                </Suspense>
              </TabErrorBoundary>
            </TabsContent>

            {/* Auditoria Tab */}
            <TabsContent value="auditoria">
              <TabErrorBoundary tabName="Auditoria">
                <Suspense fallback={<TabFallback />}>
                  <ContractAuditTab contractId={contract.id} />
                </Suspense>
              </TabErrorBoundary>
            </TabsContent>

            {/* Redlining Tab */}
            <TabsContent value="redlining">
              <TabErrorBoundary tabName="Redlining">
                <Suspense fallback={<TabFallback />}>
                  <ContractRedliningTab contractId={contract.id} contractType={contract.contract_type} />
                </Suspense>
              </TabErrorBoundary>
            </TabsContent>

            {/* Precificação IA Tab */}
            <TabsContent value="precificacao">
              <TabErrorBoundary tabName="Precificação IA">
                <Suspense fallback={<TabFallback />}>
                  <ContractPricingTab
                    contractId={contract.id}
                    propertyId={contract.property_id}
                    neighborhood={contract.properties?.neighborhood}
                    city={contract.properties?.city}
                    currentValue={contract.monthly_value}
                    adjustmentIndex={contract.adjustment_index}
                    contractType={contract.contract_type}
                  />
                </Suspense>
              </TabErrorBoundary>
            </TabsContent>
          </Tabs>
        ) : (
          <p className="text-muted-foreground">Contrato não encontrado.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
