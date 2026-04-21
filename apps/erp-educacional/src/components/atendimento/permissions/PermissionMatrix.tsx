"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import {
  PERMISSION_MODULES,
  type PermissionAction,
  type PermissionModule,
} from "@/lib/atendimento/permissions-constants";

const ALL_ACTIONS: readonly PermissionAction[] = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
] as const;
const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "Ver",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  export: "Exportar",
};

export type PermissionEntry = {
  module: PermissionModule;
  action: PermissionAction;
  granted: boolean;
};

export interface PermissionMatrixProps {
  /** Mapa "module::action" → granted. Actions ausentes são tratadas como false. */
  value: Record<string, boolean>;
  /** Disparado ao togglar uma célula. */
  onChange: (entry: PermissionEntry) => void;
  /** Bulk "liga todas"/"desliga todas" por módulo. Opcional. */
  onToggleModule?: (module: PermissionModule, granted: boolean) => void;
  /** Desabilita todas as interações (ex: cargo is_system). */
  readOnly?: boolean;
}

/**
 * Tabela 15 módulos × 5 ações com toggles por célula.
 * Células NULL (ação não aplicável ao módulo) são renderizadas vazias.
 */
export function PermissionMatrix({
  value,
  onChange,
  onToggleModule,
  readOnly = false,
}: PermissionMatrixProps) {
  const moduleSummary = useMemo(() => {
    // quantas actions estão granted por módulo
    const map = new Map<PermissionModule, { granted: number; total: number }>();
    for (const mod of PERMISSION_MODULES) {
      let granted = 0;
      for (const act of mod.actions) {
        if (value[`${mod.slug}::${act}`]) granted += 1;
      }
      map.set(mod.slug, { granted, total: mod.actions.length });
    }
    return map;
  }, [value]);

  const isGranted = (m: PermissionModule, a: PermissionAction): boolean =>
    value[`${m}::${a}`] === true;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="sticky left-0 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-700"
              style={{ minWidth: 240 }}
            >
              Módulo
            </th>
            {ALL_ACTIONS.map((act) => (
              <th
                key={act}
                scope="col"
                className="px-3 py-3 text-center font-semibold text-gray-700"
              >
                {ACTION_LABELS[act]}
              </th>
            ))}
            <th
              scope="col"
              className="px-3 py-3 text-right font-semibold text-gray-700"
            >
              Resumo
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {PERMISSION_MODULES.map((mod) => {
            const summary = moduleSummary.get(mod.slug)!;
            const allOn = summary.granted === summary.total;
            const noneOn = summary.granted === 0;
            return (
              <tr key={mod.slug} className="hover:bg-gray-50/60">
                <td
                  className="sticky left-0 bg-white px-4 py-3 text-gray-900"
                  style={{ minWidth: 240 }}
                >
                  <div className="font-medium">{mod.name}</div>
                  <div className="text-xs text-gray-400">{mod.slug}</div>
                </td>
                {ALL_ACTIONS.map((act) => {
                  const applicable = mod.actions.includes(act);
                  if (!applicable) {
                    return (
                      <td
                        key={act}
                        className="px-3 py-3 text-center text-gray-200"
                      >
                        —
                      </td>
                    );
                  }
                  const on = isGranted(mod.slug, act);
                  return (
                    <td key={act} className="px-3 py-3 text-center">
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() =>
                          onChange({
                            module: mod.slug,
                            action: act,
                            granted: !on,
                          })
                        }
                        className={[
                          "inline-flex h-7 w-7 items-center justify-center rounded-full border transition",
                          on
                            ? "border-emerald-200 bg-emerald-500 text-white hover:bg-emerald-600"
                            : "border-gray-200 bg-white text-gray-300 hover:border-gray-300 hover:text-gray-400",
                          readOnly
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer",
                        ].join(" ")}
                        aria-pressed={on}
                        aria-label={`${ACTION_LABELS[act]} ${mod.name}`}
                        title={`${ACTION_LABELS[act]} ${mod.name}`}
                      >
                        {on ? (
                          <Check size={14} strokeWidth={3} />
                        ) : (
                          <X size={14} />
                        )}
                      </button>
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        allOn
                          ? "bg-emerald-100 text-emerald-700"
                          : noneOn
                            ? "bg-gray-100 text-gray-500"
                            : "bg-amber-100 text-amber-700",
                      ].join(" ")}
                    >
                      {summary.granted}/{summary.total}
                    </span>
                    {onToggleModule && !readOnly && (
                      <button
                        type="button"
                        onClick={() => onToggleModule(mod.slug, !allOn)}
                        className="text-xs text-gray-500 hover:text-gray-900 hover:underline"
                      >
                        {allOn ? "tirar tudo" : "liberar tudo"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
