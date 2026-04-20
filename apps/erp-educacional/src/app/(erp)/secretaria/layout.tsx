"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ScrollText, FileText, Settings2, LayoutDashboard,
} from "lucide-react";

interface MenuItem {
  label: string;
  href: string;
  icon: React.ElementType;
  exact?: boolean;
  sub?: { label: string; href: string }[];
}

const menuItems: MenuItem[] = [
  { label: "Dashboard", href: "/secretaria", icon: LayoutDashboard, exact: true },
  {
    label: "Emissão",
    href: "/secretaria/emissao",
    icon: FileText,
    sub: [
      { label: "Histórico Escolar", href: "/secretaria/emissao/historico" },
    ],
  },
  {
    label: "Configurações",
    href: "/secretaria/configuracoes",
    icon: Settings2,
    sub: [
      { label: "Modelos de Documentos", href: "/secretaria/configuracoes/documentos" },
    ],
  },
];

export default function SecretariaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 min-h-[calc(100vh-4.5rem)]">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
              <ScrollText size={18} className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900 leading-none">Secretaria</p>
              <p className="text-xs text-gray-400 mt-0.5">Documentos e Emissão</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {menuItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-amber-50 text-amber-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                </Link>
                {isActive && item.sub && (
                  <div className="ml-7 mt-0.5 space-y-0.5">
                    {item.sub.map((s) => (
                      <Link
                        key={s.href}
                        href={s.href}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          pathname.startsWith(s.href)
                            ? "text-amber-700 bg-amber-50/60"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
                        {s.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">Módulo Secretaria</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
