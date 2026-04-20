import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ecossistema Vault",
  description: "Coleta segura de credenciais via AES-256-GCM",
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#f9fafb",
        }}
      >
        {children}
      </body>
    </html>
  );
}
