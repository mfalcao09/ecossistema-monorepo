import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Search, Copy, ExternalLink, BedDouble, Bath, Maximize } from "lucide-react";
import { toast } from "sonner";

export default function CommercialAvailability() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterPurpose, setFilterPurpose] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["available-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("status", "disponivel")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = properties.filter((p: any) => {
    if (search) {
      const s = search.toLowerCase();
      const match = [p.title, p.neighborhood, p.city, p.address].some((f) => f?.toLowerCase().includes(s));
      if (!match) return false;
    }
    if (filterType !== "all" && p.property_type !== filterType) return false;
    if (filterPurpose !== "all" && p.purpose !== filterPurpose) return false;
    return true;
  });

  const sorted = [...filtered].sort((a: any, b: any) => {
    if (sortBy === "sale_price") return (b.sale_price || 0) - (a.sale_price || 0);
    if (sortBy === "total_area") return (b.total_area || 0) - (a.total_area || 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const types = [...new Set(properties.map((p: any) => p.property_type).filter(Boolean))];
  const purposes = [...new Set(properties.map((p: any) => p.purpose).filter(Boolean))];

  const countByType = types.reduce((acc: any, t: string) => {
    acc[t] = properties.filter((p: any) => p.property_type === t).length;
    return acc;
  }, {} as Record<string, number>);

  const formatCurrency = (v: number | null) => v ? `R$ ${v.toLocaleString("pt-BR")}` : "—";

  const handleShare = (p: any) => {
    const url = `${window.location.origin}/vitrine/${p.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Disponibilidade de Imóveis</h1>
        <p className="text-muted-foreground">Visão consolidada dos imóveis disponíveis para venda ou locação</p>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Total Disponível</p>
            <p className="text-2xl font-bold">{properties.length}</p>
          </CardContent>
        </Card>
        {Object.entries(countByType).slice(0, 3).map(([type, count]) => (
          <Card key={type}>
            <CardContent className="pt-4 pb-3">
              <p className="text-sm text-muted-foreground capitalize">{type}</p>
              <p className="text-2xl font-bold">{count as number}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por título, bairro, cidade..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPurpose} onValueChange={setFilterPurpose}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Finalidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {purposes.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Mais recente</SelectItem>
            <SelectItem value="sale_price">Maior preço</SelectItem>
            <SelectItem value="total_area">Maior área</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : sorted.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum imóvel disponível encontrado.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((p: any) => (
            <Card key={p.id} className="overflow-hidden hover:shadow-md transition-shadow">
              {p.images?.[0] ? (
                <img src={p.images[0]} alt={p.title} className="h-40 w-full object-cover" />
              ) : (
                <div className="h-40 w-full bg-muted flex items-center justify-center">
                  <Building2 className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm line-clamp-1">{p.title || "Sem título"}</h3>
                  <Badge variant="secondary" className="capitalize text-[10px] shrink-0">{p.purpose || "—"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{[p.neighborhood, p.city].filter(Boolean).join(", ") || "—"}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {p.bedrooms && <span className="flex items-center gap-0.5"><BedDouble className="h-3 w-3" />{p.bedrooms}</span>}
                  {p.bathrooms && <span className="flex items-center gap-0.5"><Bath className="h-3 w-3" />{p.bathrooms}</span>}
                  {p.total_area && <span className="flex items-center gap-0.5"><Maximize className="h-3 w-3" />{p.total_area}m²</span>}
                </div>
                <div className="text-primary font-bold">
                  {p.purpose === "venda" ? formatCurrency(p.sale_price) : formatCurrency(p.rent_value)}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => handleShare(p)}>
                    <Copy className="h-3 w-3 mr-1" /> Compartilhar
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" asChild>
                    <a href={`/vitrine/${p.id}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
