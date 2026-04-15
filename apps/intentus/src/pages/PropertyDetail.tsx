import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useProperty, useUpdateProperty, usePropertyFeatures, useSavePropertyFeatures,
  usePropertyMedia, useUploadPropertyImage, useDeletePropertyImage,
  usePropertyAttachments, useUploadPropertyAttachment, useDeletePropertyAttachment,
  usePropertyOwners, useAddPropertyOwner, useRemovePropertyOwner,
  usePropertyKeys, useAddPropertyKey, useDeletePropertyKey,
  useUpdateIntakeStatus, useUpdatePublishedPortals,
} from "@/hooks/useProperties";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import { usePeople } from "@/hooks/usePeople";
import { formatCep, fetchAddressByCep } from "@/lib/cepUtils";
import {
  propertySchema, type PropertyFormValues, defaultPropertyValues,
  propertyTypeLabels, propertyPurposeLabels, propertyStatusLabels, brazilianStates,
  propertyStatusColors,
} from "@/lib/propertySchema";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import {
  ArrowLeft, ArrowRight, Save, Building2, ChevronDown, ChevronUp, Image, MapPin, Key, Users, FileText, Clock, Plus, Trash2, Loader2, Download, File, TrendingUp, Globe, FolderOpen,
} from "lucide-react";
import { PropertyDocumentsTab } from "@/components/properties/PropertyDocumentsTab";
import {
  intakeStatusLabels, intakeStatusColors, intakePrevStage, intakeNextStage, portalOptions,
} from "@/lib/intakeStatus";

import { useFormCustomization } from "@/hooks/useFormCustomization";

