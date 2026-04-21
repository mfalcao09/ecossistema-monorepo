"use client";

/**
 * TemplatePreview — mockup WhatsApp bubble para visualizar templates HSM.
 * Recebe `components` no formato Meta e renderiza como bubble "outgoing".
 */

import { MessageSquare } from "lucide-react";
import type { MetaComponent } from "@/lib/atendimento/meta-templates";
import { renderTemplateBody } from "@/lib/atendimento/meta-templates";

interface Props {
  components: MetaComponent[];
  variables?: string[];
  compact?: boolean;
}

export default function TemplatePreview({ components, variables = [], compact }: Props) {
  const header = components.find((c) => c.type === "HEADER");
  const body = components.find((c) => c.type === "BODY");
  const footer = components.find((c) => c.type === "FOOTER");
  const buttonsComp = components.find((c) => c.type === "BUTTONS");

  const rendered = body && body.type === "BODY"
    ? renderTemplateBody(components, variables)
    : "";

  return (
    <div
      className={`bg-[#ece5dd] rounded-lg p-3 ${compact ? "min-h-[140px]" : "min-h-[200px]"}`}
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(0,0,0,0.02) 0 2px, transparent 2px 8px)",
      }}
    >
      <div className="bg-white rounded-lg shadow-sm max-w-[85%] p-2.5 text-[13px] leading-snug">
        {/* HEADER */}
        {header?.type === "HEADER" && (
          <div className="mb-1.5">
            {header.format === "TEXT" && header.text && (
              <div className="font-semibold text-gray-900">{header.text}</div>
            )}
            {(header.format === "IMAGE" ||
              header.format === "VIDEO" ||
              header.format === "DOCUMENT") && (
              <div className="flex items-center justify-center bg-gray-100 rounded h-20 text-gray-400 text-xs">
                [{header.format}]
              </div>
            )}
          </div>
        )}

        {/* BODY */}
        <div className="whitespace-pre-wrap text-gray-800">
          {rendered || (
            <span className="text-gray-400 italic flex items-center gap-1">
              <MessageSquare size={11} /> Sem corpo
            </span>
          )}
        </div>

        {/* FOOTER */}
        {footer?.type === "FOOTER" && (
          <div className="text-[11px] text-gray-400 mt-1.5">{footer.text}</div>
        )}

        {/* Timestamp + status fake */}
        <div className="text-[10px] text-gray-400 text-right mt-1">
          10:30 ✓✓
        </div>

        {/* BUTTONS */}
        {buttonsComp?.type === "BUTTONS" && buttonsComp.buttons.length > 0 && (
          <div className="border-t border-gray-100 mt-2 pt-1.5 -mx-2.5 -mb-2.5">
            {buttonsComp.buttons.map((btn, idx) => (
              <div
                key={idx}
                className="text-center text-[12px] text-blue-600 font-medium py-1.5 border-b border-gray-100 last:border-b-0"
              >
                {btn.type === "URL" ? "🔗 " : btn.type === "PHONE_NUMBER" ? "📞 " : ""}
                {btn.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
