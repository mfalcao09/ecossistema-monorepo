import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles, FileText } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseAI: () => void;
  onChooseManual: () => void;
}

export function ImportMethodChoiceDialog({ open, onOpenChange, onChooseAI, onChooseManual }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Contrato em Vigor</DialogTitle>
          <DialogDescription>
            Como deseja importar o contrato?
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <button
            onClick={() => {
              onOpenChange(false);
              onChooseAI();
            }}
            className="flex items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-sm">Importar com ajuda de IA</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Envie o contrato e aditivos em PDF. A IA irá ler e pré-preencher o cadastro.
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              onOpenChange(false);
              onChooseManual();
            }}
            className="flex items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-sm">Importar Manualmente</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Preencha todos os campos do contrato manualmente.
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
