import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, AlertTriangle, Minus } from "lucide-react";
import type { InspectionItem } from "@/hooks/useInspections";

interface InspectionComparisonProps {
  entryItems: InspectionItem[];
  exitItems: InspectionItem[];
  entryDate?: string | null;
  exitDate?: string | null;
}

const conditionLabels: Record<string, string> = {
  bom: "Bom",
  regular: "Regular",
  ruim: "Ruim",
  novo: "Novo",
  danificado: "Danificado",
};

function conditionBadge(condition: string | null) {
  if (!condition) return <Badge variant="outline">N/A</Badge>;
  const isGood = ["bom", "novo"].includes(condition);
  const isBad = ["ruim", "danificado"].includes(condition);
  return (
    <Badge variant={isGood ? "default" : isBad ? "destructive" : "secondary"}>
      {conditionLabels[condition] || condition}
    </Badge>
  );
}

export function InspectionComparison({ entryItems, exitItems, entryDate, exitDate }: InspectionComparisonProps) {
  // Match items by name
  const allItemNames = Array.from(new Set([
    ...entryItems.map((i) => i.item_name),
    ...exitItems.map((i) => i.item_name),
  ]));

  const comparisons = allItemNames.map((name) => {
    const entry = entryItems.find((i) => i.item_name === name);
    const exit = exitItems.find((i) => i.item_name === name);
    const changed = entry && exit && entry.condition !== exit.condition;
    const degraded = changed && isDegraded(entry?.condition, exit?.condition);
    return { name, entry, exit, changed, degraded };
  });

  const degradedCount = comparisons.filter((c) => c.degraded).length;
  const unchangedCount = comparisons.filter((c) => !c.changed).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Comparativo de Vistorias</span>
          <div className="flex gap-2">
            {degradedCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {degradedCount} itens degradados
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> {unchangedCount} sem alteração
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Entrada {entryDate ? `(${new Date(entryDate).toLocaleDateString("pt-BR")})` : ""}</TableHead>
              <TableHead>Saída {exitDate ? `(${new Date(exitDate).toLocaleDateString("pt-BR")})` : ""}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Observações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhum item de vistoria para comparar.
                </TableCell>
              </TableRow>
            ) : (
              comparisons.map((c) => (
                <TableRow key={c.name} className={c.degraded ? "bg-destructive/5" : ""}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.entry ? conditionBadge(c.entry.condition) : <Minus className="h-4 w-4 text-muted-foreground" />}</TableCell>
                  <TableCell>{c.exit ? conditionBadge(c.exit.condition) : <Minus className="h-4 w-4 text-muted-foreground" />}</TableCell>
                  <TableCell>
                    {c.degraded ? (
                      <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Degradou</Badge>
                    ) : c.changed ? (
                      <Badge variant="secondary">Alterado</Badge>
                    ) : (
                      <Badge variant="outline">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {c.exit?.notes || c.entry?.notes || "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function isDegraded(entryCondition: string | null | undefined, exitCondition: string | null | undefined): boolean {
  const order = ["novo", "bom", "regular", "ruim", "danificado"];
  const entryIdx = order.indexOf(entryCondition || "");
  const exitIdx = order.indexOf(exitCondition || "");
  if (entryIdx === -1 || exitIdx === -1) return false;
  return exitIdx > entryIdx;
}
