import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, AlertTriangle } from "lucide-react";
import { useCompanyAnnouncements } from "@/hooks/useCompanyAnnouncements";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AnnouncementsFeed() {
  const { data: announcements = [], isLoading } = useCompanyAnnouncements();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="h-16 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (announcements.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <Megaphone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum aviso no momento</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Megaphone className="h-4 w-4" />
          Avisos da Empresa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {announcements.map((a) => (
          <div
            key={a.id}
            className={`p-3 rounded-lg border ${
              a.priority === "alta"
                ? "border-destructive/30 bg-destructive/5"
                : "border-border bg-muted/30"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                {a.priority === "alta" && (
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  {a.content && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.content}</p>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
