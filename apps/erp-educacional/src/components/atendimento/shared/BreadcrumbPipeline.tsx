"use client";

/**
 * BreadcrumbPipeline — "Pipeline X › Etapa Y" clicável.
 * Exibido no header do ChatPanel quando a conversa está vinculada a um deal.
 *
 * S4 Kanban CRM · shared component.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbPipelineProps {
  dealId: string | null | undefined;
  onClick?: () => void; // opcional: abrir LeadDetailModal ao clicar
}

interface DealSummary {
  id: string;
  pipeline: { id: string; name: string; color_hex: string | null };
  stage:    { id: string; name: string; color_hex: string | null };
}

export default function BreadcrumbPipeline({ dealId, onClick }: BreadcrumbPipelineProps) {
  const [deal, setDeal] = useState<DealSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dealId) { setDeal(null); return; }
    setLoading(true);

    fetch(`/api/atendimento/deals/${dealId}`)
      .then(r => r.json())
      .then(json => {
        if (!json.deal) { setDeal(null); return; }
        setDeal({
          id: json.deal.id,
          pipeline: {
            id:        json.deal.pipelines?.id ?? json.deal.pipeline_id,
            name:      json.deal.pipelines?.name ?? "Pipeline",
            color_hex: json.deal.pipelines?.color_hex ?? null,
          },
          stage: {
            id:        json.deal.pipeline_stages?.id ?? json.deal.stage_id,
            name:      json.deal.pipeline_stages?.name ?? "Etapa",
            color_hex: json.deal.pipeline_stages?.color_hex ?? null,
          },
        });
      })
      .catch(() => setDeal(null))
      .finally(() => setLoading(false));
  }, [dealId]);

  if (!dealId) return null;
  if (loading) {
    return <div className="h-6 w-48 animate-pulse rounded bg-gray-100" />;
  }
  if (!deal) return null;

  const content = (
    <div className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
        style={{
          backgroundColor: (deal.pipeline.color_hex ?? "#345EF3") + "18",
          color:            deal.pipeline.color_hex ?? "#345EF3",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: deal.pipeline.color_hex ?? "#345EF3" }}
        />
        {deal.pipeline.name}
      </span>
      <ChevronRight className="h-3 w-3 text-gray-400" />
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
        style={{
          backgroundColor: (deal.stage.color_hex ?? "#98A2B3") + "18",
          color:            deal.stage.color_hex ?? "#475467",
        }}
      >
        {deal.stage.name}
      </span>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex hover:opacity-80"
        aria-label="Abrir detalhes do lead"
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={`/atendimento/crm?deal=${deal.id}`} className="inline-flex hover:opacity-80">
      {content}
    </Link>
  );
}
