import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAuthTenantId } from "@/lib/tenantUtils";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Shield, AlertTriangle, Upload, FileText, Trash2, TrendingUp, Clock, CheckCircle2, XCircle, RefreshCw, Target, Sparkles, type LucideIcon } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { useExclusivityAnalytics, type ExclusivityAlert, type ExclusivityRecommendation } from "@/hooks/useExclusivityAnalytics";

const statusColors: Record<string, string> = {
  ativo: "bg-green-100 text-green-800",
  expirado: "bg-red-100 text-red-800",
  cancelado: "bg-gray-100 text-gray-800",
  renovado: "bg-blue-100 text-blue-800",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

const ACTION_COLORS: Record<string, string> = {
  renovar: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  renegociar: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  cancelar: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  monitorar: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

const ACTION_LABELS: Record<string, string> = {
  renovar: "Renovar",
  renegociar: "Renegociar",
  cancelar: "Cancelar",
  monitorar: "Monitorar",
};

export default function ExclusivityContracts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { analytics, isLoading: analyticsLoading } = useExclusivityAnalytics();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    property_id: "",
    owner_person_id: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    auto_renew: false,
    renewal_period_months: "12",
    commission_percentage: "",
    notes: "",
    alert_days_before: "30",
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["exclusivity-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exclusivity_contracts")
        .select("*, properties(title), people!exclusivity_contracts_owner_person_id_fkey(name)")
        .order("end_date", { ascending: true });
      if (error) {
        const { data: d2 } = await supabase.from("exclusivity_contracts").select("*").order("end_date", { ascending: true });
        return d2 || [];
      }
      return data || [];
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["props-for-excl"],
    queryFn: async () => {
      const { data } = await supabase.from("properties").select("id, title").order("title");
      return data || [];
    },
  });

  const { data: people = [] } = useQuery({
    queryKey: ["people-for-excl"],
    queryFn: async () => {
      const { data } = await supabase.from("people").select("id, name").order("name");
      return data || [];
    },
  });

  const createContract = useMutation({
    mutationFn: async () => {
      setUploading(true);
      const tenantId = await getAuthTenantId();
      let fileUrl: string | null = null;
      let fileName: string | null = null;

      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop();
        const path = `${tenantId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("exclusivity-documents")
          .upload(path, selectedFile);
        if (uploadError) throw uploadError;
        fileUrl = path;
        fileName = selectedFile.name;
      }

      const { error } = await supabase.from("exclusivity_contracts").insert({
        tenant_id: tenantId,
        property_id: form.property_id,
        owner_person_id: form.owner_person_id,
        start_date: form.start_date,
        end_date: form.end_date,
        auto_renew: form.auto_renew,
        renewal_period_months: parseInt(form.renewal_period_months) || 12,
        commission_percentage: parseFloat(form.commission_percentage) || null,
        notes: form.notes || null,
        alert_days_before: parseInt(form.alert_days_before) || 30,
        created_by: user!.id,
        file_url: fileUrl,
        file_name: fileName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exclusivity-contracts"] });
      setShowDialog(false);
      setSelectedFile(null);
      setUploading(false);
      toast.success("Exclusividade registrada!");
    },
    onError: () => {
      setUploading(false);
      toast.error("Erro ao registrar exclusividade");
    },
  });

  const handleDownload = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from("exclusivity-documents")
      .createSignedUrl(filePath, 300);
    if (error || !data?.signedUrl) {
      toast.error("Erro ao gerar link de download");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Controle de Exclusividades</h1>
          <p className="text-muted-foreground">Gerencie contratos de exclusividade com proprietários</p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Exclusividade
        </Button>
      </div>

      {/* ── KPIs IA ──────────────────────────────────────────── */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPICard label="Ativas" value={analytics.kpis.activeContracts} icon={Shield} color="text-primary" />
          <KPICard label="Vencendo 30d" value={analytics.kpis.expiringSoon} icon={Clock} color={analytics.kpis.expiringSoon > 0 ? "text-orange-600" : "text-muted-foreground"} />
          <KPICard label="Com Negócios" value={analytics.kpis.withDeals} icon={CheckCircle2} color="text-green-600" />
          <KPICard label="Sem Negócios" value={analytics.kpis.withoutDeals} icon={XCircle} color={analytics.kpis.withoutDeals > 0 ? "text-red-600" : "text-muted-foreground"} />
          <KPICard label="Taxa Conversão" value={`${analytics.kpis.conversionRate}%`} icon={Target} color="text-primary" />
        </div>
      )}

      {/* ── Alertas IA ────────────────────────────────────────── */}
      {analytics && analytics.alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800 dark:text-orange-300">
                Alertas Inteligentes ({analytics.alerts.length})
              </span>
            </div>
            {analytics.alerts.slice(0, 5).map((alert, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Badge className={`${SEVERITY_COLORS[alert.severity]} text-[9px] px-1 shrink-0`}>
                  {alert.severity}
                </Badge>
                <span className="font-medium">{alert.propertyTitle}</span>
                <span className="text-muted-foreground">—</span>
                <span className="text-muted-foreground">{alert.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Recomendações IA ──────────────────────────────────── */}
      {analytics && analytics.recommendations.length > 0 && (
        <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                Recomendações ({analytics.recommendations.length})
              </span>
            </div>
            {analytics.recommendations.slice(0, 5).map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Badge className={`${ACTION_COLORS[rec.action]} text-[9px] px-1.5 shrink-0`}>
                  {ACTION_LABELS[rec.action]}
                </Badge>
                <span className="font-medium">{rec.propertyTitle}</span>
                <span className="text-muted-foreground">— {rec.reason}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Alert: expiring soon */}
      {contracts.filter((c: any) => c.status === "ativo" && differenceInDays(new Date(c.end_date), now) <= 30 && differenceInDays(new Date(c.end_date), now) >= 0).length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <span className="text-sm text-orange-800 font-medium">
              {contracts.filter((c: any) => c.status === "ativo" && differenceInDays(new Date(c.end_date), now) <= 30 && differenceInDays(new Date(c.end_date), now) >= 0).length} exclusividade(s) vencendo nos próximos 30 dias
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imóvel</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Prazo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c: any) => {
                const daysLeft = differenceInDays(new Date(c.end_date), now);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.properties?.title || "—"}</TableCell>
                    <TableCell>{c.people?.name || "—"}</TableCell>
                    <TableCell className="text-sm">{format(new Date(c.start_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-sm">{format(new Date(c.end_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{c.commission_percentage ? `${c.commission_percentage}%` : "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[c.status] || ""} variant="secondary">{c.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {c.file_url ? (
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(c.file_url, c.file_name || "documento")}>
                          <FileText className="h-4 w-4 mr-1" /> {c.file_name || "Baixar"}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.status === "ativo" && daysLeft >= 0 ? (
                        <Badge variant={daysLeft <= 30 ? "destructive" : "secondary"}>
                          {daysLeft} dias
                        </Badge>
                      ) : c.status === "ativo" ? (
                        <Badge variant="destructive">Vencido</Badge>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {contracts.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma exclusividade registrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Exclusividade</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Imóvel</Label>
              <Select value={form.property_id} onValueChange={(v) => setForm((f) => ({ ...f, property_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar imóvel" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Proprietário</Label>
              <Select value={form.owner_person_id} onValueChange={(v) => setForm((f) => ({ ...f, owner_person_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar proprietário" /></SelectTrigger>
                <SelectContent>
                  {people.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Início</Label><Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>Vencimento</Label><Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Comissão (%)</Label><Input type="number" value={form.commission_percentage} onChange={(e) => setForm((f) => ({ ...f, commission_percentage: e.target.value }))} /></div>
              <div><Label>Alerta (dias antes)</Label><Input type="number" value={form.alert_days_before} onChange={(e) => setForm((f) => ({ ...f, alert_days_before: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.auto_renew} onCheckedChange={(v) => setForm((f) => ({ ...f, auto_renew: v }))} />
              <Label>Renovação automática</Label>
            </div>
            <div>
              <Label>Termo de Exclusividade (PDF)</Label>
              <div className="mt-1">
                {selectedFile ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/50 transition-colors">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Clique para anexar o termo assinado</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setSelectedFile(file);
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={() => createContract.mutate()} disabled={!form.property_id || !form.owner_person_id || !form.end_date || createContract.isPending || uploading}>
              {uploading ? "Enviando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KPICard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: LucideIcon; color?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color || "text-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
