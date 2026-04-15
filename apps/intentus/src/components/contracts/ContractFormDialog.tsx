import { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  contractSchema,
  contractTypeLabels,
  contractStatusLabels,
  adjustmentIndexOptions,
  defaultContractValues,
  partyRoleLabels,
  penaltyTypeLabels,
  type ContractFormValues,
} from "@/lib/contractSchema";
import { propertyTypeLabels, brazilianStates as propStates } from "@/lib/propertySchema";
import { entityTypeLabels } from "@/lib/personSchema";
import { usePropertiesForSelect, usePeopleForSelect, type ContractWithRelations } from "@/hooks/useContracts";
import { useFormCustomization } from "@/hooks/useFormCustomization";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Upload, FileText, Sparkles, Home, Users, Info, ClipboardCheck, ListChecks } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { AIPrefillData, AIExtractedPerson, AIInspectionData } from "./AIContractImportDialog";
import type { PropertyFormValues } from "@/lib/propertySchema";
import { ObligationPreviewPanel, type AIExtractedObligation } from "./ObligationPreviewPanel";

// Currency formatting helpers
const formatBRL = (value: number | undefined | null): string => {
  if (value == null || value === 0) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const parseBRL = (text: string): number => {
  if (!text) return 0;
  // Remove dots (thousands sep) and replace comma with dot
  const cleaned = text.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const formSchemaWithParties = contractSchema.extend({
  property_id: z.string().min(1, "Selecione um imóvel"),
  parties: z.array(
    z.object({
      person_id: z.string().min(1, "Selecione uma pessoa"),
      role: z.enum(["locatario", "comprador", "proprietario", "fiador", "administrador", "testemunha", "locador", "vendedor", "intermediador"]),
    })
  ),
});

// Schema variant for AI prefill (property_id is optional since it'll be created)
const formSchemaAIPrefill = contractSchema.extend({
  property_id: z.string().optional().or(z.literal("")),
  parties: z.array(
    z.object({
      person_id: z.string().optional().or(z.literal("")),
      role: z.enum(["locatario", "comprador", "proprietario", "fiador", "administrador", "testemunha", "locador", "vendedor", "intermediador"]),
    })
  ),
});

type FormValues = z.infer<typeof formSchemaWithParties>;

interface ContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: ContractWithRelations | null;
  onSubmit: (values: ContractFormValues, parties: { person_id: string; role: any }[], propertiesData?: Array<Partial<PropertyFormValues>>, peopleData?: AIExtractedPerson[], inspectionData?: AIInspectionData | null, obligationsData?: AIExtractedObligation[]) => void;
  isPending: boolean;
  prefillData?: AIPrefillData | null;
}

export function ContractFormDialog({
  open, onOpenChange, contract, onSubmit, isPending, prefillData,
}: ContractFormDialogProps) {
  const { data: properties } = usePropertiesForSelect();
  const { data: people } = usePeopleForSelect();
  const { config } = useFormCustomization();
  const hidden = config.contract_hidden_fields;
  const [contractFile, setContractFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("contrato");

  // Properties data state for AI import (multi-property)
  const [propsData, setPropsData] = useState<Array<Partial<PropertyFormValues>>>([]);
  // People data state for AI import
  const [pplData, setPplData] = useState<AIExtractedPerson[]>([]);
  // Inspection data state for AI import
  const [inspData, setInspData] = useState<AIInspectionData | null>(null);
  const [confirmInspection, setConfirmInspection] = useState(true);
  // Obligations data state for AI import
  const [oblData, setOblData] = useState<AIExtractedObligation[]>([]);

  const isVisible = (key: string) => !hidden.includes(key);

  const anyGuaranteeVisible = ["guarantee_type", "guarantee_value", "guarantee_policy_number", "guarantee_details"].some(isVisible);

  const isAIPrefill = !!prefillData && !contract;

  const form = useForm<FormValues>({
    resolver: zodResolver(isAIPrefill ? (formSchemaAIPrefill as any) : formSchemaWithParties),
    defaultValues: {
      ...defaultContractValues,
      parties: [{ person_id: "", role: "locatario" as const }],
    },
  });

  const handleInvalidForm = useCallback((errors: any) => {
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      // Scroll to first error field
      const el = document.querySelector(`[name="${firstError}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Preencha os campos obrigatórios antes de salvar.");
    }
  }, []);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "parties",
  });

  useEffect(() => {
    if (contract) {
      form.reset({
        property_id: contract.property_id,
        contract_type: contract.contract_type,
        status: contract.status,
        start_date: contract.start_date ?? "",
        end_date: contract.end_date ?? "",
        total_value: contract.total_value ?? 0,
        monthly_value: contract.monthly_value ?? 0,
        commission_percentage: contract.commission_percentage ?? 0,
        commission_value: contract.commission_value ?? 0,
        admin_fee_percentage: (contract as any).admin_fee_percentage ?? 10,
        adjustment_index: contract.adjustment_index ?? "",
        notes: contract.notes ?? "",
        guarantee_type: (contract as any).guarantee_type ?? "",
        guarantee_value: (contract as any).guarantee_value ?? 0,
        guarantee_details: (contract as any).guarantee_details ?? "",
        guarantee_policy_number: (contract as any).guarantee_policy_number ?? "",
        signed_at: (contract as any).signed_at ?? "",
        parties: contract.contract_parties?.map((p) => ({
          person_id: p.person_id,
          role: p.role,
        })) ?? [{ person_id: "", role: "locatario" as const }],
      });
      setPropsData([]);
      setPplData([]);
    } else if (prefillData) {
      const d = prefillData.contractData;
      form.reset({
        ...defaultContractValues,
        admin_fee_percentage: 10,
        ...d,
        property_id: d.property_id || "",
        contract_type: d.contract_type || "locacao",
        status: d.status || "ativo",
        parties: prefillData.parties.length > 0
          ? prefillData.parties.map((p) => ({ person_id: "", role: (p.role || "locatario") as any }))
          : [{ person_id: "", role: "locatario" as const }],
      });
      setPropsData(prefillData.propertiesData && prefillData.propertiesData.length > 0
        ? prefillData.propertiesData
        : prefillData.propertyData && Object.keys(prefillData.propertyData).length > 0
          ? [prefillData.propertyData]
          : []);
      setPplData(prefillData.peopleData || []);
      setInspData(prefillData.inspectionData || null);
      setConfirmInspection(true);
      setOblData(prefillData.obligationsData || []);
      setActiveTab("contrato");
    } else {
      form.reset({
        ...defaultContractValues,
        admin_fee_percentage: 10,
        parties: [{ person_id: "", role: "locatario" as const }],
      });
      setPropsData([]);
      setPplData([]);
      setInspData(null);
      setOblData([]);
    }
  }, [contract, form, prefillData]);

  const contractType = form.watch("contract_type");
  const isVenda = contractType === "venda";
  const totalValue = form.watch("total_value");

  // Bidirectional commission calculation
  const handleCommissionValueChange = (val: number) => {
    form.setValue("commission_value", val);
    const tv = form.getValues("total_value") || 0;
    if (tv > 0 && val > 0) {
      form.setValue("commission_percentage", Math.round((val / tv) * 10000) / 100);
    }
  };

  const handleCommissionPctChange = (val: number) => {
    form.setValue("commission_percentage", val);
    const tv = form.getValues("total_value") || 0;
    if (tv > 0 && val > 0) {
      form.setValue("commission_value", Math.round(tv * val) / 100);
    }
  };

  const handleSubmit = (values: FormValues) => {
    const { parties, ...contractData } = values;
    const cleaned = Object.fromEntries(
      Object.entries(contractData).map(([k, v]) => {
        // Never null out property_id — keep it as-is (empty string → undefined)
        if (k === "property_id") return [k, v === "" ? undefined : v];
        return [k, v === "" ? null : v];
      })
    ) as unknown as ContractFormValues;
    cleaned.contract_type = contractData.contract_type;
    cleaned.status = contractData.status;

    // For venda contracts, clear vigencia fields
    if (contractData.contract_type === "venda") {
      cleaned.start_date = undefined;
      cleaned.end_date = undefined;
    }

    const validParties = parties
      .filter((p) => !!p.person_id && !!p.role)
      .map((p) => ({ person_id: p.person_id!, role: p.role! }));

    const hasAIData = prefillData && !contract;
    const selectedObligations = oblData.filter((o) => o.selected !== false);
    onSubmit(
      cleaned,
      validParties,
      hasAIData && propsData.length > 0 ? propsData : undefined,
      hasAIData && pplData.length > 0 ? pplData : undefined,
      hasAIData && confirmInspection ? inspData : null,
      hasAIData && selectedObligations.length > 0 ? selectedObligations : undefined,
    );
  };

  // Helper to update a property field in multi-property array
  const updatePropField = (propIndex: number, key: string, value: any) => {
    setPropsData((prev) => prev.map((p, i) => i === propIndex ? { ...p, [key]: value } : p));
  };

  const addProperty = () => {
    setPropsData((prev) => [...prev, { title: "", property_type: "casa" }]);
  };

  const removeProperty = (index: number) => {
    setPropsData((prev) => prev.filter((_, i) => i !== index));
  };

  // Helper to update a person field
  const updatePersonField = (index: number, key: string, value: any) => {
    setPplData((prev) => prev.map((p, i) => i === index ? { ...p, [key]: value } : p));
  };

  const addPerson = () => {
    setPplData((prev) => [...prev, { name: "", contractRole: "comprador" }]);
  };

  const removePerson = (index: number) => {
    setPplData((prev) => prev.filter((_, i) => i !== index));
  };

  const hasAIPrefill = !!prefillData && !contract;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {contract ? "Editar Contrato" : "Novo Contrato"}
          </DialogTitle>
        </DialogHeader>

        {hasAIPrefill ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full`} style={{ gridTemplateColumns: `repeat(${3 + (inspData ? 1 : 0) + (oblData.length > 0 ? 1 : 0)}, minmax(0, 1fr))` }}>
              <TabsTrigger value="contrato"><FileText className="mr-1.5 h-3.5 w-3.5" />Contrato</TabsTrigger>
              <TabsTrigger value="imovel"><Home className="mr-1.5 h-3.5 w-3.5" />Imóveis ({propsData.length})</TabsTrigger>
              <TabsTrigger value="pessoas"><Users className="mr-1.5 h-3.5 w-3.5" />Pessoas ({pplData.length})</TabsTrigger>
              {oblData.length > 0 && (
                <TabsTrigger value="obrigacoes">
                  <ListChecks className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                  Obrigações ({oblData.filter(o => o.selected !== false).length})
                </TabsTrigger>
              )}
              {inspData && (
                <TabsTrigger value="vistoria">
                  <ClipboardCheck className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                  Vistoria ✓
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="contrato">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit, handleInvalidForm)} className="space-y-6">
                  {/* AI prefill banner */}
                  <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Dados pré-preenchidos pela IA</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Revise todas as abas e ajuste se necessário. Ao cadastrar, o imóvel, pessoas e obrigações serão criados automaticamente.
                      </p>
                    </div>
                  </div>

                  {renderContractFields(form, contractType, isVenda, isVisible, anyGuaranteeVisible, properties, people, fields, append, remove, handleCommissionPctChange, handleCommissionValueChange, hasAIPrefill, pplData)}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? "Salvando..." : "Cadastrar"}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="imovel">
              <div className="space-y-4 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 flex-1">
                    <Home className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      {propsData.length > 1
                        ? `${propsData.length} imóveis identificados no contrato. Revise os dados de cada um.`
                        : "Dados do imóvel extraídos do contrato. Se já existir no sistema, selecione-o na aba Contrato e deixe esta aba vazia."}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addProperty}>
                    <Plus className="mr-1 h-3 w-3" /> Imóvel
                  </Button>
                </div>

                {propsData.map((prop, pi) => (
                  <div key={pi} className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Imóvel {pi + 1}</h4>
                      {propsData.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeProperty(pi)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Título *</label>
                        <Input value={prop.title || ""} onChange={(e) => updatePropField(pi, "title", e.target.value)} placeholder="Ex: Apartamento 501 Ed. Solar" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                        <Select value={prop.property_type || "casa"} onValueChange={(v) => updatePropField(pi, "property_type", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(propertyTypeLabels).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">Rua</label>
                        <Input value={prop.street || ""} onChange={(e) => updatePropField(pi, "street", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Número</label>
                        <Input value={prop.number || ""} onChange={(e) => updatePropField(pi, "number", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Bairro</label>
                        <Input value={prop.neighborhood || ""} onChange={(e) => updatePropField(pi, "neighborhood", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                        <Input value={prop.city || ""} onChange={(e) => updatePropField(pi, "city", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">UF</label>
                        <Select value={prop.state || ""} onValueChange={(v) => updatePropField(pi, "state", v)}>
                          <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                          <SelectContent>
                            {propStates.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">CEP</label>
                        <Input value={prop.zip_code || ""} onChange={(e) => updatePropField(pi, "zip_code", e.target.value)} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Matrícula</label>
                        <Input value={prop.registration_number || ""} onChange={(e) => updatePropField(pi, "registration_number", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Cartório de Registro</label>
                        <Input value={prop.registry_office || ""} onChange={(e) => updatePropField(pi, "registry_office", e.target.value)} />
                      </div>
                       <div>
                        <label className="text-xs font-medium text-muted-foreground">Inscrição Municipal (IPTU)</label>
                        <Input value={prop.municipal_registration || ""} onChange={(e) => updatePropField(pi, "municipal_registration", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Nome do Condomínio</label>
                        <Input value={(prop as any).condominium_name || ""} onChange={(e) => updatePropField(pi, "condominium_name", e.target.value)} placeholder="Ex: Edifício Solar" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Valor de Venda (R$)</label>
                        <Input placeholder="0,00" value={formatBRL(prop.sale_price)} onChange={(e) => updatePropField(pi, "sale_price", parseBRL(e.target.value) || undefined)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Área Total (m²)</label>
                        <Input type="number" step="0.01" value={prop.area_total ?? ""} onChange={(e) => updatePropField(pi, "area_total", e.target.value ? Number(e.target.value) : undefined)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Área Construída (m²)</label>
                        <Input type="number" step="0.01" value={prop.area_built ?? ""} onChange={(e) => updatePropField(pi, "area_built", e.target.value ? Number(e.target.value) : undefined)} />
                      </div>
                    </div>
                  </div>
                ))}

                {propsData.length === 0 && (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Nenhum imóvel identificado. Clique em "+ Imóvel" para adicionar.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="pessoas">
              <div className="space-y-4 py-2">
                <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <Users className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Pessoas identificadas no contrato. Se alguma já existir no sistema, remova-a aqui e vincule na aba Contrato.
                  </p>
                </div>

                {pplData.map((person, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{person.name || `Pessoa ${index + 1}`}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removePerson(index)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Nome *</label>
                        <Input value={person.name || ""} onChange={(e) => updatePersonField(index, "name", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Papel no Contrato</label>
                        <Select value={person.contractRole} onValueChange={(v) => updatePersonField(index, "contractRole", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(partyRoleLabels)
                              .filter(([v]) => v !== "intermediador" && v !== "testemunha")
                              .map(([v, l]) => (
                                <SelectItem key={v} value={v}>{l}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                        <Select value={person.entity_type || "pf"} onValueChange={(v) => updatePersonField(index, "entity_type", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(entityTypeLabels).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">CPF/CNPJ</label>
                        <Input value={person.cpf_cnpj || ""} onChange={(e) => updatePersonField(index, "cpf_cnpj", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Email</label>
                        <Input value={person.email || ""} onChange={(e) => updatePersonField(index, "email", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                        <Input value={person.phone || ""} onChange={(e) => updatePersonField(index, "phone", e.target.value)} />
                      </div>
                    </div>

                    {/* Legal representative fields for PJ */}
                    {person.entity_type === "pj" && (
                      <div className="mt-3 rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Info className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-semibold text-primary">Representante Legal</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Nome do Representante</label>
                            <Input value={person.legal_representative_name || ""} onChange={(e) => updatePersonField(index, "legal_representative_name", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">CPF do Representante</label>
                            <Input value={person.legal_representative_cpf || ""} onChange={(e) => updatePersonField(index, "legal_representative_cpf", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">E-mail do Representante</label>
                            <Input value={person.legal_representative_email || ""} onChange={(e) => updatePersonField(index, "legal_representative_email", e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Telefone do Representante</label>
                            <Input value={person.legal_representative_phone || ""} onChange={(e) => updatePersonField(index, "legal_representative_phone", e.target.value)} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <Button type="button" variant="outline" size="sm" onClick={addPerson}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar pessoa
                </Button>
              </div>
            </TabsContent>

            {/* Obligations Tab - only shown when AI detected obligations */}
            {oblData.length > 0 && (
              <TabsContent value="obrigacoes">
                <ObligationPreviewPanel obligations={oblData} onChange={setOblData} />
                <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  <Button type="button" onClick={() => form.handleSubmit(handleSubmit, handleInvalidForm)()}>
                    {isPending ? "Salvando..." : contract ? "Salvar" : "Cadastrar Contrato"}
                  </Button>
                </div>
              </TabsContent>
            )}

            {/* Vistoria Tab - only shown when AI detected inspection data */}
            {inspData && (
              <TabsContent value="vistoria">
                <div className="space-y-4 py-2">
                  {/* Header */}
                  <div className="flex items-start gap-2 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 px-3 py-2">
                    <ClipboardCheck className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400">Vistoria de Entrada Detectada</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        A IA identificou um laudo/relatório de vistoria no documento. Revise os dados abaixo e confirme o registro.
                      </p>
                    </div>
                  </div>

                  {/* Meta fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Data da Vistoria</label>
                      <Input
                        type="date"
                        value={inspData.conducted_date || ""}
                        onChange={(e) => setInspData((prev) => prev ? { ...prev, conducted_date: e.target.value } : prev)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Vistoriador</label>
                      <Input
                        value={inspData.inspector_name || ""}
                        onChange={(e) => setInspData((prev) => prev ? { ...prev, inspector_name: e.target.value } : prev)}
                        placeholder="Nome do vistoriador"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Observações Gerais</label>
                      <Input
                        value={inspData.notes || ""}
                        onChange={(e) => setInspData((prev) => prev ? { ...prev, notes: e.target.value } : prev)}
                        placeholder="Observações gerais da vistoria"
                      />
                    </div>
                  </div>

                  {/* Items table */}
                  {inspData.items.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Itens Vistoriados ({inspData.items.length})
                        </label>
                        <Button
                          type="button" variant="outline" size="sm"
                          onClick={() => setInspData((prev) => prev ? { ...prev, items: [...prev.items, { room_name: "", item_name: "", condition: "bom", notes: "" }] } : prev)}
                        >
                          <Plus className="mr-1 h-3 w-3" /> Adicionar item
                        </Button>
                      </div>
                      <div className="rounded-md border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cômodo</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Estado</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Obs.</th>
                              <th className="px-2 py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {inspData.items.map((item, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="px-2 py-1.5">
                                  <Input
                                    className="h-7 text-xs"
                                    value={item.room_name}
                                    onChange={(e) => setInspData((prev) => {
                                      if (!prev) return prev;
                                      const items = [...prev.items];
                                      items[idx] = { ...items[idx], room_name: e.target.value };
                                      return { ...prev, items };
                                    })}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <Input
                                    className="h-7 text-xs"
                                    value={item.item_name}
                                    onChange={(e) => setInspData((prev) => {
                                      if (!prev) return prev;
                                      const items = [...prev.items];
                                      items[idx] = { ...items[idx], item_name: e.target.value };
                                      return { ...prev, items };
                                    })}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <Select
                                    value={item.condition}
                                    onValueChange={(v) => setInspData((prev) => {
                                      if (!prev) return prev;
                                      const items = [...prev.items];
                                      items[idx] = { ...items[idx], condition: v };
                                      return { ...prev, items };
                                    })}
                                  >
                                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="novo">Novo</SelectItem>
                                      <SelectItem value="bom">Bom</SelectItem>
                                      <SelectItem value="regular">Regular</SelectItem>
                                      <SelectItem value="ruim">Ruim</SelectItem>
                                      <SelectItem value="danificado">Danificado</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="px-2 py-1.5">
                                  <Input
                                    className="h-7 text-xs"
                                    value={item.notes || ""}
                                    onChange={(e) => setInspData((prev) => {
                                      if (!prev) return prev;
                                      const items = [...prev.items];
                                      items[idx] = { ...items[idx], notes: e.target.value };
                                      return { ...prev, items };
                                    })}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <Button
                                    type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                                    onClick={() => setInspData((prev) => prev ? { ...prev, items: prev.items.filter((_, i) => i !== idx) } : prev)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Confirm checkbox */}
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Checkbox
                      id="confirm-inspection"
                      checked={confirmInspection}
                      onCheckedChange={(v) => setConfirmInspection(!!v)}
                    />
                    <label htmlFor="confirm-inspection" className="text-sm font-medium cursor-pointer">
                      Registrar esta vistoria como <strong>vistoria de entrada</strong> do contrato (status: realizada)
                    </label>
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit, handleInvalidForm)} className="space-y-6">
              {/* Upload do Contrato */}
              {!contract && (
                <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold">Upload do Contrato</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        É obrigatório o envio do contrato assinado em formato PDF para registro no sistema.
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => setContractFile(e.target.files?.[0] ?? null)}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="mr-2 h-3.5 w-3.5" />
                          {contractFile ? "Trocar arquivo" : "Selecionar PDF"}
                        </Button>
                        {contractFile && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{contractFile.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {renderContractFields(form, contractType, isVenda, isVisible, anyGuaranteeVisible, properties, people, fields, append, remove, handleCommissionPctChange, handleCommissionValueChange, false, [])}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Salvando..." : contract ? "Atualizar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Extracted contract fields renderer to avoid duplication
function renderContractFields(
  form: any,
  contractType: string,
  isVenda: boolean,
  isVisible: (k: string) => boolean,
  anyGuaranteeVisible: boolean,
  properties: any[] | undefined,
  people: any[] | undefined,
  fields: any[],
  append: any,
  remove: any,
  handleCommissionPctChange: (v: number) => void,
  handleCommissionValueChange: (v: number) => void,
  hasAIPrefill: boolean = false,
  aiPeopleData: AIExtractedPerson[] = [],
) {
  return (
    <>
      {/* Dados do Contrato */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Dados do Contrato
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField control={form.control} name="contract_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {Object.entries(contractTypeLabels).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
              <FormLabel>Status *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {Object.entries(contractStatusLabels).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          {hasAIPrefill ? (
            <FormItem>
              <FormLabel>Imóvel</FormLabel>
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                <Info className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-sm text-muted-foreground">O imóvel será criado a partir da aba Imóveis</span>
              </div>
            </FormItem>
          ) : (
            <FormField control={form.control} name="property_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Imóvel *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {properties?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          )}
        </div>
      </div>

      {/* Assinatura - always visible for venda */}
      {isVenda && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Assinatura</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="signed_at" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Assinatura</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="signing_platform" render={({ field }) => (
                <FormItem>
                  <FormLabel>Plataforma</FormLabel>
                  <FormControl><Input {...field} placeholder="Ex: Clicksign, Docusign, Física" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>
        </>
      )}

      {/* Vigência - hidden for venda */}
      {!isVenda && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Vigência</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="start_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Início</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="end_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Término</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Values */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Valores</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(contractType === "venda" || contractType === "administracao") && (
            <FormField control={form.control} name="total_value" render={({ field }) => (
              <FormItem>
                <FormLabel>Valor Total (R$)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0,00"
                    value={formatBRL(field.value)}
                    onChange={(e) => field.onChange(parseBRL(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}
          {(contractType === "locacao" || contractType === "administracao") && (
            <>
              <FormField control={form.control} name="monthly_value" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Mensal (R$)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0,00"
                      value={formatBRL(field.value)}
                      onChange={(e) => field.onChange(parseBRL(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {isVisible("adjustment_index") && (
                <FormField control={form.control} name="adjustment_index" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Índice de Reajuste</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {adjustmentIndexOptions.map((idx) => (
                          <SelectItem key={idx} value={idx}>{idx}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={form.control} name="payment_due_day" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia de Vencimento</FormLabel>
                  <FormControl><Input type="number" min="1" max="31" placeholder="Ex: 10" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {isVisible("admin_fee_percentage") && (
                <FormField control={form.control} name="admin_fee_percentage" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxa de Administração (%)</FormLabel>
                    <FormControl><Input type="number" step="0.5" max="100" placeholder="10" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </>
          )}
          {contractType === "venda" && (
            <>
              {isVisible("commission_percentage") && (
                <FormField control={form.control} name="commission_percentage" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comissão de Venda (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        max="100"
                        placeholder="6"
                        value={field.value ?? ""}
                        onChange={(e) => handleCommissionPctChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              {isVisible("commission_value") && (
                <FormField control={form.control} name="commission_value" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Comissão (R$)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0,00"
                        value={formatBRL(field.value)}
                        onChange={(e) => handleCommissionValueChange(parseBRL(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </>
          )}
          {contractType === "administracao" && isVisible("commission_percentage") && (
            <FormField control={form.control} name="commission_percentage" render={({ field }) => (
              <FormItem>
                <FormLabel>Comissão (%)</FormLabel>
                <FormControl><Input type="number" step="0.01" max="100" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )}
        </div>
      </div>

      <Separator />

      {/* Partes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Partes do Contrato</h3>
          {!hasAIPrefill && (
            <Button type="button" variant="outline" size="sm" onClick={() => append({ person_id: "", role: "locatario" })}>
              <Plus className="mr-1 h-3 w-3" /> Adicionar
            </Button>
          )}
        </div>

        {hasAIPrefill && aiPeopleData.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 mb-2">
              <Info className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground">As pessoas abaixo serão criadas a partir da aba Pessoas.</span>
            </div>
            {aiPeopleData.map((person, index) => (
              <div key={index} className="flex items-center gap-3 rounded-md border px-3 py-2">
                <span className="text-sm font-medium flex-1">{person.name || `Pessoa ${index + 1}`}</span>
                <Badge variant="secondary" className="text-xs">{partyRoleLabels[person.contractRole] || person.contractRole}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field: any, index: number) => (
              <div key={field.id} className="flex gap-3 items-end">
                <FormField control={form.control} name={`parties.${index}.person_id`} render={({ field: f }) => (
                  <FormItem className="flex-1">
                    <FormLabel className={index > 0 ? "sr-only" : ""}>Pessoa</FormLabel>
                    <Select onValueChange={f.onChange} value={f.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {people?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={`parties.${index}.role`} render={({ field: f }) => (
                  <FormItem className="w-[180px]">
                    <FormLabel className={index > 0 ? "sr-only" : ""}>Papel</FormLabel>
                    <Select onValueChange={f.onChange} value={f.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(partyRoleLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Garantia - hidden for venda */}
      {!isVenda && anyGuaranteeVisible && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Garantia Locatícia</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isVisible("guarantee_type") && (
                <FormField control={form.control} name="guarantee_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Garantia</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="fiador">Fiador</SelectItem>
                        <SelectItem value="caucao_dinheiro">Caução em Dinheiro</SelectItem>
                        <SelectItem value="caucao_imovel">Caução de Imóvel</SelectItem>
                        <SelectItem value="seguro_fianca">Seguro Fiança</SelectItem>
                        <SelectItem value="titulo_capitalizacao">Título de Capitalização</SelectItem>
                        <SelectItem value="nenhuma">Nenhuma</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              {isVisible("guarantee_value") && (
                <FormField control={form.control} name="guarantee_value" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Garantia (R$)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0,00"
                        value={formatBRL(field.value)}
                        onChange={(e) => field.onChange(parseBRL(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              {isVisible("guarantee_policy_number") && (
                <FormField control={form.control} name="guarantee_policy_number" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº Apólice/Título</FormLabel>
                    <FormControl><Input {...field} placeholder="Se aplicável" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              {isVisible("guarantee_details") && (
                <FormField control={form.control} name="guarantee_details" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detalhes da Garantia</FormLabel>
                    <FormControl><Input {...field} placeholder="Dados adicionais" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>
          </div>
        </>
      )}

      {/* Encargos e Responsabilidades - only for locação */}
      {!isVenda && (
        <>
          <Separator />
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Encargos e Responsabilidades</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="contract_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nº do Contrato</FormLabel>
                  <FormControl><Input placeholder="Ex: LOC-2025-001" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="notice_period_days" render={({ field }) => (
                <FormItem>
                  <FormLabel>Aviso Prévio (dias)</FormLabel>
                  <FormControl><Input type="number" min={0} placeholder="30" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="grace_period_months" render={({ field }) => (
                <FormItem>
                  <FormLabel>Carência (meses)</FormLabel>
                  <FormControl><Input type="number" min={0} placeholder="0" {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
              {Number(form.watch("grace_period_months") || 0) > 0 && (
                <>
                  <FormField control={form.control} name="grace_discount_value" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Desconto Carência (R$)</FormLabel>
                      <FormControl><Input type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="grace_reason" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Motivo da Carência</FormLabel>
                      <FormControl><Input placeholder="Ex: Benfeitorias pelo locatário" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <FormField control={form.control} name="tenant_pays_iptu" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="text-sm font-normal">Locatário paga IPTU</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="tenant_pays_condo" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="text-sm font-normal">Locatário paga Condomínio</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="tenant_pays_insurance" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="text-sm font-normal">Seguro obrigatório</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="allows_sublease" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="text-sm font-normal">Permite sublocação</FormLabel>
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <FormField control={form.control} name="promotion_fund_pct" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fundo Promoção (%)</FormLabel>
                  <FormControl><Input type="number" step="0.5" min={0} max={100} {...field} value={field.value ?? ""} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="penalty_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Multa Rescisória</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(penaltyTypeLabels).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              {form.watch("penalty_type") === "alugueis" && (
                <FormField control={form.control} name="penalty_months" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº de Aluguéis</FormLabel>
                    <FormControl><Input type="number" min={0} placeholder="3" {...field} value={field.value ?? ""} /></FormControl>
                  </FormItem>
                )} />
              )}
              <FormField control={form.control} name="exclusivity_clause" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Cláusula de Exclusividade</FormLabel>
                  <FormControl><Input placeholder="Ex: Ramo de alimentação exclusivo" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
          </div>
        </>
      )}

      {/* Observações */}
      {isVisible("notes") && (
        <>
          <Separator />
          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea placeholder="Anotações sobre este contrato..." className="min-h-[80px]" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </>
      )}
    </>
  );
}
