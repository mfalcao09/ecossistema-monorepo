import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useFormCustomization } from "@/hooks/useFormCustomization";
import {
  DEFAULT_FEATURES, DEFAULT_CONDO_FEATURES, OPTIONAL_FIELDS,
  PERSON_OPTIONAL_FIELDS, CONTRACT_OPTIONAL_FIELDS,
  type FormCustomization,
} from "@/lib/formCustomizationDefaults";
import { personTypeLabels } from "@/lib/personSchema";
import { Plus, RotateCcw, Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function FieldsTab() {
  const { config, isLoading, save, isSaving } = useFormCustomization();

  // Property state
  const [propertyFeatures, setPropertyFeatures] = useState<string[]>([]);
  const [condoFeatures, setCondoFeatures] = useState<string[]>([]);
  const [hiddenFields, setHiddenFields] = useState<string[]>([]);
  const [extraOptionalFields, setExtraOptionalFields] = useState<{ key: string; label: string }[]>([]);
  const [newPropertyFeat, setNewPropertyFeat] = useState("");
  const [newCondoFeat, setNewCondoFeat] = useState("");
  const [newOptionalField, setNewOptionalField] = useState("");

  // Person state
  const [personHiddenFields, setPersonHiddenFields] = useState<string[]>([]);
  const [personExtraTypes, setPersonExtraTypes] = useState<{ key: string; label: string }[]>([]);
  const [personExtraFields, setPersonExtraFields] = useState<{ key: string; label: string }[]>([]);
  const [newPersonType, setNewPersonType] = useState("");
  const [newPersonField, setNewPersonField] = useState("");

  // Contract state
  const [contractHiddenFields, setContractHiddenFields] = useState<string[]>([]);
  const [contractExtraFields, setContractExtraFields] = useState<{ key: string; label: string }[]>([]);
  const [newContractField, setNewContractField] = useState("");

  useEffect(() => {
    if (config) {
      setPropertyFeatures([...config.property_features]);
      setCondoFeatures([...config.condo_features]);
      setHiddenFields([...config.hidden_fields]);
      setExtraOptionalFields([...(config.extra_optional_fields || [])]);
      setPersonHiddenFields([...config.person_hidden_fields]);
      setPersonExtraTypes([...config.person_extra_types]);
      setPersonExtraFields([...config.person_extra_fields]);
      setContractHiddenFields([...config.contract_hidden_fields]);
      setContractExtraFields([...config.contract_extra_fields]);
    }
  }, [config]);

  function toggleItem(item: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }

  function addCustomFeature(value: string, list: string[], setList: (v: string[]) => void, clear: () => void) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (list.includes(trimmed)) { toast.error("Item já existe."); return; }
    setList([...list, trimmed]);
    clear();
  }

  function addKeyLabelField(
    value: string,
    existing: { key: string; label: string }[],
    setList: (v: { key: string; label: string }[]) => void,
    clear: () => void,
    defaults?: { key: string; label: string }[],
  ) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const all = [...(defaults || []), ...existing];
    if (all.some((f) => f.key === key || f.label === trimmed)) { toast.error("Campo já existe."); return; }
    setList([...existing, { key, label: trimmed }]);
    clear();
  }

  async function handleSaveAll() {
    const newConfig: FormCustomization = {
      property_features: propertyFeatures,
      condo_features: condoFeatures,
      hidden_fields: hiddenFields,
      extra_optional_fields: extraOptionalFields,
      extra_property_types: config.extra_property_types,
      person_hidden_fields: personHiddenFields,
      person_extra_types: personExtraTypes,
      person_extra_fields: personExtraFields,
      contract_hidden_fields: contractHiddenFields,
      contract_extra_fields: contractExtraFields,
    };
    await save(newConfig);
  }

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Carregando...</p>;

  const customPropertyFeats = propertyFeatures.filter((f) => !DEFAULT_FEATURES.includes(f));
  const customCondoFeats = condoFeatures.filter((f) => !DEFAULT_CONDO_FEATURES.includes(f));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSaveAll} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          {isSaving ? "Salvando..." : "Salvar Todas as Alterações"}
        </Button>
      </div>

      <Tabs defaultValue="imoveis">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="imoveis">Imóveis</TabsTrigger>
          <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
        </TabsList>

        {/* ===== IMÓVEIS ===== */}
        <TabsContent value="imoveis">
          <Tabs defaultValue="property_features">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="property_features">Características do Imóvel</TabsTrigger>
              <TabsTrigger value="condo_features">Características do Condomínio</TabsTrigger>
              <TabsTrigger value="optional_fields">Campos Opcionais</TabsTrigger>
            </TabsList>

            <TabsContent value="property_features">
              <Card>
                <CardHeader><CardTitle className="text-base">Características do Imóvel</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">Marque as características que deseja exibir nos formulários.</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                    {DEFAULT_FEATURES.map((feat) => (
                      <label key={feat} className="flex items-center gap-1.5 text-xs cursor-pointer py-0.5">
                        <Checkbox checked={propertyFeatures.includes(feat)} onCheckedChange={() => toggleItem(feat, propertyFeatures, setPropertyFeatures)} className="h-3.5 w-3.5" />
                        {feat}
                      </label>
                    ))}
                  </div>
                  {customPropertyFeats.length > 0 && (
                    <>
                      <Separator />
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Itens Personalizados</p>
                      <div className="flex flex-wrap gap-1.5">
                        {customPropertyFeats.map((feat) => (
                          <Badge key={feat} variant="secondary" className="gap-1 text-xs">
                            {feat}
                            <button onClick={() => setPropertyFeatures(propertyFeatures.filter((i) => i !== feat))}><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex gap-2">
                    <Input className="h-8 text-sm flex-1" placeholder="Adicionar nova característica..." value={newPropertyFeat} onChange={(e) => setNewPropertyFeat(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomFeature(newPropertyFeat, propertyFeatures, setPropertyFeatures, () => setNewPropertyFeat("")); } }} />
                    <Button type="button" size="sm" variant="outline" onClick={() => addCustomFeature(newPropertyFeat, propertyFeatures, setPropertyFeatures, () => setNewPropertyFeat(""))}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setPropertyFeatures([...DEFAULT_FEATURES])}><RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="condo_features">
              <Card>
                <CardHeader><CardTitle className="text-base">Características do Condomínio</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">Marque as características de condomínio que deseja exibir.</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                    {DEFAULT_CONDO_FEATURES.map((feat) => (
                      <label key={feat} className="flex items-center gap-1.5 text-xs cursor-pointer py-0.5">
                        <Checkbox checked={condoFeatures.includes(feat)} onCheckedChange={() => toggleItem(feat, condoFeatures, setCondoFeatures)} className="h-3.5 w-3.5" />
                        {feat}
                      </label>
                    ))}
                  </div>
                  {customCondoFeats.length > 0 && (
                    <>
                      <Separator />
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Itens Personalizados</p>
                      <div className="flex flex-wrap gap-1.5">
                        {customCondoFeats.map((feat) => (
                          <Badge key={feat} variant="secondary" className="gap-1 text-xs">
                            {feat}
                            <button onClick={() => setCondoFeatures(condoFeatures.filter((i) => i !== feat))}><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex gap-2">
                    <Input className="h-8 text-sm flex-1" placeholder="Adicionar nova característica..." value={newCondoFeat} onChange={(e) => setNewCondoFeat(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomFeature(newCondoFeat, condoFeatures, setCondoFeatures, () => setNewCondoFeat("")); } }} />
                    <Button type="button" size="sm" variant="outline" onClick={() => addCustomFeature(newCondoFeat, condoFeatures, setCondoFeatures, () => setNewCondoFeat(""))}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setCondoFeatures([...DEFAULT_CONDO_FEATURES])}><RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="optional_fields">
              <Card>
                <CardHeader><CardTitle className="text-base">Campos Opcionais de Imóveis</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">Desmarque os campos para ocultá-los dos formulários. Adicione campos personalizados abaixo.</p>
                  <div className="space-y-2">
                    {[...OPTIONAL_FIELDS, ...extraOptionalFields].map((f) => (
                      <div key={f.key} className="flex items-center gap-2 py-1">
                        <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                          <Checkbox checked={!hiddenFields.includes(f.key)} onCheckedChange={() => toggleItem(f.key, hiddenFields, setHiddenFields)} className="h-4 w-4" />
                          {f.label}
                        </label>
                        {!OPTIONAL_FIELDS.some((o) => o.key === f.key) && (
                          <button onClick={() => { setExtraOptionalFields(extraOptionalFields.filter((ef) => ef.key !== f.key)); setHiddenFields(hiddenFields.filter((h) => h !== f.key)); }} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex gap-2">
                    <Input className="h-8 text-sm flex-1" placeholder="Adicionar novo campo..." value={newOptionalField} onChange={(e) => setNewOptionalField(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyLabelField(newOptionalField, extraOptionalFields, setExtraOptionalFields, () => setNewOptionalField(""), OPTIONAL_FIELDS); } }} />
                    <Button type="button" size="sm" variant="outline" onClick={() => addKeyLabelField(newOptionalField, extraOptionalFields, setExtraOptionalFields, () => setNewOptionalField(""), OPTIONAL_FIELDS)}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => { setHiddenFields([]); setExtraOptionalFields([]); }}><RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ===== PESSOAS ===== */}
        <TabsContent value="pessoas">
          <Tabs defaultValue="person_optional">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="person_optional">Campos Opcionais</TabsTrigger>
              <TabsTrigger value="person_types">Tipos de Pessoa</TabsTrigger>
              <TabsTrigger value="person_extra">Campos Adicionais</TabsTrigger>
            </TabsList>

            <TabsContent value="person_optional">
              <Card>
                <CardHeader><CardTitle className="text-base">Campos Opcionais de Pessoas</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">Desmarque os campos para ocultá-los do formulário de pessoas.</p>
                  <div className="space-y-2">
                    {[...PERSON_OPTIONAL_FIELDS, ...personExtraFields].map((f) => (
                      <div key={f.key} className="flex items-center gap-2 py-1">
                        <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                          <Checkbox checked={!personHiddenFields.includes(f.key)} onCheckedChange={() => toggleItem(f.key, personHiddenFields, setPersonHiddenFields)} className="h-4 w-4" />
                          {f.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setPersonHiddenFields([])}><RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="person_types">
              <Card>
                <CardHeader><CardTitle className="text-base">Tipos de Pessoa</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">Tipos padrão do sistema (não podem ser removidos). Adicione tipos personalizados abaixo.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.values(personTypeLabels).map((label) => (
                      <Badge key={label} variant="secondary" className="text-xs">{label}</Badge>
                    ))}
                  </div>
                  {personExtraTypes.length > 0 && (
                    <>
                      <Separator />
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Tipos Personalizados</p>
                      <div className="flex flex-wrap gap-1.5">
                        {personExtraTypes.map((t) => (
                          <Badge key={t.key} variant="secondary" className="gap-1 text-xs">
                            {t.label}
                            <button onClick={() => setPersonExtraTypes(personExtraTypes.filter((x) => x.key !== t.key))}><X className="h-3 w-3" /></button>
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                  <Separator />
                  <div className="flex gap-2">
                    <Input className="h-8 text-sm flex-1" placeholder="Adicionar novo tipo..." value={newPersonType} onChange={(e) => setNewPersonType(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyLabelField(newPersonType, personExtraTypes, setPersonExtraTypes, () => setNewPersonType("")); } }} />
                    <Button type="button" size="sm" variant="outline" onClick={() => addKeyLabelField(newPersonType, personExtraTypes, setPersonExtraTypes, () => setNewPersonType(""))}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setPersonExtraTypes([])}><RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="person_extra">
              <Card>
                <CardHeader><CardTitle className="text-base">Campos Adicionais de Pessoas</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">Crie campos adicionais personalizados para o cadastro de pessoas.</p>
                  {personExtraFields.length > 0 && (
                    <div className="space-y-2">
                      {personExtraFields.map((f) => (
                        <div key={f.key} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50">
                          <span className="text-sm">{f.label}</span>
                          <button onClick={() => { setPersonExtraFields(personExtraFields.filter((x) => x.key !== f.key)); setPersonHiddenFields(personHiddenFields.filter((h) => h !== f.key)); }} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Separator />
                  <div className="flex gap-2">
                    <Input className="h-8 text-sm flex-1" placeholder="Nome do novo campo..." value={newPersonField} onChange={(e) => setNewPersonField(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyLabelField(newPersonField, personExtraFields, setPersonExtraFields, () => setNewPersonField(""), PERSON_OPTIONAL_FIELDS); } }} />
                    <Button type="button" size="sm" variant="outline" onClick={() => addKeyLabelField(newPersonField, personExtraFields, setPersonExtraFields, () => setNewPersonField(""), PERSON_OPTIONAL_FIELDS)}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setPersonExtraFields([])}><RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ===== CONTRATOS ===== */}
        <TabsContent value="contratos">
          <Tabs defaultValue="contract_optional">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="contract_optional">Campos Opcionais</TabsTrigger>
              <TabsTrigger value="contract_extra">Campos Adicionais</TabsTrigger>
            </TabsList>

            <TabsContent value="contract_optional">
              <Card>
                <CardHeader><CardTitle className="text-base">Campos Opcionais de Contratos</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">Desmarque os campos para ocultá-los do formulário de contratos.</p>
                  <div className="space-y-2">
                    {[...CONTRACT_OPTIONAL_FIELDS, ...contractExtraFields].map((f) => (
                      <div key={f.key} className="flex items-center gap-2 py-1">
                        <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                          <Checkbox checked={!contractHiddenFields.includes(f.key)} onCheckedChange={() => toggleItem(f.key, contractHiddenFields, setContractHiddenFields)} className="h-4 w-4" />
                          {f.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setContractHiddenFields([])}><RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contract_extra">
              <Card>
                <CardHeader><CardTitle className="text-base">Campos Adicionais de Contratos</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">Crie campos adicionais personalizados para o cadastro de contratos.</p>
                  {contractExtraFields.length > 0 && (
                    <div className="space-y-2">
                      {contractExtraFields.map((f) => (
                        <div key={f.key} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50">
                          <span className="text-sm">{f.label}</span>
                          <button onClick={() => { setContractExtraFields(contractExtraFields.filter((x) => x.key !== f.key)); setContractHiddenFields(contractHiddenFields.filter((h) => h !== f.key)); }} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Separator />
                  <div className="flex gap-2">
                    <Input className="h-8 text-sm flex-1" placeholder="Nome do novo campo..." value={newContractField} onChange={(e) => setNewContractField(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyLabelField(newContractField, contractExtraFields, setContractExtraFields, () => setNewContractField(""), CONTRACT_OPTIONAL_FIELDS); } }} />
                    <Button type="button" size="sm" variant="outline" onClick={() => addKeyLabelField(newContractField, contractExtraFields, setContractExtraFields, () => setNewContractField(""), CONTRACT_OPTIONAL_FIELDS)}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => setContractExtraFields([])}><RotateCcw className="h-3 w-3 mr-1" /> Restaurar Padrão</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
