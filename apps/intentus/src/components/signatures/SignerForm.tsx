import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2, X, ChevronDown, Search } from "lucide-react";
import { SIGNER_ROLES, AUTH_METHODS_LIST, SIGNER_ROLE_LABELS, AUTH_METHOD_LABELS } from "@/lib/signatureProvidersDefaults";

const AUTH_METHOD_DESCRIPTIONS: Record<string, string> = {
  email: "Token enviado para o email cadastrado do signatário",
  sms: "Token enviado por SMS para o telefone cadastrado",
  whatsapp: "Token enviado por WhatsApp para o telefone cadastrado",
  icpbrasil: "Validação via certificado digital (e-CPF/e-CNPJ)",
  manuscrita: "Coleta de assinatura desenhada na tela",
};

export interface SignerData {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  roles: string[];
  auth_methods: string[];
  date_of_birth: string;
  sign_order: number;
  extra: Record<string, any>;
}

export const EMPTY_SIGNER: SignerData = {
  name: "", email: "", cpf: "", phone: "",
  roles: ["sign"], auth_methods: ["email"],
  date_of_birth: "", sign_order: 1, extra: {},
};

interface Props {
  signer: SignerData;
  index: number;
  canRemove: boolean;
  showOrder?: boolean;
  onChange: (index: number, field: keyof SignerData, value: any) => void;
  onRemove: (index: number) => void;
}

function MultiSelectPopover({
  label,
  options,
  selected,
  onChange,
  searchable = false,
  descriptions,
  helperText,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (vals: string[]) => void;
  searchable?: boolean;
  descriptions?: Record<string, string>;
  helperText?: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  };

  const labelMap = useMemo(() => Object.fromEntries(options.map((o) => [o.value, o.label])), [options]);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {helperText && <p className="text-[10px] text-muted-foreground leading-tight">{helperText}</p>}
      <div className="flex flex-wrap gap-1 mb-1">
        {selected.map((val) => {
          const badge = (
            <Badge key={val} variant="secondary" className="text-xs gap-1 pr-1">
              {labelMap[val] || val}
              <button type="button" onClick={() => toggle(val)} className="ml-0.5 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
          if (descriptions?.[val]) {
            return (
              <TooltipProvider key={val} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>{badge}</TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-xs">
                    {descriptions[val]}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }
          return badge;
        })}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-full justify-between text-xs h-8">
            Selecionar {label.toLowerCase()}
            <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          {searchable && (
            <div className="flex items-center gap-1.5 mb-2 border-b pb-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 p-0"
              />
            </div>
          )}
          <ScrollArea className="max-h-72 overflow-y-auto">
            <div className="space-y-0.5">
              {filtered.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted cursor-pointer text-xs"
                >
                  <Checkbox
                    checked={selected.includes(opt.value)}
                    onCheckedChange={() => toggle(opt.value)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="flex-1">{opt.label}</span>
                  {descriptions?.[opt.value] && (
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{descriptions[opt.value]}</span>
                  )}
                </label>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhum resultado</p>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function SignerForm({ signer, index, canRemove, showOrder, onChange, onRemove }: Props) {
  return (
    <div className="border rounded-lg p-4 space-y-3 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showOrder && (
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
              {signer.sign_order}
            </span>
          )}
          <span className="text-sm font-medium">Signatário {index + 1}</span>
        </div>
        {canRemove && (
          <Button size="icon" variant="ghost" onClick={() => onRemove(index)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      {/* Name & Email */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nome</Label>
          <Input value={signer.name} onChange={(e) => onChange(index, "name", e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input value={signer.email} onChange={(e) => onChange(index, "email", e.target.value)} placeholder="email@exemplo.com" />
        </div>
      </div>

      {/* CPF, Phone, Date of birth */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">CPF</Label>
          <Input value={signer.cpf} onChange={(e) => onChange(index, "cpf", e.target.value)} placeholder="000.000.000-00" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Telefone</Label>
          <Input value={signer.phone} onChange={(e) => onChange(index, "phone", e.target.value)} placeholder="(00) 00000-0000" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Data de nascimento</Label>
          <Input type="date" value={signer.date_of_birth} onChange={(e) => onChange(index, "date_of_birth", e.target.value)} />
        </div>
      </div>

      {/* Roles & Auth methods */}
      <div className="grid grid-cols-2 gap-3">
        <MultiSelectPopover
          label="Papéis"
          options={SIGNER_ROLES}
          selected={signer.roles}
          onChange={(vals) => onChange(index, "roles", vals)}
          searchable
        />
        <MultiSelectPopover
          label="Autenticação"
          options={AUTH_METHODS_LIST}
          selected={signer.auth_methods}
          onChange={(vals) => onChange(index, "auth_methods", vals)}
          descriptions={AUTH_METHOD_DESCRIPTIONS}
          helperText="O token de verificação será enviado pelo(s) canal(is) selecionado(s) antes da assinatura."
        />
      </div>
    </div>
  );
}
