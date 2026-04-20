// Layout das rotas de impressão — Puppeteer headless navega aqui para
// gerar o PDF. Herda apenas o root layout (<html> + <body>), sem
// sidebar, topbar, ou chrome do ERP.

export const metadata = {
  title: 'Impressão',
  robots: { index: false, follow: false },
}

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
