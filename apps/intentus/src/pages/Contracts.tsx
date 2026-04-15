import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthTenantId } from "@/lib/tenantUtils";
import {
  useContracts,
  useCreateContract,
  useUpdateContract,
  useDeleteContract,
  type ContractWithRelations,
} from "@/hooks/useContracts";
import { useCreateProperty } from "@/hooks/useProperties";
import { useCreatePerson } from "@/hooks/usePeople";
import { ContractFormDialog } from "@/components/contracts/ContractFormDialog";
import { ContractDetailDialog } from "@/components/contracts/ContractDetailDialog";
import { CLMSettingsDialog } from "@/components/contracts/CLMSettingsDialog";
import {
  contractTypeLabels,
  contractStatusLabels,
  contractStatusColors,
  contractTypeColors,
  partyRoleLabels,
  type ContractFormValues,
} from "@/lib/contractSchema";
import { useAuth } from "@/hooks/useAuth";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import { useOnboardingProgress, useShowEmptyState } from "@/hooks/useOnboardingProgress";
import { createNotification } from "@/hooks/useNotifications";
import { ContractsEmptyState } from "@/components/contracts/CLMEmptyStates";
import { ColumnSelector, type ColumnDef } from "@/components/contracts/ColumnSelector";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NewContractChoiceDialog } from "@/components/contracts/NewContractChoiceDialog";
import { ImportMethodChoiceDialog } from "@/components/contracts/ImportMethodChoiceDialog";
import { AIContractImportDialog, type AIPrefillData, type AIExtractedPerson, type AIInspectionData } from "@/components/contracts/AIContractImportDialog";
import type { AIExtractedObligation } from "@/components/contracts/ObligationPreviewPanel";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Pencil, Trash2, Eye, Settings2, Sparkles } from "lucide-react";
import { ContractDraftDialog } from "@/components/contracts/ContractDraftDialog";
import CLMOnboardingChecklist from "@/components/contracts/CLMOnboardingChecklist";
import CLMOnboardingTour from "@/components/contracts/CLMOnboardingTour";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { useBulkSelection } from "@/hooks/useBulkContractOps";
import { BulkActionsToolbar } from "@/components/contracts/BulkActionsToolbar";
import { COPILOT_PREFILL_EVENT, type CopilotPrefillEvent } from "@/components/AICopilot";

const formatCurrency = (value: number | null) => {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const formatDate = (date: string | null) => {
  if (!date) return "—";
  return new Date(date + "T00:00:00").toLocaleDateString("pt-BR");
};

const formatPercent = (value: number | null | undefined) => {
  if (value == null || value === 0) return "—";
  return `${value}%`;
};

// Sanitiza objetos antes de enviar ao banco: converte "" para undefined (evita erro de tipo date/numeric)
function sanitizeForDb(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === "" ? undefined : v])
  );
}

const DEFAULT_COLUMNS = ["property", "type", "status", "parties", "period", "value"];

