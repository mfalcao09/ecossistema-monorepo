import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ALL_CARD_FIELDS,
  REQUIRED_FIELD_IDS,
  type CardPreferences,
  type CardFieldDefinition,
} from "@/hooks/useCardPreferences";
import {
  ArrowUp,
  ArrowDown,
  Lock,
  RotateCcw,
  GripVertical,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CardFieldsCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: CardPreferences;
  savePreferences: (prefs: CardPreferences) => void;
  resetToDefaults: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CardFieldsCustomizer({
  open,
  onOpenChange,
  preferences,
  savePreferences,
  resetToDefaults,
}: CardFieldsCustomizerProps) {
  // Local draft state — synced from props when dialog opens
  const [draft, setDraft] = useState<CardPreferences>(preferences);

  // Sync draft when dialog opens or preferences change externally
  useEffect(() => {
    if (open) {
      setDraft(preferences);
    }
  }, [open, preferences]);

  // ---- Field order (all fields, ordered: visible first, then hidden) ------

  const orderedFields: (CardFieldDefinition & { visible: boolean })[] =
    (() => {
      const visibleSet = new Set(draft.visibleFields);
      const fieldMap = new Map(ALL_CARD_FIELDS.map((f) => [f.id, f]));

      // Visible fields in their current order
      const visible = draft.visibleFields
        .map((id) => fieldMap.get(id))
        .filter(Boolean)
        .map((f) => ({ ...f!, visible: true }));

      // Hidden fields in default order
      const hidden = ALL_CARD_FIELDS.filter((f) => !visibleSet.has(f.id)).map(
        (f) => ({ ...f, visible: false }),
      );

      return [...visible, ...hidden];
    })();

  // ---- Handlers -----------------------------------------------------------

  const handleToggleField = useCallback(
    (fieldId: string, checked: boolean) => {
      // Never toggle required fields
      if (REQUIRED_FIELD_IDS.includes(fieldId)) return;

      setDraft((prev) => {
        let newVisible: string[];
        if (checked) {
          // Add at the end
          newVisible = [...prev.visibleFields, fieldId];
        } else {
          // Remove
          newVisible = prev.visibleFields.filter((id) => id !== fieldId);
        }
        const updated = { ...prev, visibleFields: newVisible };
        savePreferences(updated);
        return updated;
      });
    },
    [savePreferences],
  );

  const handleMoveUp = useCallback(
    (fieldId: string) => {
      setDraft((prev) => {
        const idx = prev.visibleFields.indexOf(fieldId);
        if (idx <= 0) return prev;

        // Don't swap above required fields at positions 0,1
        const targetIdx = idx - 1;
        if (REQUIRED_FIELD_IDS.includes(prev.visibleFields[targetIdx])) {
          return prev;
        }

        const newVisible = [...prev.visibleFields];
        [newVisible[targetIdx], newVisible[idx]] = [
          newVisible[idx],
          newVisible[targetIdx],
        ];
        const updated = { ...prev, visibleFields: newVisible };
        savePreferences(updated);
        return updated;
      });
    },
    [savePreferences],
  );

  const handleMoveDown = useCallback(
    (fieldId: string) => {
      setDraft((prev) => {
        const idx = prev.visibleFields.indexOf(fieldId);
        if (idx < 0 || idx >= prev.visibleFields.length - 1) return prev;

        const newVisible = [...prev.visibleFields];
        [newVisible[idx], newVisible[idx + 1]] = [
          newVisible[idx + 1],
          newVisible[idx],
        ];
        const updated = { ...prev, visibleFields: newVisible };
        savePreferences(updated);
        return updated;
      });
    },
    [savePreferences],
  );

  const handleToggleCompact = useCallback(
    (checked: boolean) => {
      setDraft((prev) => {
        const updated = { ...prev, compact: checked };
        savePreferences(updated);
        return updated;
      });
    },
    [savePreferences],
  );

  const handleReset = useCallback(() => {
    resetToDefaults();
    onOpenChange(false);
  }, [resetToDefaults, onOpenChange]);

  // ---- Render -------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            Personalizar Cards do Kanban
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Escolha quais campos exibir e a ordem de exibição nos cards do
            pipeline.
          </DialogDescription>
        </DialogHeader>

        {/* ---- Fields list ------------------------------------------------ */}
        <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
          {orderedFields.map((field) => {
            const isRequired = REQUIRED_FIELD_IDS.includes(field.id);
            const isVisible = field.visible;
            const visibleIdx = draft.visibleFields.indexOf(field.id);
            const isFirst =
              isVisible &&
              visibleIdx <=
                REQUIRED_FIELD_IDS.filter((rid) =>
                  draft.visibleFields.includes(rid),
                ).length -
                  1;
            const isLast =
              isVisible && visibleIdx === draft.visibleFields.length - 1;

            const Icon = field.icon;

            return (
              <div
                key={field.id}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                  isVisible
                    ? "bg-muted/50"
                    : "bg-transparent opacity-60"
                }`}
              >
                {/* Grip / Lock icon */}
                <span className="w-4 shrink-0 text-muted-foreground">
                  {isRequired ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <GripVertical className="h-3.5 w-3.5" />
                  )}
                </span>

                {/* Checkbox */}
                <Checkbox
                  id={`field-${field.id}`}
                  checked={isVisible}
                  disabled={isRequired}
                  onCheckedChange={(checked) =>
                    handleToggleField(field.id, !!checked)
                  }
                  className="shrink-0"
                />

                {/* Icon + Label */}
                <Label
                  htmlFor={`field-${field.id}`}
                  className="flex items-center gap-1.5 flex-1 cursor-pointer text-xs"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span>{field.label}</span>
                  {isRequired && (
                    <span className="text-[10px] text-muted-foreground ml-1">
                      (obrigatório)
                    </span>
                  )}
                </Label>

                {/* Reorder buttons — only for visible, non-required fields */}
                {isVisible && !isRequired && (
                  <div className="flex gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={isFirst}
                      onClick={() => handleMoveUp(field.id)}
                      aria-label={`Mover ${field.label} para cima`}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={isLast}
                      onClick={() => handleMoveDown(field.id)}
                      aria-label={`Mover ${field.label} para baixo`}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ---- Compact mode toggle ---------------------------------------- */}
        <div className="flex items-center justify-between rounded-md border px-3 py-2 mt-2">
          <div className="space-y-0.5">
            <Label htmlFor="compact-mode" className="text-xs font-medium">
              Modo compacto
            </Label>
            <p className="text-[10px] text-muted-foreground">
              Reduz espaçamento e tamanho da fonte nos cards
            </p>
          </div>
          <Switch
            id="compact-mode"
            checked={draft.compact}
            onCheckedChange={handleToggleCompact}
          />
        </div>

        {/* ---- Footer ----------------------------------------------------- */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar Padrão
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Concluído
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
