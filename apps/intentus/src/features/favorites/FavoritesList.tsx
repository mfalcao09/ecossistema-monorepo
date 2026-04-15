// ============================================================
// Component: FavoritesList
// Lista completa de imóveis favoritos do usuário
// ============================================================

import { useState } from "react";
import { Heart, Bell, BellOff, Trash2, MapPin, Pencil, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  useFavoritesList,
  useFavoriteToggle,
  useFavoriteUpdateNotes,
  useFavoriteUpdateNotify,
  type PropertyFavorite,
} from "./useFavorites";
import { cn } from "@/lib/utils";

// ---- Empty State ----
function EmptyFavorites() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Heart className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground">
        Você ainda não tem imóveis favoritos
      </h3>
      <p className="text-sm text-muted-foreground/70 mt-1">
        Clique no ícone de coração nos imóveis para adicioná-los aqui.
      </p>
    </div>
  );
}

// ---- Loading Skeleton ----
function FavoritesSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---- Inline Notes Editor ----
function InlineNotes({
  favoriteId,
  initialNotes,
}: {
  favoriteId: string;
  initialNotes: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes || "");
  const { mutate: updateNotes, isPending } = useFavoriteUpdateNotes();

  if (!isEditing) {
    return (
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setIsEditing(true)}
      >
        <Pencil className="h-3 w-3" />
        {initialNotes ? initialNotes : "Adicionar nota..."}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Nota sobre este imóvel..."
        className="h-7 text-xs"
        maxLength={500}
        autoFocus
        disabled={isPending}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            updateNotes({ favoriteId, notes: notes || null });
            setIsEditing(false);
          }
          if (e.key === "Escape") {
            setNotes(initialNotes || "");
            setIsEditing(false);
          }
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => {
          updateNotes({ favoriteId, notes: notes || null });
          setIsEditing(false);
        }}
        disabled={isPending}
      >
        <Check className="h-3.5 w-3.5 text-green-500" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => {
          setNotes(initialNotes || "");
          setIsEditing(false);
        }}
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

// ---- Favorite Item ----
function FavoriteItem({ favorite }: { favorite: PropertyFavorite }) {
  const { mutate: toggle, isPending: isRemoving } = useFavoriteToggle();
  const { mutate: updateNotify } = useFavoriteUpdateNotify();
  const property = favorite.properties;

  return (
    <Card className={cn("transition-opacity", isRemoving && "opacity-50")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Info do imóvel */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm truncate">
                {property?.title || "Imóvel sem nome"}
              </h4>
              {property?.status && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {property.status}
                </Badge>
              )}
              {property?.purpose && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {property.purpose === "sale" ? "Venda" : property.purpose === "rent" ? "Locação" : property.purpose}
                </Badge>
              )}
            </div>

            {(property?.street || property?.city) && (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate">
                  {[property.street, property.neighborhood, property.city, property.state].filter(Boolean).join(", ")}
                </span>
              </div>
            )}

            {(property?.sale_price || property?.rental_price) && (
              <span className="text-xs font-medium text-primary mt-0.5 block">
                {property.sale_price
                  ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(property.sale_price)
                  : property.rental_price
                    ? `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(property.rental_price)}/mês`
                    : ""}
              </span>
            )}

            {/* Notas editáveis inline */}
            <div className="mt-1.5">
              <InlineNotes favoriteId={favorite.id} initialNotes={favorite.notes} />
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle notificação */}
            <div className="flex items-center gap-1.5" title={
              favorite.notify_on_change
                ? "Notificações ativadas"
                : "Notificações desativadas"
            }>
              {favorite.notify_on_change ? (
                <Bell className="h-3.5 w-3.5 text-primary" />
              ) : (
                <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <Switch
                checked={favorite.notify_on_change}
                onCheckedChange={(checked) =>
                  updateNotify({ favoriteId: favorite.id, notifyOnChange: checked })
                }
                className="scale-75"
              />
            </div>

            {/* Remover favorito */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => toggle({ propertyId: favorite.property_id })}
              disabled={isRemoving}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---- Main Component ----
export function FavoritesList() {
  const { data: favorites, isLoading, error } = useFavoritesList();

  if (isLoading) return <FavoritesSkeleton />;

  if (error) {
    return (
      <div className="text-center py-8 text-destructive text-sm">
        Erro ao carregar favoritos: {error.message}
      </div>
    );
  }

  if (!favorites || favorites.length === 0) return <EmptyFavorites />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          {favorites.length} {favorites.length === 1 ? "favorito" : "favoritos"}
        </h3>
      </div>
      {favorites.map((favorite) => (
        <FavoriteItem key={favorite.id} favorite={favorite} />
      ))}
    </div>
  );
}
