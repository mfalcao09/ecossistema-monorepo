import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import SignerForm, { type SignerData, EMPTY_SIGNER } from "./SignerForm";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  signer: SignerData | null;
  index: number;
  onSave: (index: number, signer: SignerData) => void;
}

export default function SignerEditDialog({ open, onOpenChange, signer, index, onSave }: Props) {
  const [draft, setDraft] = useState<SignerData>(signer ?? { ...EMPTY_SIGNER });

  // Sync draft when dialog opens with new signer data
  const handleOpenChange = (v: boolean) => {
    if (v && signer) setDraft({ ...signer });
    if (v && !signer) setDraft({ ...EMPTY_SIGNER });
    onOpenChange(v);
  };

  const handleChange = (_i: number, field: keyof SignerData, val: any) => {
    setDraft((prev) => ({ ...prev, [field]: val }));
  };

  const canSave = draft.name.trim().length > 0 || draft.email.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{signer ? `Editar Signatário ${index + 1}` : "Novo Signatário"}</DialogTitle>
        </DialogHeader>

        <SignerForm
          signer={draft}
          index={0}
          canRemove={false}
          showOrder={false}
          onChange={handleChange}
          onRemove={() => {}}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!canSave} onClick={() => { onSave(index, draft); onOpenChange(false); }}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
