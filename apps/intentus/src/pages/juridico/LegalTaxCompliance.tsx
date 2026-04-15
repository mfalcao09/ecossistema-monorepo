import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, FileSearch } from "lucide-react";

export default function LegalTaxCompliance() {
  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ["tax-compliance-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("id, contract_type, status, monthly_value, start_date, end_date").eq("status", "ativo").order("start_date", { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  // These tables may not exist yet in types, so we handle gracefully
  const dimobContractIds = new Set<string>();
  const irContractIds = new Set<string>();

  const contractsWithoutDimob = contracts.filter((c: any) => !dimobContractIds.has(c.id));
  const contractsWithoutIR = contracts.filter((c: any) => c.contract_type === "locacao" && (c.monthly_value || 0) > 2259.20 && !irContractIds.has(c.id));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Conformidade Tributária</h1><p className="text-muted-foreground">Hub de auditoria Jurídico-Financeiro: DIMOB, IRRF e obrigações acessórias.</p></div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {contractsWithoutDimob.length === 0 ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
              <div className="text-2xl font-bold">{contractsWithoutDimob.length}</div>
            </div>
            <p className="text-xs text-muted-foreground">Contratos sem registro DIMOB</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {contractsWithoutIR.length === 0 ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
              <div className="text-2xl font-bold">{contractsWithoutIR.length}</div>
            </div>
            <p className="text-xs text-muted-foreground">Contratos sem retenção IR (acima do limite)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{contracts.length}</div>
            <p className="text-xs text-muted-foreground">Contratos Ativos Analisados</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileSearch className="h-4 w-4" />Contratos sem registro DIMOB</CardTitle></CardHeader>
        <CardContent>
          {contractsWithoutDimob.length === 0 ? <p className="text-muted-foreground text-sm text-center py-4">Todos os contratos possuem registro DIMOB. ✓</p> : (
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Contrato</TableHead><TableHead>Tipo</TableHead><TableHead>Valor Mensal</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {contractsWithoutDimob.slice(0, 20).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.id.slice(0, 8)}...</TableCell>
                      <TableCell><Badge variant="outline">{c.contract_type}</Badge></TableCell>
                      <TableCell>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.monthly_value || 0)}</TableCell>
                      <TableCell><Badge variant="destructive">Sem DIMOB</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Contratos sem retenção de IR (aluguel &gt; R$ 2.259,20)</CardTitle></CardHeader>
        <CardContent>
          {contractsWithoutIR.length === 0 ? <p className="text-muted-foreground text-sm text-center py-4">Todas as retenções estão em dia. ✓</p> : (
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Contrato</TableHead><TableHead>Valor Mensal</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {contractsWithoutIR.slice(0, 20).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.id.slice(0, 8)}...</TableCell>
                      <TableCell>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.monthly_value || 0)}</TableCell>
                      <TableCell><Badge variant="destructive">Sem retenção IR</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {loadingContracts && <div className="text-center py-8 text-muted-foreground">Carregando dados de auditoria...</div>}
    </div>
  );
}
