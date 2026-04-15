"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Building, LayoutDashboard, BookOpen } from "lucide-react";

const menuItems = [
  { label: "Visão Geral", href: "/cadastro", icon: LayoutDashboard, exact: true },
  { label: "Instituições (IES)", href: "/cadastro/ies", icon: Building2 },
  { label: "Departamentos", href: "/cadastro/departamentos", icon: Building },
  { label: "Cursos", href: "/cadastro/cursos", icon: BookOpen },
];

export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 min-h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center">
              <Building2 size={18} className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900 leading-none">Cadastro</p>
              <p className="text-xs text-gray-400 mt-0.5">IES, Estrutura e Cursos</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {menuItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href) && item.href !== "/cadastro";
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">Módulo Cadastro</p>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
