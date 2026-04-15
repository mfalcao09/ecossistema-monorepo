"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Monitor, Users, ChevronLeft, Bot, Shield, Lock, Calendar, BookOpen, FlaskConical, Layers } from "lucide-react";

interface MenuItem {
  label: string
  href: string
  icon: React.ElementType
  beta?: boolean
}

const menuItems: MenuItem[] = [
  { label: "Papéis e Permissões",  href: "/configuracoes/rbac",         icon: Lock    },
  { label: "Usuários",             href: "/configuracoes/usuarios",      icon: Users   },
  { label: "Anos Letivos",         href: "/configuracoes/anos-letivos",  icon: BookOpen },
  { label: "Calendário Acadêmico", href: "/configuracoes/calendarios",   icon: Calendar },
  { label: "Sistema",              href: "/configuracoes/sistema",       icon: Monitor  },
  { label: "Módulos",              href: "/configuracoes/modulos",       icon: Layers   },
  { label: "IA e Agentes",         href: "/configuracoes/ia",            icon: Bot,     beta: true },
  { label: "Assinatura Digital",   href: "/configuracoes/assinatura",    icon: Shield   },
];

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 min-h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="w-9 h-9 bg-slate-600 rounded-xl flex items-center justify-center">
              <Settings size={18} className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900 leading-none">Configurações</p>
              <p className="text-xs text-gray-400 mt-0.5">Sistema ERP FIC</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-100 text-slate-800"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.beta && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded-full bg-amber-100 text-amber-700 border border-amber-300 leading-none flex-shrink-0">
                    <FlaskConical size={8} />
                    Beta
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <Link
            href="/home"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={14} />
            Voltar ao início
          </Link>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
