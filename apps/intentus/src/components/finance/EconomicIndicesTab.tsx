import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";
import { useEconomicIndices, ALL_INDEX_CODES, getIndexMeta } from "@/hooks/useEconomicIndices";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { format, parseISO, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";

function TrendIcon({ value }: { value: number | null }) {
  if (value == null) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (value > 0) return <TrendingUp className="h-4 w-4 text-primary" />;
  if (value < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function Sparkline({ data }: { data?: { date: string; value: number }[] }) {
  if (!data || data.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <ResponsiveContainer width={80} height={28}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function FreshnessStatus({ fetchedAt }: { fetchedAt?: string }) {
  if (!fetchedAt) return <Badge variant="outline" className="text-xs">Sem dados</Badge>;
  const hours = differenceInHours(new Date(), parseISO(fetchedAt));
  if (hours < 24) return <Badge variant="secondary" className="text-xs">Atualizado</Badge>;
  if (hours < 72) return <Badge variant="outline" className="text-xs">Desatualizado</Badge>;
  return <Badge variant="destructive" className="text-xs">Antigo</Badge>;
}

export default function EconomicIndicesTab() {
  const { indices, sparklineData, isLoading, refreshIndices, isRefreshing } = useEconomicIndices();

  const lastUpdate = (() => {
    if (!indices) return null;
    let latest: string | null = null;
    for (const idx of indices.values()) {
      if (!latest || idx.fetched_at > latest) latest = idx.fetched_at;
    }
    return latest;
  })();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Índices Econômicos</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Dados atualizados via API do Banco Central do Brasil (SGS).
            {lastUpdate && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Última atualização: {format(parseISO(lastUpdate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => refreshIndices()} disabled={isRefreshing} size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Atualizando..." : "Atualizar Índices"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando índices...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Índice</TableHead>
                <TableHead>Uso</TableHead>
                <TableHead className="text-right">Mensal (%)</TableHead>
                <TableHead className="text-right">Acum. 12m (%)</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>12 meses</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ALL_INDEX_CODES.map((code) => {
                const meta = getIndexMeta(code);
                const idx = indices?.get(code);
                const spark = sparklineData?.get(code);

                return (
                  <TableRow key={code}>
                    <TableCell className="font-medium">{meta.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{meta.description}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <TrendIcon value={idx?.monthly_value ?? null} />
                        <span>{idx?.monthly_value != null ? `${idx.monthly_value.toFixed(2)}%` : "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {idx?.accumulated_12m != null ? `${idx.accumulated_12m.toFixed(2)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {idx?.reference_date
                        ? format(parseISO(idx.reference_date), "MMM/yyyy", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Sparkline data={spark} />
                    </TableCell>
                    <TableCell>
                      <FreshnessStatus fetchedAt={idx?.fetched_at} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
