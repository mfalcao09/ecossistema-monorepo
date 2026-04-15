import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Plus, Clock } from "lucide-react";
import { useOwnerTransfers, transferStatusLabels } from "@/hooks/useOwnerTransfers";
import { useIRWithholdings, irStatusLabels } from "@/hooks/useIRWithholdings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/csvExport";
import { format, startOfMonth, endOfMonth } from "date-fns";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function useCommissionsPending() {
  return useQuery({
    queryKey: ["commissions-payable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_splits")
        .select("*, people:person_id ( id, name )")
        .in("status", ["pendente", "aprovado"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export default function FinancePayables() {
  const [search, setSearch] = useState("");
  const { data: transfers = [] } = useOwnerTransfers();
  const { data: irWithholdings = [] } = useIRWithholdings();
  const { data: commissions = [] } = useCommissionsPending();

  const pendingTransfers = transfers.filter(t => t.status === "pendente");
  const pendingCommissions = commissions.filter((c: any) => c.status === "pendente" || c.status === "aprovado");
  const activeIR = irWithholdings.filter((ir: any) => ir.status === "registrado");

  const transfersTotal = pendingTransfers.reduce((s, t) => s + Number(t.net_amount), 0);
  const commissionsTotal = pendingCommissions.reduce((s: number, c: any) => s + Number(c.calculated_value), 0);
  const irTotal = activeIR.reduce((s: number, ir: any) => s + Number(ir.ir_value), 0);

  const paidTransfers = transfers.filter(t => t.status === "pago");
  const paidTotal = paidTransfers.reduce((s, t) => s + Number(t.net_amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Despesas</h1>
          <p className="text-muted-foreground text-sm">Gestão de contas a pagar, fornecedores e repasses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const data = [...pendingTransfers.map(t => ({ tipo: "Repasse", descricao: `Contrato ${t.contract_id}`, valor: t.net_amount, status: t.status })),
              ...pendingCommissions.map((c: any) => ({ tipo: "Comissão", descricao: c.people?.name || "—", valor: c.calculated_value, status: c.status })),
              ...activeIR.map((ir: any) => ({ tipo: "IRRF", descricao: `Mês ${ir.reference_month}`, valor: ir.ir_value, status: ir.status }))];
            exportToCSV(data, "despesas-pendentes", { tipo: "Tipo", descricao: "Descrição", valor: "Valor", status: "Status" });
          }}><Download className="h-4 w-4 mr-1" />Exportar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Repasses Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{fmt(transfersTotal)}</div>
            <p className="text-xs text-muted-foreground">{pendingTransfers.length} repasses a proprietários</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Comissões a Pagar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(commissionsTotal)}</div>
            <p className="text-xs text-muted-foreground">{pendingCommissions.length} comissões pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Impostos Retidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(irTotal)}</div>
            <p className="text-xs text-muted-foreground">{activeIR.length} retenções registradas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pago (Total)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fmt(paidTotal)}</div>
            <p className="text-xs text-muted-foreground">{paidTransfers.length} repasses pagos</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="repasses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="repasses">Repasses ({pendingTransfers.length})</TabsTrigger>
          <TabsTrigger value="comissoes">Comissões ({pendingCommissions.length})</TabsTrigger>
          <TabsTrigger value="impostos">Impostos ({activeIR.length})</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <TabsContent value="repasses">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead>Bruto</TableHead>
                    <TableHead>Taxa Adm.</TableHead>
                    <TableHead>Deduções</TableHead>
                    <TableHead>Líquido</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTransfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-12">Nenhum repasse pendente.</TableCell>
                    </TableRow>
                  ) : pendingTransfers.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.reference_month}</TableCell>
                      <TableCell>{fmt(Number(t.gross_amount))}</TableCell>
                      <TableCell>{fmt(Number(t.admin_fee_value))}</TableCell>
                      <TableCell>{fmt(Number(t.deductions_total))}</TableCell>
                      <TableCell className="font-semibold">{fmt(Number(t.net_amount))}</TableCell>
                      <TableCell><Badge variant="outline">{transferStatusLabels[t.status] || t.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comissoes">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beneficiário</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCommissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-12">Nenhuma comissão pendente.</TableCell>
                    </TableRow>
                  ) : pendingCommissions.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.people?.name || "—"}</TableCell>
                      <TableCell>{c.role}</TableCell>
                      <TableCell>{fmt(Number(c.calculated_value))}</TableCell>
                      <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impostos">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>Alíquota</TableHead>
                    <TableHead>Valor IR</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeIR.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-12">Nenhuma retenção registrada.</TableCell>
                    </TableRow>
                  ) : activeIR.map((ir: any) => (
                    <TableRow key={ir.id}>
                      <TableCell className="font-medium">{ir.reference_month}</TableCell>
                      <TableCell>{fmt(Number(ir.ir_base))}</TableCell>
                      <TableCell>{ir.ir_rate}%</TableCell>
                      <TableCell className="font-semibold">{fmt(Number(ir.ir_value))}</TableCell>
                      <TableCell><Badge variant="outline">{irStatusLabels[ir.status] || ir.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
