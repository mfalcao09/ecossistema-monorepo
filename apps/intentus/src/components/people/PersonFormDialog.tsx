import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  personSchema,
  PersonFormValues,
  personTypeLabels,
  entityTypeLabels,
  brazilianStates,
  defaultPersonValues,
  maritalStatusLabels,
  marriageRegimeLabels,
  notificationPreferenceLabels,
  creditAnalysisStatusLabels,
} from "@/lib/personSchema";
import type { Person } from "@/hooks/usePeople";
import { useFormCustomization } from "@/hooks/useFormCustomization";
import { useCnpjQuery } from "@/hooks/useCnpjQuery";
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
import { formatCep, fetchAddressByCep } from "@/lib/cepUtils";
import { formatCpfCnpj } from "@/lib/cpfCnpjValidation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface PersonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person?: Person | null;
  onSubmit: (values: PersonFormValues) => void;
  isPending: boolean;
}

export function PersonFormDialog({
  open, onOpenChange, person, onSubmit, isPending,
}: PersonFormDialogProps) {
  const numberInputRef = useRef<HTMLInputElement>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const { config } = useFormCustomization();
  const { query: queryCnpj, isLoading: cnpjLoading } = useCnpjQuery();
  const hidden = config.person_hidden_fields;

  const allTypeLabels: Record<string, string> = {
    ...personTypeLabels,
    ...Object.fromEntries(config.person_extra_types.map((t) => [t.key, t.label])),
  };

  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personSchema),
    defaultValues: person
      ? {
          name: person.name,
          person_type: person.person_type,
          entity_type: (person as any).entity_type ?? "pf",
          cpf_cnpj: person.cpf_cnpj ?? "",
          rg: person.rg ?? "",
          rg_issuer: (person as any).rg_issuer ?? "",
          date_of_birth: person.date_of_birth ?? "",
          email: person.email ?? "",
          email_billing: (person as any).email_billing ?? "",
          phone: person.phone ?? "",
          phone2: person.phone2 ?? "",
          whatsapp: (person as any).whatsapp ?? "",
          notification_preference: (person as any).notification_preference ?? "email",
          zip_code: person.zip_code ?? "",
          street: person.street ?? "",
          number: person.number ?? "",
          complement: person.complement ?? "",
          neighborhood: person.neighborhood ?? "",
          city: person.city ?? "",
          state: person.state ?? "",
          notes: person.notes ?? "",
          legal_representative_name: (person as any).legal_representative_name ?? "",
          legal_representative_cpf: (person as any).legal_representative_cpf ?? "",
          marital_status: (person as any).marital_status ?? "",
          marriage_regime: (person as any).marriage_regime ?? "",
          profession: (person as any).profession ?? "",
          nationality: (person as any).nationality ?? "Brasileira",
          natural_from: (person as any).natural_from ?? "",
          bank_name: (person as any).bank_name ?? "",
          bank_agency: (person as any).bank_agency ?? "",
          bank_account: (person as any).bank_account ?? "",
          bank_account_type: (person as any).bank_account_type ?? "",
          pix_key: (person as any).pix_key ?? "",
          inscricao_estadual: (person as any).inscricao_estadual ?? "",
          inscricao_municipal: (person as any).inscricao_municipal ?? "",
          cnae: (person as any).cnae ?? "",
          lgpd_consent_date: (person as any).lgpd_consent_date ?? "",
          lgpd_consent_ip: (person as any).lgpd_consent_ip ?? "",
          credit_analysis_status: (person as any).credit_analysis_status ?? "",
          credit_analysis_date: (person as any).credit_analysis_date ?? "",
        }
      : defaultPersonValues,
  });

  const handleSubmit = (values: PersonFormValues) => {
    const cleaned = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === "" ? null : v])
    ) as unknown as PersonFormValues;
    onSubmit(cleaned);
  };

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
      setTimeout(() => numberInputRef.current?.focus(), 100);
    } else {
      toast.error("CEP não encontrado.");
    }
  }, [form]);

  const isVisible = (key: string) => !hidden.includes(key);

  const anyAddressVisible = ["zip_code", "street", "number", "complement", "neighborhood", "city", "state"].some(isVisible);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {person ? "Editar Pessoa" : "Nova Pessoa"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Dados Pessoais */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Dados Pessoais
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Nome completo *</FormLabel>
                      <FormControl><Input placeholder="Nome da pessoa" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="person_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.entries(allTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="entity_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Natureza Jurídica *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.entries(entityTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isVisible("date_of_birth") && (
                  <FormField
                    control={form.control}
                    name="date_of_birth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="cpf_cnpj"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        CPF / CNPJ
                        {cnpjLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="000.000.000-00"
                          maxLength={18}
                          value={field.value}
                          onChange={(e) => field.onChange(formatCpfCnpj(e.target.value))}
                          onBlur={async () => {
                            const digits = (field.value || "").replace(/\D/g, "");
                            if (digits.length === 14) {
                              const result = await queryCnpj(digits);
                              if (result) {
                                form.setValue("name", result.razao_social || form.getValues("name"));
                                form.setValue("entity_type", "pj");
                                if (result.email) form.setValue("email", result.email);
                                if (result.telefone) form.setValue("phone", result.telefone);
                                if (result.endereco) {
                                  if (result.endereco.logradouro) form.setValue("street", result.endereco.logradouro);
                                  if (result.endereco.numero) form.setValue("number", result.endereco.numero);
                                  if (result.endereco.complemento) form.setValue("complement", result.endereco.complemento);
                                  if (result.endereco.bairro) form.setValue("neighborhood", result.endereco.bairro);
                                  if (result.endereco.municipio) form.setValue("city", result.endereco.municipio);
                                  if (result.endereco.uf) form.setValue("state", result.endereco.uf);
                                  if (result.endereco.cep) form.setValue("zip_code", formatCep(result.endereco.cep));
                                }
                                toast.success("Dados do CNPJ preenchidos automaticamente!");
                              }
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isVisible("rg") && (
                  <FormField
                    control={form.control}
                    name="rg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RG</FormLabel>
                        <FormControl><Input placeholder="00.000.000-0" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {isVisible("rg") && (
                  <FormField
                    control={form.control}
                    name="rg_issuer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Órgão Emissor</FormLabel>
                        <FormControl><Input placeholder="SSP/SP" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            <Separator />

            {/* Qualificação Legal (PF) */}
            {form.watch("entity_type") === "pf" && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Qualificação Legal
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="profession" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profissão</FormLabel>
                        <FormControl><Input placeholder="Ex: Engenheiro" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="nationality" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nacionalidade</FormLabel>
                        <FormControl><Input placeholder="Brasileira" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="natural_from" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Naturalidade</FormLabel>
                        <FormControl><Input placeholder="Ex: São Paulo/SP" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="marital_status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado Civil</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            {Object.entries(maritalStatusLabels).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    {(form.watch("marital_status") === "casado" || form.watch("marital_status") === "uniao_estavel") && (
                      <FormField control={form.control} name="marriage_regime" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Regime de Bens</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {Object.entries(marriageRegimeLabels).map(([v, l]) => (
                                <SelectItem key={v} value={v}>{l}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Dados Empresariais (PJ) */}
            {form.watch("entity_type") === "pj" && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Dados Empresariais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="inscricao_estadual" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inscrição Estadual</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="inscricao_municipal" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inscrição Municipal</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="cnae" render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNAE Principal</FormLabel>
                        <FormControl><Input placeholder="00.00-0-00" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </div>
                <Separator />
              </>
            )}

            <Separator />

            {/* Contato */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Contato
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="email@exemplo.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {isVisible("phone2") && (
                  <FormField
                    control={form.control}
                    name="phone2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone 2</FormLabel>
                        <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField control={form.control} name="email_billing" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Faturamento</FormLabel>
                    <FormControl><Input type="email" placeholder="financeiro@empresa.com" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="whatsapp" render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="notification_preference" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferência de Notificação</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "email"}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(notificationPreferenceLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
            </div>

            {anyAddressVisible && (
              <>
                <Separator />
                {/* Endereço */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Endereço
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {isVisible("zip_code") && (
                      <FormField
                        control={form.control}
                        name="zip_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="00000-000"
                                maxLength={9}
                                value={field.value}
                                onChange={(e) => field.onChange(formatCep(e.target.value))}
                                onBlur={handleCepBlur}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCepBlur(); } }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {isVisible("street") && (
                      <FormField
                        control={form.control}
                        name="street"
                        render={({ field }) => (
                          <FormItem className="md:col-span-3">
                            <FormLabel>Rua</FormLabel>
                            <FormControl><Input placeholder="Nome da rua" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {isVisible("number") && (
                      <FormField
                        control={form.control}
                        name="number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input placeholder="123" {...field} ref={(el) => {
                                field.ref(el);
                                (numberInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                              }} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {isVisible("complement") && (
                      <FormField
                        control={form.control}
                        name="complement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complemento</FormLabel>
                            <FormControl><Input placeholder="Apto 101" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {isVisible("neighborhood") && (
                      <FormField
                        control={form.control}
                        name="neighborhood"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl><Input placeholder="Bairro" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {isVisible("city") && (
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl><Input placeholder="Cidade" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {isVisible("state") && (
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>UF</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger></FormControl>
                              <SelectContent>
                                {brazilianStates.map((uf) => (
                                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Dados Bancários */}
            <Separator />
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Dados Bancários
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="bank_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banco</FormLabel>
                    <FormControl><Input placeholder="Ex: Bradesco" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="bank_agency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agência</FormLabel>
                    <FormControl><Input placeholder="0001" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="bank_account" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta</FormLabel>
                    <FormControl><Input placeholder="12345-6" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="bank_account_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Conta</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="corrente">Corrente</SelectItem>
                        <SelectItem value="poupanca">Poupança</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="pix_key" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Chave PIX</FormLabel>
                    <FormControl><Input placeholder="CPF, Email, Telefone ou Aleatória" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Compliance / LGPD */}
            <Separator />
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Compliance & LGPD
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="credit_analysis_status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Análise de Crédito</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.entries(creditAnalysisStatusLabels).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="credit_analysis_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data da Análise</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="lgpd_consent_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consentimento LGPD</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="lgpd_consent_ip" render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP do Consentimento</FormLabel>
                    <FormControl><Input placeholder="Ex: 192.168.1.1" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

            {isVisible("notes") && (
              <>
                <Separator />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Anotações sobre esta pessoa..." className="min-h-[80px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : person ? "Atualizar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
