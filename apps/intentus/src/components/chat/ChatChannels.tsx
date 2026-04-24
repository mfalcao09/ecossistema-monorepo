import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Wifi,
  WifiOff,
  Trash2,
  MessageCircle,
  Send as TelegramIcon,
  Globe,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { Instagram } from "@/components/icons/BrandIcons";
import { useChatChannels, useUpdateChatChannel } from "@/hooks/useChat";
import { toast } from "sonner";
import {
  ChannelTypeChoiceDialog,
  type ChannelConnectionMode,
} from "./ChannelTypeChoiceDialog";
import { ChannelConnectionWizard } from "./ChannelConnectionWizard";

const CHANNEL_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  whatsapp_oficial: MessageCircle,
  whatsapp_nao_oficial: MessageCircle,
  instagram: Instagram,
  telegram: TelegramIcon,
  webchat: Globe,
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp_oficial: "WhatsApp Oficial",
  whatsapp_nao_oficial: "WhatsApp",
  instagram: "Instagram",
  telegram: "Telegram",
  webchat: "Webchat",
};

const PROVIDER_BADGES: Record<string, { label: string; className: string }> = {
  hunion: {
    label: "API Oficial",
    className: "bg-blue-500/10 text-blue-600 border-blue-200",
  },
  zapi: {
    label: "WhatsApp Web",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  },
  manual: { label: "Manual", className: "" },
};

export function ChatChannels() {
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<ChannelConnectionMode | null>(
    null,
  );
  const [showDeleted, setShowDeleted] = useState(false);
  const [reconnectChannelId, setReconnectChannelId] = useState<string | null>(
    null,
  );

  const { data: channels } = useChatChannels();
  const updateChannel = useUpdateChatChannel();

  const handleSelectMode = (mode: ChannelConnectionMode) => {
    setWizardMode(mode);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDeleted(!showDeleted)}
        >
          {showDeleted ? "Ocultar Deletados" : "Ver Deletados"}
        </Button>
        <Button size="sm" onClick={() => setChoiceOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar Canal
        </Button>
      </div>

      {(channels ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhum canal conectado</p>
            <p className="text-sm text-muted-foreground">
              Adicione um canal de atendimento para começar
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(channels ?? []).map((channel) => {
            const Icon = CHANNEL_ICONS[channel.channel_type] || Globe;
            const isConnected = channel.status === "conectado";
            const connectedVia = (channel as any).connected_via || "manual";
            const providerBadge = PROVIDER_BADGES[connectedVia];

            return (
              <Card key={channel.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`h-5 w-5 ${channel.channel_type.includes("whatsapp") ? "text-emerald-500" : "text-muted-foreground"}`}
                    />
                    <CardTitle className="text-sm">{channel.name}</CardTitle>
                  </div>
                  <Badge
                    variant={isConnected ? "default" : "secondary"}
                    className={isConnected ? "bg-emerald-500" : ""}
                  >
                    {isConnected ? (
                      <Wifi className="h-3 w-3 mr-1" />
                    ) : (
                      <WifiOff className="h-3 w-3 mr-1" />
                    )}
                    {isConnected ? "Conectado" : "Desconectado"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm text-muted-foreground">
                      {CHANNEL_LABELS[channel.channel_type]}
                    </p>
                    {providerBadge && connectedVia !== "manual" && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${providerBadge.className}`}
                      >
                        {providerBadge.label}
                      </Badge>
                    )}
                  </div>
                  {channel.phone_number && (
                    <p className="text-sm font-mono">{channel.phone_number}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant={isConnected ? "destructive" : "default"}
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        if (connectedVia === "zapi" && !isConnected) {
                          // For QR Code channels, open reconnect wizard
                          setReconnectChannelId(channel.id);
                          setWizardMode("qrcode");
                          return;
                        }
                        updateChannel.mutate(
                          {
                            id: channel.id,
                            status: isConnected ? "desconectado" : "conectado",
                          } as any,
                          {
                            onSuccess: () =>
                              toast.success(
                                isConnected
                                  ? "Canal desconectado"
                                  : "Canal conectado",
                              ),
                          },
                        );
                      }}
                    >
                      {isConnected ? "Desconectar" : "Conectar"}
                    </Button>
                    {connectedVia === "zapi" && isConnected && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReconnectChannelId(channel.id);
                          setWizardMode("qrcode");
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Reconectar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => {
                        updateChannel.mutate(
                          { id: channel.id, status: "deletado" } as any,
                          { onSuccess: () => toast.success("Canal removido") },
                        );
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Channel type selection dialog */}
      <ChannelTypeChoiceDialog
        open={choiceOpen}
        onOpenChange={setChoiceOpen}
        onSelect={handleSelectMode}
      />

      {/* Connection wizard */}
      {wizardMode && (
        <ChannelConnectionWizard
          open={!!wizardMode}
          onOpenChange={(v) => {
            if (!v) {
              setWizardMode(null);
              setReconnectChannelId(null);
            }
          }}
          mode={wizardMode}
        />
      )}
    </div>
  );
}
