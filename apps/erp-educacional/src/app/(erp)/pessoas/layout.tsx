import { ReactNode } from 'react'

export const metadata = {
  title: 'Pessoas | ERP FIC',
  description: 'Cadastro unificado de pessoas — alunos, professores, colaboradores',
}

export default function PessoasLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