function CollapsibleSection({ title, icon: Icon, defaultOpen = false, children }: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3 px-4 flex flex-row items-center justify-between hover:bg-muted/50 transition-colors">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              {title}
            </CardTitle>
            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// fetchAddressByCep moved to @/lib/cepUtils

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { config: formConfig } = useFormCustomization();
  const { data: property, isLoading } = useProperty(id);
  const { data: features } = usePropertyFeatures(id);
  const { data: media } = usePropertyMedia(id);
  const { data: attachments } = usePropertyAttachments(id);
  const { data: owners } = usePropertyOwners(id);
  const { data: keys } = usePropertyKeys(id);
  const { data: allPeople } = usePeople();
  const { data: priceHistory } = usePriceHistory(id);
  const updateProp = useUpdateProperty();
  const saveFeatures = useSavePropertyFeatures();
  const uploadImage = useUploadPropertyImage();
  const deleteImage = useDeletePropertyImage();
  const uploadAttachment = useUploadPropertyAttachment();
  const deleteAttachment = useDeletePropertyAttachment();
  const addOwner = useAddPropertyOwner();
  const removeOwner = useRemovePropertyOwner();
  const addKey = useAddPropertyKey();
  const deleteKey = useDeletePropertyKey();
  const updateIntake = useUpdateIntakeStatus();
  const updatePortals = useUpdatePublishedPortals();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);

  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [selectedCondoFeatures, setSelectedCondoFeatures] = useState<string[]>([]);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [newKeyCode, setNewKeyCode] = useState("");
  const [newKeyType, setNewKeyType] = useState("comum");
  const [newKeyLocation, setNewKeyLocation] = useState("");
  const [showKeyForm, setShowKeyForm] = useState(false);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: defaultPropertyValues,
  });

  useEffect(() => {
    if (property) {
      form.reset({
        title: property.title,
        property_code: property.property_code ?? "",
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
        region: property.region ?? "",
        rooms: property.rooms ?? 0,
        suites: property.suites ?? 0,
        bathrooms: property.bathrooms ?? 0,
        parking_spots: property.parking_spots ?? 0,
        area_total: property.area_total ?? undefined,
        area_built: property.area_built ?? undefined,
        private_area: property.private_area ?? undefined,
        industrial_area: property.industrial_area ?? undefined,
        ceiling_height: property.ceiling_height ?? undefined,
        docks: property.docks ?? 0,
        sale_price: property.sale_price ?? undefined,
        rental_price: property.rental_price ?? undefined,
        condominium_fee: property.condominium_fee ?? undefined,
        iptu: property.iptu ?? undefined,
        accepts_exchange: property.accepts_exchange ?? false,
        exchange_value: property.exchange_value ?? undefined,
        show_on_website: property.show_on_website ?? true,
        highlight_web: property.highlight_web ?? false,
        has_sign: property.has_sign ?? false,
        has_income: property.has_income ?? false,
        description: property.description ?? "",
        development_id: property.development_id ?? "",
      });
    }
  }, [property, form]);

  useEffect(() => {
    if (features) {
      const featureNames = features.map((f) => f.feature_name);
      setSelectedFeatures(featureNames.filter((f) => formConfig.property_features.includes(f)));
      setSelectedCondoFeatures(featureNames.filter((f) => formConfig.condo_features.includes(f)));
    }
  }, [features]);

  const handleCepBlur = useCallback(async () => {
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
      // Focus on number field
      setTimeout(() => numberInputRef.current?.focus(), 100);
    } else {
      toast.error("CEP não encontrado.");
    }
  }, [form]);

  function toggleFeature(feat: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(feat) ? list.filter((f) => f !== feat) : [...list, feat]);
  }

  function handleSave(values: PropertyFormValues) {
    if (!id) return;
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(values)) {
      cleaned[key] = val === "" || val === undefined ? null : val;
    }
    updateProp.mutate({ id, ...cleaned } as any, {
      onSuccess: () => {
        saveFeatures.mutate({
          propertyId: id,
          features: [...selectedFeatures, ...selectedCondoFeatures],
        });
      },
    });
  }

  const ownerIds = owners?.map((o) => o.person_id) ?? [];
  const availablePeople = allPeople?.filter((p) => !ownerIds.includes(p.id)) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] rounded-xl" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Imóvel não encontrado.</p>
        <Button variant="outline" className="mt-3" onClick={() => navigate("/imoveis")}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/imoveis")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-bold font-[var(--font-display)]">
            Imóvel {property.property_code || property.title}
          </h1>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <Badge variant="secondary" className={propertyStatusColors[property.status] ?? ""}>
            {propertyStatusLabels[property.status] ?? property.status}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {propertyPurposeLabels[property.purpose] ?? property.purpose}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {propertyTypeLabels[property.property_type] ?? property.property_type}
          </Badge>
        </div>
        <div className="ml-auto">
          <Button onClick={form.handleSubmit(handleSave)} disabled={updateProp.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {updateProp.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Main layout: content + sidebar */}
      <div className="flex gap-4">
        {/* Left: main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Tabs Card */}
          <Card>
            <CardHeader className="pb-0 px-4 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" /> Dados do Imóvel
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSave)}>
                  <Tabs defaultValue="imovel" className="mt-2">
                    <TabsList className="mb-4">
                      <TabsTrigger value="imovel">Imóvel</TabsTrigger>
                      <TabsTrigger value="detalhes">Detalhes do Imóvel</TabsTrigger>
                      <TabsTrigger value="outros">Outros</TabsTrigger>
                      <TabsTrigger value="documentos"><FolderOpen className="h-3.5 w-3.5 mr-1" />Documentos</TabsTrigger>
                    </TabsList>

                    {/* ─── Tab: Imóvel ─── */}
                    <TabsContent value="imovel" className="space-y-5">
                      {/* Dados Principais */}
                      <section className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <FormField control={form.control} name="property_code" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Código</FormLabel>
                              <FormControl><Input className="h-8 text-sm" {...field} /></FormControl>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="status" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Status</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{Object.entries(propertyStatusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="property_type" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Categoria</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{Object.entries(propertyTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="purpose" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Finalidade</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{Object.entries(propertyPurposeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                        </div>
                      </section>

                      <Separator />

                      {/* Endereço - CEP primeiro */}
                      <section className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <FormField control={form.control} name="zip_code" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">CEP</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    className="h-8 text-sm"
                                    placeholder="00000-000"
                                    maxLength={9}
                                    value={field.value}
                                    onChange={(e) => {
                                      field.onChange(formatCep(e.target.value));
                                    }}
                                    onBlur={(e) => {
                                      field.onBlur();
                                      handleCepBlur();
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleCepBlur();
                                      }
                                    }}
                                  />
                                  {cepLoading && <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-2 top-2 text-muted-foreground" />}
                                </div>
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
                              <FormLabel className="text-xs">Nº</FormLabel>
                              <FormControl><Input className="h-8 text-sm" {...field} ref={(el) => {
                                field.ref(el);
                                (numberInputRef as any).current = el;
                              }} /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <FormField control={form.control} name="complement" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Unidade/Compl.</FormLabel>
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
                              <FormLabel className="text-xs">Cidade</FormLabel>
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
                        {!formConfig.hidden_fields.includes("region") && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <FormField control={form.control} name="region" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Região</FormLabel>
                                <FormControl><Input className="h-8 text-sm" {...field} /></FormControl>
                              </FormItem>
                            )} />
                          </div>
                        )}
                      </section>

                      <Separator />

                      {/* Título e Descrição */}
                      <section className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Título e Descrição</h4>
                        <FormField control={form.control} name="title" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Título para Site e Portais</FormLabel>
                            <FormControl><Input className="h-8 text-sm" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="description" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Descrição Site</FormLabel>
                            <FormControl><Textarea rows={4} className="text-sm" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </section>

                      <Separator />

                      {/* Valores */}
                      <section className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valores</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <FormField control={form.control} name="rental_price" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">$ Locação</FormLabel>
                              <FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="sale_price" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">$ Venda</FormLabel>
                              <FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="condominium_fee" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">$ Condomínio</FormLabel>
                              <FormControl><Input className="h-8 text-sm" type="number" step="0.01" min={0} {...field} value={field.value ?? ""} /></FormControl>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name="iptu" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">$ IPTU a.m</FormLabel>
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

                    {/* ─── Tab: Detalhes do Imóvel ─── */}
                    <TabsContent value="detalhes" className="space-y-5">
                      <section className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Características Comuns · Condomínio</h4>
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
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Características do Imóvel</h4>
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
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metragens / Terreno</h4>
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
                    </TabsContent>

                    {/* ─── Tab: Outros ─── */}
                    <TabsContent value="outros" className="space-y-5">
                      <section className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Divulgação</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {!formConfig.hidden_fields.includes("has_sign") && (
                            <FormField control={form.control} name="has_sign" render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel className="text-xs font-normal">Tem Placa</FormLabel>
                              </FormItem>
                            )} />
                          )}
                        </div>
                      </section>
                      <Separator />
                      <section className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Internet</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <FormField control={form.control} name="show_on_website" render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              <FormLabel className="text-xs font-normal">Exibir no Site</FormLabel>
                            </FormItem>
                          )} />
                          {!formConfig.hidden_fields.includes("highlight_web") && (
                            <FormField control={form.control} name="highlight_web" render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel className="text-xs font-normal">Destaque Web</FormLabel>
                              </FormItem>
                            )} />
                          )}
                          {!formConfig.hidden_fields.includes("has_income") && (
                            <FormField control={form.control} name="has_income" render={({ field }) => (
                              <FormItem className="flex items-center gap-2 space-y-0">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel className="text-xs font-normal">Imóvel c/ Renda</FormLabel>
                              </FormItem>
                            )} />
                          )}
                        </div>
                      </section>
                      <Separator />
                      <section className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Observações</h4>
                        <FormField control={form.control} name="description" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Obs.</FormLabel>
                            <FormControl><Textarea rows={4} className="text-sm" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </section>
                    </TabsContent>

                    {/* ─── Tab: Documentos ─── */}
                    <TabsContent value="documentos">
                      {id && <PropertyDocumentsTab propertyId={id} />}
                    </TabsContent>
                  </Tabs>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Galeria de Imagens */}
          <CollapsibleSection title="Galeria de Imagens" icon={Image} defaultOpen={true}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (!id || !e.target.files) return;
                Array.from(e.target.files).forEach((file) => {
                  uploadImage.mutate({ propertyId: id, file });
                });
                e.target.value = "";
              }}
            />
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadImage.isPending}>
                  {uploadImage.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                  Adicionar fotos
                </Button>
              </div>
              {media && media.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {media.map((m) => (
                    <div key={m.id} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
                      <img src={m.media_url} alt={m.caption ?? "Foto do imóvel"} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-1 right-1 bg-destructive/80 text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteImage.mutate({ mediaId: m.id, mediaUrl: m.media_url, propertyId: id! })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Nenhuma imagem cadastrada. Clique em "Adicionar fotos" para enviar.
                </div>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Localização" icon={MapPin}>
            {property.street || property.city ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {[property.street, property.number, property.neighborhood, property.city, property.state].filter(Boolean).join(", ")}
                </p>
                <div className="rounded-md overflow-hidden border aspect-video">
                  <iframe
                    title="Mapa do imóvel"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${encodeURIComponent(
                      [property.street, property.number, property.neighborhood, property.city, property.state].filter(Boolean).join(", ")
                    )}&output=embed`}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Endereço não informado.
              </div>
            )}
          </CollapsibleSection>

          {/* Proprietário */}
          <CollapsibleSection title="Proprietário" icon={Users}>
            <div className="space-y-3">
              <div className="flex justify-end">
                <Popover open={ownerPopoverOpen} onOpenChange={setOwnerPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" disabled={addOwner.isPending}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Vincular proprietário
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Buscar pessoa..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma pessoa encontrada.</CommandEmpty>
                        <CommandGroup>
                          {availablePeople.map((p) => (
                            <CommandItem
                              key={p.id}
                              onSelect={() => {
                                addOwner.mutate({ propertyId: id!, personId: p.id });
                                setOwnerPopoverOpen(false);
                              }}
                            >
                              <div>
                                <p className="text-sm font-medium">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.cpf_cnpj || p.email || p.phone || "—"}</p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {owners && owners.length > 0 ? (
                <div className="space-y-2">
                  {owners.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between border rounded-md p-2.5">
                      <div>
                        <p className="text-sm font-medium">{o.people?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {[o.people?.cpf_cnpj, o.people?.phone, o.people?.email].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeOwner.mutate({ id: o.id, propertyId: id! })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Nenhum proprietário vinculado.
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Anexos */}
          <CollapsibleSection title="Anexos" icon={FileText}>
            <input
              ref={attachmentInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
              multiple
              className="hidden"
              onChange={(e) => {
                if (!id || !e.target.files) return;
                Array.from(e.target.files).forEach((file) => {
                  uploadAttachment.mutate({ propertyId: id, file });
                });
                e.target.value = "";
              }}
            />
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => attachmentInputRef.current?.click()} disabled={uploadAttachment.isPending}>
                  {uploadAttachment.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                  Adicionar anexo
                </Button>
              </div>
              {attachments && attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between border rounded-md p-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <File className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{a.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(a.file_size)} · {format(new Date(a.created_at), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                          <a href={a.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteAttachment.mutate({ id: a.id, fileUrl: a.file_url, propertyId: id! })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Nenhum anexo cadastrado.
                </div>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Chaveiros" icon={Key}>
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setShowKeyForm(!showKeyForm)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Cadastrar chave
                </Button>
              </div>
              {showKeyForm && (
                <div className="border rounded-md p-3 space-y-3 bg-muted/30">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Número/Código *</label>
                      <Input className="h-8 text-sm mt-1" placeholder="Ex: 001" value={newKeyCode} onChange={(e) => setNewKeyCode(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Tipo</label>
                      <Select value={newKeyType} onValueChange={setNewKeyType}>
                        <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="comum">Comum</SelectItem>
                          <SelectItem value="tetra">Tetra</SelectItem>
                          <SelectItem value="codificada">Codificada</SelectItem>
                          <SelectItem value="controle">Controle remoto</SelectItem>
                          <SelectItem value="tag">Tag/Cartão</SelectItem>
                          <SelectItem value="digital">Digital</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Localização</label>
                      <Input className="h-8 text-sm mt-1" placeholder="Ex: Portaria" value={newKeyLocation} onChange={(e) => setNewKeyLocation(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setShowKeyForm(false); setNewKeyCode(""); setNewKeyLocation(""); }}>Cancelar</Button>
                    <Button size="sm" disabled={!newKeyCode.trim() || addKey.isPending} onClick={() => {
                      addKey.mutate({ property_id: id!, key_code: newKeyCode.trim(), key_type: newKeyType, location: newKeyLocation.trim() || undefined }, {
                        onSuccess: () => { setNewKeyCode(""); setNewKeyLocation(""); setNewKeyType("comum"); setShowKeyForm(false); },
                      });
                    }}>
                      {addKey.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                      Salvar
                    </Button>
                  </div>
                </div>
              )}
              {keys && keys.length > 0 ? (
                <div className="space-y-2">
                  {keys.map((k: any) => (
                    <div key={k.id} className="flex items-center justify-between border rounded-md p-2.5">
                      <div className="flex items-center gap-3">
                        <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium">Chave {k.key_code}</p>
                          <p className="text-xs text-muted-foreground">
                            {[k.key_type, k.location].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteKey.mutate({ id: k.id, propertyId: id! })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                !showKeyForm && (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    Nenhuma chave cadastrada.
                  </div>
                )
              )}
            </div>
          </CollapsibleSection>
        </div>

        {/* Right Sidebar */}
        <div className="hidden lg:block w-[320px] shrink-0 space-y-4">
          {/* Intake Workflow (Item 2) */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Captação
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <Badge className={(intakeStatusColors as any)[(property as any).intake_status] || ""}>
                {(intakeStatusLabels as any)[(property as any).intake_status] || "Captado"}
              </Badge>
              {(() => {
                const currentStage = (property as any).intake_status || "captado";
                const prev = intakePrevStage[currentStage];
                const next = intakeNextStage[currentStage];
                return (prev || next) ? (
                  <div className="flex gap-1.5">
                    {prev && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        title={`Voltar para ${intakeStatusLabels[prev]}`}
                        onClick={() => id && updateIntake.mutate({ id, intake_status: prev })}
                        disabled={updateIntake.isPending}
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {next && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        title={`Avançar para ${intakeStatusLabels[next]}`}
                        onClick={() => id && updateIntake.mutate({ id, intake_status: next })}
                        disabled={updateIntake.isPending}
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ) : null;
              })()}
            </CardContent>
          </Card>

          {/* Portals (Item 11) */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Publicação em Portais
              </CardTitle>
            </CardHeader>
             <CardContent className="px-4 pb-4 space-y-2">
              {portalOptions.map((portal) => {
                const currentPortals = ((property as any).published_portals || []) as string[];
                const isSitePublico = portal.value === "site_proprio";
                // Site Público is driven by show_on_website / intake_status "publicado"
                const isActive = isSitePublico
                  ? property.show_on_website === true
                  : currentPortals.includes(portal.value);
                return (
                  <div key={portal.value} className="flex items-center gap-2">
                    <Checkbox
                      checked={isActive}
                      onCheckedChange={(checked) => {
                        if (isSitePublico) {
                          // Toggle show_on_website + intake_status
                          if (checked) {
                            // Mark as publicado and show on website
                            if (id) {
                              updateIntake.mutate({ id, intake_status: "publicado" });
                            }
                          } else {
                            // Remove from public site, revert to aprovado
                            if (id) {
                              updateProp.mutate({ id, show_on_website: false } as any);
                              updateIntake.mutate({ id, intake_status: "aprovado" });
                            }
                          }
                        } else {
                          const newPortals = checked
                            ? [...currentPortals, portal.value]
                            : currentPortals.filter((p: string) => p !== portal.value);
                          if (id) updatePortals.mutate({ id, portals: newPortals });
                        }
                      }}
                    />
                    <span className="text-xs">{portal.label}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Price History (Item 14) */}
          {priceHistory && priceHistory.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Histórico de Preços
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-2">
                  {priceHistory.slice(0, 5).map((h: any) => (
                    <div key={h.id} className="text-xs border-l-2 border-border pl-3 pb-2">
                      <p className="text-muted-foreground">{format(new Date(h.changed_at), "dd/MM/yyyy")}</p>
                      <p className="font-medium">
                        {h.price_type === "sale_price" ? "Venda" : "Locação"}:{" "}
                        <span className="text-muted-foreground line-through">
                          {h.old_value ? `R$ ${Number(h.old_value).toLocaleString("pt-BR")}` : "—"}
                        </span>
                        {" → "}
                        <span className="text-primary font-bold">
                          R$ {Number(h.new_value).toLocaleString("pt-BR")}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Agenda do Imóvel
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <Calendar
                mode="single"
                selected={calendarDate}
                onSelect={(d) => d && setCalendarDate(d)}
                locale={ptBR}
                className="w-full"
              />
              <div className="text-center text-xs text-muted-foreground mt-2 px-2">
                Nenhum evento para {format(calendarDate, "dd/MM/yyyy")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xs text-muted-foreground">
                <p className="mb-2">{format(new Date(property.created_at), "dd/MM/yyyy")}</p>
                <div className="border-l-2 border-border pl-3 pb-3">
                  <p className="font-medium text-foreground">Imóvel cadastrado</p>
                  <p className="text-muted-foreground">Cadastro inicial do imóvel no sistema.</p>
                </div>
                {property.updated_at !== property.created_at && (
                  <>
                    <p className="mb-2 mt-3">{format(new Date(property.updated_at), "dd/MM/yyyy")}</p>
                    <div className="border-l-2 border-border pl-3 pb-3">
                      <p className="font-medium text-foreground">Última atualização</p>
                      <p className="text-muted-foreground">Dados do imóvel foram atualizados.</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
