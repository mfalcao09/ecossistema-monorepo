"use client";

import { useState, useEffect, type FormEvent } from "react";

// ── Tipos globais Facebook SDK ──────────────────────────────────────────────
declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        callback: (response: {
          authResponse?: { code?: string; accessToken?: string };
        }) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Lock,
  Info,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Facebook,
} from "lucide-react";
import {
  CANAIS,
  BADGE_STYLES,
  CORES_CANAL,
  type CanalCatalogo,
  type TipoCanal,
} from "./canais-catalogo";

interface AddChannelDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (canal: NovoCanalPayload) => void;
}

export interface NovoCanalPayload {
  tipo: TipoCanal;
  nome: string;
  cor: string;
  ambiente: "demo" | "producao";
  config: Record<string, string | boolean>;
  atendimento: {
    departamento: string;
    saudacao: string;
    foraExpediente: string;
    sincronizarContatos: boolean;
    criarCardCrm: boolean;
  };
}

const STEPS = [
  { numero: 1, titulo: "Escolher canal" },
  { numero: 2, titulo: "Identificar" },
  { numero: 3, titulo: "Conectar" },
  { numero: 4, titulo: "Configurar atendimento" },
] as const;

export function AddChannelDialog({
  open,
  onClose,
  onCreated,
}: AddChannelDialogProps) {
  const [step, setStep] = useState(1);
  const [canalEscolhido, setCanalEscolhido] = useState<CanalCatalogo | null>(
    null,
  );
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES_CANAL[0].valor);
  const [ambiente, setAmbiente] = useState<"demo" | "producao">("demo");
  const [config, setConfig] = useState<Record<string, string | boolean>>({});
  const [atendimento, setAtendimento] = useState({
    departamento: "Atendimento Geral FIC",
    saudacao:
      "Olá! Você entrou em contato com a FIC. Em breve um atendente vai te responder.",
    foraExpediente:
      "Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Retornaremos sua mensagem assim que possível.",
    sincronizarContatos: true,
    criarCardCrm: false,
  });

  if (!open) return null;

  function reset() {
    setStep(1);
    setCanalEscolhido(null);
    setNome("");
    setCor(CORES_CANAL[0].valor);
    setAmbiente("demo");
    setConfig({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleEscolher(canal: CanalCatalogo) {
    if (canal.status === "em-breve") return;
    setCanalEscolhido(canal);
    setNome(canal.nome);
    setStep(2);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canalEscolhido) return;
    onCreated({
      tipo: canalEscolhido.id,
      nome,
      cor,
      ambiente,
      config,
      atendimento,
    });
    reset();
    onClose();
  }

  const podeAvancar2 = nome.trim().length >= 3;
  const podeAvancar3 = canalEscolhido
    ? validarConfig(canalEscolhido, config)
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Adicionar Canal de Atendimento
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Conecte um novo canal para começar a receber mensagens
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            {STEPS.map((s, idx) => {
              const ativo = step === s.numero;
              const concluido = step > s.numero;
              return (
                <div key={s.numero} className="flex items-center gap-2 flex-1">
                  <div
                    className={`flex items-center gap-2 ${
                      ativo
                        ? "text-blue-700"
                        : concluido
                          ? "text-green-700"
                          : "text-slate-400"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ring-2 ${
                        ativo
                          ? "bg-blue-600 text-white ring-blue-200"
                          : concluido
                            ? "bg-green-600 text-white ring-green-200"
                            : "bg-white text-slate-400 ring-slate-200"
                      }`}
                    >
                      {concluido ? <Check size={14} /> : s.numero}
                    </div>
                    <span className="text-xs font-medium hidden sm:inline">
                      {s.titulo}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-px ${
                        concluido ? "bg-green-300" : "bg-slate-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-6">
            {step === 1 && <Step1Catalogo onEscolher={handleEscolher} />}
            {step === 2 && canalEscolhido && (
              <Step2Identificar
                canal={canalEscolhido}
                nome={nome}
                setNome={setNome}
                cor={cor}
                setCor={setCor}
                ambiente={ambiente}
                setAmbiente={setAmbiente}
              />
            )}
            {step === 3 && canalEscolhido && (
              <Step3Conectar
                canal={canalEscolhido}
                config={config}
                setConfig={setConfig}
              />
            )}
            {step === 4 && canalEscolhido && (
              <Step4Configurar
                atendimento={atendimento}
                setAtendimento={setAtendimento}
              />
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={step === 1 ? handleClose : () => setStep(step - 1)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            {step === 1 ? (
              "Cancelar"
            ) : (
              <>
                <ChevronLeft size={16} /> Voltar
              </>
            )}
          </button>
          <div className="flex items-center gap-2">
            {step === 4 && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e as unknown as FormEvent)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Pular configuração
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && !canalEscolhido) ||
                  (step === 2 && !podeAvancar2) ||
                  (step === 3 && !podeAvancar3)
                }
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Avançar <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => handleSubmit(e as unknown as FormEvent)}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Check size={16} /> Adicionar canal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step1Catalogo({
  onEscolher,
}: {
  onEscolher: (c: CanalCatalogo) => void;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">
        Por onde seus clientes vão falar com você?
      </h3>
      <p className="text-sm text-slate-500 mb-5">
        Escolha um canal para conectar agora. Você pode adicionar outros depois.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CANAIS.map((canal) => {
          const Icon = canal.icone;
          const indisponivel = canal.status === "em-breve";
          return (
            <button
              key={canal.id}
              type="button"
              onClick={() => onEscolher(canal)}
              disabled={indisponivel}
              title={
                indisponivel
                  ? `Em desenvolvimento — previsto para ${canal.previsao}`
                  : canal.ajuda
              }
              className={`group relative flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                indisponivel
                  ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
                  : "border-slate-200 bg-white hover:border-blue-400 hover:shadow-md cursor-pointer"
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl ${canal.corBg} flex items-center justify-center flex-shrink-0`}
              >
                <Icon size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {canal.nome}
                  </p>
                  {indisponivel && (
                    <Lock size={12} className="text-slate-400" />
                  )}
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">
                  {canal.descricao}
                </p>
                <span
                  className={`inline-flex mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    BADGE_STYLES[canal.badge.tipo]
                  }`}
                >
                  {canal.badge.texto}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Step2Identificar({
  canal,
  nome,
  setNome,
  cor,
  setCor,
  ambiente,
  setAmbiente,
}: {
  canal: CanalCatalogo;
  nome: string;
  setNome: (v: string) => void;
  cor: string;
  setCor: (v: string) => void;
  ambiente: "demo" | "producao";
  setAmbiente: (v: "demo" | "producao") => void;
}) {
  const Icon = canal.icone;
  return (
    <div>
      <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <div
          className={`w-10 h-10 rounded-xl ${canal.corBg} flex items-center justify-center`}
        >
          <Icon size={18} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{canal.nome}</p>
          <p className="text-xs text-slate-500">{canal.descricao}</p>
        </div>
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">
        Identifique o canal
      </h3>
      <p className="text-sm text-slate-500 mb-5">
        Esses dados ajudam você e sua equipe a reconhecer o canal nas conversas.
      </p>

      <div className="space-y-4">
        <Field label="Nome do canal" required>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: WhatsApp Comercial FIC"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">Mínimo 3 caracteres</p>
        </Field>

        <Field label="Cor">
          <div className="flex flex-wrap gap-2">
            {CORES_CANAL.map((c) => (
              <button
                key={c.valor}
                type="button"
                onClick={() => setCor(c.valor)}
                title={c.nome}
                style={{ backgroundColor: c.valor }}
                className={`w-9 h-9 rounded-full transition-all ${
                  cor === c.valor
                    ? "ring-2 ring-offset-2 ring-slate-900 scale-110"
                    : "hover:scale-105"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            A cor aparece como tag nas conversas para identificar a origem
            rapidamente.
          </p>
        </Field>

        <Field label="Ambiente">
          <div className="grid grid-cols-2 gap-2">
            <AmbienteOption
              ativo={ambiente === "demo"}
              onClick={() => setAmbiente("demo")}
              titulo="Demonstração"
              descricao="Sem disparo em massa, ideal para testes"
            />
            <AmbienteOption
              ativo={ambiente === "producao"}
              onClick={() => setAmbiente("producao")}
              titulo="Produção"
              descricao="Operação real, todos os recursos liberados"
            />
          </div>
        </Field>
      </div>
    </div>
  );
}

function AmbienteOption({
  ativo,
  onClick,
  titulo,
  descricao,
}: {
  ativo: boolean;
  onClick: () => void;
  titulo: string;
  descricao: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 text-left rounded-lg border transition-all ${
        ativo
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <p className="text-sm font-semibold text-slate-900">{titulo}</p>
      <p className="text-xs text-slate-500 mt-0.5">{descricao}</p>
    </button>
  );
}

function Step3Conectar({
  canal,
  config,
  setConfig,
}: {
  canal: CanalCatalogo;
  config: Record<string, string | boolean>;
  setConfig: (c: Record<string, string | boolean>) => void;
}) {
  const set = (k: string, v: string | boolean) =>
    setConfig({ ...config, [k]: v });

  return (
    <div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">
        Conectar {canal.nome}
      </h3>
      <p className="text-sm text-slate-500 mb-5">{canal.ajuda}</p>

      {canal.fluxoConexao === "meta-cloud-api" && (
        <FluxoMetaCloudApi config={config} set={set} />
      )}
      {canal.fluxoConexao === "qr-baileys" && (
        <FluxoQrBaileys config={config} set={set} />
      )}
      {canal.fluxoConexao === "oauth-facebook" && (
        <FluxoOAuthFacebook config={config} set={set} />
      )}
      {canal.fluxoConexao === "imap-smtp" && (
        <FluxoEmail config={config} set={set} />
      )}
      {canal.fluxoConexao === "bot-token" && (
        <FluxoBotToken config={config} set={set} />
      )}
    </div>
  );
}

function FluxoMetaCloudApi({
  config,
  set,
}: {
  config: Record<string, string | boolean>;
  set: (k: string, v: string | boolean) => void;
}) {
  const webhookUrl = "https://erp.fic.edu.br/api/atendimento/webhook";
  const verifyToken = "fic-meta-webhook-2026";
  const modoEmbedded = config["mode"] !== "manual"; // padrão: embedded

  type EmbeddedStatus = "idle" | "aguardando" | "sucesso" | "erro";
  const [embeddedStatus, setEmbeddedStatus] = useState<EmbeddedStatus>("idle");
  const [erroMsg, setErroMsg] = useState("");

  // ── Carregar Facebook SDK ──────────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById("facebook-jssdk")) return;

    window.fbAsyncInit = function () {
      window.FB!.init({
        appId: "1289456453376034",
        version: "v20.0",
        cookie: true,
        xfbml: false,
      });
    };

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/pt_BR/sdk.js";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  // ── Receber waba_id + phone_number_id via postMessage ─────────────────
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com") return;
      try {
        const data =
          typeof event.data === "string"
            ? (JSON.parse(event.data) as Record<string, unknown>)
            : (event.data as Record<string, unknown>);
        if (data?.type === "WA_EMBEDDED_SIGNUP") {
          const wabaId = data["waba_id"] as string | undefined;
          const phoneNumberId = data["phone_number_id"] as string | undefined;
          if (wabaId) set("waba_id", wabaId);
          if (phoneNumberId) set("phone_number_id", phoneNumberId);
        }
      } catch {
        // ignora erros de parse de outras mensagens
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [set]);

  function handleEmbeddedSignup() {
    setEmbeddedStatus("aguardando");
    setErroMsg("");

    if (!window.FB) {
      setEmbeddedStatus("erro");
      setErroMsg(
        "SDK do Facebook não carregou. Recarregue a página e tente novamente.",
      );
      return;
    }

    window.FB.login(
      (response) => {
        if (response.authResponse?.code) {
          set("embedded_code", response.authResponse.code);
          set("mode", "embedded");
          setEmbeddedStatus("sucesso");
        } else {
          setEmbeddedStatus("erro");
          setErroMsg("Autorização cancelada ou negada pelo usuário.");
        }
      },
      {
        config_id: "1140027898257109",
        response_type: "code",
        override_default_response_type: true,
        extras: {
          featureName: "whatsapp_embedded_signup",
          sessionInfoVersion: "3",
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <Banner
        tipo="info"
        titulo="Pré-requisitos Meta Business"
        texto="Você precisa de uma conta Meta Business com WABA aprovada e um aplicativo configurado em developers.facebook.com."
        link={{
          url: "https://developers.facebook.com",
          label: "Abrir Meta for Developers",
        }}
      />

      {/* Seletor de modo */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            set("mode", "embedded");
            setEmbeddedStatus("idle");
          }}
          className={`p-3 text-left rounded-lg border transition-all ${
            modoEmbedded
              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className="text-sm font-semibold text-slate-900">⚡ Automático</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Conectar com Embedded Signup
          </p>
        </button>
        <button
          type="button"
          onClick={() => {
            set("mode", "manual");
            setEmbeddedStatus("idle");
          }}
          className={`p-3 text-left rounded-lg border transition-all ${
            !modoEmbedded
              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <p className="text-sm font-semibold text-slate-900">🔧 Manual</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Inserir credenciais manualmente
          </p>
        </button>
      </div>

      {/* Fluxo Embedded Signup */}
      {modoEmbedded ? (
        <div className="space-y-3">
          {embeddedStatus !== "sucesso" ? (
            <button
              type="button"
              onClick={handleEmbeddedSignup}
              disabled={embeddedStatus === "aguardando"}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1877F2] text-white rounded-lg font-semibold hover:bg-[#166FE5] disabled:opacity-60 transition-opacity"
            >
              <Facebook size={18} />
              {embeddedStatus === "aguardando"
                ? "Aguardando autorização na janela Meta…"
                : "Conectar com Meta (Embedded Signup)"}
            </button>
          ) : (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-center gap-3">
              <Check className="text-green-600 flex-shrink-0" size={18} />
              <div>
                <p className="text-sm font-semibold text-green-900">
                  Meta autorizado com sucesso!
                </p>
                <p className="text-xs text-green-700 mt-0.5">
                  {config["phone_number_id"]
                    ? `Phone Number ID: ${String(config["phone_number_id"])}`
                    : "Número será confirmado após salvar."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    set("embedded_code", "");
                    set("waba_id", "");
                    set("phone_number_id", "");
                    setEmbeddedStatus("idle");
                  }}
                  className="mt-1 text-xs text-green-700 underline"
                >
                  Reconectar
                </button>
              </div>
            </div>
          )}
          {erroMsg && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {erroMsg}
            </p>
          )}
          <p className="text-xs text-slate-400">
            Uma janela do Facebook será aberta. Autorize o acesso e o número
            será conectado automaticamente sem inserir credenciais manualmente.
          </p>
        </div>
      ) : (
        /* Fluxo Manual */
        <>
          <CredencialField
            label="App ID"
            id="app_id"
            config={config}
            set={set}
            placeholder="1289456453376034"
          />
          <CredencialField
            label="Phone Number ID"
            id="phone_id"
            config={config}
            set={set}
            placeholder="1100247799842409"
          />
          <CredencialField
            label="WhatsApp Business Account ID (WABA)"
            id="waba_id"
            config={config}
            set={set}
            placeholder="956493510675203"
          />
          <CredencialField
            label="Token Permanente"
            id="token"
            config={config}
            set={set}
            mascarado
          />
          <CredencialField
            label="App Secret"
            id="app_secret"
            config={config}
            set={set}
            mascarado
          />
        </>
      )}

      <div className="border-t border-slate-200 pt-4">
        <p className="text-xs font-semibold text-slate-700 mb-2">
          Configure no painel da Meta:
        </p>
        <CopiarField label="URL do Webhook" valor={webhookUrl} />
        <CopiarField label="Token de Verificação" valor={verifyToken} />
      </div>
    </div>
  );
}

function FluxoQrBaileys({
  config,
  set,
}: {
  config: Record<string, string | boolean>;
  set: (k: string, v: string | boolean) => void;
}) {
  const aceito = config.maturado === true;
  return (
    <div className="space-y-4">
      <Banner
        tipo="alerta"
        titulo="Risco de banimento"
        texto="O WhatsApp pode banir números não-oficiais sem aviso. Use apenas números maturados (3-5 dias de uso real) e nunca para disparo em massa."
      />

      <label className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer">
        <input
          type="checkbox"
          checked={aceito}
          onChange={(e) => set("maturado", e.target.checked)}
          className="mt-0.5"
        />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            Confirmo que este número foi maturado por pelo menos 3-5 dias
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            Sem maturação, a chance de banimento é alta nas primeiras horas.
          </p>
        </div>
      </label>

      {aceito && (
        <div className="text-center py-8 px-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-600 mb-2">
            QR Code será gerado quando o canal for criado.
          </p>
          <p className="text-xs text-slate-400">
            Você terá 60 segundos para escanear no WhatsApp do celular.
          </p>
        </div>
      )}
    </div>
  );
}

function FluxoOAuthFacebook({
  config,
  set,
}: {
  config: Record<string, string | boolean>;
  set: (k: string, v: string | boolean) => void;
}) {
  const conectado = config.fb_conectado === true;
  return (
    <div className="space-y-4">
      <Banner
        tipo="info"
        titulo="Login com Facebook"
        texto="Você será redirecionado para escolher a página e autorizar permissões de mensagens."
      />
      {!conectado ? (
        <button
          type="button"
          onClick={() => set("fb_conectado", true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1877F2] text-white rounded-lg font-semibold hover:bg-[#166FE5]"
        >
          <Facebook size={18} /> Conectar com Facebook
        </button>
      ) : (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-center gap-3">
          <Check className="text-green-600" size={18} />
          <div>
            <p className="text-sm font-semibold text-green-900">Conectado</p>
            <p className="text-xs text-green-700">Página: FIC Cassilândia</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FluxoEmail({
  config,
  set,
}: {
  config: Record<string, string | boolean>;
  set: (k: string, v: string | boolean) => void;
}) {
  const provedor = (config.provedor as string) || "";
  return (
    <div className="space-y-4">
      <Field label="Provedor de e-mail" required>
        <select
          value={provedor}
          onChange={(e) => set("provedor", e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
        >
          <option value="">Selecione…</option>
          <option value="gmail">Gmail (OAuth Google)</option>
          <option value="outlook">Outlook 365 (OAuth Microsoft)</option>
          <option value="imap">Outro (IMAP/SMTP manual)</option>
        </select>
      </Field>

      {provedor === "imap" && (
        <>
          <CredencialField
            label="Servidor IMAP"
            id="imap_host"
            config={config}
            set={set}
            placeholder="imap.exemplo.com"
          />
          <CredencialField
            label="E-mail"
            id="email"
            config={config}
            set={set}
            placeholder="atendimento@fic.edu.br"
          />
          <CredencialField
            label="Senha"
            id="senha"
            config={config}
            set={set}
            mascarado
          />
        </>
      )}

      {(provedor === "gmail" || provedor === "outlook") && (
        <button
          type="button"
          onClick={() => set("oauth_concluido", true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
        >
          Autorizar acesso
        </button>
      )}
    </div>
  );
}

function FluxoBotToken({
  config,
  set,
}: {
  config: Record<string, string | boolean>;
  set: (k: string, v: string | boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <Banner
        tipo="info"
        titulo="Como obter o token"
        texto="No Telegram, abra @BotFather → /newbot → escolha nome → copie o token gerado e cole abaixo."
        link={{ url: "https://t.me/BotFather", label: "Abrir @BotFather" }}
      />
      <CredencialField
        label="Token do Bot"
        id="bot_token"
        config={config}
        set={set}
        mascarado
        placeholder="123456:ABC-DEF..."
      />
    </div>
  );
}

function Step4Configurar({
  atendimento,
  setAtendimento,
}: {
  atendimento: NovoCanalPayload["atendimento"];
  setAtendimento: (a: NovoCanalPayload["atendimento"]) => void;
}) {
  const set = <K extends keyof NovoCanalPayload["atendimento"]>(
    k: K,
    v: NovoCanalPayload["atendimento"][K],
  ) => setAtendimento({ ...atendimento, [k]: v });

  return (
    <div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">
        Configurar atendimento
      </h3>
      <p className="text-sm text-slate-500 mb-5">
        Tudo aqui já vem com defaults inteligentes. Ajuste apenas o que precisar
        — ou pule e ajuste depois.
      </p>

      <div className="space-y-4">
        <Field label="Departamento padrão">
          <select
            value={atendimento.departamento}
            onChange={(e) => set("departamento", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
          >
            <option>Atendimento Geral FIC</option>
            <option>Secretaria</option>
            <option>Financeiro</option>
            <option>Comercial</option>
            <option>Suporte TI</option>
          </select>
        </Field>

        <Field label="Mensagem de saudação">
          <textarea
            value={atendimento.saudacao}
            onChange={(e) => set("saudacao", e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
          />
        </Field>

        <Field label="Mensagem fora do expediente">
          <textarea
            value={atendimento.foraExpediente}
            onChange={(e) => set("foraExpediente", e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
          />
        </Field>

        <div className="space-y-2 pt-2 border-t border-slate-100">
          <Toggle
            checked={atendimento.sincronizarContatos}
            onChange={(v) => set("sincronizarContatos", v)}
            label="Sincronizar contatos automaticamente"
            descricao="Salva nome e telefone no CRM ao receber primeira mensagem"
          />
          <Toggle
            checked={atendimento.criarCardCrm}
            onChange={(v) => set("criarCardCrm", v)}
            label="Criar card no CRM ao receber primeira mensagem"
            descricao="Adiciona o lead automaticamente no funil de vendas"
          />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function CredencialField({
  label,
  id,
  config,
  set,
  mascarado,
  placeholder,
}: {
  label: string;
  id: string;
  config: Record<string, string | boolean>;
  set: (k: string, v: string | boolean) => void;
  mascarado?: boolean;
  placeholder?: string;
}) {
  const [visivel, setVisivel] = useState(false);
  const valor = (config[id] as string) || "";
  const tipo = mascarado && !visivel ? "password" : "text";
  return (
    <Field label={label} required>
      <div className="relative">
        <input
          type={tipo}
          value={valor}
          onChange={(e) => set(id, e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 text-sm border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
        />
        {mascarado && (
          <button
            type="button"
            onClick={() => setVisivel(!visivel)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
            aria-label={visivel ? "Ocultar" : "Mostrar"}
          >
            {visivel ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </Field>
  );
}

function CopiarField({ label, valor }: { label: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    navigator.clipboard.writeText(valor);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }
  return (
    <div className="mb-2">
      <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 text-xs bg-slate-100 text-slate-700 rounded-lg font-mono truncate">
          {valor}
        </code>
        <button
          type="button"
          onClick={copiar}
          className="px-2.5 py-2 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1"
        >
          {copiado ? (
            <Check size={12} className="text-green-600" />
          ) : (
            <Copy size={12} />
          )}
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

function Banner({
  tipo,
  titulo,
  texto,
  link,
}: {
  tipo: "info" | "alerta";
  titulo: string;
  texto: string;
  link?: { url: string; label: string };
}) {
  const styles =
    tipo === "info"
      ? "border-blue-200 bg-blue-50 text-blue-900"
      : "border-amber-200 bg-amber-50 text-amber-900";
  const Icon = tipo === "info" ? Info : Info;
  return (
    <div className={`rounded-lg border p-3 ${styles}`}>
      <div className="flex items-start gap-2">
        <Icon size={16} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{titulo}</p>
          <p className="text-xs mt-0.5 opacity-90">{texto}</p>
          {link && (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold underline"
            >
              {link.label} <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  descricao,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  descricao: string;
}) {
  return (
    <label className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5 ${
          checked ? "bg-blue-600" : "bg-slate-300"
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{descricao}</p>
      </div>
    </label>
  );
}

function validarConfig(
  canal: CanalCatalogo,
  config: Record<string, string | boolean>,
): boolean {
  switch (canal.fluxoConexao) {
    case "meta-cloud-api":
      // Modo embedded: code obtido via FB.login + waba_id + phone_number_id via postMessage
      if (config["mode"] !== "manual") {
        return (
          typeof config["embedded_code"] === "string" &&
          (config["embedded_code"] as string).trim().length > 0
        );
      }
      // Modo manual: 5 campos obrigatórios
      return ["app_id", "phone_id", "waba_id", "token", "app_secret"].every(
        (k) =>
          typeof config[k] === "string" &&
          (config[k] as string).trim().length > 0,
      );
    case "qr-baileys":
      return config.maturado === true;
    case "oauth-facebook":
      return config.fb_conectado === true;
    case "imap-smtp": {
      if (config.provedor === "imap") {
        return ["imap_host", "email", "senha"].every(
          (k) =>
            typeof config[k] === "string" &&
            (config[k] as string).trim().length > 0,
        );
      }
      return config.oauth_concluido === true;
    }
    case "bot-token":
      return (
        typeof config.bot_token === "string" &&
        (config.bot_token as string).trim().length > 5
      );
    default:
      return false;
  }
}
