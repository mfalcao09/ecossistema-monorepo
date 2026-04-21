"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare, LayoutDashboard, Users,
  Radio, Zap, BarChart2, FlaskConical,
  FileText, Calendar, MessagesSquare, Link as LinkIcon,
} from "lucide-react";

interface MenuItem {
  label: string
  href: string
  icon: React.ElementType
  exact?: boolean
  badge?: string
  beta?: boolean
}

const CHAT_INTERNO_ENABLED = process.env.NEXT_PUBLIC_ATENDIMENTO_CHAT_INTERNO_ENABLED === "true";
const LINKS_REDIRECT_ENABLED = process.env.NEXT_PUBLIC_ATENDIMENTO_LINKS_REDIRECT_ENABLED === "true";

const menuItems: MenuItem[] = [
  { label: "Dashboard",    href: "/atendimento",              icon: LayoutDashboard, exact: true },
  { label: "Conversas",    href: "/atendimento/conversas",    icon: MessageSquare,   badge: "WA" },
  { label: "Contatos",     href: "/atendimento/contatos",     icon: Users },
  { label: "Canais",       href: "/atendimento/canais",       icon: Radio },
  { label: "Templates",    href: "/atendimento/templates",    icon: FileText,        badge: "WABA" },
  { label: "Agendamentos", href: "/atendimento/agendamentos", icon: Calendar },
  { label: "Automações",   href: "/atendimento/automacoes",   icon: Zap,             badge: "IA" },
  ...(CHAT_INTERNO_ENABLED ? [{
    label: "Chat interno",
    href: "/atendimento/chat-interno",
    icon: MessagesSquare,
    beta: true,
  } satisfies MenuItem] : []),
  ...(LINKS_REDIRECT_ENABLED ? [{
    label: "Links",
    href: "/atendimento/links-redirecionamento",
    icon: LinkIcon,
    beta: true,
  } satisfies MenuItem] : []),
  { label: "Relatórios",   href: "/atendimento/relatorios",   icon: BarChart2,       beta: true },
];

export default function AtendimentoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1 min-h-[calc(100vh-3.5rem)]">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center">
              <MessageSquare size={18} className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900 leading-none">Atendimento</p>
              <p className="text-xs text-gray-400 mt-0.5">WhatsApp · Instagram · IA</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {menuItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href) && item.href !== "/atendimento";
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {/* Badge ex: "WA", "IA" */}
                {item.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 leading-none flex-shrink-0">
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
          <p className="text-xs text-gray-400 text-center">Módulo Atendimento · NEXVY</p>
        </div>
      </aside>

      {/* Conteúdo principal — sem padding na tela de conversas (ocupa 100% do espaço) */}
      <main className={`flex-1 overflow-auto ${
        pathname.startsWith('/atendimento/conversas') ? '' : 'p-6'
      }`}>
        {children}
      </main>
    </div>
  );
}
