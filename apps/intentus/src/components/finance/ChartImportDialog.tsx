import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { parseChartCSV, ParsedChartRow } from "@/lib/chartOfAccountsTemplate";
import { ChartAccountInput } from "@/hooks/useChartOfAccounts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (inputs: ChartAccountInput[]) => void;
  isPending: boolean;
  existingCodes: Set<string>;
}

export default function ChartImportDialog({ open, onOpenChange, onConfirm, isPending, existingCodes }: Props) {
  const [rows, setRows] = useState<ParsedChartRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseChartCSV(text);

      // Check for codes already existing in DB
      const dupeErrors = result.rows
        .filter((r) => existingCodes.has(r.codigo))
        .map((r) => `Código "${r.codigo}" já existe no plano de contas`);

      setRows(result.rows);
      setErrors([...result.errors, ...dupeErrors]);
    };
    reader.readAsText(file);
  };

  const handleConfirm = () => {
    const inputs: ChartAccountInput[] = rows
      .filter((r) => !existingCodes.has(r.codigo))
      .map((r) => ({
        code: r.codigo,
        name: r.nome,
        account_type: r.tipo,
        nature: r.natureza,
        parent_id: r.codigo_pai || null, // Will be resolved by bulkCreate
        level: r.codigo.split(".").length,
        is_active: r.ativa,
        notes: r.observacoes || null,
      }));
    onConfirm(inputs);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setRows([]);
      setErrors([]);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    }
    onOpenChange(v);
  };

  const validRows = rows.filter((r) => !existingCodes.has(r.codigo));
  const hasBlockingErrors = errors.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Plano de Contas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file && file.name.toLowerCase().endsWith(".csv")) {
                const fakeEvent = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
                handleFile(fakeEvent);
              }
            }}
          >
            <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
            <p className="text-sm text-muted-foreground">
              {fileName ? fileName : "Arraste o CSV aqui ou clique para selecionar"}
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">Formato: CSV</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>

          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 space-y-1 max-h-32 overflow-auto">
              <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                <AlertTriangle className="h-4 w-4" /> {errors.length} erro(s) encontrado(s)
              </div>
              {errors.map((err, i) => (
                <p key={i} className="text-xs text-destructive/80 ml-6">{err}</p>
              ))}
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">
                  <strong>{validRows.length}</strong> conta(s) serão importadas
                </span>
                {validRows.length < rows.length && (
                  <Badge variant="outline" className="text-xs">
                    {rows.length - validRows.length} ignorada(s)
                  </Badge>
                )}
              </div>

              <div className="border rounded-md overflow-auto flex-1 max-h-[40vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-28">Tipo</TableHead>
                      <TableHead className="w-20">Nat.</TableHead>
                      <TableHead className="w-20">Pai</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 50).map((r, i) => {
                      const isDupe = existingCodes.has(r.codigo);
                      return (
                        <TableRow key={i} className={isDupe ? "opacity-40 line-through" : ""}>
                          <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                          <TableCell className="text-sm">{r.nome}</TableCell>
                          <TableCell className="text-xs">{r.tipo}</TableCell>
                          <TableCell className="text-xs">{r.natureza === "devedora" ? "D" : "C"}</TableCell>
                          <TableCell className="font-mono text-xs">{r.codigo_pai}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {rows.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Mostrando 50 de {rows.length} linhas
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={validRows.length === 0 || hasBlockingErrors || isPending}
          >
            {isPending ? "Importando..." : `Importar ${validRows.length} conta(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