const COLUMN_CATALOG: ColumnDef<ContractWithRelations>[] = [
  {
    key: "property",
    label: "Imóvel",
    defaultVisible: true,
    render: (c) => <span className="font-medium">{c.properties?.title ?? "—"}</span>,
  },
  {
    key: "type",
    label: "Tipo",
    defaultVisible: true,
    render: (c) => (
      <Badge variant="secondary" className={contractTypeColors[c.contract_type] ?? ""}>
        {contractTypeLabels[c.contract_type]}
      </Badge>
    ),
  },
  {
    key: "status",
    label: "Status",
    defaultVisible: true,
    render: (c) => (
      <Badge variant="secondary" className={contractStatusColors[c.status] ?? ""}>
        {contractStatusLabels[c.status]}
      </Badge>
    ),
  },
  {
    key: "parties",
    label: "Partes",
    defaultVisible: true,
    render: (c) =>
      c.contract_parties && c.contract_parties.length > 0 ? (
        <div className="space-y-0.5">
          {c.contract_parties.slice(0, 2).map((p) => (
            <div key={p.id} className="truncate max-w-[200px] text-sm text-muted-foreground">
              <span className="text-xs text-muted-foreground/70">{partyRoleLabels[p.role] ?? p.role}:</span>{" "}
              {p.people?.name ?? "—"}
            </div>
          ))}
          {c.contract_parties.length > 2 && (
            <span className="text-xs text-muted-foreground">+{c.contract_parties.length - 2} mais</span>
          )}
        </div>
      ) : (
        "—"
      ),
  },
  {
    key: "period",
    label: "Vigência",
    defaultVisible: true,
    render: (c) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(c.start_date)} — {formatDate(c.end_date)}
      </span>
    ),
  },
  {
    key: "value",
    label: "Valor",
    defaultVisible: true,
    render: (c) => (
      <span className="text-sm">
        {c.contract_type === "locacao"
          ? formatCurrency(c.monthly_value) + "/mês"
          : formatCurrency(c.total_value)}
      </span>
    ),
  },
  {
    key: "commission_pct",
    label: "Comissão (%)",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{formatPercent(c.commission_percentage)}</span>,
  },
  {
    key: "commission_val",
    label: "Comissão (R$)",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{formatCurrency(c.commission_value)}</span>,
  },
  {
    key: "admin_fee",
    label: "Taxa Adm (%)",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{formatPercent(c.admin_fee_percentage)}</span>,
  },
  {
    key: "adjustment_index",
    label: "Índice Reajuste",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{c.adjustment_index || "—"}</span>,
  },
  {
    key: "guarantee_type",
    label: "Garantia",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{c.guarantee_type || "—"}</span>,
  },
  {
    key: "guarantee_value",
    label: "Valor Garantia",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{formatCurrency(c.guarantee_value)}</span>,
  },
   {
    key: "notes",
    label: "Observações",
    defaultVisible: false,
    render: (c) => (
      <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
        {c.notes ? (c.notes.length > 60 ? c.notes.slice(0, 60) + "…" : c.notes) : "—"}
      </span>
    ),
  },
  {
    key: "signed_at",
    label: "Assinatura",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{formatDate((c as any).signed_at)}</span>,
  },
  {
    key: "signing_platform",
    label: "Plataforma",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{(c as any).signing_platform || "—"}</span>,
  },
  {
    key: "down_payment",
    label: "Sinal/Arras",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{formatCurrency((c as any).down_payment)}</span>,
  },
  {
    key: "remaining_balance",
    label: "Saldo",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{formatCurrency((c as any).remaining_balance)}</span>,
  },
  {
    key: "payment_method",
    label: "Forma Pgto",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{(c as any).payment_method || "—"}</span>,
  },
  {
    key: "has_intermediation",
    label: "Intermediação",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{(c as any).has_intermediation ? "Sim" : "Não"}</span>,
  },
  {
    key: "deed_deadline_days",
    label: "Prazo Escritura",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{(c as any).deed_deadline_days != null ? `${(c as any).deed_deadline_days} dias` : "—"}</span>,
  },
  {
    key: "late_interest_rate",
    label: "Juros Mora",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{formatPercent((c as any).late_interest_rate)}</span>,
  },
  {
    key: "late_penalty_rate",
    label: "Multa Atraso",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{formatPercent((c as any).late_penalty_rate)}</span>,
  },
  {
    key: "termination_penalty_rate",
    label: "Multa Rescisão",
    defaultVisible: false,
    render: (c) => <span className="text-sm">{formatPercent((c as any).termination_penalty_rate)}</span>,
  },
  {
    key: "actions",
    label: "Ações",
    defaultVisible: true,
    fixed: true,
    render: () => null, // rendered separately
  },
];

