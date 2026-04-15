import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/providers/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Faculdades Integradas de Cassilândia — FIC",
  description:
    "Ferramenta de emissão e gestão de diplomas digitais das Faculdades Integradas de Cassilândia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {/* Aplica cor principal e dark mode via CSS vars + classe .dark */}
        <ThemeProvider />
        {children}
      </body>
    </html>
  );
}
