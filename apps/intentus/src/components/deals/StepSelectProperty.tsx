import { useState } from "react";
import { usePropertiesForSelect } from "@/hooks/useContracts";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  alugado: "Alugado",
  indisponivel: "Indisponível",
};

const statusColors: Record<string, string> = {
  disponivel: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  reservado: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  vendido: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  alugado: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  indisponivel: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function StepSelectProperty({ selectedId, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const { data: properties, isLoading } = usePropertiesForSelect();

  const filtered = properties?.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Selecionar Imóvel</h2>
        <p className="text-sm text-muted-foreground">
          O imóvel precisa estar cadastrado na base. Caso não encontre, acesse o módulo de Imóveis para cadastrá-lo antes de prosseguir.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar imóvel por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-2 max-h-[320px] overflow-y-auto pr-1">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))
        ) : filtered && filtered.length > 0 ? (
          filtered.map((prop) => (
            <Card
              key={prop.id}
              className={cn(
                "cursor-pointer transition-colors hover:border-primary/50",
                selectedId === prop.id && "border-primary bg-primary/5 ring-1 ring-primary/20"
              )}
              onClick={() => onSelect(prop.id)}
            >
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                  {selectedId === prop.id ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{prop.title}</p>
                </div>
                <Badge variant="secondary" className={statusColors[prop.status] ?? ""}>
                  {statusLabels[prop.status] ?? prop.status}
                </Badge>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {search ? "Nenhum imóvel encontrado." : "Nenhum imóvel cadastrado. Acesse o módulo de Imóveis para cadastrar."}
          </div>
        )}
      </div>
    </div>
  );
}
