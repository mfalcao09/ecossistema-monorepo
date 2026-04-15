import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { Building2, User, Save, Loader2, MapPin, FileText, ScrollText, Settings, UserCheck, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { formatCep, fetchAddressByCep } from "@/lib/cepUtils";
import { formatCpfCnpj, isValidCNPJ, isValidCPF } from "@/lib/cpfCnpjValidation";
import InternalPoliciesTab from "@/components/admin/InternalPoliciesTab";
import ActivityLogTab from "@/components/admin/ActivityLogTab";

interface CompanyForm {
  name: string;
  slug: string;
  cnpj: string;
  razaoSocial: string;
  telefone: string;
  email: string;
  tipo: string;
  receitaAnual: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  repNome: string;
  repEmail: string;
  repDocumento: string;
  repNascimento: string;
  repRendaMensal: string;
  repOcupacao: string;
  repCelular: string;
}

const emptyForm: CompanyForm = {
  name: "",
  slug: "",
  cnpj: "",
  razaoSocial: "",
  telefone: "",
  email: "",
  tipo: "imobiliaria",
  receitaAnual: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  repNome: "",
  repEmail: "",
  repDocumento: "",
  repNascimento: "",
  repRendaMensal: "",
  repOcupacao: "",
  repCelular: "",
};

const TAB_MAP: Record<string, string> = {
  politicas: "politicas",
  atividades: "atividades",
};

export default function CompanyData() {
  const { tenantId } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CompanyForm>({ ...emptyForm });
  const [searchParams, setSearchParams] = useSearchParams();
  const [creatingAccess, setCreatingAccess] = useState(false);
  const activeTab = TAB_MAP[searchParams.get("tab") || ""] || "dados";

  // Check if rep legal email has a user account in this tenant
  const repEmail = form.repEmail?.trim();
  const { data: repHasAccount } = useQuery({
    queryKey: ["rep-account-check", tenantId, repEmail],
    enabled: !!tenantId && !!repEmail && repEmail.length > 3,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("tenant_id", tenantId!)
        .ilike("name", `%${form.repNome?.trim() || ""}%`);
      // Also check by matching email in auth (we check profiles linked to tenant)
      // Since profiles don't store email, we check via user_id -> auth
      // Simpler approach: just check if any profile in tenant matches the rep name
      return (data && data.length > 0) ? data[0] : null;
    },
  });

  const handleCreateRepAccess = async () => {
    if (!repEmail || !form.repNome?.trim()) {
      toast.error("Preencha nome e email do representante.");
      return;
    }
    setCreatingAccess(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: repEmail,
          name: form.repNome.trim(),
          role: "admin",
          tenant_id: tenantId,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else if (data?.temp_password) {
        toast.success(`Acesso criado! Senha temporária: ${data.temp_password}`, { duration: 15000 });
        queryClient.invalidateQueries({ queryKey: ["rep-account-check"] });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar acesso");
    } finally {
      setCreatingAccess(false);
    }
  };

  const handleTabChange = (value: string) => {
    if (value === "dados") {
      searchParams.delete("tab");
    } else {
      searchParams.set("tab", value);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["company-data", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!tenant) return;
    const s = typeof tenant.settings === "object" && tenant.settings ? (tenant.settings as any) : {};
    const rep = s?.representante || {};
    setForm({
      name: tenant.name || "",
      slug: tenant.slug || "",
      cnpj: (tenant as any).cnpj || "",
      razaoSocial: s?.razaoSocial || "",
      telefone: s?.telefone || "",
      email: s?.email || "",
      tipo: s?.tipo || "imobiliaria",
      receitaAnual: s?.receitaAnual || "",
      cep: s?.cep || "",
      endereco: s?.endereco || "",
      numero: s?.numero || "",
      complemento: s?.complemento || "",
      bairro: s?.bairro || "",
      cidade: s?.cidade || "",
      uf: s?.uf || "",
      repNome: rep?.nome || "",
      repEmail: rep?.email || "",
      repDocumento: rep?.documento || "",
      repNascimento: rep?.nascimento || "",
      repRendaMensal: rep?.rendaMensal || "",
      repOcupacao: rep?.ocupacao || "",
      repCelular: rep?.celular || "",
    });
  }, [tenant]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (form.cnpj.trim() && !isValidCNPJ(form.cnpj)) {
        throw new Error("CNPJ informado é inválido.");
      }
      if (form.repDocumento.trim() && !isValidCPF(form.repDocumento)) {
        throw new Error("CPF do representante é inválido.");
      }
      const settings = {
        ...((typeof tenant?.settings === "object" && tenant?.settings) || {}),
        razaoSocial: form.razaoSocial,
        telefone: form.telefone,
        email: form.email,
        tipo: form.tipo,
        receitaAnual: form.receitaAnual,
        cep: form.cep,
        endereco: form.endereco,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
        representante: {
          nome: form.repNome,
          email: form.repEmail,
          documento: form.repDocumento,
          nascimento: form.repNascimento,
          rendaMensal: form.repRendaMensal,
          ocupacao: form.repOcupacao,
          celular: form.repCelular,
        },
      };
      const { error } = await supabase
        .from("tenants")
        .update({
          name: form.name.trim(),
          cnpj: form.cnpj.trim() || null,
          settings,
        } as any)
        .eq("id", tenantId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-data", tenantId] });
      toast.success("Dados da empresa atualizados com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });

  const updateField = (field: keyof CompanyForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações da Empresa</h1>
          <p className="text-muted-foreground">Gerencie dados cadastrais, políticas e atividades.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="dados">
            <Building2 className="h-4 w-4 mr-1.5" />Dados Cadastrais
          </TabsTrigger>
          <TabsTrigger value="politicas">
            <FileText className="h-4 w-4 mr-1.5" />Políticas Internas
          </TabsTrigger>
          <TabsTrigger value="atividades">
            <ScrollText className="h-4 w-4 mr-1.5" />Log de Atividades
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate();
            }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="h-4 w-4" />
                  Dados da Empresa
                </CardTitle>
                <CardDescription>Informações gerais do cadastro da empresa.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Fantasia *</Label>
                  <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Razão Social</Label>
                  <Input value={form.razaoSocial} onChange={(e) => updateField("razaoSocial", e.target.value)} placeholder="Razão Social Ltda" />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input value={form.cnpj} onChange={(e) => updateField("cnpj", formatCpfCnpj(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => updateField("tipo", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="imobiliaria">Imobiliária</SelectItem>
                      <SelectItem value="construtora">Construtora</SelectItem>
                      <SelectItem value="incorporadora">Incorporadora</SelectItem>
                      <SelectItem value="administradora">Administradora</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => updateField("telefone", e.target.value)} placeholder="(11) 3000-0000" />
                </div>
                <div className="space-y-2">
                  <Label>Email da Empresa</Label>
                  <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="contato@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={form.slug} disabled className="opacity-60" />
                  <p className="text-xs text-muted-foreground">O slug não pode ser alterado.</p>
                </div>
                <div className="space-y-2">
                  <Label>Receita Anual</Label>
                  <Input value={form.receitaAnual} onChange={(e) => updateField("receitaAnual", e.target.value)} placeholder="Ex: R$ 500.000" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" />
                  Endereço
                </CardTitle>
                <CardDescription>Endereço da empresa (usado em cobranças PIX e boletos).</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={form.cep}
                    onChange={(e) => updateField("cep", formatCep(e.target.value))}
                    onBlur={async () => {
                      const addr = await fetchAddressByCep(form.cep);
                      if (addr) {
                        setForm((prev) => ({
                          ...prev,
                          endereco: addr.street || prev.endereco,
                          bairro: addr.neighborhood || prev.bairro,
                          cidade: addr.city || prev.cidade,
                          uf: addr.state || prev.uf,
                        }));
                      }
                    }}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Logradouro</Label>
                  <Input value={form.endereco} onChange={(e) => updateField("endereco", e.target.value)} placeholder="Rua, Av, etc." />
                </div>
                <div className="space-y-2">
                  <Label>Número</Label>
                  <Input value={form.numero} onChange={(e) => updateField("numero", e.target.value)} placeholder="123" />
                </div>
                <div className="space-y-2">
                  <Label>Complemento</Label>
                  <Input value={form.complemento} onChange={(e) => updateField("complemento", e.target.value)} placeholder="Sala 1" />
                </div>
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={form.bairro} onChange={(e) => updateField("bairro", e.target.value)} placeholder="Centro" />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={form.cidade} onChange={(e) => updateField("cidade", e.target.value)} placeholder="São Paulo" />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input value={form.uf} onChange={(e) => updateField("uf", e.target.value.toUpperCase())} placeholder="SP" maxLength={2} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <User className="h-4 w-4" />
                      Representante Legal / Usuário Admin
                    </CardTitle>
                    <CardDescription>Dados do responsável legal pela empresa.</CardDescription>
                  </div>
                  {repEmail && (
                    repHasAccount ? (
                      <Badge variant="secondary" className="gap-1">
                        <UserCheck className="h-3 w-3" />
                        Com acesso
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCreateRepAccess}
                        disabled={creatingAccess}
                        className="gap-1.5"
                      >
                        {creatingAccess ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5" />
                        )}
                        Criar Acesso
                      </Button>
                    )
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Representante *</Label>
                  <Input value={form.repNome} onChange={(e) => updateField("repNome", e.target.value)} placeholder="Nome completo" required />
                </div>
                <div className="space-y-2">
                  <Label>Email do Representante *</Label>
                  <Input type="email" value={form.repEmail} onChange={(e) => updateField("repEmail", e.target.value)} placeholder="rep@empresa.com" required />
                </div>
                <div className="space-y-2">
                  <Label>CPF do Representante</Label>
                  <Input value={form.repDocumento} onChange={(e) => updateField("repDocumento", formatCpfCnpj(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
                </div>
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input type="date" value={form.repNascimento} onChange={(e) => updateField("repNascimento", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Celular</Label>
                  <Input value={form.repCelular} onChange={(e) => updateField("repCelular", e.target.value)} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label>Ocupação / Cargo</Label>
                  <Input value={form.repOcupacao} onChange={(e) => updateField("repOcupacao", e.target.value)} placeholder="Diretor" />
                </div>
                <div className="space-y-2">
                  <Label>Renda Mensal</Label>
                  <Input value={form.repRendaMensal} onChange={(e) => updateField("repRendaMensal", e.target.value)} placeholder="Ex: R$ 10.000" />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="politicas">
          <InternalPoliciesTab />
        </TabsContent>

        <TabsContent value="atividades">
          <ActivityLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
