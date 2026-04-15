"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  LayoutDashboard,
  Files,
  ScanLine,
  FilePlus2,
  LayoutTemplate,
  ShieldCheck,
  FlaskConical,
} from "lucide-react";

interface MenuItem {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
  beta?: boolean
}

const MENU_ITEMS: MenuItem[] = [
  { href: "/acervo",             label: "Dashboard",   icon: LayoutDashboard, exact: true  },
  { href: "/acervo/documentos",  label: "Documentos",  icon: Files,           exact: false },
  { href: "/acervo/digitalizar", label: "Digitalizar", icon: ScanLine,        exact: false },
  { href: "/acervo/emitir",      label: "Emitir",      icon: FilePlus2,       exact: false, beta: true },
  { href: "/acervo/templates",   label: "Templates",   icon: LayoutTemplate,  exact: false },
  { href: "/acervo/mec",         label: "Acesso MEC",  icon: ShieldCheck,     exact: false, beta: true },
];

export default function AcervoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[calc(100vh-72px)]">

      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">

        {/* Cabeçalho do módulo */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
              <Archive size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-800 leading-none">Acervo Digital</p>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">
                Portaria MEC 360/2022
              </p>
            </div>
          </div>
        </div>

        {/* Itens de menu */}
        <nav className="flex-1 p-2 space-y-0.5">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-teal-50 text-teal-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon
                  size={16}
                  className={`flex-shrink-0 ${isActive ? "text-teal-600" : "text-gray-400"}`}
                />
                <span className="flex-1">{item.label}</span>
                {item.beta && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-full bg-amber-100 text-amber-700 border border-amber-300 leading-none flex-shrink-0">
                    <FlaskConical size={8} />
                    Beta
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé da sidebar */}
        <div className="p-3 border-t border-gray-100">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            <p className="text-[10px] font-semibold text-amber-700 leading-none mb-1">
              ⚠ Prazos MEC vencidos
            </p>
            <p className="text-[10px] text-amber-600 leading-tight">
              Digitalização retroativa obrigatória. Acesse o Dashboard para detalhes.
            </p>
          </div>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
