import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  MessageCircle,
  QrCode,
  Send as TelegramIcon,
  Globe,
} from "lucide-react";
import { Instagram } from "@/components/icons/BrandIcons";
import { Badge } from "@/components/ui/badge";

export type ChannelConnectionMode =
  | "hunion_whatsapp"
  | "qrcode"
  | "hunion_instagram"
  | "telegram"
  | "webchat";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mode: ChannelConnectionMode) => void;
}

const options: {
  mode: ChannelConnectionMode;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge?: string;
  iconClass?: string;
}[] = [
  {
    mode: "hunion_whatsapp",
    icon: MessageCircle,
    title: "WhatsApp Business (Oficial)",
    description: "Conecte via Meta Business com número oficial verificado",
    badge: "API Oficial",
    iconClass: "text-emerald-500",
  },
  {
    mode: "qrcode",
    icon: QrCode,
    title: "WhatsApp (QR Code)",
    description: "Escaneie o QR Code com seu celular para conectar rapidamente",
    iconClass: "text-emerald-500",
  },
  {
    mode: "hunion_instagram",
    icon: Instagram,
    title: "Instagram / Messenger",
    description: "Conecte via página do Facebook ou Instagram Business",
    badge: "Meta",
    iconClass: "text-pink-500",
  },
  {
    mode: "telegram",
    icon: TelegramIcon,
    title: "Telegram",
    description: "Informe o token do bot para conectar",
    iconClass: "text-blue-500",
  },
  {
    mode: "webchat",
    icon: Globe,
    title: "Webchat",
    description: "Configure o widget de chat para seu site",
    iconClass: "text-muted-foreground",
  },
];

export function ChannelTypeChoiceDialog({
  open,
  onOpenChange,
  onSelect,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Canal</DialogTitle>
          <DialogDescription>
            Escolha o tipo de canal que deseja conectar
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {options.map((opt) => (
            <Card
              key={opt.mode}
              className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
              onClick={() => {
                onOpenChange(false);
                onSelect(opt.mode);
              }}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div className="rounded-lg bg-muted p-2.5 shrink-0">
                  <opt.icon
                    className={`h-6 w-6 ${opt.iconClass || "text-muted-foreground"}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{opt.title}</span>
                    {opt.badge && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0"
                      >
                        {opt.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {opt.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
