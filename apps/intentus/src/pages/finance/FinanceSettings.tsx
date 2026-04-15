import { useState, useEffect } from "react";
import { useFinanceSettings, DEFAULT_FINANCE_SETTINGS, type FinanceSettings } from "@/hooks/useFinanceSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Save, RotateCcw } from "lucide-react";
import EconomicIndicesTab from "@/components/finance/EconomicIndicesTab";

function NumberField({ label, value, onChange, suffix, step }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="number" step={step || "0.01"} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="max-w-[180px]" />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <Label className="cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function FinanceSettingsPage() {
  const { settings, isLoading, saveSettings, isSaving } = useFinanceSettings();
  const [form, setForm] = useState<FinanceSettings>(DEFAULT_FINANCE_SETTINGS);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const update = <K extends keyof FinanceSettings>(key: K, value: FinanceSettings[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSave = () => saveSettings(form);
  const handleReset = () => setForm(DEFAULT_FINANCE_SETTINGS);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="h-6 w-6" /> Configurações Financeiras</h1>
          <p className="text-muted-foreground">Regras de cálculo, impostos, comissões e repasses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}><RotateCcw className="h-4 w-4 mr-2" /> Restaurar Padrão</Button>
          <Button onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4 mr-2" /> Salvar Configurações</Button>
        </div>
      </div>

      <Tabs defaultValue="geral">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="multa_juros">Multa e Juros</TabsTrigger>
          <TabsTrigger value="irrf">IRRF / Retenção</TabsTrigger>
          <TabsTrigger value="cobranca">Cobrança</TabsTrigger>
          <TabsTrigger value="comissoes">Comissões</TabsTrigger>
          <TabsTrigger value="repasses">Repasses</TabsTrigger>
          <TabsTrigger value="indices">Índices</TabsTrigger>
        </TabsList>

        {/* Geral */}
        <TabsContent value="geral">
          <Card>
            <CardHeader><CardTitle>Configurações Gerais</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <NumberField label="Taxa de Administração Padrão" value={form.admin_fee_percentage} onChange={(v) => update("admin_fee_percentage", v)} suffix="%" />
              <NumberField label="Taxa de Intermediação Padrão" value={form.intermediation_fee_percentage} onChange={(v) => update("intermediation_fee_percentage", v)} suffix="%" />
              <div className="space-y-1">
                <Label>Dia de Corte para Repasses</Label>
                <Select value={String(form.transfer_cut_off_day)} onValueChange={(v) => update("transfer_cut_off_day", parseInt(v))}>
                  <SelectTrigger className="max-w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 15, 20, 25, 30].map((d) => <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Regime Tributário</Label>
                <Select value={form.tax_regime} onValueChange={(v) => update("tax_regime", v)}>
                  <SelectTrigger className="max-w-[280px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                    <SelectItem value="lucro_real">Lucro Real</SelectItem>
                    <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                    <SelectItem value="mei">MEI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Multa e Juros */}
        <TabsContent value="multa_juros">
          <Card>
            <CardHeader><CardTitle>Multa e Juros por Atraso</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <NumberField label="Multa por Atraso" value={form.late_penalty_percentage} onChange={(v) => update("late_penalty_percentage", v)} suffix="%" />
              <div className="space-y-1">
                <Label>Tipo de Juros</Label>
                <Select value={form.interest_type} onValueChange={(v) => update("interest_type", v)}>
                  <SelectTrigger className="max-w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Simples</SelectItem>
                    <SelectItem value="composto">Composto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <NumberField label="Taxa de Juros por Dia" value={form.daily_interest_rate} onChange={(v) => update("daily_interest_rate", v)} suffix="%" step="0.001" />
              <NumberField label="Juros de Mora Mensal" value={form.monthly_interest_rate} onChange={(v) => update("monthly_interest_rate", v)} suffix="%" />
              <NumberField label="Carência antes da Multa" value={form.grace_days} onChange={(v) => update("grace_days", v)} suffix="dias" step="1" />
              <SwitchField label="Aplicar Correção Monetária" checked={form.apply_monetary_correction} onChange={(v) => update("apply_monetary_correction", v)} />
              {form.apply_monetary_correction && (
                <div className="space-y-1">
                  <Label>Índice de Correção</Label>
                  <Select value={form.correction_index} onValueChange={(v) => update("correction_index", v)}>
                    <SelectTrigger className="max-w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="igpm">IGPM</SelectItem>
                      <SelectItem value="ipca">IPCA</SelectItem>
                      <SelectItem value="inpc">INPC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* IRRF */}
        <TabsContent value="irrf">
          <Card>
            <CardHeader><CardTitle>IRRF e Retenções</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <SwitchField label="Calcular retenção de IR automaticamente no repasse (PJ para PF)" checked={form.auto_ir_retention} onChange={(v) => update("auto_ir_retention", v)} />
              <p className="text-xs text-muted-foreground px-1 -mt-1">O recolhimento da DARF é responsabilidade do locatário (PJ). A imobiliária apenas registra o valor retido para fins de DIMOB.</p>
              <NumberField label="Alíquota de ISS sobre Serviços" value={form.iss_rate} onChange={(v) => update("iss_rate", v)} suffix="%" />
              <div className="border-t pt-4 space-y-2">
                <h4 className="font-medium text-sm">Retenções na Fonte</h4>
                <SwitchField label="Reter PIS" checked={form.retain_pis} onChange={(v) => update("retain_pis", v)} />
                <SwitchField label="Reter COFINS" checked={form.retain_cofins} onChange={(v) => update("retain_cofins", v)} />
                <SwitchField label="Reter CSLL" checked={form.retain_csll} onChange={(v) => update("retain_csll", v)} />
              </div>
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-medium text-sm">Alíquotas Customizadas</h4>
                <NumberField label="PIS" value={form.custom_pis_rate} onChange={(v) => update("custom_pis_rate", v)} suffix="%" />
                <NumberField label="COFINS" value={form.custom_cofins_rate} onChange={(v) => update("custom_cofins_rate", v)} suffix="%" />
                <NumberField label="IRPJ" value={form.custom_irpj_rate} onChange={(v) => update("custom_irpj_rate", v)} suffix="%" />
                <NumberField label="CSLL" value={form.custom_csll_rate} onChange={(v) => update("custom_csll_rate", v)} suffix="%" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cobranca */}
        <TabsContent value="cobranca">
          <Card>
            <CardHeader><CardTitle>Regras de Cobrança</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <NumberField label="Tolerância antes de marcar como inadimplente" value={form.defaulter_tolerance_days} onChange={(v) => update("defaulter_tolerance_days", v)} suffix="dias" step="1" />
              <NumberField label="Enviar lembrete antes do vencimento" value={form.reminder_days_before} onChange={(v) => update("reminder_days_before", v)} suffix="dias" step="1" />
              <SwitchField label="Enviar notificação no dia do vencimento" checked={form.notify_on_due_date} onChange={(v) => update("notify_on_due_date", v)} />
              <SwitchField label="Cobrar automaticamente após atraso" checked={form.auto_charge_enabled} onChange={(v) => update("auto_charge_enabled", v)} />
              {form.auto_charge_enabled && (
                <NumberField label="Dias após vencimento para cobrança automática" value={form.auto_charge_days} onChange={(v) => update("auto_charge_days", v)} suffix="dias" step="1" />
              )}
              <div className="space-y-1">
                <Label>Texto padrão para mensagem de cobrança</Label>
                <Textarea value={form.collection_message_template} onChange={(e) => update("collection_message_template", e.target.value)} placeholder="Ex: Prezado(a), informamos que sua parcela encontra-se em atraso..." rows={4} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comissoes */}
        <TabsContent value="comissoes">
          <Card>
            <CardHeader><CardTitle>Comissões</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <NumberField label="Comissão padrão sobre Vendas" value={form.sales_commission_percentage} onChange={(v) => update("sales_commission_percentage", v)} suffix="%" />
              <NumberField label="Comissão padrão sobre Locações" value={form.rental_commission_percentage} onChange={(v) => update("rental_commission_percentage", v)} suffix="%" />
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-medium text-sm">Split Padrão (House vs Corretor)</h4>
                <NumberField label="House" value={form.house_split_percentage} onChange={(v) => update("house_split_percentage", v)} suffix="%" step="1" />
                <NumberField label="Corretor" value={form.broker_split_percentage} onChange={(v) => update("broker_split_percentage", v)} suffix="%" step="1" />
              </div>
              <SwitchField label="Reter IR sobre comissões PF" checked={form.retain_ir_on_commissions} onChange={(v) => update("retain_ir_on_commissions", v)} />
              <NumberField label="Dia de pagamento de comissões" value={form.commission_payment_day} onChange={(v) => update("commission_payment_day", v)} suffix="do mês seguinte" step="1" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Repasses */}
        <TabsContent value="repasses">
          <Card>
            <CardHeader><CardTitle>Repasses a Proprietários</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <SwitchField label="Deduzir IR do repasse automaticamente" checked={form.deduct_ir_from_transfer} onChange={(v) => update("deduct_ir_from_transfer", v)} />
              <SwitchField label="Deduzir seguro incêndio do repasse" checked={form.deduct_fire_insurance} onChange={(v) => update("deduct_fire_insurance", v)} />
              <SwitchField label="Deduzir IPTU do repasse" checked={form.deduct_iptu} onChange={(v) => update("deduct_iptu", v)} />
              <NumberField label="Valor mínimo para gerar repasse" value={form.min_transfer_amount} onChange={(v) => update("min_transfer_amount", v)} suffix="R$" />
              <SwitchField label="Agrupar repasses por proprietário" checked={form.group_transfers_by_owner} onChange={(v) => update("group_transfers_by_owner", v)} />
            </CardContent>
          </Card>
        </TabsContent>
        {/* Indices */}
        <TabsContent value="indices">
          <EconomicIndicesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
