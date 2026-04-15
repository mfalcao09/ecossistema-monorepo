import TopBar from "@/components/layout/TopBar";
import { PermissoesProvider } from "@/components/providers/PermissoesProvider";
import BannerSessaoAtiva from "@/components/diploma/BannerSessaoAtiva";

export default function ErpLayout({ children }: { children: React.ReactNode }) {
  return (
    <PermissoesProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar />
        <BannerSessaoAtiva />
        <div className="flex-1">
          {children}
        </div>
      </div>
    </PermissoesProvider>
  );
}
