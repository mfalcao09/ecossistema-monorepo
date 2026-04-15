import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useJournalEntries } from "@/hooks/useJournalEntries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SplitSquareHorizontal } from "lucide-react";

export default function FinanceExpenseApportionment() {
  const { entries } = useJournalEntries({});
  
  const { data: apportionments = [], isLoading } = useQuery({
    queryKey: ["expense_apportionments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_apportionments" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const criteriaLabel: Record<string, string> = { manual: "Manual", area_m2: "Por Área (m²)", igualitario: "Igualitário" };
  const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rateio de Despesas</h1>
        <p className="text-muted-foreground text-sm">Distribuição proporcional de despesas entre centros de custo ou imóveis</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <SplitSquareHorizontal className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Rateios Realizados</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Carregando...</p>
          ) : apportionments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <SplitSquareHorizontal className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum rateio registrado</p>
              <p className="text-xs mt-1">Os rateios são criados a partir dos lançamentos contábeis</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lançamento</TableHead>
                  <TableHead>Centro de Custo</TableHead>
                  <TableHead>Critério</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apportionments.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-sm">{a.journal_entry_id?.slice(0, 8)}...</TableCell>
                    <TableCell className="text-sm">{a.cost_center_id?.slice(0, 8) || "-"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{criteriaLabel[a.criteria] || a.criteria}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{Number(a.percentage).toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-mono">{fmt(a.calculated_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
