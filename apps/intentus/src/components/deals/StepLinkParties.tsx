import { useState } from "react";
import { usePeopleForSelect } from "@/hooks/useContracts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { partyRoleLabels } from "@/lib/contractSchema";
import { Search, Plus, Trash2, Users } from "lucide-react";
import type { DealRequestParty } from "@/hooks/useDealRequests";

interface Props {
  parties: DealRequestParty[];
  onChange: (parties: DealRequestParty[]) => void;
}

const roles = Object.entries(partyRoleLabels) as [DealRequestParty["role"], string][];

export function StepLinkParties({ parties, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedRole, setSelectedRole] = useState<DealRequestParty["role"]>("proprietario");
  const { data: people, isLoading } = usePeopleForSelect();

  const filteredPeople = people?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      !parties.some((party) => party.person_id === p.id && party.role === selectedRole)
  );

  const addParty = () => {
    if (!selectedPersonId) return;
    onChange([...parties, { person_id: selectedPersonId, role: selectedRole }]);
    setSelectedPersonId("");
  };

  const removeParty = (index: number) => {
    onChange(parties.filter((_, i) => i !== index));
  };

  const getPersonName = (id: string) => people?.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Vincular Partes</h2>
        <p className="text-sm text-muted-foreground">
          As partes envolvidas (proprietário, comprador/locatário, fiadores) precisam estar cadastradas na base.
          Acesse o módulo de Pessoas caso precise cadastrá-las antes de vincular ao negócio.
        </p>
      </div>

      {/* Add party form */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as DealRequestParty["role"])}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pessoa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Button onClick={addParty} disabled={!selectedPersonId} size="sm" className="shrink-0">
              <Plus className="mr-1 h-4 w-4" />
              Adicionar
            </Button>
          </div>

          {/* Person picker */}
          {search && (
            <div className="max-h-[160px] overflow-y-auto rounded-md border divide-y">
              {isLoading ? (
                <div className="p-3 text-sm text-muted-foreground">Carregando...</div>
              ) : filteredPeople && filteredPeople.length > 0 ? (
                filteredPeople.slice(0, 10).map((person) => (
                  <button
                    key={person.id}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${
                      selectedPersonId === person.id ? "bg-primary/10 text-primary" : ""
                    }`}
                    onClick={() => {
                      setSelectedPersonId(person.id);
                      setSearch(person.name);
                    }}
                  >
                    <span className="font-medium">{person.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground capitalize">
                      {person.person_type}
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-3 text-sm text-muted-foreground">
                  Nenhuma pessoa encontrada. Cadastre no módulo de Pessoas.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current parties */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          <Users className="h-4 w-4" />
          Partes vinculadas ({parties.length})
        </h3>
        {parties.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma parte vinculada ainda. Adicione pelo menos uma parte para prosseguir.
          </p>
        ) : (
          <div className="space-y-1">
            {parties.map((party, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Badge variant="secondary" className="text-xs shrink-0">
                  {partyRoleLabels[party.role]}
                </Badge>
                <span className="flex-1 text-sm truncate">{getPersonName(party.person_id)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeParty(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
