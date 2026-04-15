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
  DEFAULT_FEATURES, DEFAULT_CONDO_FEATURES, OPTIONAL_FIELDS,
  type FormCustomization,
} from "@/lib/formCustomizationDefaults";
import { Plus, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FormCustomizationDialog({ open, onOpenChange }: Props) {
  const { config, isLoading, save, isSaving } = useFormCustomization();

  const [propertyFeatures, setPropertyFeatures] = useState<string[]>([]);
  const [condoFeatures, setCondoFeatures] = useState<string[]>([]);
  const [hiddenFields, setHiddenFields] = useState<string[]>([]);
  const [extraOptionalFields, setExtraOptionalFields] = useState<{ key: string; label: string }[]>([]);
  const [newPropertyFeat, setNewPropertyFeat] = useState("");
  const [newCondoFeat, setNewCondoFeat] = useState("");
  const [newOptionalField, setNewOptionalField] = useState("");

  useEffect(() => {
    if (open && config) {
      setPropertyFeatures([...config.property_features]);
      setCondoFeatures([...config.condo_features]);
      setHiddenFields([...config.hidden_fields]);
      setExtraOptionalFields([...(config.extra_optional_fields || [])]);
    }
  }, [open, config]);

  function toggleItem(item: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }

  function addCustomFeature(
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    clear: () => void,
  ) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (list.includes(trimmed)) {
      toast.error("Item já existe na lista.");
      return;
    }
    setList([...list, trimmed]);
    clear();
  }

  function removeCustomFeature(item: string, list: string[], setList: (v: string[]) => void) {
    setList(list.filter((i) => i !== item));
  }

  function addOptionalField(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if ([...OPTIONAL_FIELDS, ...extraOptionalFields].some((f) => f.key === key || f.label === trimmed)) {
      toast.error("Campo já existe na lista.");
      return;
    }
    setExtraOptionalFields([...extraOptionalFields, { key, label: trimmed }]);
    setNewOptionalField("");
  }

  async function handleSave() {
    const newConfig: FormCustomization = {
      ...config,
      property_features: propertyFeatures,
      condo_features: condoFeatures,
      hidden_fields: hiddenFields,
      extra_optional_fields: extraOptionalFields,
    };
    await save(newConfig);
    onOpenChange(false);
  }

  async function handleResetAll() {
    const newConfig: FormCustomization = {
      ...config,
      property_features: [...DEFAULT_FEATURES],
      condo_features: [...DEFAULT_CONDO_FEATURES],
      hidden_fields: [],
      extra_optional_fields: [],
      extra_property_types: [],
    };
    await save(newConfig);
    onOpenChange(false);
  }

  const customPropertyFeats = propertyFeatures.filter((f) => !DEFAULT_FEATURES.includes(f));
  const customCondoFeats = condoFeatures.filter((f) => !DEFAULT_CONDO_FEATURES.includes(f));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Personalizar Campos do Formulário</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] px-6">
          <Tabs defaultValue="property_features">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="property_features">Características do Imóvel</TabsTrigger>
              <TabsTrigger value="condo_features">Características do Condomínio</TabsTrigger>
              <TabsTrigger value="hidden_fields">Campos Opcionais</TabsTrigger>
            </TabsList>

            {/* Property Features */}
            <TabsContent value="property_features" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Marque as características que deseja exibir nos formulários. Desmarque para ocultar. Adicione itens personalizados abaixo.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {DEFAULT_FEATURES.map((feat) => (
                  <label key={feat} className="flex items-center gap-1.5 text-xs cursor-pointer py-0.5">
                    <Checkbox
                      checked={propertyFeatures.includes(feat)}
                      onCheckedChange={() => toggleItem(feat, propertyFeatures, setPropertyFeatures)}
                      className="h-3.5 w-3.5"
                    />
                    {feat}
                  </label>
                ))}
              </div>

              {customPropertyFeats.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Itens Personalizados</p>
                    <div className="flex flex-wrap gap-1.5">
                      {customPropertyFeats.map((feat) => (
                        <Badge key={feat} variant="secondary" className="gap-1 text-xs">
                          {feat}
                          <button onClick={() => removeCustomFeature(feat, propertyFeatures, setPropertyFeatures)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm flex-1"
                  placeholder="Adicionar nova característica..."
                  value={newPropertyFeat}
                  onChange={(e) => setNewPropertyFeat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomFeature(newPropertyFeat, propertyFeatures, setPropertyFeatures, () => setNewPropertyFeat(""));
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addCustomFeature(newPropertyFeat, propertyFeatures, setPropertyFeatures, () => setNewPropertyFeat(""))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setPropertyFeatures([...DEFAULT_FEATURES])}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão
              </Button>
            </TabsContent>

            {/* Condo Features */}
            <TabsContent value="condo_features" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Marque as características de condomínio que deseja exibir. Adicione itens personalizados abaixo.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {DEFAULT_CONDO_FEATURES.map((feat) => (
                  <label key={feat} className="flex items-center gap-1.5 text-xs cursor-pointer py-0.5">
                    <Checkbox
                      checked={condoFeatures.includes(feat)}
                      onCheckedChange={() => toggleItem(feat, condoFeatures, setCondoFeatures)}
                      className="h-3.5 w-3.5"
                    />
                    {feat}
                  </label>
                ))}
              </div>

              {customCondoFeats.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Itens Personalizados</p>
                    <div className="flex flex-wrap gap-1.5">
                      {customCondoFeats.map((feat) => (
                        <Badge key={feat} variant="secondary" className="gap-1 text-xs">
                          {feat}
                          <button onClick={() => removeCustomFeature(feat, condoFeatures, setCondoFeatures)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm flex-1"
                  placeholder="Adicionar nova característica..."
                  value={newCondoFeat}
                  onChange={(e) => setNewCondoFeat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomFeature(newCondoFeat, condoFeatures, setCondoFeatures, () => setNewCondoFeat(""));
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addCustomFeature(newCondoFeat, condoFeatures, setCondoFeatures, () => setNewCondoFeat(""))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setCondoFeatures([...DEFAULT_CONDO_FEATURES])}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão
              </Button>
            </TabsContent>

            {/* Hidden Fields */}
            <TabsContent value="hidden_fields" className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Desmarque os campos que não se aplicam ao seu negócio para ocultá-los dos formulários. Adicione campos personalizados abaixo.
              </p>
              <div className="space-y-2">
                {[...OPTIONAL_FIELDS, ...extraOptionalFields].map((f) => (
                  <div key={f.key} className="flex items-center gap-2 py-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                      <Checkbox
                        checked={!hiddenFields.includes(f.key)}
                        onCheckedChange={() => toggleItem(f.key, hiddenFields, setHiddenFields)}
                        className="h-4 w-4"
                      />
                      {f.label}
                    </label>
                    {!OPTIONAL_FIELDS.some((o) => o.key === f.key) && (
                      <button
                        onClick={() => {
                          setExtraOptionalFields(extraOptionalFields.filter((ef) => ef.key !== f.key));
                          setHiddenFields(hiddenFields.filter((h) => h !== f.key));
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <Separator />
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm flex-1"
                  placeholder="Adicionar novo campo..."
                  value={newOptionalField}
                  onChange={(e) => setNewOptionalField(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOptionalField(newOptionalField);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addOptionalField(newOptionalField)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setHiddenFields([]);
                  setExtraOptionalFields([]);
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão
              </Button>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6 pt-2 flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetAll}
            disabled={isSaving}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            {isSaving ? "Restaurando..." : "Restaurar Tudo"}
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
