"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap, Users, PenTool, FileSignature,
  LayoutDashboard, Settings2, FolderOpen, Layers, FlaskConical,
} from "lucide-react";

interface MenuItem {
  label: string
  href: string
  icon: React.ElementType
  exact?: boolean
  badge?: string
  beta?: boolean
}

const menuItems: MenuItem[] = [
  { label: "Dashboard",    href: "/diploma",              icon: LayoutDashboard, exact: true },
  // ─── Emissão com IA ─────────────────────────────────────────────────────
  { label: "Emissões",     href: "/diploma/processos",    icon: FolderOpen,      badge: "IA" },
  { label: "Assinaturas",  href: "/diploma/assinaturas",  icon: FileSignature,   badge: "BRy" },
  // ─── Cadastros ──────────────────────────────────────────────────────────
  { label: "Diplomados",   href: "/diploma/diplomados",   icon: Users },
  { label: "Assinantes",   href: "/diploma/assinantes",   icon: PenTool },
  { label: "Configurações",href: "/diploma/configuracoes",icon: Settings2 },
  // ─── Migração — funcionalidade Beta ─────────────────────────────────────
  { label: "Migração",     href: "/diploma/migracao",     icon: Layers,          badge: "Legado", beta: true },
];

export default function DiplomaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 min-h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center">
              <GraduationCap size={18} className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900 leading-none">Diploma Digital</p>
              <p className="text-xs text-gray-400 mt-0.5">XSD v1.05 · MEC</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {menuItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href) && item.href !== "/diploma";
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {/* Badge "IA" / "Legado" */}
                {item.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 leading-none flex-shrink-0">
                    {item.badge}
                  </span>
                )}
                {/* Badge Beta */}
                {item.beta && (
                  <span className="inline-flex items-center gap-0.5 px-1 py-0.5 text-[9px] font-bold uppercase rounded-full bg-amber-100 text-amber-700 border border-amber-300 leading-none flex-shrink-0">
                    <FlaskConical size={8} />
                    β
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">Módulo Diploma Digital</p>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
