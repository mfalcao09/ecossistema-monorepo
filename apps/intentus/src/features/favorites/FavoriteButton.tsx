// ============================================================
// Component: FavoriteButton
// Botão de coração para marcar imóvel como favorito
// ============================================================

import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFavoriteCheck, useFavoriteToggle } from "./useFavorites";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  propertyId: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { button: "h-8 w-8", icon: "h-4 w-4" },
  md: { button: "h-9 w-9", icon: "h-5 w-5" },
  lg: { button: "h-10 w-10", icon: "h-6 w-6" },
};

export function FavoriteButton({ propertyId, size = "md", className }: FavoriteButtonProps) {
  const { data, isLoading: isChecking } = useFavoriteCheck(propertyId);
  const { mutate: toggle, isPending: isToggling } = useFavoriteToggle();

  const isFavorite = data?.isFavorite ?? false;
  const isLoading = isChecking || isToggling;
  const sizes = sizeMap[size];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(sizes.button, "rounded-full", className)}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            toggle({ propertyId });
          }}
          disabled={isLoading}
          aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          {isLoading ? (
            <Loader2 className={cn(sizes.icon, "animate-spin text-muted-foreground")} />
          ) : (
            <Heart
              className={cn(
                sizes.icon,
                "transition-colors duration-200",
                isFavorite
                  ? "fill-red-500 text-red-500"
                  : "text-muted-foreground hover:text-red-400"
              )}
            />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      </TooltipContent>
    </Tooltip>
  );
}
