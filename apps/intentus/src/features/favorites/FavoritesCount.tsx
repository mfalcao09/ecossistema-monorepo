// ============================================================
// Component: FavoritesCount
// Badge com contagem de favoritos do usuário
// ============================================================

import { Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFavoritesCount } from "./useFavorites";
import { cn } from "@/lib/utils";

interface FavoritesCountProps {
  className?: string;
  showIcon?: boolean;
}

export function FavoritesCount({ className, showIcon = true }: FavoritesCountProps) {
  const { data, isLoading } = useFavoritesCount();
  const count = data?.count ?? 0;

  if (isLoading) {
    return (
      <Badge variant="secondary" className={cn("animate-pulse", className)}>
        {showIcon && <Heart className="h-3 w-3 mr-1" />}
        ...
      </Badge>
    );
  }

  if (count === 0) return null;

  return (
    <Badge variant="secondary" className={className}>
      {showIcon && <Heart className="h-3 w-3 mr-1 fill-red-500 text-red-500" />}
      {count}
    </Badge>
  );
}
