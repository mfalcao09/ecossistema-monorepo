import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Image, Music, Video, Webhook, MessageSquare, FolderPlus, Plus, Trash2, Search } from "lucide-react";
import { useChatFiles, useDeleteChatFile } from "@/hooks/useChat";
import { toast } from "sonner";

const FILE_TYPES = [
  { key: undefined, label: "Todos", icon: FileText },
  { key: "mensagem", label: "Mensagens", icon: MessageSquare },
  { key: "audio", label: "Áudio", icon: Music },
  { key: "imagem", label: "Imagens", icon: Image },
  { key: "documento", label: "Documentos", icon: FileText },
  { key: "fluxo", label: "Fluxos", icon: Video },
  { key: "webhook", label: "Webhooks", icon: Webhook },
];

export function ChatFiles() {
  const [selectedType, setSelectedType] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const { data: files, isLoading } = useChatFiles(selectedType);
  const deleteFile = useDeleteChatFile();

  const filtered = (files ?? []).filter((f) =>
    !search || f.file_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-220px)] border rounded-lg overflow-hidden">
      {/* Sidebar tipos */}
      <div className="w-48 border-r bg-muted/30 flex flex-col">
        <div className="p-3 border-b">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipos</span>
        </div>
        <ScrollArea className="flex-1">
          {FILE_TYPES.map((ft) => (
            <button
              key={ft.label}
              onClick={() => setSelectedType(ft.key)}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm hover:bg-muted/50 transition-colors ${
                selectedType === ft.key ? "bg-muted font-medium" : ""
              }`}
            >
              <ft.icon className="h-4 w-4 text-muted-foreground" />
              {ft.label}
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* Área principal */}
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar arquivos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" size="sm"><FolderPlus className="h-4 w-4 mr-1" /> Nova Pasta</Button>
          <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Arquivo</Button>
        </div>
        <ScrollArea className="flex-1 p-4">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Nenhum arquivo encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pasta</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">{file.file_name}</TableCell>
                    <TableCell><Badge variant="outline">{file.file_type}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{file.folder || "/"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          deleteFile.mutate(file.id, { onSuccess: () => toast.success("Arquivo removido") });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
