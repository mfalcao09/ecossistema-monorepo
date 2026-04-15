import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  FileText,
  CheckCircle2,
  PenTool,
  Paperclip,
  DollarSign,
  Brain,
  Settings,
  Search,
  Download,
  Filter,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Shield,
  Calendar,
  User,
  X,
} from "lucide-react";
import {
  useAuditTimeline,
  useAuditStats,
  useExportAudit,
  groupEventsByDate,
  calculateAuditHash,
  AuditEvent,
  AuditEventCategory,
  AuditFilters,
  AUDIT_CATEGORY_CONFIG,
  EVENT_TYPE_LABELS,
} from "@/hooks/useAuditTimeline";

// ============================================================
// AuditTimelinePanel — Painel visual da trilha de auditoria
// Fase 4, Épico 2: Timeline com filtros, stats e exportação
// ============================================================

interface AuditTimelinePanelProps {
  contractId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Ícone dinâmico por categoria
function CategoryIcon({ category, className }: { category: AuditEventCategory; className?: string }) {
  const iconMap: Record<AuditEventCategory, React.ReactNode> = {
    lifecycle: <RefreshCw className={className} />,
    content: <FileText className={className} />,
    approval: <CheckCircle2 className={className} />,
    signature: <PenTool className={className} />,
    document: <Paperclip className={className} />,
    financial: <DollarSign className={className} />,
    ai: <Brain className={className} />,
    system: <Settings className={className} />,
  };
  return <>{iconMap[category] || <Clock className={className} />}</>;
}

// Card de estatística
function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

// Evento individual na timeline
function TimelineEvent({ event, isLast }: { event: AuditEvent; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const config = AUDIT_CATEGORY_CONFIG[event.event_category] || AUDIT_CATEGORY_CONFIG.system;
  const time = new Date(event.created_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasDetails = event.field_name || event.old_value || event.new_value || event.metadata;

  return (
    <div className="flex gap-3 relative">
      {/* Linha vertical da timeline */}
      {!isLast && (
        <div className="absolute left-[17px] top-[36px] bottom-0 w-[2px] bg-gray-200" />
      )}

      {/* Ícone circular */}
      <div className={`flex-shrink-0 w-[36px] h-[36px] rounded-full ${config.bgColor} flex items-center justify-center z-10`}>
        <CategoryIcon category={event.event_category} className={`h-4 w-4 ${config.color}`} />
      </div>

      {/* Conteúdo do evento */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-gray-900">
                {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
              </span>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.color} ${config.bgColor} border-0`}>
                {config.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {event.description}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
            <Clock className="h-3 w-3" />
            {time}
          </div>
        </div>

        {/* Informações do usuário */}
        {(event.user_name || event.user_email) && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{event.user_name || event.user_email}</span>
          </div>
        )}

        {/* Detalhes expandíveis */}
        {hasDetails && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Ocultar detalhes" : "Ver detalhes"}
            </button>

            {expanded && (
              <div className="mt-2 rounded-md bg-gray-50 border p-3 space-y-2">
                {event.field_name && (
                  <div className="text-xs">
                    <span className="font-medium text-gray-700">Campo: </span>
                    <span className="text-gray-600">{event.field_name}</span>
                  </div>
                )}
                {(event.old_value || event.new_value) && (
                  <div className="flex items-center gap-2 text-xs">
                    {event.old_value && (
                      <span className="bg-red-50 text-red-700 px-2 py-1 rounded line-through">
                        {event.old_value.length > 80
                          ? event.old_value.substring(0, 80) + "..."
                          : event.old_value}
                      </span>
                    )}
                    {event.old_value && event.new_value && (
                      <ArrowRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    )}
                    {event.new_value && (
                      <span className="bg-green-50 text-green-700 px-2 py-1 rounded">
                        {event.new_value.length > 80
                          ? event.new_value.substring(0, 80) + "..."
                          : event.new_value}
                      </span>
                    )}
                  </div>
                )}
                {event.metadata && Object.keys(event.metadata).length > 0 && (
                  <div className="text-xs">
                    <span className="font-medium text-gray-700">Metadados: </span>
                    <code className="text-[11px] bg-gray-100 px-1 rounded">
                      {JSON.stringify(event.metadata, null, 0).substring(0, 200)}
                    </code>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditTimelinePanel({
  contractId,
  open,
  onOpenChange,
}: AuditTimelinePanelProps) {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [integrityHash, setIntegrityHash] = useState<string | null>(null);

  const { data: events = [], isLoading } = useAuditTimeline(contractId, filters);
  const { data: stats } = useAuditStats(contractId);
  const exportAudit = useExportAudit();

  // Agrupar eventos por data
  const groupedEvents = useMemo(() => groupEventsByDate(events), [events]);
  const dateKeys = useMemo(() => Object.keys(groupedEvents), [groupedEvents]);

  // Categorias ativas para filtro
  const allCategories: AuditEventCategory[] = [
    "lifecycle", "content", "approval", "signature", "document", "financial", "ai", "system",
  ];

  // Calcular hash de integridade
  const handleVerifyIntegrity = async () => {
    if (events.length > 0) {
      const hash = await calculateAuditHash(events);
      setIntegrityHash(hash);
    }
  };

  // Limpar filtros
  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = (filters.categories && filters.categories.length > 0) ||
    (filters.eventTypes && filters.eventTypes.length > 0) ||
    filters.searchTerm || filters.dateFrom || filters.dateTo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1A1A2E]">
            <Shield className="h-5 w-5 text-[#e2a93b]" />
            Trilha de Auditoria Completa
          </DialogTitle>
        </DialogHeader>

        {/* Cards de estatísticas */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Total de Eventos"
              value={stats.totalEvents}
              color="bg-blue-50"
            />
            <StatCard
              label="Categorias"
              value={stats.uniqueCategories}
              color="bg-purple-50"
            />
            <StatCard
              label="Último Evento"
              value={
                stats.lastEventDate
                  ? new Date(stats.lastEventDate).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })
                  : "—"
              }
              color="bg-green-50"
            />
            <StatCard
              label="Alterações"
              value={stats.byCategory?.["content"] || 0}
              color="bg-amber-50"
            />
          </div>
        )}

        {/* Barra de ações */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nos eventos..."
              value={filters.searchTerm || ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, searchTerm: e.target.value || undefined }))}
              className="pl-9 h-9"
            />
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showFilters ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="relative"
                >
                  <Filter className="h-4 w-4" />
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-[#e2a93b] rounded-full" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Filtros</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyIntegrity}
                >
                  <Shield className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Verificar integridade (SHA-256)</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="outline"
            size="sm"
            onClick={() => exportAudit.mutate(contractId)}
            disabled={exportAudit.isPending}
          >
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>

        {/* Hash de integridade */}
        {integrityHash && (
          <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-xs text-green-800 font-medium">SHA-256:</span>
              <code className="text-[11px] text-green-700 font-mono">
                {integrityHash.substring(0, 32)}...
              </code>
            </div>
            <button onClick={() => setIntegrityHash(null)} className="text-green-600 hover:text-green-800">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Painel de filtros expansível */}
        {showFilters && (
          <div className="bg-gray-50 rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Filtrar por categoria</span>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                  Limpar filtros
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allCategories.map((cat) => {
                const config = AUDIT_CATEGORY_CONFIG[cat];
                const isActive = filters.categories?.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setFilters((prev) => {
                        const current = prev.categories || [];
                        const next = isActive
                          ? current.filter((c) => c !== cat)
                          : [...current, cat];
                        return { ...prev, categories: next.length > 0 ? next : undefined };
                      });
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? `${config.bgColor} ${config.color} ring-2 ring-offset-1 ring-current`
                        : "bg-white border text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {config.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">De</label>
                <Input
                  type="date"
                  value={filters.dateFrom || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, dateFrom: e.target.value || undefined }))
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Até</label>
                <Input
                  type="date"
                  value={filters.dateTo || ""}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, dateTo: e.target.value || undefined }))
                  }
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <ScrollArea className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-[#e2a93b]" />
              <span className="ml-2 text-muted-foreground">Carregando auditoria...</span>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-muted-foreground font-medium">Nenhum evento registrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                {hasActiveFilters
                  ? "Tente ajustar os filtros para ver mais resultados."
                  : "Os eventos de auditoria aparecerão aqui conforme ações forem realizadas."}
              </p>
            </div>
          ) : (
            <div className="space-y-4 pr-2">
              {dateKeys.map((dateLabel) => {
                const dayEvents = groupedEvents[dateLabel];
                return (
                  <div key={dateLabel}>
                    {/* Cabeçalho do dia */}
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-3.5 w-3.5 text-[#e2a93b]" />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {dateLabel}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {dayEvents.length}
                      </Badge>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    {/* Eventos do dia */}
                    <div className="ml-1">
                      {dayEvents.map((event, idx) => (
                        <TimelineEvent
                          key={event.id}
                          event={event}
                          isLast={idx === dayEvents.length - 1}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Footer com total */}
              <div className="text-center py-3 text-xs text-muted-foreground">
                {events.length} evento{events.length !== 1 ? "s" : ""} registrado{events.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
