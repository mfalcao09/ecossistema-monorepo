import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, MapPin, BedDouble, Bath, Car, Maximize, Home, Building2, Send } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

function usePublicProperties(filters: { search: string; type: string; purpose: string; minPrice: string; maxPrice: string }) {
  return useQuery({
    queryKey: ["public-properties", filters],
    queryFn: async () => {
      let q = supabase
        .from("properties")
        .select("id, title, property_type, purpose, city, neighborhood, state, sale_price, rental_price, area, bedrooms, bathrooms, parking_spots, description, status, show_on_website")
        .eq("status", "disponivel")
        .eq("show_on_website", true)
        .order("created_at", { ascending: false });

      if (filters.type && filters.type !== "todos") q = q.eq("property_type", filters.type as any);
      if (filters.purpose && filters.purpose !== "todos") q = q.eq("purpose", filters.purpose as any);

      const { data, error } = await q;
      if (error) throw error;

      let results = data || [];
      if (filters.search) {
        const s = filters.search.toLowerCase();
        results = results.filter((p: any) =>
          (p.title || "").toLowerCase().includes(s) ||
          (p.city || "").toLowerCase().includes(s) ||
          (p.neighborhood || "").toLowerCase().includes(s)
        );
      }
      if (filters.minPrice) {
        const min = Number(filters.minPrice);
        results = results.filter((p: any) => Number(p.sale_price || p.rental_price || 0) >= min);
      }
      if (filters.maxPrice) {
        const max = Number(filters.maxPrice);
        results = results.filter((p: any) => Number(p.sale_price || p.rental_price || 0) <= max);
      }
      return results;
    },
  });
}

function usePropertyThumbnails(propertyIds: string[]) {
  return useQuery({
    queryKey: ["property-thumbnails", propertyIds],
    queryFn: async () => {
      if (propertyIds.length === 0) return {};
      const { data, error } = await supabase
        .from("property_media")
        .select("property_id, media_url, display_order")
        .in("property_id", propertyIds)
        .eq("media_type", "image")
        .order("display_order", { ascending: true });
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((m) => {
        if (!map[m.property_id]) {
          map[m.property_id] = m.media_url;
        }
      });
      return map;
    },
    enabled: propertyIds.length > 0,
  });
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const propertyTypeLabels: Record<string, string> = {
  casa: "Casa", apartamento: "Apartamento", terreno: "Terreno", lote: "Lote",
  comercial: "Comercial", sala: "Sala", galpao: "Galpão", rural: "Rural",
};

const purposeLabels: Record<string, string> = {
  venda: "Venda", locacao: "Locação", ambos: "Venda e Locação",
};

export default function PublicShowcase() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("todos");
  const [purpose, setPurpose] = useState("todos");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [interestDialog, setInterestDialog] = useState<any>(null);
  const [interestForm, setInterestForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const { data: properties = [], isLoading } = usePublicProperties({ search, type, purpose, minPrice, maxPrice });
  const propertyIds = properties.map((p: any) => p.id);
  const { data: thumbnails = {} } = usePropertyThumbnails(propertyIds);

  async function handleInterestSubmit() {
    if (!interestForm.name || !interestForm.phone) {
      toast.error("Preencha nome e telefone.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("leads").insert({
        name: interestForm.name,
        email: interestForm.email || null,
        phone: interestForm.phone,
        property_id: interestDialog?.id || null,
        source: "site" as any,
        status: "novo" as any,
        interest_type: interestDialog?.purpose === "venda" ? "venda" : "locacao",
        notes: interestForm.message || `Interesse no imóvel: ${interestDialog?.title}`,
      } as any);
      if (error) throw error;
      toast.success("Interesse registrado! Entraremos em contato em breve.");
      setInterestDialog(null);
      setInterestForm({ name: "", email: "", phone: "", message: "" });
    } catch (e: any) {
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-primary/5 py-12 px-4">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold font-display text-foreground">
            Encontre o Imóvel Ideal
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Explore nosso portfólio de imóveis disponíveis para venda e locação
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-4 -mt-6">
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por cidade, bairro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  {Object.entries(propertyTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger><SelectValue placeholder="Finalidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="locacao">Locação</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Preço mín." type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              <Input placeholder="Preço máx." type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground mb-4">{properties.length} imóveis encontrados</p>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando imóveis...</div>
        ) : properties.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Home className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum imóvel encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((p: any) => {
              const price = p.purpose === "locacao" ? p.rental_price : p.sale_price;
              const thumb = thumbnails[p.id];
              return (
                <Card key={p.id} className="overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer">
                  <Link to={`/vitrine/${p.id}`}>
                    <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                      {thumb ? (
                        <img src={thumb} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <Building2 className="h-12 w-12 text-muted-foreground/30" />
                      )}
                    </div>
                  </Link>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground line-clamp-1">{p.title}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {[p.neighborhood, p.city, p.state].filter(Boolean).join(", ") || "—"}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {purposeLabels[p.purpose] || p.purpose}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {p.bedrooms > 0 && <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{p.bedrooms}</span>}
                      {p.bathrooms > 0 && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{p.bathrooms}</span>}
                      {p.parking_spots > 0 && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />{p.parking_spots}</span>}
                      {p.area > 0 && <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{p.area}m²</span>}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <p className="text-lg font-bold text-primary">{price ? fmt(Number(price)) : "Consulte"}</p>
                        {p.purpose === "locacao" && price && <p className="text-[10px] text-muted-foreground">/mês</p>}
                      </div>
                      <Button size="sm" onClick={(e) => { e.preventDefault(); setInterestDialog(p); }}>
                        <Send className="h-3 w-3 mr-1" /> Tenho Interesse
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Interest Dialog */}
      <Dialog open={!!interestDialog} onOpenChange={(v) => !v && setInterestDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tenho Interesse</DialogTitle>
          </DialogHeader>
          {interestDialog && (
            <p className="text-sm text-muted-foreground">
              Imóvel: <strong>{interestDialog.title}</strong>
            </p>
          )}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={interestForm.name} onChange={(e) => setInterestForm({ ...interestForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Telefone *</Label>
                <Input value={interestForm.phone} onChange={(e) => setInterestForm({ ...interestForm, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={interestForm.email} onChange={(e) => setInterestForm({ ...interestForm, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <Textarea value={interestForm.message} onChange={(e) => setInterestForm({ ...interestForm, message: e.target.value })} rows={3} placeholder="Gostaria de agendar uma visita..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterestDialog(null)}>Cancelar</Button>
            <Button onClick={handleInterestSubmit} disabled={submitting}>
              <Send className="h-4 w-4 mr-1" /> {submitting ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
