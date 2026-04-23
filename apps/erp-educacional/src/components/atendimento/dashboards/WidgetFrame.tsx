"use client";

import { MoreVertical, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  canEdit: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}

export function WidgetFrame({
  title,
  subtitle,
  icon,
  canEdit,
  onRemove,
  children,
}: Props) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menu]);

  return (
    <div className="h-full w-full rounded-xl border border-slate-200 bg-white flex flex-col overflow-hidden">
      <div className="flex items-start justify-between px-4 py-3 border-b border-slate-100 widget-drag-handle cursor-move">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="text-sm font-semibold text-slate-700 truncate">
              {title}
            </h3>
          </div>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {canEdit && (
          <div ref={ref} className="relative">
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setMenu((v) => !v);
              }}
              className="p-1 hover:bg-slate-100 rounded text-slate-400"
            >
              <MoreVertical size={14} />
            </button>
            {menu && (
              <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-slate-200 bg-white shadow-lg z-20">
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    if (confirm(`Remover widget "${title}"?`)) onRemove();
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                >
                  <X size={12} /> Remover widget
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}
