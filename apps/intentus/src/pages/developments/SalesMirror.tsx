import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayoutGrid, Search } from "lucide-react";
import { useDevelopments } from "@/hooks/useDevelopments";
import { useSalesMirrorData } from "@/hooks/useSalesMirror";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  disponivel: { label: "Disponível", color: "text-white", bg: "bg-emerald-500 hover:bg-emerald-600" },
  reservado: { label: "Reservado", color: "text-white", bg: "bg-yellow-500 hover:bg-yellow-600" },
  reservada: { label: "Reservada", color: "text-white", bg: "bg-yellow-500 hover:bg-yellow-600" },
  proposta_em_analise: { label: "Proposta", color: "text-white", bg: "bg-orange-500 hover:bg-orange-600" },
  vendido: { label: "Vendido", color: "text-white", bg: "bg-red-500 hover:bg-red-600" },
  bloqueada: { label: "Bloqueado", color: "text-white", bg: "bg-gray-400 hover:bg-gray-500" },
};

export default function SalesMirror() {
  const { data: developments = [] } = useDevelopments();
  const [selectedDev, setSelectedDev] = useState<string>("");
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [filterBlock, setFilterBlock] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const devId = selectedDev || developments[0]?.id || "";
  const { data: mirror, isLoading } = useSalesMirrorData(devId || undefined);

  const filteredUnits = useMemo(() => {
    if (!mirror) return [];
    return mirror.units.filter(u => {
      if (filterBlock !== "all" && u.block_id !== filterBlock) return false;
      if (filterStatus !== "all" && u.status !== filterStatus) return false;
      if (search && !u.unit_identifier.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [mirror, filterBlock, filterStatus, search]);

  const unitsByBlock = useMemo(() => {
    const groups: Record<string, typeof filteredUnits> = {};
    const noBlock = "sem_bloco";
    filteredUnits.forEach(u => {
      const key = u.block_id || noBlock;
      if (!groups[key]) groups[key] = [];
      groups[key].push(u);
    });
    return groups;
  }, [filteredUnits]);

  const blockNames = useMemo(() => {
    const map: Record<string, string> = { sem_bloco: "Sem Bloco" };
    mirror?.blocks.forEach(b => { map[b.id] = b.nome; });
    return map;
  }, [mirror]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">Espelho de Vendas</h1>
          <p className="text-muted-foreground text-sm">Visualização interativa da disponibilidade em tempo real</p>
        </div>
        <Select value={devId} onValueChange={setSelectedDev}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Selecionar empreendimento" /></SelectTrigger>
          <SelectContent>
            {developments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {!devId ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          <LayoutGrid className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Selecione um empreendimento para visualizar o espelho.</p>
        </CardContent></Card>
      ) : isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Carregando espelho...</div>
      ) : mirror ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: "Total", value: mirror.stats.total, cls: "text-foreground" },
              { label: "Disponíveis", value: mirror.stats.disponivel, cls: "text-emerald-600" },
              { label: "Reservadas", value: mirror.stats.reservada, cls: "text-yellow-600" },
              { label: "Em Proposta", value: mirror.stats.proposta_em_analise, cls: "text-orange-600" },
              { label: "Vendidas", value: mirror.stats.vendida, cls: "text-red-600" },
              { label: "% VGV", value: `${mirror.stats.pctVGV}%`, cls: "text-primary" },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="py-3 px-4 text-center">
                  <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 items-center">
            {Object.entries(statusConfig).filter(([k]) => k !== "reservado").map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className={`h-3 w-3 rounded ${v.bg.split(" ")[0]}`} />
                <span className="text-xs text-muted-foreground">{v.label}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Bloco</Label>
              <Select value={filterBlock} onValueChange={setFilterBlock}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {mirror.blocks.map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar unidade..." className="h-8 pl-8 w-48 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Grid by block */}
          {Object.entries(unitsByBlock).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma unidade encontrada.</p>
          ) : (
            Object.entries(unitsByBlock).map(([blockId, units]) => (
              <div key={blockId} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">{blockNames[blockId] || "Sem Bloco"}</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
                  {units.map(u => {
                    const cfg = statusConfig[u.status] || statusConfig.disponivel;
                    return (
                      <button
                        key={u.id}
                        onClick={() => setSelectedUnit(u)}
                        className={`${cfg.bg} ${cfg.color} rounded-md p-2 text-center transition-all hover:scale-105 hover:shadow-md`}
                      >
                        <p className="text-xs font-bold leading-tight truncate">{u.unit_identifier}</p>
                        {u.area && <p className="text-[9px] opacity-80">{u.area}m²</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Unit detail sheet */}
          <Sheet open={!!selectedUnit} onOpenChange={v => !v && setSelectedUnit(null)}>
            <SheetContent>
              {selectedUnit && (
                <>
                  <SheetHeader>
                    <SheetTitle>{selectedUnit.unit_identifier}</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4 mt-4">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${(statusConfig[selectedUnit.status]?.bg || "bg-gray-300").split(" ")[0]}`} />
                      <Badge variant="outline">{statusConfig[selectedUnit.status]?.label || selectedUnit.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-muted-foreground text-xs">Área</p><p className="font-medium">{selectedUnit.area ? `${selectedUnit.area} m²` : "—"}</p></div>
                      <div><p className="text-muted-foreground text-xs">Preço Tabela</p><p className="font-medium">{selectedUnit.valor_tabela ? fmt(Number(selectedUnit.valor_tabela)) : selectedUnit.price ? fmt(Number(selectedUnit.price)) : "—"}</p></div>
                      <div><p className="text-muted-foreground text-xs">Andar</p><p className="font-medium">{selectedUnit.floor || "—"}</p></div>
                      <div><p className="text-muted-foreground text-xs">Tipologia</p><p className="font-medium">{selectedUnit.typology || "—"}</p></div>
                    </div>
                    {selectedUnit.status === "disponivel" && (
                      <div className="pt-3 border-t space-y-2">
                        <Button className="w-full" variant="default">Criar Proposta</Button>
                        <Button className="w-full" variant="outline">Reservar Unidade</Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        </>
      ) : null}
    </div>
  );
}
