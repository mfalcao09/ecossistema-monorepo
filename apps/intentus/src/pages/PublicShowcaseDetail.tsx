import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, MapPin, BedDouble, Bath, Car, Maximize, Building2, Send, Home, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const purposeLabels: Record<string, string> = {
  venda: "Venda", locacao: "Locação", ambos: "Venda e Locação",
};

function usePropertyMedia(propertyId?: string) {
  return useQuery({
    queryKey: ["property-media-public", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_media")
        .select("*")
        .eq("property_id", propertyId!)
        .eq("media_type", "image")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!propertyId,
  });
}

export default function PublicShowcaseDetail() {
  const { id } = useParams<{ id: string }>();
  const [interestOpen, setInterestOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [currentImg, setCurrentImg] = useState(0);

  const { data: property, isLoading } = useQuery({
    queryKey: ["public-property", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id!)
        .eq("status", "disponivel")
        .eq("show_on_website", true)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const { data: media = [] } = usePropertyMedia(id);

  async function handleSubmit() {
    if (!form.name || !form.phone) {
      toast.error("Preencha nome e telefone.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("leads").insert({
        name: form.name,
        email: form.email || null,
        phone: form.phone,
        property_id: id,
        source: "site" as any,
        status: "novo" as any,
        interest_type: property?.purpose === "venda" ? "venda" : "locacao",
        notes: form.message || `Interesse no imóvel: ${property?.title}`,
      } as any);
      if (error) throw error;
      toast.success("Interesse registrado! Entraremos em contato em breve.");
      setInterestOpen(false);
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch {
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (!property) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Home className="h-12 w-12 opacity-30" />
        <p>Imóvel não encontrado ou indisponível.</p>
        <Link to="/vitrine"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar à Vitrine</Button></Link>
      </div>
    );
  }

  const price = property.purpose === "locacao" ? property.rental_price : property.sale_price;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Link to="/vitrine" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar à Vitrine
        </Link>

        {/* Image gallery */}
        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden relative">
          {media.length > 0 ? (
            <>
              <img src={media[currentImg]?.media_url} alt={property.title} className="w-full h-full object-cover" />
              {media.length > 1 && (
                <>
                  <Button variant="ghost" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80" onClick={() => setCurrentImg(i => (i - 1 + media.length) % media.length)}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/60 hover:bg-background/80" onClick={() => setCurrentImg(i => (i + 1) % media.length)}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {media.map((_: any, i: number) => (
                      <button key={i} className={`w-2 h-2 rounded-full ${i === currentImg ? "bg-primary" : "bg-background/60"}`} onClick={() => setCurrentImg(i)} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <Building2 className="h-16 w-16 text-muted-foreground/30" />
          )}
        </div>

        {/* Thumbnail strip */}
        {media.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {media.map((m: any, i: number) => (
              <button key={m.id} onClick={() => setCurrentImg(i)} className={`flex-shrink-0 w-20 h-14 rounded overflow-hidden border-2 ${i === currentImg ? "border-primary" : "border-transparent"}`}>
                <img src={m.media_url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{property.title}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-4 w-4" />
              {[property.street, property.number, property.neighborhood, property.city, property.state].filter(Boolean).join(", ") || "Localização não informada"}
            </p>
          </div>
          <Badge variant="outline">{purposeLabels[property.purpose] || property.purpose}</Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {property.bedrooms > 0 && <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" />{property.bedrooms} quartos</span>}
          {property.bathrooms > 0 && <span className="flex items-center gap-1"><Bath className="h-4 w-4" />{property.bathrooms} banheiros</span>}
          {property.parking_spots > 0 && <span className="flex items-center gap-1"><Car className="h-4 w-4" />{property.parking_spots} vagas</span>}
          {property.area_total > 0 && <span className="flex items-center gap-1"><Maximize className="h-4 w-4" />{property.area_total}m²</span>}
        </div>

        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary">{price ? fmt(Number(price)) : "Consulte"}</p>
              {property.purpose === "locacao" && price && <p className="text-xs text-muted-foreground">/mês</p>}
            </div>
            <Button onClick={() => setInterestOpen(true)}>
              <Send className="h-4 w-4 mr-1" /> Tenho Interesse
            </Button>
          </CardContent>
        </Card>

        {property.description && (
          <Card>
            <CardContent className="pt-6">
              <h2 className="font-semibold mb-2">Descrição</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{property.description}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={interestOpen} onOpenChange={setInterestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Tenho Interesse</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Imóvel: <strong>{property.title}</strong></p>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Telefone *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Mensagem</Label><Textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={3} placeholder="Gostaria de agendar uma visita..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterestOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}><Send className="h-4 w-4 mr-1" /> {submitting ? "Enviando..." : "Enviar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
