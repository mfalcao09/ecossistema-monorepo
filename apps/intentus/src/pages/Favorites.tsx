// ============================================================
// Page: Favoritos
// Lista de imóveis favoritos do usuário
// ============================================================

import { Heart } from "lucide-react";
import { FavoritesList } from "@/features/favorites";

export default function Favorites() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Heart className="h-6 w-6 text-red-500" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Favoritos</h1>
          <p className="text-sm text-muted-foreground">
            Imóveis que você marcou como favoritos
          </p>
        </div>
      </div>
      <FavoritesList />
    </div>
  );
}
