import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Download, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useCreatePropertyDocumentToken } from "@/hooks/usePropertyDocuments";
import QRCode from "qrcode";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propertyId: string;
  token: any;
}

export function PropertyQRCodeDialog({ open, onOpenChange, propertyId, token }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const createToken = useCreatePropertyDocumentToken();

  const publicUrl = token
    ? `${window.location.origin}/imoveis/${propertyId}/documentos?token=${token.token}`
    : null;

  useEffect(() => {
    if (!publicUrl || !open) return;
    QRCode.toDataURL(publicUrl, { width: 256, margin: 2, color: { dark: "#000000", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [publicUrl, open]);

  function copyUrl() {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado!");
    }
  }

  function downloadQR() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qrcode-imovel-${propertyId}.png`;
    a.click();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> QR Code — Documentos do Imóvel
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {qrDataUrl ? (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg border p-3 bg-white">
                <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Escaneie o QR Code para acessar os documentos públicos deste imóvel
              </p>
              <div className="w-full rounded-md bg-muted px-3 py-2 text-xs font-mono break-all text-muted-foreground">
                {publicUrl}
              </div>
              <div className="flex gap-2 w-full">
                <Button variant="outline" size="sm" className="flex-1" onClick={copyUrl}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar Link
                </Button>
                <Button size="sm" className="flex-1" onClick={downloadQR}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Baixar QR
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => createToken.mutate({ propertyId })}
                disabled={createToken.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Gerar novo token
              </Button>
            </div>
          ) : !token ? (
            <div className="text-center py-4 space-y-2">
              <QrCode className="h-10 w-10 mx-auto text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">Nenhum token gerado ainda</p>
              <Button size="sm" onClick={() => createToken.mutate({ propertyId })} disabled={createToken.isPending}>
                {createToken.isPending ? "Gerando..." : "Gerar QR Code"}
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-muted-foreground mt-2">Gerando QR Code...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
