import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, ImageOff } from "lucide-react";
import { Instagram } from "@/components/icons/BrandIcons";
import { useSocialFeed } from "@/hooks/useSocialFeed";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export function SocialFeedCarousel() {
  const { data: posts = [], isLoading } = useSocialFeed();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="h-16 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <Instagram className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Conecte seu Instagram para exibir posts aqui
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Configure em Administração → Configurações do Site
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Instagram className="h-4 w-4" />
          Instagram
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-3 pb-2">
            {posts.map((post) => (
              <a
                key={post.id}
                href={post.permalink || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="group shrink-0 w-36"
              >
                <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                  {post.media_url ? (
                    <img
                      src={post.media_url}
                      alt={post.caption?.slice(0, 60) || "Post do Instagram"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageOff className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                {post.caption && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 whitespace-normal line-clamp-2">
                    {post.caption}
                  </p>
                )}
              </a>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
