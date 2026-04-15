import type { Metadata } from "next"
import { Suspense } from "react"
import PortalHeader from "@/components/portal/PortalHeader"
import PortalFooter from "@/components/portal/PortalFooter"
import ChatAssistente from "@/components/portal/ChatAssistente"
import PortalPageClient from "./(portal)/PortalPageClient"

export const metadata: Metadata = {
  title: "Portal de Diplomas — FIC",
  description:
    "Portal público de verificação de diplomas digitais das Faculdades Integradas de Cassilândia",
  openGraph: {
    title: "Portal de Diplomas — FIC",
    description:
      "Verifique a autenticidade de diplomas digitais das Faculdades Integradas de Cassilândia",
    siteName: "FIC - Portal de Diplomas",
    locale: "pt_BR",
    type: "website",
  },
}

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <PortalHeader />
      <main className="flex-1">
        <Suspense>
          <PortalPageClient />
        </Suspense>
      </main>
      <PortalFooter />
      <ChatAssistente />
    </div>
  )
}
