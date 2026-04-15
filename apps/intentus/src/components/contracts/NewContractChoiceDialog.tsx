import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileText, Rocket } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChooseExisting: () => void;
}

// onChooseExisting now opens the ImportMethodChoiceDialog instead of going directly to ContractFormDialog

export function NewContractChoiceDialog({ open, onOpenChange, onChooseExisting }: Props) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Contrato</DialogTitle>
          <DialogDescription>
            Como deseja prosseguir?
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <button
            onClick={() => {
              onOpenChange(false);
              onChooseExisting();
            }}
            className="flex items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-sm">Cadastrar contrato em vigor</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Registre no sistema um contrato que já esteja vigente/existente
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              onOpenChange(false);
              navigate("/novos-negocios");
            }}
            className="flex items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-sm">Iniciar nova solicitação de contrato</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Conduza o processo completo de um novo negócio pelo sistema
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
