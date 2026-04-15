import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Building2, Check } from "lucide-react";
import { toast } from "sonner";
import { formatCpfCnpj, isValidCNPJ } from "@/lib/cpfCnpjValidation";

interface PlanOption {
  id: string;
  name: string;
  price_monthly: number;
  max_users: number | null;
  max_properties: number | null;
  modules: string[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Onboarding() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>("");

  // Representative legal form fields
  const [form, setForm] = useState({
    repNome: "",
    repEmail: "",
  });

  useEffect(() => {
    supabase
      .from("plans")
      .select("id, name, price_monthly, max_users, max_properties, modules")
      .eq("active", true)
      .gt("price_monthly", 0)
      .order("price_monthly")
      .then(({ data }) => {
        if (data && data.length > 0) {
          const mapped = data.map((p: any) => ({
            ...p,
            modules: Array.isArray(p.modules) ? p.modules : [],
          }));
          setPlans(mapped);
          setSelectedPlan(mapped[0].id);
        }
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe o nome da empresa");
      return;
    }
    if (cnpj.trim() && !isValidCNPJ(cnpj)) {
      toast.error("CNPJ informado é inválido");
      return;
    }
    if (!selectedPlan) {
      toast.error("Selecione um plano");
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Create tenant with plan
      const { data: tenant, error: tErr } = await supabase
        .from("tenants")
        .insert({
          name: name.trim(),
          cnpj: cnpj.trim() || null,
          slug: slug || `org-${Date.now()}`,
          plan_id: selectedPlan,
          settings: form.repNome || form.repEmail ? {
            representante: {
              nome: form.repNome,
              email: form.repEmail,
            },
          } : {},
        } as any)
        .select()
        .single();
      if (tErr) throw tErr;

      // Link profile to tenant
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ tenant_id: tenant.id })
        .eq("user_id", user.id);
      if (pErr) throw pErr;

      // Give user admin role
      await supabase
        .from("user_roles")
        .insert({ user_id: user.id, role: "admin", tenant_id: tenant.id });

      // Create subscription (7 days trial)
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 7);

      await supabase.from("tenant_subscriptions").insert({
        tenant_id: tenant.id,
        plan_id: selectedPlan,
        status: "ativo",
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        notes: "Período de teste - 7 dias",
      });

      // Auto-invite legal representative if email differs from logged-in user
      if (form.repEmail && form.repEmail !== user.email && form.repNome) {
        try {
          const { data: inviteData, error: inviteErr } = await supabase.functions.invoke("invite-user", {
            body: {
              email: form.repEmail,
              name: form.repNome,
              role: "admin",
              tenant_id: tenant.id,
            },
          });
          if (inviteErr) {
            console.error("Rep invite error:", inviteErr);
          } else if (inviteData?.error) {
            console.warn("Rep invite warning:", inviteData.error);
          } else if (inviteData?.temp_password) {
            toast.info(`Acesso criado para ${form.repNome}. Senha temporária: ${inviteData.temp_password}`, { duration: 15000 });
          }
        } catch (err) {
          console.error("Rep invite exception:", err);
        }
      }

      toast.success("Empresa cadastrada com sucesso!");
      window.location.href = "/";
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar empresa");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-display">Bem-vindo!</CardTitle>
          <CardDescription>
            Configure sua empresa para começar a usar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="company-name">Nome da Empresa *</Label>
              <Input
                id="company-name"
                placeholder="Imobiliária Exemplo Ltda"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-cnpj">CNPJ (opcional)</Label>
              <Input
                id="company-cnpj"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(formatCpfCnpj(e.target.value))}
                maxLength={18}
              />
            </div>

            {/* Representante Legal */}
            <div className="space-y-3 border-t pt-4">
              <Label className="text-sm font-semibold">Representante Legal</Label>
              <div className="space-y-2">
                <Label htmlFor="rep-nome">Nome do Representante</Label>
                <Input
                  id="rep-nome"
                  placeholder="Nome completo"
                  value={form.repNome}
                  onChange={(e) => setForm(prev => ({ ...prev, repNome: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rep-email">Email do Representante</Label>
                <Input
                  id="rep-email"
                  type="email"
                  placeholder="representante@empresa.com"
                  value={form.repEmail}
                  onChange={(e) => setForm(prev => ({ ...prev, repEmail: e.target.value }))}
                />
                {form.repEmail && user?.email && form.repEmail !== user.email && (
                  <p className="text-xs text-muted-foreground">
                    Um acesso será criado automaticamente para este representante.
                  </p>
                )}
              </div>
            </div>

            {plans.length > 0 && (
              <div className="space-y-3">
                <Label>Plano *</Label>
                <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan} className="space-y-2">
                  {plans.map((plan) => (
                    <label
                      key={plan.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        selectedPlan === plan.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <RadioGroupItem value={plan.id} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{plan.name}</span>
                          <span className="text-sm font-semibold">{fmt(plan.price_monthly)}/mês</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {plan.max_users ? `Até ${plan.max_users} usuários` : "Usuários ilimitados"}
                          {" · "}
                          {plan.max_properties ? `${plan.max_properties} imóveis` : "Imóveis ilimitados"}
                        </p>
                      </div>
                      {selectedPlan === plan.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </label>
                  ))}
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  Todos os planos incluem 7 dias de teste gratuito.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Criando..." : "Criar Empresa e Continuar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
