import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDealMembers,
  useAddDealMember,
  useRemoveDealMember,
} from "@/hooks/useDealMembers";
import { useProfiles } from "@/hooks/useDealCardFeatures";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DealMembersPopover({
  dealId,
  trigger,
}: {
  dealId: string;
  trigger?: React.ReactNode;
}) {
  const { data: members } = useDealMembers(dealId);
  const { data: profiles } = useProfiles();
  const addMember = useAddDealMember();
  const removeMember = useRemoveDealMember();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const memberUserIds = useMemo(
    () => new Set((members || []).map((m: any) => m.user_id)),
    [members]
  );

  const filtered = useMemo(() => {
    if (!profiles) return [];
    const q = search.toLowerCase();
    return profiles.filter(
      (p) => p.name && p.name.toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const handleToggle = (userId: string) => {
    if (memberUserIds.has(userId)) {
      const member = (members || []).find((m: any) => m.user_id === userId);
      if (member) removeMember.mutate({ id: member.id, dealId });
    } else {
      addMember.mutate({ dealId, userId });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Membros
            {members && members.length > 0 && (
              <span className="ml-1 bg-primary/10 text-primary rounded-full px-1.5 text-[10px] font-semibold">
                {members.length}
              </span>
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" side="bottom">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Membros</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-3">
          <Input
            placeholder="Pesquisar membros"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-60">
          <div className="px-2 pb-2 space-y-0.5">
            {/* Current members */}
            {members && members.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Membros do Quadro
                </div>
                {members
                  .filter((m: any) => {
                    if (!search) return true;
                    const p = profiles?.find((pr) => pr.user_id === m.user_id);
                    return p?.name?.toLowerCase().includes(search.toLowerCase());
                  })
                  .map((m: any) => {
                    const p = profiles?.find((pr) => pr.user_id === m.user_id);
                    const name = p?.name || "?";
                    return (
                      <button
                        key={m.id}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted transition-colors group"
                        onClick={() => handleToggle(m.user_id)}
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {getInitials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm flex-1 text-left">{name}</span>
                        <X className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
              </>
            )}

            {/* Available to add */}
            {filtered.filter((p) => !memberUserIds.has(p.user_id)).length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Disponíveis
                </div>
                {filtered
                  .filter((p) => !memberUserIds.has(p.user_id))
                  .map((p) => (
                    <button
                      key={p.user_id}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted transition-colors"
                      onClick={() => handleToggle(p.user_id)}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                          {getInitials(p.name || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1 text-left">{p.name}</span>
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ))}
              </>
            )}

            {filtered.length === 0 && (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                Nenhum membro encontrado
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function DealMembersAvatars({ dealId }: { dealId: string }) {
  const { data: members } = useDealMembers(dealId);
  const { data: profiles } = useProfiles();

  if (!members || members.length === 0) return null;

  return (
    <div className="flex -space-x-1.5">
      {members.slice(0, 5).map((m: any) => {
        const p = profiles?.find((pr) => pr.user_id === m.user_id);
        const name = p?.name || "?";
        return (
          <Avatar key={m.id} className="h-6 w-6 border-2 border-background">
            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
        );
      })}
      {members.length > 5 && (
        <Avatar className="h-6 w-6 border-2 border-background">
          <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
            +{members.length - 5}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