export default function Contracts() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [editContract, setEditContract] = useState<ContractWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractWithRelations | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [importMethodOpen, setImportMethodOpen] = useState(false);
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [aiPrefill, setAiPrefill] = useState<AIPrefillData | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const navigate = useNavigate();
  const { isAdminOrGerente, isSuperAdmin } = useAuth();
  const { canCreateContract, canDeleteContract, canManageSettings, canUseDraftAI } = usePermissions();

  // Onboarding
  const {
    showChecklist,
    tourSeen,
    isComplete: onboardingComplete,
    markTourSeen,
    checkAutoComplete,
  } = useOnboardingProgress();

  // Empty state detection
  const { showEmptyState: showContractsEmpty } = useShowEmptyState("contracts");

  // Auto-abrir tour na primeira visita (tourSeen=false)
  React.useEffect(() => {
    if (!tourSeen && !onboardingComplete) {
      setTourOpen(true);
    }
  }, [tourSeen, onboardingComplete]);

  // Listen for Copilot prefill events (conversational contract creation)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CopilotPrefillEvent>).detail;
      if (detail?.prefill) {
        // Build AIPrefillData from Copilot event
        const prefillData: AIPrefillData = {
          ...(detail.prefill as any),
        };
        setAiPrefill(prefillData);
        setEditContract(null);
        setFormOpen(true);
      }
    };
    window.addEventListener(COPILOT_PREFILL_EVENT, handler);
    return () => window.removeEventListener(COPILOT_PREFILL_EVENT, handler);
  }, []);

  const { data: contracts, isLoading } = useContracts({
    search,
    status: statusFilter,
    contract_type: typeFilter,
  });

  // Handler para os botões "Fazer agora" do checklist e tour
  const handleOnboardingAction = useCallback((action: string) => {
    switch (action) {
      case "create_contract":
        setChoiceOpen(true);
        break;
      case "open_templates":
        navigate("/contratos/minutario");
        break;
      case "import_contract":
        setImportMethodOpen(true);
        break;
      case "create_manual":
        setFormOpen(true);
        break;
      case "ai_insights":
      case "open_reports":
        navigate("/contratos/analytics");
        break;
      case "open_approvals":
        navigate("/contratos/configuracoes");
        break;
      case "open_chatbot":
        // Chatbot é acessado dentro do detalhe do contrato — abrir primeiro contrato se existir
        if (contracts && contracts.length > 0) {
          setDetailId(contracts[0].id);
        }
        break;
      case "open_dashboard":
        navigate("/contratos/command-center");
        break;
      default:
        break;
    }
  }, [navigate, contracts]);

  const { visibleColumns, savePreferences } = useTablePreferences("contracts", DEFAULT_COLUMNS);

  // Bulk selection
  const bulk = useBulkSelection(contracts);

  const createContract = useCreateContract();
  const updateContract = useUpdateContract();
  const deleteContract = useDeleteContract();
  const createProperty = useCreateProperty();
  const createPerson = useCreatePerson();

  const activeColumns = useMemo(
    () => COLUMN_CATALOG.filter((col) => col.fixed || visibleColumns.includes(col.key)),
    [visibleColumns]
  );

  const handleCreate = async (
    values: ContractFormValues,
    parties: any[],
    propertiesData?: Array<Partial<any>>,
    peopleData?: AIExtractedPerson[],
    inspectionData?: AIInspectionData | null,
    obligationsData?: AIExtractedObligation[],
  ) => {
    try {
      let finalValues = { ...values };
      let finalParties = [...parties];

      const tenant_id = await getAuthTenantId();

      // --- Cascade: create properties if AI data provided ---
      if (propertiesData && propertiesData.length > 0) {
        for (let i = 0; i < propertiesData.length; i++) {
          const propItem = propertiesData[i];
          if (!propItem.title) continue;
          const propResult = await createProperty.mutateAsync({
            ...sanitizeForDb(propItem),
            title: propItem.title,
            property_type: propItem.property_type || "casa",
            purpose: "venda",
            status: "disponivel",
            tenant_id,
          } as any);
          // First property becomes the contract's main property
          if (i === 0) {
            finalValues.property_id = propResult.id;
          }
        }
      }

      // --- Helper: find existing person by CPF/CNPJ or create new ---
      const upsertPerson = async (payload: Record<string, any>): Promise<{ id: string }> => {
        const cpf = payload.cpf_cnpj?.trim();
        if (cpf) {
          const { data: existing } = await supabase
            .from("people")
            .select("id")
            .eq("cpf_cnpj", cpf)
            .maybeSingle();
          if (existing) return existing;
        }
        return await createPerson.mutateAsync(payload as any);
      };

      // --- Cascade: create people if AI data provided ---
      if (peopleData && peopleData.length > 0) {
        const createdPeople: { person_id: string; role: string }[] = [];
        for (const person of peopleData) {
          if (!person.name) continue;
          const {
            contractRole, legal_representative_name, legal_representative_cpf,
            marital_status, marriage_regime, profession, nationality, natural_from, rg_issuer,
            bank_name, bank_agency, bank_account, bank_account_type, pix_key,
            inscricao_estadual, inscricao_municipal, cnae,
            ...personFields
          } = person;

          let legalRepId: string | undefined;
          // If PJ with legal representative, upsert the PF representative first
          if (person.entity_type === "pj" && legal_representative_name) {
            const repResult = await upsertPerson({
              name: legal_representative_name,
              cpf_cnpj: legal_representative_cpf || "",
              person_type: "cliente",
              entity_type: "pf",
            });
            legalRepId = repResult.id;
          }

          const personResult = await upsertPerson({
            ...sanitizeForDb(personFields),
            name: person.name,
            person_type: contractRole === "comprador" ? "comprador" : contractRole === "proprietario" ? "proprietario" : "cliente",
            entity_type: person.entity_type || "pf",
            ...(legalRepId ? { legal_representative_id: legalRepId } : {}),
            ...(marital_status ? { marital_status } : {}),
            ...(marriage_regime ? { marriage_regime } : {}),
            ...(profession ? { profession } : {}),
            ...(nationality ? { nationality } : {}),
            ...(natural_from ? { natural_from } : {}),
            ...(rg_issuer ? { rg_issuer } : {}),
            ...(bank_name ? { bank_name } : {}),
            ...(bank_agency ? { bank_agency } : {}),
            ...(bank_account ? { bank_account } : {}),
            ...(bank_account_type ? { bank_account_type } : {}),
            ...(pix_key ? { pix_key } : {}),
            ...(inscricao_estadual ? { inscricao_estadual } : {}),
            ...(inscricao_municipal ? { inscricao_municipal } : {}),
            ...(cnae ? { cnae } : {}),
          });
          createdPeople.push({ person_id: personResult.id, role: contractRole });
        }
        // Merge AI-created people with manually selected parties (if any)
        finalParties = [
          ...finalParties.filter((p) => !!p.person_id),
          ...createdPeople,
        ];
      }

      createContract.mutate(
        { contract: finalValues as any, parties: finalParties },
        {
          onSuccess: async (newContract: any) => {
            setFormOpen(false);
            // Wire onboarding: mark contract creation as complete
            checkAutoComplete("contract_created");
            // Fire-and-forget notification
            supabase.auth.getUser().then(({ data: { user } }) => {
              if (user) {
                createNotification({
                  userId: user.id,
                  title: "Contrato criado",
                  message: "Novo contrato foi registrado no sistema",
                  category: "contrato",
                  referenceType: "contract",
                  referenceId: newContract?.id,
                });
              }
            });
            // If AI provided inspection data, upgrade the auto-created "agendada" inspection
            // (created by the DB trigger on_contract_activated) to "realizada" with full details.
            if (inspectionData && inspectionData.items.length > 0 && newContract?.id) {
              try {
                const { data: { user } } = await supabase.auth.getUser();
                const inspectorNotes = [
                  inspectionData.inspector_name ? `Vistoriador: ${inspectionData.inspector_name}` : null,
                  inspectionData.notes || null,
                ].filter(Boolean).join(" — ") || "Vistoria de entrada importada do contrato via IA.";

                // Look for the auto-created "agendada" inspection from the DB trigger
                const { data: existing } = await supabase
                  .from("inspections")
                  .select("id")
                  .eq("contract_id", newContract.id)
                  .eq("inspection_type", "entrada")
                  .maybeSingle();

                let inspectionId: string | null = null;

                if (existing?.id) {
                  // Update existing inspection to "realizada"
                  await supabase.from("inspections").update({
                    status: "realizada" as any,
                    completed_date: inspectionData.conducted_date || null,
                    scheduled_date: inspectionData.conducted_date || null,
                    inspector_notes: inspectorNotes,
                  }).eq("id", existing.id);
                  inspectionId = existing.id;
                } else {
                  // No inspection yet (e.g. contract not activated) — create one
                  const { data: insp } = await supabase.from("inspections").insert({
                    property_id: finalValues.property_id,
                    contract_id: newContract.id,
                    inspection_type: "entrada",
                    status: "realizada" as any,
                    scheduled_date: inspectionData.conducted_date || null,
                    completed_date: inspectionData.conducted_date || null,
                    inspector_notes: inspectorNotes,
                    assigned_to: user?.id || null,
                    created_by: user?.id || null,
                    tenant_id,
                  }).select("id").single();
                  inspectionId = insp?.id ?? null;
                }

                if (inspectionId) {
                  await supabase.from("inspection_items").insert(
                    inspectionData.items.map((item) => ({
                      inspection_id: inspectionId,
                      item_name: `${item.room_name ? item.room_name + " — " : ""}${item.item_name}`,
                      condition: item.condition,
                      notes: item.notes || null,
                      tenant_id,
                    }))
                  );
                }
              } catch (inspErr) {
                console.error("Error updating inspection from AI data:", inspErr);
              }
            }

            // --- Cascade: create obligations if AI extracted them ---
            if (obligationsData && obligationsData.length > 0 && newContract?.id) {
              try {
                const oblRows = obligationsData
                  .filter((o) => o.selected !== false && o.title && o.due_date)
                  .map((o) => ({
                    contract_id: newContract.id,
                    title: o.title,
                    description: o.description ? `${o.description}${o.source_clause ? ` (Ref: ${o.source_clause})` : ""}` : (o.source_clause || null),
                    obligation_type: o.obligation_type || "operacional",
                    responsible_party: o.responsible_party || "administradora",
                    due_date: o.due_date!,
                    recurrence: o.recurrence || null,
                    alert_days_before: o.alert_days_before ?? 30,
                    tenant_id,
                  }));
                if (oblRows.length > 0) {
                  const { error: oblErr } = await supabase
                    .from("contract_obligations")
                    .insert(oblRows);
                  if (oblErr) {
                    console.error("Error creating AI obligations:", oblErr);
                  } else {
                    console.log(`Created ${oblRows.length} obligations from AI extraction`);
                  }
                }
              } catch (oblCascadeErr) {
                console.error("Error in obligation cascade:", oblCascadeErr);
              }
            }
          }
        }
      );
    } catch (err: any) {
      console.error("Cascade creation error:", err);
    }
  };

  const handleUpdate = (values: ContractFormValues, parties: any[]) => {
    if (!editContract) return;
    updateContract.mutate(
      { id: editContract.id, contract: values as any, parties },
      {
        onSuccess: () => {
          setEditContract(null);
          setFormOpen(false);
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteContract.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const openEdit = (contract: ContractWithRelations) => {
    setEditContract(contract);
    setFormOpen(true);
  };

  const openCreate = () => {
    setChoiceOpen(true);
  };

  const handleChooseExisting = () => {
    setImportMethodOpen(true);
  };

  const handleChooseManual = () => {
    setEditContract(null);
    setAiPrefill(null);
    setFormOpen(true);
  };

  const handleChooseAI = () => {
    setAiImportOpen(true);
  };

  const handleAIResult = (data: AIPrefillData) => {
    setAiPrefill(data);
    setEditContract(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie contratos de venda, locação e administração
          </p>
        </div>
        <div className="flex gap-2">
          {canManageSettings && (
            <Button variant="outline" onClick={() => setCustomizeOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Configurações CLM
            </Button>
          )}
          {canUseDraftAI && (
            <Button variant="outline" onClick={() => setDraftOpen(true)} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Gerar com IA
            </Button>
          )}
          {canCreateContract && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Contrato
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por imóvel ou pessoa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(contractTypeLabels).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {Object.entries(contractStatusLabels).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ColumnSelector
          columns={COLUMN_CATALOG}
          visibleColumns={visibleColumns}
          onColumnsChange={savePreferences}
          defaultColumns={DEFAULT_COLUMNS}
        />
      </div>

      {/* Onboarding Checklist */}
      {showChecklist && (
        <CLMOnboardingChecklist onAction={handleOnboardingAction} />
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px] px-2">
                <Checkbox
                  checked={bulk.isAllSelected ? true : bulk.isPartiallySelected ? "indeterminate" : false}
                  onCheckedChange={() => bulk.toggleAll()}
                  aria-label="Selecionar todos os contratos"
                />
              </TableHead>
              {activeColumns.map((col) => (
                <TableHead key={col.key} className={col.key === "actions" ? "w-[120px]" : ""}>
                  {col.key === "actions" ? "Ações" : col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-2"><Skeleton className="h-4 w-4" /></TableCell>
                  {activeColumns.map((col) => (
                    <TableCell key={col.key}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : contracts && contracts.length > 0 ? (
              contracts.map((contract) => (
                <TableRow key={contract.id} data-state={bulk.selectedIds.has(contract.id) ? "selected" : undefined}>
                  <TableCell className="px-2">
                    <Checkbox
                      checked={bulk.selectedIds.has(contract.id)}
                      onCheckedChange={() => bulk.toggle(contract.id)}
                      aria-label={`Selecionar contrato ${contract.properties?.title ?? contract.id}`}
                    />
                  </TableCell>
                  {activeColumns.map((col) =>
                    col.key === "actions" ? (
                      <TableCell key="actions">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailId(contract.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(contract)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {(isSuperAdmin || canDeleteContract) && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(contract)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    ) : (
                      <TableCell key={col.key}>{col.render(contract)}</TableCell>
                    )
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={activeColumns.length + 1} className="p-0">
                  {search || statusFilter !== "todos" || typeFilter !== "todos" ? (
                    <div className="h-32 flex items-center justify-center text-muted-foreground">
                      Nenhum contrato encontrado com os filtros selecionados.
                    </div>
                  ) : (
                    <ContractsEmptyState onAction={handleOnboardingAction} />
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedContracts={bulk.selectedContracts}
        selectedIds={bulk.selectedIds}
        onClearSelection={bulk.clearSelection}
      />

      {/* Form dialog */}
      <ContractFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditContract(null);
            setAiPrefill(null);
          }
        }}
        contract={editContract}
        onSubmit={editContract ? handleUpdate : handleCreate}
        isPending={createContract.isPending || updateContract.isPending}
        prefillData={aiPrefill}
      />

      {/* Detail dialog */}
      <ContractDetailDialog
        contractId={detailId}
        open={!!detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
      />

      {/* Choice dialog */}
      <NewContractChoiceDialog
        open={choiceOpen}
        onOpenChange={setChoiceOpen}
        onChooseExisting={handleChooseExisting}
      />

      {/* Import method choice */}
      <ImportMethodChoiceDialog
        open={importMethodOpen}
        onOpenChange={setImportMethodOpen}
        onChooseAI={handleChooseAI}
        onChooseManual={handleChooseManual}
      />

      {/* AI import dialog */}
      <AIContractImportDialog
        open={aiImportOpen}
        onOpenChange={setAiImportOpen}
        onResult={handleAIResult}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Excluir contrato permanentemente</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Tem certeza que deseja excluir este contrato?</p>
                <p className="mt-2 text-destructive font-semibold">Esta ação é irreversível. Todas as parcelas, partes e dados vinculados serão removidos permanentemente.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customization dialog */}
      <CLMSettingsDialog open={customizeOpen} onOpenChange={setCustomizeOpen} />
      <ContractDraftDialog open={draftOpen} onOpenChange={setDraftOpen} />

      {/* Onboarding Tour */}
      <CLMOnboardingTour
        open={tourOpen}
        onClose={() => {
          setTourOpen(false);
          markTourSeen();
        }}
        onAction={handleOnboardingAction}
      />
    </div>
  );
}
