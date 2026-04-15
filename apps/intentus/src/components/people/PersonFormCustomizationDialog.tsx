import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useFormCustomization } from "@/hooks/useFormCustomization";
import {
  PERSON_OPTIONAL_FIELDS,
  type FormCustomization,
} from "@/lib/formCustomizationDefaults";
import { personTypeLabels } from "@/lib/personSchema";
import { Plus, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PersonFormCustomizationDialog({ open, onOpenChange }: Props) {
  const { config, save, isSaving, reset, isResetting } = useFormCustomization();

  const [hiddenFields, setHiddenFields] = useState<string[]>([]);
  const [extraTypes, setExtraTypes] = useState<{ key: string; label: string }[]>([]);
  const [extraFields, setExtraFields] = useState<{ key: string; label: string }[]>([]);
  const [newType, setNewType] = useState("");
  const [newField, setNewField] = useState("");

  useEffect(() => {
    if (open && config) {
      setHiddenFields([...config.person_hidden_fields]);
      setExtraTypes([...config.person_extra_types]);
      setExtraFields([...config.person_extra_fields]);
    }
  }, [open, config]);

  function toggleHidden(key: string) {
    setHiddenFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function addExtraType() {
    const trimmed = newType.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (
      Object.keys(personTypeLabels).includes(key) ||
      extraTypes.some((t) => t.key === key)
    ) {
      toast.error("Tipo já existe.");
      return;
    }
    setExtraTypes([...extraTypes, { key, label: trimmed }]);
    setNewType("");
  }

  function addExtraField() {
    const trimmed = newField.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (
      [...PERSON_OPTIONAL_FIELDS, ...extraFields].some(
        (f) => f.key === key || f.label === trimmed
      )
    ) {
      toast.error("Campo já existe.");
      return;
    }
    setExtraFields([...extraFields, { key, label: trimmed }]);
    setNewField("");
  }

  async function handleSave() {
    const newConfig: FormCustomization = {
      ...config,
      person_hidden_fields: hiddenFields,
      person_extra_types: extraTypes,
      person_extra_fields: extraFields,
    };
    await save(newConfig);
    onOpenChange(false);
  }

  async function handleResetAll() {
    const newConfig: FormCustomization = {
      ...config,
      person_hidden_fields: [],
      person_extra_types: [],
      person_extra_fields: [],
    };
    await save(newConfig);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Personalizar Campos de Pessoas</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] px-6">
          <Tabs defaultValue="optional">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="optional">Campos Opcionais</TabsTrigger>
              <TabsTrigger value="types">Tipos de Pessoa</TabsTrigger>
              <TabsTrigger value="extra">Campos Adicionais</TabsTrigger>
            </TabsList>

            {/* Optional Fields */}
            <TabsContent value="optional" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Desmarque os campos que não se aplicam ao seu negócio para ocultá-los do formulário de pessoas.
              </p>
              <div className="space-y-2">
                {[...PERSON_OPTIONAL_FIELDS, ...extraFields].map((f) => (
                  <div key={f.key} className="flex items-center gap-2 py-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                      <Checkbox
                        checked={!hiddenFields.includes(f.key)}
                        onCheckedChange={() => toggleHidden(f.key)}
                        className="h-4 w-4"
                      />
                      {f.label}
                    </label>
                  </div>
                ))}
              </div>
              <Button
                type="button" variant="ghost" size="sm" className="text-xs"
                onClick={() => setHiddenFields([])}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão
              </Button>
            </TabsContent>

            {/* Person Types */}
            <TabsContent value="types" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Tipos padrão do sistema (não podem ser removidos). Adicione tipos personalizados abaixo.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(personTypeLabels).map((label) => (
                  <Badge key={label} variant="secondary" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
              {extraTypes.length > 0 && (
                <>
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Tipos Personalizados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {extraTypes.map((t) => (
                      <Badge key={t.key} variant="secondary" className="gap-1 text-xs">
                        {t.label}
                        <button onClick={() => setExtraTypes(extraTypes.filter((x) => x.key !== t.key))}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </>
              )}
              <Separator />
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm flex-1"
                  placeholder="Adicionar novo tipo..."
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtraType(); } }}
                />
                <Button type="button" size="sm" variant="outline" onClick={addExtraType}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="button" variant="ghost" size="sm" className="text-xs"
                onClick={() => setExtraTypes([])}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão
              </Button>
            </TabsContent>

            {/* Extra Fields */}
            <TabsContent value="extra" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Crie campos adicionais personalizados para o cadastro de pessoas.
              </p>
              {extraFields.length > 0 && (
                <div className="space-y-2">
                  {extraFields.map((f) => (
                    <div key={f.key} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50">
                      <span className="text-sm">{f.label}</span>
                      <button
                        onClick={() => {
                          setExtraFields(extraFields.filter((x) => x.key !== f.key));
                          setHiddenFields(hiddenFields.filter((h) => h !== f.key));
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Separator />
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm flex-1"
                  placeholder="Nome do novo campo..."
                  value={newField}
                  onChange={(e) => setNewField(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtraField(); } }}
                />
                <Button type="button" size="sm" variant="outline" onClick={addExtraField}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="button" variant="ghost" size="sm" className="text-xs"
                onClick={() => { setExtraFields([]); }}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão
              </Button>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6 pt-2 flex-row gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleResetAll} disabled={isResetting}>
            <RotateCcw className="h-4 w-4 mr-1" />
            {isResetting ? "Restaurando..." : "Restaurar Tudo"}
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
