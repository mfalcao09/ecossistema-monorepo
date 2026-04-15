import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatCep, fetchAddressByCep } from "@/lib/cepUtils";
import { formatCpfCnpj, isValidCpfCnpj } from "@/lib/cpfCnpjValidation";
import { toast } from "sonner";
import { Upload, X, ImagePlus, FileText, AlertCircle } from "lucide-react";
import type { Property } from "@/hooks/useProperties";
import { useFormCustomization } from "@/hooks/useFormCustomization";
import {
  propertySchema, type PropertyFormValues, defaultPropertyValues,
  propertyTypeLabels, propertyPurposeLabels, propertyStatusLabels, brazilianStates,
  propertyCategoryLabels, habiteSeStatusLabels,
} from "@/lib/propertySchema";
import {
  personSchema, type PersonFormValues, defaultPersonValues, brazilianStates as personStates,
} from "@/lib/personSchema";

export interface PropertyFormSubmitData {
  property: PropertyFormValues;
  features: string[];
  owner?: Partial<PersonFormValues> | null;
  photos: File[];
  attachments: { file: File; label: string }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: Property | null;
  onSubmit: (data: PropertyFormSubmitData) => void;
  isPending: boolean;
}

export function PropertyFormDialog({ open, onOpenChange, property, onSubmit, isPending }: Props) {
  const { config: formConfig } = useFormCustomization();
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [selectedCondoFeatures, setSelectedCondoFeatures] = useState<string[]>([]);
  const [cepLoading, setCepLoading] = useState(false);
  const [ownerCepLoading, setOwnerCepLoading] = useState(false);

  // Owner state
  const [ownerName, setOwnerName] = useState("");
  const [ownerCpfCnpj, setOwnerCpfCnpj] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerPhone2, setOwnerPhone2] = useState("");
  const [ownerRg, setOwnerRg] = useState("");
  const [ownerDob, setOwnerDob] = useState("");
  const [ownerZipCode, setOwnerZipCode] = useState("");
  const [ownerStreet, setOwnerStreet] = useState("");
  const [ownerNumber, setOwnerNumber] = useState("");
  const [ownerComplement, setOwnerComplement] = useState("");
  const [ownerNeighborhood, setOwnerNeighborhood] = useState("");
  const [ownerCity, setOwnerCity] = useState("");
  const [ownerState, setOwnerState] = useState("");
  const [ownerNotes, setOwnerNotes] = useState("");

  // Upload state
  const [photos, setPhotos] = useState<File[]>([]);
  const [matriculaFile, setMatriculaFile] = useState<File | null>(null);
  const [iptuFile, setIptuFile] = useState<File | null>(null);
  const [extraAttachments, setExtraAttachments] = useState<File[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const matriculaInputRef = useRef<HTMLInputElement>(null);
  const iptuInputRef = useRef<HTMLInputElement>(null);
  const extraAttachInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: defaultPropertyValues,
  });

  useEffect(() => {
    if (property) {
      form.reset({
        title: property.title,
        property_code: (property as any).property_code ?? "",
        property_type: property.property_type,
        purpose: property.purpose,
        status: property.status,
        zip_code: property.zip_code ?? "",
        street: property.street ?? "",
        number: property.number ?? "",
        complement: property.complement ?? "",
        neighborhood: property.neighborhood ?? "",
        city: property.city ?? "",
        state: property.state ?? "",
        region: (property as any).region ?? "",
        condominium_name: (property as any).condominium_name ?? "",
        rooms: property.rooms ?? 0,
        suites: (property as any).suites ?? 0,
        bathrooms: property.bathrooms ?? 0,
        parking_spots: property.parking_spots ?? 0,
        area_total: property.area_total ?? undefined,
        area_built: property.area_built ?? undefined,
        private_area: (property as any).private_area ?? undefined,
        industrial_area: (property as any).industrial_area ?? undefined,
        leasable_area: (property as any).leasable_area ?? undefined,
        ceiling_height: (property as any).ceiling_height ?? undefined,
        docks: (property as any).docks ?? 0,
        power_capacity: (property as any).power_capacity ?? "",
        category: (property as any).category ?? "",
        latitude: (property as any).latitude ?? undefined,
        longitude: (property as any).longitude ?? undefined,
        habite_se_status: (property as any).habite_se_status ?? "",
        avcb_expiry: (property as any).avcb_expiry ?? "",
        sale_price: property.sale_price ?? undefined,
        rental_price: property.rental_price ?? undefined,
        condominium_fee: property.condominium_fee ?? undefined,
        iptu: property.iptu ?? undefined,
        accepts_exchange: (property as any).accepts_exchange ?? false,
        exchange_value: (property as any).exchange_value ?? undefined,
        show_on_website: (property as any).show_on_website ?? true,
        highlight_web: (property as any).highlight_web ?? false,
        has_sign: (property as any).has_sign ?? false,
        has_income: (property as any).has_income ?? false,
        description: property.description ?? "",
        development_id: property.development_id ?? "",
      });
    } else {
      form.reset(defaultPropertyValues);
      setSelectedFeatures([]);
      setSelectedCondoFeatures([]);
      resetOwner();
      resetUploads();
    }
  }, [property, form]);

  function resetOwner() {
    setOwnerName(""); setOwnerCpfCnpj(""); setOwnerEmail(""); setOwnerPhone("");
    setOwnerPhone2(""); setOwnerRg(""); setOwnerDob(""); setOwnerZipCode("");
    setOwnerStreet(""); setOwnerNumber(""); setOwnerComplement("");
    setOwnerNeighborhood(""); setOwnerCity(""); setOwnerState(""); setOwnerNotes("");
  }

  function resetUploads() {
    setPhotos([]); setMatriculaFile(null); setIptuFile(null); setExtraAttachments([]);
  }

  function toggleFeature(feat: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(feat) ? list.filter((f) => f !== feat) : [...list, feat]);
  }

  async function handleCepBlur() {
    const cep = form.getValues("zip_code");
    if (!cep || cep.replace(/\D/g, "").length !== 8) return;
    setCepLoading(true);
    const addr = await fetchAddressByCep(cep);
    setCepLoading(false);
    if (addr) {
      form.setValue("street", addr.street);
      form.setValue("neighborhood", addr.neighborhood);
      form.setValue("city", addr.city);
      form.setValue("state", addr.state);
    } else {
      toast.error("CEP não encontrado.");
    }
  }

  async function handleOwnerCepBlur() {
    if (!ownerZipCode || ownerZipCode.replace(/\D/g, "").length !== 8) return;
    setOwnerCepLoading(true);
    const addr = await fetchAddressByCep(ownerZipCode);
    setOwnerCepLoading(false);
    if (addr) {
      setOwnerStreet(addr.street);
      setOwnerNeighborhood(addr.neighborhood);
      setOwnerCity(addr.city);
      setOwnerState(addr.state);
    }
  }

  function handleSubmit(values: PropertyFormValues) {
    // Validate required uploads for new properties
    if (!property) {
      if (!matriculaFile) {
        toast.error("Upload da Matrícula do Imóvel é obrigatório.");
        return;
      }
      if (!iptuFile) {
        toast.error("Upload do IPTU do Imóvel é obrigatório.");
        return;
      }
    }

    // Validate owner CPF/CNPJ if provided
    if (ownerCpfCnpj.trim() && !isValidCpfCnpj(ownerCpfCnpj)) {
      toast.error("CPF/CNPJ do proprietário é inválido.");
      return;
    }

    const allFeatures = [...selectedFeatures, ...selectedCondoFeatures];

    const ownerData = ownerName.trim()
      ? {
          name: ownerName.trim(),
          person_type: "proprietario" as const,
          entity_type: "pf" as const,
          cpf_cnpj: ownerCpfCnpj,
          rg: ownerRg,
          date_of_birth: ownerDob,
          email: ownerEmail,
          phone: ownerPhone,
          phone2: ownerPhone2,
          zip_code: ownerZipCode,
          street: ownerStreet,
          number: ownerNumber,
          complement: ownerComplement,
          neighborhood: ownerNeighborhood,
          city: ownerCity,
          state: ownerState,
          notes: ownerNotes,
        }
      : null;

    const attachments: { file: File; label: string }[] = [];
    if (matriculaFile) attachments.push({ file: matriculaFile, label: "Matrícula do Imóvel" });
    if (iptuFile) attachments.push({ file: iptuFile, label: "IPTU do Imóvel" });
    extraAttachments.forEach((f) => attachments.push({ file: f, label: f.name }));

    onSubmit({
      property: values,
      features: allFeatures,
      owner: ownerData,
      photos,
      attachments,
    });
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeExtraAttachment(idx: number) {
    setExtraAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  const isNew = !property;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{property ? "Editar Imóvel" : "Novo Imóvel"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh] px-6 pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <Tabs defaultValue="imovel">
                <TabsList className="mb-4 flex-wrap h-auto gap-1">
                  <TabsTrigger value="imovel">Imóvel</TabsTrigger>
                  <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                  {isNew && <TabsTrigger value="proprietario">Proprietário</TabsTrigger>}
                  {isNew && <TabsTrigger value="uploads">Uploads</TabsTrigger>}
                  <TabsTrigger value="outros">Outros</TabsTrigger>
                </TabsList>

                {/* ─── Tab: Imóvel ─── */}
                <TabsContent value="imovel" className="space-y-5">
                  {/* Dados Principais */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados Principais</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <FormField control={form.control} name="title" render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-xs">Título *</FormLabel>
                          <FormControl><Input className="h-8 text-sm" placeholder="Nome do imóvel" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="property_code" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Código</FormLabel>
                          <FormControl><Input className="h-8 text-sm" placeholder="Ex: 12345" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <FormField control={form.control} name="property_type" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Tipo *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{Object.entries(propertyTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="purpose" render={({ field }) => {
                        const isVenda = field.value === "venda" || field.value === "ambos";
                        const isLocacao = field.value === "locacao" || field.value === "ambos";
                        const toggle = (type: "venda" | "locacao") => {
                          if (type === "venda") {
                            const newVenda = !isVenda;
                            field.onChange(newVenda && isLocacao ? "ambos" : newVenda ? "venda" : isLocacao ? "locacao" : "venda");
                          } else {
                            const newLocacao = !isLocacao;
                            field.onChange(isVenda && newLocacao ? "ambos" : newLocacao ? "locacao" : isVenda ? "venda" : "locacao");
                          }
                        };
                        return (
                          <FormItem>
                            <FormLabel className="text-xs">Finalidade *</FormLabel>
                            <div className="flex items-center gap-4 pt-1">
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox checked={isVenda} onCheckedChange={() => toggle("venda")} />
                                Venda
                              </label>
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <Checkbox checked={isLocacao} onCheckedChange={() => toggle("locacao")} />
                                Locação
                              </label>
                            </div>
                          </FormItem>
                        );
                      }} />
                      <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Status *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{Object.entries(propertyStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </div>
                  </section>

                  <Separator />

                  {/* Endereço */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <FormField control={form.control} name="zip_code" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">CEP</FormLabel>
                          <FormControl>
                            <Input className="h-8 text-sm" placeholder="00000-000" maxLength={9}
                              value={field.value}
                              onChange={(e) => field.onChange(formatCep(e.target.value))}
                              onBlur={() => { field.onBlur(); handleCepBlur(); }}
                            />
                          </FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="street" render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel className="text-xs">Endereço</FormLabel>
                          <FormControl><Input className="h-8 text-sm" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="number" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Número</FormLabel>
                          <FormControl><Input className="h-8 text-sm" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <FormField control={form.control} name="complement" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Complemento</FormLabel>
                          <FormControl><Input className="h-8 text-sm" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="neighborhood" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Bairro</FormLabel>
                          <FormControl><Input className="h-8 text-sm" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="city" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Município</FormLabel>
                          <FormControl><Input className="h-8 text-sm" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="state" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">UF</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="UF" /></SelectTrigger></FormControl>
                            <SelectContent>{brazilianStates.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </div>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <FormField control={form.control} name="region" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Região</FormLabel>
                          <FormControl><Input className="h-8 text-sm" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="condominium_name" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Nome do Condomínio</FormLabel>
                          <FormControl><Input className="h-8 text-sm" placeholder="Ex: Edifício Solar" {...field} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                  </section>

                  <Separator />

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição</h3>
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Descrição Site / Observações</FormLabel>
                        <FormControl><Textarea rows={3} className="text-sm" placeholder="Detalhes adicionais do imóvel..." {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </section>

                  <Separator />

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valores (R$)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <FormField control={form.control} name="sale_price" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Valor Venda</FormLabel>
                          <FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="rental_price" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Valor Aluguel</FormLabel>
                          <FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="condominium_fee" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Condomínio</FormLabel>
                          <FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="iptu" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">IPTU</FormLabel>
                          <FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl>
                        </FormItem>
                      )} />
                    </div>
                    {!formConfig.hidden_fields.includes("accepts_exchange") && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                        <FormField control={form.control} name="accepts_exchange" render={({ field }) => (
                          <FormItem className="flex items-center gap-2 space-y-0 pt-2">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <FormLabel className="text-xs font-normal">Aceita Permuta</FormLabel>
                          </FormItem>
                        )} />
                        {form.watch("accepts_exchange") && (
                          <FormField control={form.control} name="exchange_value" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Valor Permuta</FormLabel>
                              <FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl>
                            </FormItem>
                          )} />
                        )}
                      </div>
                    )}
                  </section>
                </TabsContent>

                {/* ─── Tab: Detalhes ─── */}
                <TabsContent value="detalhes" className="space-y-5">
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Características Comuns · Condomínio</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                      {formConfig.condo_features.map((feat) => (
                        <label key={feat} className="flex items-center gap-1.5 text-xs cursor-pointer py-0.5">
                          <Checkbox checked={selectedCondoFeatures.includes(feat)} onCheckedChange={() => toggleFeature(feat, selectedCondoFeatures, setSelectedCondoFeatures)} className="h-3.5 w-3.5" />
                          {feat}
                        </label>
                      ))}
                    </div>
                  </section>

                  <Separator />

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Características do Imóvel</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <FormField control={form.control} name="rooms" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Dormitórios</FormLabel><FormControl><Input className="h-8 text-sm" type="number" min={0} {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="suites" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Suítes</FormLabel><FormControl><Input className="h-8 text-sm" type="number" min={0} {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="bathrooms" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Banheiros</FormLabel><FormControl><Input className="h-8 text-sm" type="number" min={0} {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="parking_spots" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Vagas</FormLabel><FormControl><Input className="h-8 text-sm" type="number" min={0} {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mt-3">
                      {formConfig.property_features.map((feat) => (
                        <label key={feat} className="flex items-center gap-1.5 text-xs cursor-pointer py-0.5">
                          <Checkbox checked={selectedFeatures.includes(feat)} onCheckedChange={() => toggleFeature(feat, selectedFeatures, setSelectedFeatures)} className="h-3.5 w-3.5" />
                          {feat}
                        </label>
                      ))}
                    </div>
                  </section>

                  <Separator />

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metragens / Terreno</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <FormField control={form.control} name="area_total" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Área Terreno</FormLabel><FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="area_built" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Área Construída</FormLabel><FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl></FormItem>
                      )} />
                      {!formConfig.hidden_fields.includes("private_area") && (
                        <FormField control={form.control} name="private_area" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Área Privativa</FormLabel><FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl></FormItem>
                        )} />
                      )}
                      {!formConfig.hidden_fields.includes("industrial_area") && (
                        <FormField control={form.control} name="industrial_area" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Área Fabril</FormLabel><FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl></FormItem>
                        )} />
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {!formConfig.hidden_fields.includes("ceiling_height") && (
                        <FormField control={form.control} name="ceiling_height" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Pé Direito (m)</FormLabel><FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl></FormItem>
                        )} />
                      )}
                      {!formConfig.hidden_fields.includes("docks") && (
                        <FormField control={form.control} name="docks" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">Docas</FormLabel><FormControl><Input className="h-8 text-sm" type="number" min={0} {...field} value={field.value ?? ""} /></FormControl></FormItem>
                        )} />
                      )}
                    </div>
                  </section>

                  <Separator />

                  {/* Classificação Técnica */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Classificação Técnica</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <FormField control={form.control} name="category" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Categoria</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {Object.entries(propertyCategoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="leasable_area" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">ABL (m²)</FormLabel><FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="power_capacity" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Carga Elétrica</FormLabel><FormControl><Input className="h-8 text-sm" placeholder="Ex: 500kVA" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="habite_se_status" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Habite-se</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {Object.entries(habiteSeStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <FormField control={form.control} name="avcb_expiry" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Validade AVCB</FormLabel><FormControl><Input className="h-8 text-sm" type="date" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="latitude" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Latitude</FormLabel><FormControl><Input className="h-8 text-sm" type="number" step="0.000001" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                      )} />
                      <FormField control={form.control} name="longitude" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Longitude</FormLabel><FormControl><Input className="h-8 text-sm" type="number" step="0.000001" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                      )} />
                    </div>
                  </section>
                </TabsContent>

                {/* ─── Tab: Proprietário (only new) ─── */}
                {isNew && (
                  <TabsContent value="proprietario" className="space-y-5">
                    <section className="space-y-3">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados do Proprietário</h3>
                      <p className="text-xs text-muted-foreground">Preencha os dados abaixo para cadastrar o proprietário automaticamente na base de Pessoas.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Nome *</label>
                          <Input className="h-8 text-sm" placeholder="Nome completo" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">CPF / CNPJ</label>
                          <Input className="h-8 text-sm" placeholder="000.000.000-00" value={ownerCpfCnpj}
                            onChange={(e) => setOwnerCpfCnpj(formatCpfCnpj(e.target.value))} maxLength={18} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">RG</label>
                          <Input className="h-8 text-sm" value={ownerRg} onChange={(e) => setOwnerRg(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Data Nascimento</label>
                          <Input className="h-8 text-sm" type="date" value={ownerDob} onChange={(e) => setOwnerDob(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Email</label>
                          <Input className="h-8 text-sm" type="email" placeholder="email@exemplo.com" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Telefone</label>
                          <Input className="h-8 text-sm" placeholder="(00) 00000-0000" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Telefone 2</label>
                          <Input className="h-8 text-sm" value={ownerPhone2} onChange={(e) => setOwnerPhone2(e.target.value)} />
                        </div>
                      </div>
                    </section>

                    <Separator />

                    <section className="space-y-3">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço do Proprietário</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">CEP</label>
                          <Input className="h-8 text-sm" placeholder="00000-000" maxLength={9}
                            value={ownerZipCode}
                            onChange={(e) => setOwnerZipCode(formatCep(e.target.value))}
                            onBlur={handleOwnerCepBlur} />
                        </div>
                        <div className="space-y-1.5 col-span-2">
                          <label className="text-xs font-medium">Endereço</label>
                          <Input className="h-8 text-sm" value={ownerStreet} onChange={(e) => setOwnerStreet(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Número</label>
                          <Input className="h-8 text-sm" value={ownerNumber} onChange={(e) => setOwnerNumber(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Complemento</label>
                          <Input className="h-8 text-sm" value={ownerComplement} onChange={(e) => setOwnerComplement(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Bairro</label>
                          <Input className="h-8 text-sm" value={ownerNeighborhood} onChange={(e) => setOwnerNeighborhood(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Município</label>
                          <Input className="h-8 text-sm" value={ownerCity} onChange={(e) => setOwnerCity(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">UF</label>
                          <Select value={ownerState} onValueChange={setOwnerState}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="UF" /></SelectTrigger>
                            <SelectContent>{personStates.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    </section>

                    <Separator />

                    <section className="space-y-3">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações</h3>
                      <Textarea rows={2} className="text-sm" placeholder="Observações sobre o proprietário..." value={ownerNotes} onChange={(e) => setOwnerNotes(e.target.value)} />
                    </section>
                  </TabsContent>
                )}

                {/* ─── Tab: Uploads (only new) ─── */}
                {isNew && (
                  <TabsContent value="uploads" className="space-y-5">
                    {/* Photos */}
                    <section className="space-y-3">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fotos do Imóvel</h3>
                      <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => { if (e.target.files) setPhotos((prev) => [...prev, ...Array.from(e.target.files!)]); e.target.value = ""; }} />
                      <Button type="button" variant="outline" size="sm" onClick={() => photoInputRef.current?.click()}>
                        <ImagePlus className="h-4 w-4 mr-1" /> Adicionar Fotos
                      </Button>
                      {photos.length > 0 && (
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-2">
                          {photos.map((file, idx) => (
                            <div key={idx} className="relative group rounded-md overflow-hidden border bg-muted aspect-square">
                              <img src={URL.createObjectURL(file)} alt={file.name} className="h-full w-full object-cover" />
                              <button type="button" className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removePhoto(idx)}>
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <Separator />

                    {/* Required Attachments */}
                    <section className="space-y-3">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Anexos Obrigatórios</h3>

                      <div className="space-y-3">
                        {/* Matrícula */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <label className="text-xs font-medium">Matrícula do Imóvel *</label>
                              {!matriculaFile && <AlertCircle className="h-3 w-3 text-destructive" />}
                            </div>
                            <input ref={matriculaInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden"
                              onChange={(e) => { if (e.target.files?.[0]) setMatriculaFile(e.target.files[0]); e.target.value = ""; }} />
                            {matriculaFile ? (
                              <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs bg-muted/50">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate flex-1">{matriculaFile.name}</span>
                                <button type="button" onClick={() => setMatriculaFile(null)}><X className="h-3 w-3" /></button>
                              </div>
                            ) : (
                              <Button type="button" variant="outline" size="sm" onClick={() => matriculaInputRef.current?.click()}>
                                <Upload className="h-3.5 w-3.5 mr-1" /> Selecionar arquivo
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* IPTU */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <label className="text-xs font-medium">IPTU do Imóvel *</label>
                              {!iptuFile && <AlertCircle className="h-3 w-3 text-destructive" />}
                            </div>
                            <input ref={iptuInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden"
                              onChange={(e) => { if (e.target.files?.[0]) setIptuFile(e.target.files[0]); e.target.value = ""; }} />
                            {iptuFile ? (
                              <div className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs bg-muted/50">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate flex-1">{iptuFile.name}</span>
                                <button type="button" onClick={() => setIptuFile(null)}><X className="h-3 w-3" /></button>
                              </div>
                            ) : (
                              <Button type="button" variant="outline" size="sm" onClick={() => iptuInputRef.current?.click()}>
                                <Upload className="h-3.5 w-3.5 mr-1" /> Selecionar arquivo
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>

                    <Separator />

                    {/* Extra Attachments */}
                    <section className="space-y-3">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outros Anexos</h3>
                      <input ref={extraAttachInputRef} type="file" multiple className="hidden"
                        onChange={(e) => { if (e.target.files) setExtraAttachments((prev) => [...prev, ...Array.from(e.target.files!)]); e.target.value = ""; }} />
                      <Button type="button" variant="outline" size="sm" onClick={() => extraAttachInputRef.current?.click()}>
                        <Upload className="h-3.5 w-3.5 mr-1" /> Adicionar Anexo
                      </Button>
                      {extraAttachments.length > 0 && (
                        <div className="space-y-1 mt-2">
                          {extraAttachments.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs bg-muted/50">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate flex-1">{file.name}</span>
                              <button type="button" onClick={() => removeExtraAttachment(idx)}><X className="h-3 w-3" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </TabsContent>
                )}

                {/* ─── Tab: Outros ─── */}
                <TabsContent value="outros" className="space-y-5">
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Divulgação</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <FormField control={form.control} name="has_sign" render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="text-xs font-normal">Tem Placa</FormLabel>
                        </FormItem>
                      )} />
                    </div>
                  </section>

                  <Separator />

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Internet</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <FormField control={form.control} name="show_on_website" render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="text-xs font-normal">Exibir no Site</FormLabel>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="highlight_web" render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="text-xs font-normal">Destaque Web</FormLabel>
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="has_income" render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="text-xs font-normal">Imóvel c/ Renda</FormLabel>
                        </FormItem>
                      )} />
                    </div>
                  </section>

                  <Separator />

                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações</h3>
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Obs.</FormLabel>
                        <FormControl><Textarea rows={3} className="text-sm" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </section>

                  {isNew && (
                    <>
                      <Separator />
                      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                        💡 <strong>Chaveiros</strong> podem ser adicionados após o cadastro, na página de detalhes do imóvel.
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Salvando..." : property ? "Salvar Alterações" : "Cadastrar Imóvel"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
