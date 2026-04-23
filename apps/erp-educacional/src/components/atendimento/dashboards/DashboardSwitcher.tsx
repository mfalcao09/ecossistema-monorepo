"use client";

import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ChevronDown,
  Pin,
  Plus,
  Pencil,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import type { Dashboard } from "@/lib/atendimento/dashboards";

interface Props {
  current: Dashboard | null;
  dashboards: Dashboard[];
  currentUserId: string | null;
  canWrite: boolean;
  onSelect: (d: Dashboard) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (d: Dashboard, newName: string) => Promise<void>;
  onDelete: (d: Dashboard) => Promise<void>;
  onTogglePin: (d: Dashboard) => Promise<void>;
}

export function DashboardSwitcher({
  current,
  dashboards,
  currentUserId,
  canWrite,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onTogglePin,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingId(null);
        setCreating(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const myDashboards = dashboards.filter(
    (d) => d.owner_user_id === currentUserId,
  );
  const sharedDashboards = dashboards.filter(
    (d) => d.owner_user_id !== currentUserId,
  );

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    await onCreate(name);
    setNewName("");
    setCreating(false);
  }

  async function handleRename(d: Dashboard) {
    const next = editValue.trim();
    if (next && next !== d.name) await onRename(d, next);
    setEditingId(null);
    setEditValue("");
  }

  function renderItem(d: Dashboard) {
    const isOwner = d.owner_user_id === currentUserId;
    const isActive = current?.id === d.id;
    const isEditing = editingId === d.id;

    return (
      <div
        key={d.id}
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
          isActive
            ? "bg-emerald-50 text-emerald-900"
            : "hover:bg-slate-50 text-slate-700"
        }`}
        onClick={() => {
          if (!isEditing) {
            onSelect(d);
            setOpen(false);
          }
        }}
      >
        <LayoutDashboard
          size={14}
          className={isActive ? "text-emerald-600" : "text-slate-400"}
        />
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleRename(d)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename(d);
              if (e.key === "Escape") setEditingId(null);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-white border border-emerald-300 rounded px-1.5 py-0.5 text-sm"
          />
        ) : (
          <span className="flex-1 truncate">{d.name}</span>
        )}
        {d.is_shared && !isOwner && (
          <UsersIcon
            size={12}
            className="text-slate-400"
            aria-label="Compartilhado"
          />
        )}
        {isOwner && !isEditing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              title={d.pinned_order > 0 ? "Desafixar" : "Fixar"}
              onClick={(e) => {
                e.stopPropagation();
                void onTogglePin(d);
              }}
              className="p-1 hover:bg-slate-200 rounded"
            >
              <Pin
                size={12}
                className={
                  d.pinned_order > 0 ? "text-emerald-600" : "text-slate-400"
                }
                fill={d.pinned_order > 0 ? "currentColor" : "none"}
              />
            </button>
            <button
              type="button"
              title="Renomear"
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(d.id);
                setEditValue(d.name);
              }}
              className="p-1 hover:bg-slate-200 rounded"
            >
              <Pencil size={12} className="text-slate-400" />
            </button>
            <button
              type="button"
              title="Excluir"
              onClick={(e) => {
                e.stopPropagation();
                if (
                  confirm(
                    `Excluir dashboard "${d.name}"? Os widgets serão removidos.`,
                  )
                ) {
                  void onDelete(d);
                }
              }}
              className="p-1 hover:bg-red-100 rounded"
            >
              <Trash2 size={12} className="text-slate-400" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm text-slate-700"
      >
        <LayoutDashboard size={14} className="text-slate-500" />
        <span className="font-medium">{current?.name ?? "Dashboard"}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 rounded-xl border border-slate-200 bg-white shadow-lg z-50 p-2">
          {myDashboards.length > 0 && (
            <>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
                Minhas dashboards
              </div>
              {myDashboards.map(renderItem)}
            </>
          )}

          {sharedDashboards.length > 0 && (
            <>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 mt-2">
                Compartilhadas
              </div>
              {sharedDashboards.map(renderItem)}
            </>
          )}

          {canWrite && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              {creating ? (
                <div className="flex items-center gap-2 px-2 py-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleCreate();
                      if (e.key === "Escape") {
                        setCreating(false);
                        setNewName("");
                      }
                    }}
                    placeholder="Nome da dashboard"
                    className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    className="text-xs px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    Criar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-emerald-700 hover:bg-emerald-50"
                >
                  <Plus size={14} />
                  Adicionar dashboard
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
