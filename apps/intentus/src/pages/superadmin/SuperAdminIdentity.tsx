import { useState, useEffect, useRef } from "react";
import { usePlatformIdentity, PlatformIdentity } from "@/hooks/usePlatformIdentity";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Palette, Image, Save, Loader2, Home, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminIdentity() {
  const { identity, isLoading, save, isSaving } = usePlatformIdentity();
  const [form, setForm] = useState<PlatformIdentity>(identity);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading) setForm(identity);
  }, [identity, isLoading]);

  const handleSave = () => save(form);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes("png")) {
      toast.error("Apenas arquivos PNG são aceitos.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 2MB.");
      return;
    }
    setUploading(true);
    try {
      const path = `logo_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("platform-assets")
        .upload(path, file, { upsert: true, contentType: "image/png" });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("platform-assets").getPublicUrl(path);
      setForm((prev) => ({ ...prev, logo_url: urlData.publicUrl }));
      toast.success("Logo enviada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar logo: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setForm((prev) => ({ ...prev, logo_url: null }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Identidade Visual</h1>
        <p className="page-subtitle">
          Configure a logo, cores e identidade visual que serão exibidas em todas as empresas e instâncias da plataforma.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Logo & Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Image className="h-4 w-4" />
              Logo & Marca
            </CardTitle>
            <CardDescription>
              A logo será exibida no topo da sidebar de todas as tenants.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform_name">Nome da Plataforma</Label>
              <Input
                id="platform_name"
                value={form.platform_name}
                onChange={(e) => setForm({ ...form, platform_name: e.target.value })}
                placeholder="Gestão Imobiliária"
              />
            </div>
            <div className="space-y-2">
              <Label>Logo da Plataforma</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png"
                className="hidden"
                onChange={handleLogoUpload}
              />
              {form.logo_url ? (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <img
                    src={form.logo_url}
                    alt="Logo atual"
                    className="h-12 w-12 rounded-lg object-contain bg-muted"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Logo carregada</p>
                    <p className="text-xs text-muted-foreground truncate">{form.logo_url.split('/').pop()}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveLogo}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                  ) : (
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                  )}
                  <p className="mt-2 text-sm font-medium">Clique para enviar a logo</p>
                  <p className="text-xs text-muted-foreground">
                    Apenas PNG, máx. 2MB. Recomendado: quadrada, fundo transparente, 128×128px.
                  </p>
                </button>
              )}
            </div>
            <div className="space-y-2">
              <Label>Favicon</Label>
              <input
                type="file"
                accept="image/png,image/x-icon,image/ico,image/svg+xml"
                className="hidden"
                id="favicon_upload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1 * 1024 * 1024) {
                    toast.error("O favicon deve ter no máximo 1MB.");
                    e.target.value = "";
                    return;
                  }
                  setUploading(true);
                  try {
                    const path = `favicon_${Date.now()}.${file.name.split('.').pop()}`;
                    const { error: uploadError } = await supabase.storage
                      .from("platform-assets")
                      .upload(path, file, { upsert: true });
                    if (uploadError) throw uploadError;
                    const { data: urlData } = supabase.storage.from("platform-assets").getPublicUrl(path);
                    setForm((prev) => ({ ...prev, favicon_url: urlData.publicUrl }));
                    toast.success("Favicon enviado com sucesso!");
                  } catch (err: any) {
                    toast.error("Erro ao enviar favicon: " + err.message);
                  } finally {
                    setUploading(false);
                    e.target.value = "";
                  }
                }}
              />
              {form.favicon_url ? (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <img
                    src={form.favicon_url}
                    alt="Favicon atual"
                    className="h-8 w-8 rounded object-contain bg-muted"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Favicon carregado</p>
                    <p className="text-xs text-muted-foreground truncate">{form.favicon_url.split('/').pop()}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('favicon_upload')?.click()}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setForm((prev) => ({ ...prev, favicon_url: null }))}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => document.getElementById('favicon_upload')?.click()}
                  disabled={uploading}
                  className="w-full rounded-lg border-2 border-dashed border-border p-4 text-center hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground mx-auto" />
                  )}
                  <p className="mt-1.5 text-sm font-medium">Clique para enviar o favicon</p>
                  <p className="text-xs text-muted-foreground">PNG, ICO ou SVG, máx. 1MB</p>
                </button>
              )}
            </div>

            {/* Preview */}
            <div className="rounded-lg border p-4 bg-sidebar text-sidebar-foreground">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Pré-visualização</p>
              <div className="flex flex-col items-center gap-2">
                {form.logo_url ? (
                  <img
                    src={form.logo_url}
                    alt="Logo preview"
                    className="w-full rounded-lg object-contain bg-primary/10"
                    style={{ aspectRatio: '363 / 90' }}
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                    <Home className="h-6 w-6 text-primary-foreground" />
                  </div>
                )}
                <span className="text-xs font-bold font-display tracking-tight">
                  {form.platform_name || "Gestão Imobiliária"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Palette */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4" />
              Paleta de Cores
            </CardTitle>
            <CardDescription>
              Defina as cores base do sistema em formato HEX.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Cor Primária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="primary_color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="h-9 w-9 rounded-md border cursor-pointer shrink-0 p-0.5"
                />
                <Input
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  placeholder="#1b2a4a"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accent_color">Cor de Destaque</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="accent_color"
                  value={form.accent_color}
                  onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                  className="h-9 w-9 rounded-md border cursor-pointer shrink-0 p-0.5"
                />
                <Input
                  value={form.accent_color}
                  onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                  placeholder="#e8a020"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sidebar_color">Cor da Sidebar</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="sidebar_color"
                  value={form.sidebar_color}
                  onChange={(e) => setForm({ ...form, sidebar_color: e.target.value })}
                  className="h-9 w-9 rounded-md border cursor-pointer shrink-0 p-0.5"
                />
                <Input
                  value={form.sidebar_color}
                  onChange={(e) => setForm({ ...form, sidebar_color: e.target.value })}
                  placeholder="#172240"
                  className="font-mono"
                />
              </div>
            </div>

            {/* Color preview swatches */}
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pré-visualização da paleta</p>
              <div className="flex gap-2">
                <div className="flex-1 h-12 rounded-md flex items-center justify-center text-[10px] font-medium text-white" style={{ backgroundColor: form.primary_color }}>
                  Primária
                </div>
                <div className="flex-1 h-12 rounded-md flex items-center justify-center text-[10px] font-medium" style={{ backgroundColor: form.accent_color }}>
                  Destaque
                </div>
                <div className="flex-1 h-12 rounded-md flex items-center justify-center text-[10px] font-medium text-white" style={{ backgroundColor: form.sidebar_color }}>
                  Sidebar
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Identidade
        </Button>
      </div>
    </div>
  );
}
