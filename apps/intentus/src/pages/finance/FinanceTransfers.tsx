import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Download, ArrowRightLeft, CheckCircle2, Clock, CalendarDays, Send, Unlock } from "lucide-react";
import { toast } from "sonner";
import {
  useOwnerTransfers,
  useCreateOwnerTransfer,
  useUpdateOwnerTransfer,
  transferStatusLabels,
  type OwnerTransfer,
} from "@/hooks/useOwnerTransfers";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { exportToCSV } from "@/lib/csvExport";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function FinanceTransfers() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(getCurrentMonth());
  const { data: transfers = [], isLoading } = useOwnerTransfers(month);
  const { data: bankAccounts = [] } = useBankAccounts();
  const create = useCreateOwnerTransfer();
  const update = useUpdateOwnerTransfer();
  const [search, setSearch] = useState("");

  const totalBruto = transfers.reduce((s, t) => s + Number(t.gross_amount), 0);
  const totalAdmin = transfers.reduce((s, t) => s + Number(t.admin_fee_value), 0);
  const totalLiquido = transfers.reduce((s, t) => s + Number(t.net_amount), 0);
  const totalPago = transfers.filter(t => t.status === "pago").reduce((s, t) => s + Number(t.net_amount), 0);

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  function handleApprove(t: OwnerTransfer) {
    update.mutate({ id: t.id, status: "processado", review_notes: "Conferido e processado" } as any);
  }

  function handlePay(t: OwnerTransfer) {
    update.mutate({ id: t.id, status: "pago", payment_date: new Date().toISOString().split("T")[0] } as any);
  }

  function handleUnblock(t: OwnerTransfer) {
    if (!confirm("Confirma o desbloqueio deste repasse? O locatário pode ainda estar inadimplente.")) return;
    // Directly update to remove block
    supabase.from("owner_transfers" as any)
      .update({ blocked: false, blocked_reason: null, notes: `Desbloqueado manualmente em ${new Date().toLocaleDateString("pt-BR")}. ${(t as any).blocked_reason || ""}` } as any)
      .eq("id", t.id)
      .then(({ error }) => {
        if (error) { toast.error(error.message); return; }
        toast.success("Repasse desbloqueado!");
        qc.invalidateQueries({ queryKey: ["owner-transfers"] });
      });
  }



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Repasses</h1>
          <p className="text-muted-foreground text-sm">Faturas de repasse aos proprietários — receita líquida após retenção da taxa de administração</p>
        </div>
        <div className="flex gap-2">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          <Button variant="outline" size="sm" onClick={() => exportToCSV(transfers.map(t => ({
            mes_ref: t.reference_month, corte: `Dia ${t.cut_off_day}`, bruto: t.gross_amount,
            taxa_adm_pct: `${t.admin_fee_percentage}%`, taxa_adm_val: t.admin_fee_value,
            deducoes: t.deductions_total, liquido: t.net_amount, status: transferStatusLabels[t.status] || t.status,
          })), `repasses_${month}`, { mes_ref: "Mês Ref.", corte: "Corte", bruto: "Bruto", taxa_adm_pct: "Taxa %", taxa_adm_val: "Taxa R$", deducoes: "Deduções", liquido: "Líquido", status: "Status" })}><Download className="h-4 w-4 mr-1" />Exportar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recebido Bruto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(totalBruto)}</div>
            <p className="text-xs text-muted-foreground mt-1">Aluguel + encargos recebidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Administração</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{fmt(totalAdmin)}</div>
            <p className="text-xs text-muted-foreground mt-1">Receita da imobiliária</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Líquido a Repassar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{fmt(totalLiquido - totalPago)}</div>
            <p className="text-xs text-muted-foreground mt-1">{transfers.filter(t => t.status === "pendente").length} repasses pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Já Repassado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{fmt(totalPago)}</div>
            <p className="text-xs text-muted-foreground mt-1">{transfers.filter(t => t.status === "pago").length} repasses efetuados</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="todos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="processados">Processados</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar proprietário, imóvel..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Cortes: Dias 10, 20 e 30</span>
          </div>
        </div>

        {["todos", "pendentes", "processados", "pagos"].map((tab) => {
          const filtered = tab === "pendentes" ? transfers.filter(t => t.status === "pendente")
            : tab === "processados" ? transfers.filter(t => t.status === "processado")
            : tab === "pagos" ? transfers.filter(t => t.status === "pago")
            : transfers;
          return (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês Ref.</TableHead>
                        <TableHead>Corte</TableHead>
                        <TableHead>Bruto</TableHead>
                        <TableHead>Taxa Adm. (%)</TableHead>
                        <TableHead>Taxa Adm. (R$)</TableHead>
                        <TableHead>Deduções</TableHead>
                        <TableHead>Líquido</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                            <ArrowRightLeft className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            Nenhum repasse encontrado para {month}. Os repasses são gerados a partir dos recebimentos de aluguel.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((t) => {
                          const isBlocked = (t as any).blocked;
                          return (
                          <TableRow key={t.id} className={isBlocked ? "bg-destructive/5" : ""}>
                            <TableCell className="font-mono">{t.reference_month}</TableCell>
                            <TableCell>Dia {t.cut_off_day}</TableCell>
                            <TableCell>{fmt(Number(t.gross_amount))}</TableCell>
                            <TableCell className="font-mono">{t.admin_fee_percentage}%</TableCell>
                            <TableCell className="text-primary font-medium">{fmt(Number(t.admin_fee_value))}</TableCell>
                            <TableCell className="text-destructive">{Number(t.deductions_total) > 0 ? `-${fmt(Number(t.deductions_total))}` : "—"}</TableCell>
                            <TableCell className="font-bold">{fmt(Number(t.net_amount))}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Badge variant={t.status === "pago" ? "default" : t.status === "processado" ? "secondary" : "outline"}>
                                  {transferStatusLabels[t.status] || t.status}
                                </Badge>
                                {isBlocked && (
                                  <Badge variant="destructive" className="text-xs">
                                    Bloqueado
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {isBlocked && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-destructive" title={(t as any).blocked_reason}>
                                      ⚠ Inadimplência
                                    </span>
                                    <Button variant="destructive" size="sm" onClick={() => handleUnblock(t)}>
                                      <Unlock className="h-3 w-3 mr-1" />Desbloquear
                                    </Button>
                                  </div>
                                )}
                                {t.status === "pendente" && !isBlocked && (
                                  <Button variant="outline" size="sm" onClick={() => handleApprove(t)}>
                                    <CheckCircle2 className="h-3 w-3 mr-1" />Processar
                                  </Button>
                                )}
                                {t.status === "processado" && (
                                  <Button size="sm" onClick={() => handlePay(t)}>
                                    <Send className="h-3 w-3 mr-1" />Pagar
                                  </Button>
                                )}
                                {t.status === "pago" && (
                                  <span className="text-xs text-muted-foreground">{t.payment_date}</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )})
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
