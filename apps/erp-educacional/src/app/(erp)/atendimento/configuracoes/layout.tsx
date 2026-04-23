"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Shield, UsersRound, FileText } from "lucide-react";

const tabs = [
  { href: "/atendimento/configuracoes/cargos",              label: "Cargos",           icon: Shield },
  { href: "/atendimento/configuracoes/usuarios",            label: "Usuários",         icon: Users },
  { href: "/atendimento/configuracoes/equipes",             label: "Equipes",          icon: UsersRound },
  { href: "/atendimento/configuracoes/tipos-de-processo",   label: "Tipos de processo", icon: FileText },
];

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Configurações do Atendimento</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cargos, usuários e equipes do módulo.
        </p>
        <nav className="mt-4 flex gap-1">
          {tabs.map((t) => {
            const active = pathname.startsWith(t.href);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={[
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                ].join(" ")}
              >
                <Icon size={16} />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
