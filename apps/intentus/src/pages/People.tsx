import React, { useState } from "react";
import { usePeople, useCreatePerson, useUpdatePerson, useDeletePerson, type Person } from "@/hooks/usePeople";
import { PersonExpandedDetails } from "@/components/people/PersonExpandedDetails";
import { PersonFormDialog } from "@/components/people/PersonFormDialog";
import { PersonFormCustomizationDialog } from "@/components/people/PersonFormCustomizationDialog";
import { personTypeLabels, type PersonFormValues } from "@/lib/personSchema";
import { useFormCustomization } from "@/hooks/useFormCustomization";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Pencil, Trash2, Settings2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const typeBadgeVariant: Record<string, string> = {
  cliente: "bg-blue-100 text-blue-800",
  proprietario: "bg-emerald-100 text-emerald-800",
  fiador: "bg-purple-100 text-purple-800",
  locatario: "bg-amber-100 text-amber-800",
  comprador: "bg-teal-100 text-teal-800",
  lead: "bg-orange-100 text-orange-800",
};

export default function People() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const { isAdminOrGerente, isSuperAdmin } = useAuth();
  const { config } = useFormCustomization();

  const allTypeLabels: Record<string, string> = {
    ...personTypeLabels,
    ...Object.fromEntries(config.person_extra_types.map((t) => [t.key, t.label])),
  };

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const { data: people, isLoading } = usePeople({ search, person_type: typeFilter });
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const deletePerson = useDeletePerson();

  const handleCreate = (values: PersonFormValues) => {
    createPerson.mutate(values as Parameters<typeof createPerson.mutate>[0], {
      onSuccess: () => setFormOpen(false),
    });
  };

  const handleUpdate = (values: PersonFormValues) => {
    if (!editPerson) return;
    updatePerson.mutate({ id: editPerson.id, ...values } as Parameters<typeof updatePerson.mutate>[0], {
      onSuccess: () => {
        setEditPerson(null);
        setFormOpen(false);
      },
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deletePerson.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const openEdit = (person: Person) => {
    setEditPerson(person);
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditPerson(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Pessoas</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie clientes, proprietários, leads e demais contatos
          </p>
        </div>
        <div className="flex gap-2">
          {isAdminOrGerente && (
            <Button variant="outline" onClick={() => setCustomizeOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Personalizar Campos
            </Button>
          )}
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Pessoa
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, CPF ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(allTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden md:table-cell">Telefone</TableHead>
              <TableHead className="hidden lg:table-cell">Cidade</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : people && people.length > 0 ? (
              people.map((person) => (
                <React.Fragment key={person.id}>
                <TableRow>
                  <TableCell
                    className="font-medium cursor-pointer hover:text-primary transition-colors"
                    onClick={() => toggleExpanded(person.id)}
                  >
                    {person.name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={typeBadgeVariant[person.person_type] ?? ""}
                    >
                      {allTypeLabels[person.person_type] ?? person.person_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {person.email ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {person.phone ?? "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {person.city ? `${person.city}${person.state ? `/${person.state}` : ""}` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(person)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isSuperAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(person)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                {expandedId === person.id && (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0 bg-muted/20">
                      <PersonExpandedDetails personId={person.id} />
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  {search || typeFilter !== "todos"
                    ? "Nenhuma pessoa encontrada com os filtros selecionados."
                    : "Nenhuma pessoa cadastrada ainda. Clique em \"Nova Pessoa\" para começar."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Form dialog */}
      <PersonFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditPerson(null);
        }}
        person={editPerson}
        onSubmit={editPerson ? handleUpdate : handleCreate}
        isPending={createPerson.isPending || updatePerson.isPending}
      />

      {/* Customization dialog */}
      <PersonFormCustomizationDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Excluir permanentemente</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?</p>
                <p className="mt-2 text-destructive font-semibold">Esta ação é irreversível. Todos os dados desta pessoa serão removidos permanentemente do sistema.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
