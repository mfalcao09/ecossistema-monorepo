/**
 * Sprint 2 / Etapa 2 — Tela 2: Revisão pós-extração (esqueleto + polling)
 *
 * Esta página é o destino do redirect da Tela 1 (`/diploma/processos/novo`).
 * Ela faz polling em GET /api/extracao/sessoes/[id] enquanto o status é
 * `processando` e mostra:
 *
 *   - **processando** → barra de progresso animada + etapas rotativas
 *   - **erro**        → painel de erro com botão de voltar
 *   - **rascunho**    → placeholder do formulário (Etapa 3 vai preencher)
 *
 * O formulário pré-preenchido + gate FIC + classificação de arquivos vão
 * na Etapa 3 (Sprint 2 da próxima sessão). Esta etapa entrega só o loop
 * Tela 1 → upload → polling → estado pronto.
 *
 * Decisões (sessão 030):
 *   - Polling a cada 3s (decisão Marcelo: barra de progresso + etapas animadas)
 *   - Etapas rotativas a cada 4s pra dar sensação de progresso real
 *   - Timeout duro de 5 minutos (300s) — se passar, mostra erro de timeout
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  CardArquivoClassificacao,
  type ArquivoClassificavel,
} from "@/components/diploma/revisao/CardArquivoClassificacao";
import { GateFicComprobatorios } from "@/components/diploma/revisao/GateFicComprobatorios";
import { DialogVisualizarDocumento } from "@/components/diploma/revisao/DialogVisualizarDocumento";
import {
  DialogSelecionarArquivo,
  type ArquivoSessao,
} from "@/components/diploma/revisao/DialogSelecionarArquivo";
import {
  FormularioRevisao,
  type DadosRevisao,
  type CursoCadastro,
} from "@/components/diploma/revisao/FormularioRevisao";
import { ModalOverrideCriacao } from "@/components/diploma/revisao/ModalOverrideCriacao";
import {
  COMPROBATORIOS_OBRIGATORIOS_FIC,
  type TipoXsdComprobatorio,
} from "@/lib/diploma/regras-fic";
import type { ViolacaoGate } from "@/lib/diploma/gate-criacao-processo";
import {
  construirConfirmacoes,
  type ConfirmacaoComprobatorio,
  type ComprobatorioDetectadoRaw,
} from "@/lib/diploma/mapa-comprobatorios";

// ─── Tipos ──────────────────────────────────────────────────────────────────

type StatusSessao =
  | "processando"
  | "rascunho"
  | "concluido"
  | "erro"
  | "descartado"
  | "aguardando_revisao"
  | "convertido_em_processo";

interface ProcessoArquivoRow {
  id: string;
  nome_original: string;
  mime_type: string;
  tamanho_bytes: number | null;
  storage_path: string;
  destino_xml: boolean;
  destino_acervo: boolean;
  tipo_xsd: TipoXsdComprobatorio | null;
  created_at: string;
}

interface SessaoExtracao {
  id: string;
  processo_id: string | null;
  diploma_id: string | null;
  status: StatusSessao;
  arquivos: Array<{
    storage_path: string;
    bucket: string;
    nome_original: string;
    mime_type: string;
    tamanho_bytes?: number;
  }>;
  dados_extraidos: Record<string, unknown> | null;
  dados_confirmados?: Record<string, unknown> | null;
  campos_faltando: Record<string, unknown> | null;
  confianca_geral: number | null;
  erro_mensagem: string | null;
  iniciado_em: string | null;
  finalizado_em: string | null;
  processing_ms: number | null;
  version: number;
  processo_arquivos?: ProcessoArquivoRow[];
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 3000;
// Sessão 031: ampliado de 5min → 7min como rede de segurança complementar
// à paralelização no Railway (document-converter server.js). Cobre casos com
// muitos arquivos (16+) e/ou arquivos grandes + instabilidade pontual do Gemini.
const TIMEOUT_MS = 7 * 60 * 1000; // 7 minutos
const ETAPA_ROTACAO_MS = 4000;

const ETAPAS_LOADING = [
  { texto: "Enviando arquivos para a IA...", icone: Sparkles },
  { texto: "Identificando os tipos de documento...", icone: Sparkles },
  { texto: "Analisando RG e dados pessoais...", icone: Sparkles },
  { texto: "Lendo histórico do Ensino Médio...", icone: Sparkles },
  { texto: "Extraindo certidões e títulos...", icone: Sparkles },
  { texto: "Validando informações cruzadas...", icone: Sparkles },
  { texto: "Quase lá — montando o formulário...", icone: Sparkles },
] as const;

// ─── Componente ─────────────────────────────────────────────────────────────

export default function RevisaoExtracaoPage() {
  const router = useRouter();
  const params = useParams<{ sessaoId: string }>();
  const searchParams = useSearchParams();

  // Smart back: se a navegação veio do pipeline (?from=pipeline&id=<diplomaId>),
  // o botão "←" volta pra lá. Caso contrário, vai pra lista de processos.
  const fromPipeline = searchParams?.get("from") === "pipeline";
  const fromDiplomaId = searchParams?.get("id");
  const voltarHref =
    fromPipeline && fromDiplomaId
      ? `/diploma/diplomas/${fromDiplomaId}`
      : "/diploma/processos";
  const voltarLabel =
    fromPipeline && fromDiplomaId
      ? "Voltar ao pipeline"
      : "Voltar para a lista";
  const sessaoId = params?.sessaoId;

  const [sessao, setSessao] = useState<SessaoExtracao | null>(null);
  const [erroFetch, setErroFetch] = useState<string | null>(null);
  const [etapaIndex, setEtapaIndex] = useState(0);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [timeoutEstourado, setTimeoutEstourado] = useState(false);

  // ── Estado editável da revisão (Etapa 3) ───────────────────────────────
  const [dadosRevisao, setDadosRevisao] = useState<DadosRevisao>({});
  const [arquivosClassif, setArquivosClassif] = useState<
    ArquivoClassificavel[]
  >([]);
  const [dirty, setDirty] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [ultimoSalvamento, setUltimoSalvamento] = useState<Date | null>(null);
  const [formBloqueado, setFormBloqueado] = useState(false);
  const [hidratado, setHidratado] = useState(false);

  // ── Estado de cursos (cadastro) para auto-fill ──────────────────────────
  const [cursos, setCursos] = useState<CursoCadastro[]>([]);
  const [cursoSelecionadoId, setCursoSelecionadoId] = useState<string | null>(
    null,
  );
  const autoMatchFeito = useRef(false);

  // Estado do fluxo "Criar processo"
  const [criando, setCriando] = useState(false);
  const [erroCriacao, setErroCriacao] = useState<string | null>(null);
  const [modalOverride, setModalOverride] = useState<{
    violacoes: ViolacaoGate[];
    bloqueantes: ViolacaoGate[];
  } | null>(null);

  // ── Estado de confirmação de comprobatórios (sessão 043) ─────────────────
  const [confirmacoes, setConfirmacoes] = useState<
    Map<TipoXsdComprobatorio, ConfirmacaoComprobatorio>
  >(new Map());
  const confirmacoesBuildFeito = useRef(false);

  // Dialog de visualização de comprobatório
  const [dialogComprobatorio, setDialogComprobatorio] =
    useState<ConfirmacaoComprobatorio | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);

  // Substituição de arquivo no dialog (sessão 065)
  const [substituindoArquivo, setSubstituindoArquivo] = useState(false);

  // Descarte da extração (sessão 066)
  const [descartando, setDescartando] = useState(false);

  // Dialog de seleção manual de arquivo (sessão 044)
  const [tipoSelecaoManual, setTipoSelecaoManual] =
    useState<TipoXsdComprobatorio | null>(null);

  // Ref pra evitar setState após unmount
  const ativo = useRef(true);
  useEffect(() => {
    ativo.current = true;
    return () => {
      ativo.current = false;
    };
  }, []);

  // Contador de falhas consecutivas do fetch — só exibe painel de erro
  // quando ultrapassar o limiar (sessão 034 fix assertivo).
  const [falhasConsecutivas, setFalhasConsecutivas] = useState(0);
  const FALHAS_LIMIAR_ERRO = 3;

  // ── Fetch com retry interno + timeout client-side (sessão 037) ──────────
  //
  // Sessão 034: retry interno + grace period de 9 tentativas antes de
  //   mostrar painel de erro, para absorver "Failed to fetch" transitório.
  // Sessão 035: split lite/heavy no handler mata 504 por payload pesado
  //   DURANTE `status='processando'`.
  // Sessão 036: AbortController 12s pra matar fetch pendente infinito.
  // Sessão 037 (09/04 20h): BUG — o AbortController 12s virou tiro no pé.
  //   Quando a sessão JÁ está em `rascunho` (status final), o handler
  //   entra no caminho HEAVY e serializa `dados_extraidos` + `arquivos`
  //   JSONB (para 16 docs da Kauana, vários MB). O `maxDuration` do route
  //   é 30s, mas o client abortava em 12s — antes mesmo do server ter
  //   chance de responder. Resultado: DOMException "signal is aborted
  //   without reason" mostrado cru ao usuário, mesmo com a sessão PRONTA
  //   e gravada no banco com os 16 arquivos extraídos corretamente.
  //
  // Fix: FETCH_TIMEOUT_MS = 35s (maxDuration do server + 5s de margem).
  // AbortController continua existindo para matar pending infinito
  // real (>35s = algo muito errado), mas não aborta requisições legítimas
  // no caminho heavy. Também: backoff mais generoso (500ms, 1.5s, 3s) e
  // mensagem amigável em PT quando o catch final for um AbortError.
  const FETCH_TIMEOUT_MS = 35_000;
  const fetchSessao = useCallback(async () => {
    if (!sessaoId) return;

    const MAX_RETRIES = 3;
    let ultimoErro: unknown = null;

    for (let tentativa = 1; tentativa <= MAX_RETRIES; tentativa++) {
      const controller = new AbortController();
      const timeoutRef = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`/api/extracao/sessoes/${sessaoId}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          const corpo = await res.json().catch(() => ({}));
          throw new Error(
            corpo?.erro || `Falha ao buscar sessão (HTTP ${res.status})`,
          );
        }

        const data = (await res.json()) as SessaoExtracao;
        if (ativo.current) {
          setSessao(data);
          setErroFetch(null);
          setFalhasConsecutivas(0);
        }
        return;
      } catch (err) {
        ultimoErro = err;
        // Retry em erros de rede (TypeError "Failed to fetch"), abort do
        // AbortController (timeout client-side) ou HTTP 5xx. 4xx e outros
        // não vão melhorar com retry.
        const msg = err instanceof Error ? err.message : String(err);
        const ehAbort =
          (err instanceof DOMException && err.name === "AbortError") ||
          /abort/i.test(msg);
        const ehRede =
          err instanceof TypeError ||
          ehAbort ||
          /Failed to fetch|NetworkError|HTTP 5\d\d/.test(msg);

        if (!ehRede || tentativa === MAX_RETRIES) break;

        // Backoff mais generoso: 500ms, 1.5s, 3s. Cold start de rota heavy
        // pode pegar o 1º retry; dar tempo pra serverless "esquentar".
        const delay = tentativa === 1 ? 500 : tentativa === 2 ? 1500 : 3000;
        await new Promise((r) => setTimeout(r, delay));
        if (!ativo.current) return;
      } finally {
        clearTimeout(timeoutRef);
      }
    }

    // Todas as tentativas internas falharam
    if (ativo.current) {
      // Traduz AbortError (DOMException raw) em mensagem amigável em PT.
      // Sessão 037: "signal is aborted without reason" não diz nada ao
      // usuário final — e no caso de timeout do heavy fetch, muito
      // provavelmente os dados já estão gravados e um retry funciona.
      let mensagem: string;
      if (ultimoErro instanceof Error) {
        const raw = ultimoErro.message;
        const ehAbortRaw =
          (ultimoErro instanceof DOMException &&
            ultimoErro.name === "AbortError") ||
          /signal is aborted|AbortError|aborted without reason/i.test(raw);
        mensagem = ehAbortRaw
          ? "Tempo limite ao carregar a sessão. Os dados podem já estar prontos — clique em Tentar novamente."
          : raw;
      } else {
        mensagem = "Erro inesperado ao carregar a sessão.";
      }
      setErroFetch(mensagem);
      setFalhasConsecutivas((prev) => prev + 1);
    }
  }, [sessaoId]);

  // Handler do botão "Tentar novamente" — reset do contador + fetch limpo
  const tentarNovamente = useCallback(() => {
    setErroFetch(null);
    setFalhasConsecutivas(0);
    fetchSessao();
  }, [fetchSessao]);

  // Ref pra status atual — usado pelo intervalo pra parar quando sair de
  // 'processando' sem precisar re-criar o intervalo a cada render.
  const statusRef = useRef<StatusSessao | null>(null);
  useEffect(() => {
    statusRef.current = sessao?.status ?? null;
  }, [sessao?.status]);

  // ── Polling resiliente + Realtime + visibilitychange (sessão 034) ───────
  //
  // Bug original (sessão 033): Tela 2 estourava timeout mesmo com a sessão
  // já em `rascunho`/version=2 gravada no banco em 64s pelo Railway. Causa
  // raiz suspeita: silent error swallow no fetch (uma vez setSessao foi
  // chamado, erros posteriores ficavam invisíveis na UI) + dependência única
  // de setInterval (frágil a tab throttling, race conditions de unmount).
  //
  // Solução: 4 camadas de defesa
  //   1) Realtime — subscrever UPDATE em extracao_sessoes (WebSocket, imune
  //      a throttling de aba, dispara em <1s após gravação no banco).
  //   2) Polling resiliente via setTimeout encadeado (não setInterval).
  //   3) visibilitychange — quando aba volta ao foco, força fetch imediato.
  //   4) erroFetch visível também durante "processando" (não só antes da
  //      primeira carga).
  useEffect(() => {
    if (!sessaoId) return;

    let cancelado = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const inicio = Date.now();

    // Fetch encadeado (não setInterval): cada fetch agenda o próximo só
    // depois de terminar — evita acúmulo se uma chamada demorar.
    const tick = async () => {
      if (cancelado || !ativo.current) return;

      // Já saiu de processando? Para o loop.
      if (statusRef.current && statusRef.current !== "processando") {
        return;
      }

      const decorrido = Date.now() - inicio;
      setTempoDecorrido(decorrido);

      if (decorrido > TIMEOUT_MS) {
        setTimeoutEstourado(true);
        ativo.current = false;
        return;
      }

      await fetchSessao();

      if (cancelado || !ativo.current) return;
      if (statusRef.current && statusRef.current !== "processando") return;

      timeoutId = setTimeout(tick, POLL_INTERVAL_MS);
    };

    // Disparo inicial
    fetchSessao().then(() => {
      if (cancelado) return;
      if (statusRef.current && statusRef.current !== "processando") return;
      timeoutId = setTimeout(tick, POLL_INTERVAL_MS);
    });

    // ── Realtime via Supabase (camada 1) — import dinâmico ──
    // Sessão 034: import dinâmico para isolar o módulo do bundle inicial.
    // Se o cliente Supabase tiver qualquer hiccup de inicialização, não
    // afeta o fetch principal nem quebra o polling.
    let canalRef: { removeChannel: () => void } | null = null;
    import("@/lib/supabase/client")
      .then(({ createClient }) => {
        if (cancelado) return;
        try {
          const supabase = createClient();
          const canal = supabase
            .channel(`extracao_sessao_${sessaoId}`)
            .on(
              "postgres_changes",
              {
                event: "UPDATE",
                schema: "public",
                table: "extracao_sessoes",
                filter: `id=eq.${sessaoId}`,
              },
              () => {
                if (cancelado || !ativo.current) return;
                fetchSessao();
              },
            )
            .subscribe();
          canalRef = {
            removeChannel: () => {
              try {
                supabase.removeChannel(canal);
              } catch {
                /* noop */
              }
            },
          };
        } catch (e) {
          // Realtime é best-effort. Polling + visibilitychange cobrem o caso.
          console.warn("[revisao] Realtime indisponível, usando polling:", e);
        }
      })
      .catch((e) => {
        console.warn("[revisao] Falha ao carregar Supabase client:", e);
      });

    // ── visibilitychange (camada 3) ──
    // Quando a aba volta ao foco, força fetch imediato. Pega casos onde
    // throttling de background congelou o setTimeout.
    const onVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        ativo.current &&
        !cancelado
      ) {
        fetchSessao();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelado = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibility);
      canalRef?.removeChannel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessaoId]);

  const processandoAtivo = sessao?.status === "processando";

  // ── Rotação das etapas de loading ────────────────────────────────────────
  useEffect(() => {
    if (!processandoAtivo) return;
    const iv = setInterval(() => {
      setEtapaIndex((prev) => (prev + 1) % ETAPAS_LOADING.length);
    }, ETAPA_ROTACAO_MS);
    return () => clearInterval(iv);
  }, [processandoAtivo]);

  // ── Hidratação do estado editável a partir da sessão (1x) ───────────────
  useEffect(() => {
    if (hidratado || !sessao) return;
    if (
      sessao.status !== "rascunho" &&
      sessao.status !== "concluido" &&
      sessao.status !== "aguardando_revisao" &&
      sessao.status !== "convertido_em_processo" // sessão 074: revisão pós-conversão (auditoria XSD)
    ) {
      return;
    }

    // dados_confirmados pode ser {} (objeto vazio) — nesse caso, usar dados_extraidos
    const confirmados = sessao.dados_confirmados as DadosRevisao | null;
    const extraidos = sessao.dados_extraidos as DadosRevisao | null;
    const temConfirmados =
      confirmados != null && Object.keys(confirmados).length > 0;
    const fonte = temConfirmados ? confirmados : (extraidos ?? {});
    setDadosRevisao(fonte);

    const rows: ProcessoArquivoRow[] = sessao.processo_arquivos ?? [];
    setArquivosClassif(
      rows.map((r) => ({
        id: r.id,
        nome_original: r.nome_original,
        mime_type: r.mime_type,
        tamanho_bytes: r.tamanho_bytes,
        destino_xml: r.destino_xml ?? false,
        destino_acervo: r.destino_acervo ?? false,
        tipo_xsd: r.tipo_xsd,
      })),
    );
    setHidratado(true);

    // ── Construir confirmações a partir de comprobatorios_detectados ──────
    if (!confirmacoesBuildFeito.current) {
      confirmacoesBuildFeito.current = true;
      const extraidos = sessao.dados_extraidos as Record<
        string,
        unknown
      > | null;
      const detectadosRaw = (extraidos?.comprobatorios_detectados ??
        []) as ComprobatorioDetectadoRaw[];
      const arquivosRef = sessao.arquivos ?? [];

      if (detectadosRaw.length > 0) {
        // Se já tem confirmações salvas em dados_confirmados, restaurar status
        const confirmadosSalvos = (fonte as Record<string, unknown>)
          ?.confirmacoes_comprobatorios as Record<string, string> | undefined;

        const mapa = construirConfirmacoes(detectadosRaw, arquivosRef);

        // Restaurar status 'confirmado' de sessões anteriores (auto-save)
        if (confirmadosSalvos) {
          for (const [tipo, status] of Object.entries(confirmadosSalvos)) {
            const entry = mapa.get(tipo as TipoXsdComprobatorio);
            if (entry && status === "confirmado") {
              entry.status = "confirmado";
            }
          }
        }

        setConfirmacoes(mapa);
      }
    }
  }, [sessao, hidratado]);

  // ── Verificar se processo possui diploma(s) bloqueado(s) (publicado/assinado) ──
  // Se sim, bloqueia o formulário de revisão imediatamente ao carregar.
  const lockCheckFeito = useRef(false);
  useEffect(() => {
    if (lockCheckFeito.current || !sessao?.processo_id) return;
    lockCheckFeito.current = true;
    const STATUS_BLOQUEADO = new Set([
      "assinado",
      "registrado",
      "rvdd_gerado",
      "publicado",
    ]);
    let cancelado = false;
    async function verificarLock() {
      try {
        const res = await fetch(`/api/processos/${sessao!.processo_id}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelado) return;
        const dados = await res.json();
        const contagem: Record<string, number> = dados?.contagem_status ?? {};
        const bloqueado = Object.keys(contagem).some(
          (s) => STATUS_BLOQUEADO.has(s) && contagem[s] > 0,
        );
        if (bloqueado && !cancelado) setFormBloqueado(true);
      } catch {
        // silencioso — não bloqueia por erro de rede
      }
    }
    verificarLock();
    return () => {
      cancelado = true;
    };
  }, [sessao?.processo_id]);

  // ── Buscar lista de cursos do cadastro ──────────────────────────────────
  useEffect(() => {
    let cancelado = false;
    async function carregarCursos() {
      try {
        const res = await fetch("/api/cursos", { cache: "no-store" });
        if (!res.ok) {
          // Log visível — ajuda diagnóstico se auto-fill falhar
          console.warn(
            "[revisao] /api/cursos falhou:",
            res.status,
            await res.text().catch(() => ""),
          );
          return;
        }
        const data = await res.json();
        if (!cancelado && Array.isArray(data)) {
          console.info("[revisao] cursos carregados:", data.length);
          setCursos(data);
        }
      } catch (e) {
        console.warn("[revisao] erro ao carregar /api/cursos:", e);
      }
    }
    carregarCursos();
    return () => {
      cancelado = true;
    };
  }, []);

  // ── Buscar assinantes cadastrados e injetar no dadosRevisao ────────────
  const assinantesCarregados = useRef(false);
  useEffect(() => {
    if (assinantesCarregados.current || !hidratado) return;
    // Se já tem assinantes no dado (ex: dados_confirmados salvos), pular
    if (dadosRevisao.assinantes && dadosRevisao.assinantes.length > 0) {
      assinantesCarregados.current = true;
      return;
    }
    assinantesCarregados.current = true;
    let cancelado = false;
    async function carregarAssinantes() {
      try {
        const res = await fetch("/api/assinantes", { cache: "no-store" });
        if (!res.ok || cancelado) return;
        const lista = await res.json();
        if (!Array.isArray(lista) || lista.length === 0 || cancelado) return;
        const ativos = lista.filter((a: { ativo: boolean }) => a.ativo);
        if (ativos.length === 0) return;
        const ecpfs = ativos
          .filter(
            (a: { tipo_certificado: string }) => a.tipo_certificado === "eCPF",
          )
          .sort(
            (
              a: { ordem_assinatura: number },
              b: { ordem_assinatura: number },
            ) => a.ordem_assinatura - b.ordem_assinatura,
          );
        const ecnpj = ativos.find(
          (a: { tipo_certificado: string }) => a.tipo_certificado === "eCNPJ",
        );
        if (!cancelado) {
          setDadosRevisao((prev) => ({
            ...prev,
            assinantes: ecpfs.map(
              (a: {
                id: string;
                nome: string;
                cpf: string;
                cargo: string;
                outro_cargo: string | null;
              }) => ({
                id: a.id,
                nome: a.nome,
                cpf: a.cpf,
                cargo: a.outro_cargo || a.cargo,
              }),
            ),
            ecnpj_emissora: ecnpj
              ? ecnpj.cpf
                  ?.replace(/\D/g, "")
                  .replace(
                    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                    "$1.$2.$3/$4-$5",
                  )
              : prev.ecnpj_emissora,
          }));
        }
      } catch {
        // silencioso — assinantes preenchidos manualmente se falhar
      }
    }
    carregarAssinantes();
    return () => {
      cancelado = true;
    };
  }, [hidratado, dadosRevisao.assinantes]);

  // ── Auto-match: tentar associar curso extraído ao cadastro (1x) ────────
  //
  // Bug corrigido (2026-04-22, piloto Kauana):
  //   1. Quando `dadosRevisao.curso_id` já existia, só setava o ID e retornava
  //      — não aplicava os campos do cadastro. Resultado: IES (nome/CNPJ/codigo_mec)
  //      e demais campos normalizados do curso (codigo_emec, grau, etc.) ficavam
  //      vazios, mesmo com curso cadastrado no banco. Fix: sempre chamar
  //      `aplicarCursoCadastro()`.
  //   2. O Gemini às vezes extrai `curso.curso` ("FISIOTERAPIA") em vez de
  //      `curso.nome`. Fix: usar ambos como fallback no match por nome.
  useEffect(() => {
    if (autoMatchFeito.current || !hidratado || cursos.length === 0) return;
    autoMatchFeito.current = true;

    const cursoDados = dadosRevisao.curso as
      | Record<string, unknown>
      | undefined;
    const nomeExtraido = (
      (cursoDados?.nome as string | undefined) ||
      (cursoDados?.curso as string | undefined) ||
      ""
    )
      .toLowerCase()
      .trim();

    console.info("[revisao] auto-match executando", {
      cursos: cursos.length,
      curso_id_salvo: dadosRevisao.curso_id ?? null,
      nome_extraido: nomeExtraido || null,
    });

    // 1) Se já tem curso_id salvo (ex: dados_confirmados), usar direto
    //    E TAMBÉM aplicar cadastro — garante IES e campos normalizados.
    if (dadosRevisao.curso_id) {
      const existe = cursos.find((c) => c.id === dadosRevisao.curso_id);
      if (existe) {
        console.info("[revisao] auto-match por curso_id:", existe.nome);
        setCursoSelecionadoId(existe.id);
        aplicarCursoCadastro(existe);
        return;
      }
    }

    // 2) Tentar match por nome do curso extraído
    if (!nomeExtraido) {
      console.warn(
        "[revisao] auto-match: sem nome extraído — usuário terá que selecionar manualmente",
      );
      return;
    }

    const match = cursos.find(
      (c) =>
        c.nome.toLowerCase().trim().includes(nomeExtraido) ||
        nomeExtraido.includes(c.nome.toLowerCase().trim()),
    );
    if (match) {
      console.info("[revisao] auto-match por nome:", match.nome);
      setCursoSelecionadoId(match.id);
      aplicarCursoCadastro(match);
    } else {
      console.warn(
        "[revisao] auto-match: nenhum curso cadastrado casou com",
        nomeExtraido,
      );
    }
  }, [hidratado, cursos]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mapas de normalização: enum do banco → valor XSD do select ─────────
  // O banco armazena enums lowercase (ex: "bacharel"), mas os selects do
  // formulário usam os valores do XSD v1.05 (ex: "Bacharelado").
  const GRAU_DB_PARA_XSD: Record<string, string> = {
    bacharel: "Bacharelado",
    bacharelado: "Bacharelado",
    licenciado: "Licenciatura",
    licenciatura: "Licenciatura",
    tecnologo: "Tecnólogo",
    tecnólogo: "Tecnólogo",
    "curso sequencial": "Curso sequencial",
  };

  const MODALIDADE_DB_PARA_XSD: Record<string, string> = {
    presencial: "Presencial",
    ead: "EAD",
    "a distância": "EAD",
    "a distancia": "EAD",
  };

  // titulo_conferido no banco pode ser livre (ex: "Bacharel em Ciências Contábeis")
  // mas o select XSD espera apenas o grau (ex: "Bacharel")
  const TITULO_DB_PARA_XSD: Record<string, string> = {
    bacharel: "Bacharel",
    licenciado: "Licenciado",
    tecnólogo: "Tecnólogo",
    tecnologo: "Tecnólogo",
    médico: "Médico",
    medico: "Médico",
  };

  function normalizarGrau(val: string | null | undefined): string | null {
    if (!val) return null;
    return GRAU_DB_PARA_XSD[val.toLowerCase().trim()] ?? val;
  }

  function normalizarModalidade(val: string | null | undefined): string | null {
    if (!val) return null;
    return MODALIDADE_DB_PARA_XSD[val.toLowerCase().trim()] ?? val;
  }

  function normalizarTitulo(val: string | null | undefined): string | null {
    if (!val) return null;
    const lower = val.toLowerCase().trim();
    // Tenta match direto primeiro
    if (TITULO_DB_PARA_XSD[lower]) return TITULO_DB_PARA_XSD[lower];
    // Se é texto livre (ex: "Bacharel em Ciências Contábeis"), extrai o primeiro token
    const primeiroToken = lower.split(/\s+/)[0];
    if (TITULO_DB_PARA_XSD[primeiroToken])
      return TITULO_DB_PARA_XSD[primeiroToken];
    return val;
  }

  // ── Aplicar dados do curso cadastrado ao formulário ────────────────────
  function aplicarCursoCadastro(c: CursoCadastro) {
    setDadosRevisao((prev) => ({
      ...prev,
      curso_id: c.id,
      curso: {
        ...prev.curso,
        nome: c.nome,
        codigo_emec: c.codigo_emec ?? prev.curso?.codigo_emec ?? null,
        grau: normalizarGrau(c.grau) ?? prev.curso?.grau ?? null,
        titulo_conferido:
          normalizarTitulo(c.titulo_conferido) ??
          prev.curso?.titulo_conferido ??
          null,
        modalidade:
          normalizarModalidade(c.modalidade) ?? prev.curso?.modalidade ?? null,
        carga_horaria:
          c.carga_horaria_total ?? prev.curso?.carga_horaria ?? null,
        hora_aula_min:
          c.duracao_hora_aula_minutos ?? prev.curso?.hora_aula_min ?? null,
        codigo_curriculo:
          c.codigo_curriculo ?? prev.curso?.codigo_curriculo ?? null,
      },
      ies: {
        ...prev.ies,
        nome: c.instituicoes?.nome ?? prev.ies?.nome ?? null,
        cnpj: c.instituicoes?.cnpj ?? prev.ies?.cnpj ?? null,
        codigo_mec: c.instituicoes?.codigo_mec ?? prev.ies?.codigo_mec ?? null,
      },
    }));
    setDirty(true);
  }

  // ── Handler de seleção manual de curso ─────────────────────────────────
  const handleCursoSelecionado = useCallback(
    (cursoId: string) => {
      if (!cursoId) {
        setCursoSelecionadoId(null);
        return;
      }
      setCursoSelecionadoId(cursoId);
      const c = cursos.find((x) => x.id === cursoId);
      if (c) aplicarCursoCadastro(c);
    },
    [cursos], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Memo: arquivos com tipo_xsd derivado das confirmações (sessão 049) ──
  // O sidebar de comprobatórios atualiza `confirmacoes` (Map in-memory),
  // mas `arquivosClassif` NÃO era atualizado com o tipo_xsd correspondente.
  // Isso causava o bug onde o gate (que lê processo_arquivos.tipo_xsd do banco)
  // via todos os comprobatórios como faltantes, apesar de estarem "4/4 confirmados"
  // na UI. Este memo garante que o auto-save e o flush pré-converter enviem
  // o tipo_xsd correto ao banco.
  const arquivosComConfirmacoes = useMemo(() => {
    if (confirmacoes.size === 0) return arquivosClassif;

    // Constrói mapa: nome_original → tipo_xsd confirmado
    const nomeParaTipo = new Map<string, TipoXsdComprobatorio>();
    for (const [, c] of confirmacoes) {
      if (c.status === "confirmado" && c.nome_arquivo) {
        nomeParaTipo.set(c.nome_arquivo, c.tipo_xsd);
        // Também match case-insensitive
        nomeParaTipo.set(c.nome_arquivo.toLowerCase(), c.tipo_xsd);
      }
    }

    if (nomeParaTipo.size === 0) return arquivosClassif;

    return arquivosClassif.map((a) => {
      const tipoConfirmado =
        nomeParaTipo.get(a.nome_original) ??
        nomeParaTipo.get(a.nome_original.toLowerCase());
      if (tipoConfirmado) {
        return {
          ...a,
          tipo_xsd: tipoConfirmado,
          destino_xml: true, // Comprobatório confirmado → vai pro XML
        };
      }
      return a;
    });
  }, [arquivosClassif, confirmacoes]);

  // ── Debounced auto-save (1.5s após última edição) ───────────────────────
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dirty || !hidratado || !sessaoId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaveStatus("saving");
      try {
        // Serializar confirmações de comprobatórios para persistência
        const confirmacoesSerialized: Record<string, string> = {};
        for (const [tipo, c] of confirmacoes) {
          confirmacoesSerialized[tipo] = c.status;
        }

        const res = await fetch(`/api/extracao/sessoes/${sessaoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            dados_confirmados: {
              ...dadosRevisao,
              confirmacoes_comprobatorios: confirmacoesSerialized,
            },
            arquivos: arquivosComConfirmacoes.map((a) => ({
              id: a.id,
              destino_xml: a.destino_xml,
              destino_acervo: a.destino_acervo,
              tipo_xsd: a.tipo_xsd,
            })),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          // 403 DIPLOMA_PUBLICADO → bloquear formulário imediatamente
          if (res.status === 403 && body?.erro === "DIPLOMA_PUBLICADO") {
            setFormBloqueado(true);
          }
          throw new Error(body?.erro ?? `HTTP ${res.status}`);
        }
        setAutoSaveStatus("saved");
        setUltimoSalvamento(new Date());
        setDirty(false);
        // mantém "saved" permanente — timestamp fica visível
      } catch (e) {
        console.error("[auto-save] falhou:", e);
        setAutoSaveStatus("error");
      }
    }, 1500);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [
    dadosRevisao,
    arquivosComConfirmacoes,
    confirmacoes,
    dirty,
    hidratado,
    sessaoId,
  ]);

  // ── Handlers dos componentes filhos ─────────────────────────────────────
  const handleDadosChange = useCallback((novos: DadosRevisao) => {
    setDadosRevisao(novos);
    setDirty(true);
  }, []);

  const handleArquivoChange = useCallback(
    (id: string, patch: Partial<ArquivoClassificavel>) => {
      setArquivosClassif((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
      setDirty(true);
    },
    [],
  );

  // ── Handlers de comprobatórios (sessão 043) ──────────────────────────────

  /** Abre o dialog de visualização de um comprobatório. Gera signed URL. */
  const handleVisualizarComprobatorio = useCallback(
    async (c: ConfirmacaoComprobatorio) => {
      setDialogComprobatorio(c);
      setPreviewUrl(null);
      setPreviewMime(null);
      setCarregandoPreview(true);

      try {
        // Encontrar o arquivo na sessão para obter storage_path e mime_type
        const arquivo =
          c.arquivo_index != null ? sessao?.arquivos?.[c.arquivo_index] : null;

        if (!arquivo) {
          setCarregandoPreview(false);
          return;
        }

        setPreviewMime(arquivo.mime_type);

        // Gerar signed URL via Supabase client (import dinâmico)
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data, error } = await supabase.storage
          .from(arquivo.bucket || "processo-arquivos")
          .createSignedUrl(arquivo.storage_path, 600); // 10 min

        if (error || !data?.signedUrl) {
          console.error("[preview] Erro ao gerar signed URL:", error);
          setCarregandoPreview(false);
          return;
        }

        setPreviewUrl(data.signedUrl);
      } catch (e) {
        console.error("[preview] Erro:", e);
      } finally {
        setCarregandoPreview(false);
      }
    },
    [sessao?.arquivos],
  );

  /**
   * Substitui o arquivo do comprobatório sendo visualizado.
   * 1. Faz upload do novo arquivo para o Supabase Storage
   * 2. Atualiza sessao.arquivos[idx] com o novo arquivo
   * 3. Atualiza arquivosClassif[idx] com nome/mime/tamanho novos
   * 4. Re-gera signed URL para o preview (o checkbox de confirmação é
   *    resetado automaticamente pelo dialog ao detectar nova previewUrl)
   */
  const handleSubstituirArquivo = useCallback(
    async (file: File) => {
      const idx = dialogComprobatorio?.arquivo_index;
      if (idx == null || !sessaoId) return;

      setSubstituindoArquivo(true);
      setPreviewUrl(null);
      setPreviewMime(null);
      setCarregandoPreview(true);

      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { resolverTenantAtivo } = await import("@/lib/extracao/upload");
        const supabase = createClient();

        // Descobre quem está logado + o tenant ativo — necessário para montar
        // um path que passe pela policy RLS processo_arquivos_tenant_*.
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr || !user) {
          alert("Sessão expirada. Faça login novamente.");
          return;
        }
        const tenantId = await resolverTenantAtivo(supabase, user.id);

        // Path: {tenant_id}/{user_id}/sub_{idx}_{timestamp}.{ext} — casado com
        // o formato dos uploads iniciais (lib/extracao/upload.ts).
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
        const novoPath = `${tenantId}/${user.id}/sub_${idx}_${Date.now()}${ext ? "." + ext : ""}`;
        const bucket = sessao?.arquivos?.[idx]?.bucket ?? "processo-arquivos";

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(novoPath, file, { upsert: true, contentType: file.type });

        if (uploadError) {
          console.error("[substituir] Erro no upload:", uploadError);
          alert("Erro ao enviar o arquivo. Tente novamente.");
          return;
        }

        // Gera signed URL para preview imediato
        const { data: signed, error: signErr } = await supabase.storage
          .from(bucket)
          .createSignedUrl(novoPath, 600);

        if (signErr || !signed?.signedUrl) {
          console.error("[substituir] Erro ao gerar signed URL:", signErr);
          return;
        }

        // Sessão 2026-04-26: persiste a substituição no banco IMEDIATAMENTE.
        // Antes era 100% client-side (auto-save só toca destino_xml/acervo/
        // tipo_xsd, não storage_path/nome/mime/tamanho), o que fazia F5
        // reverter para o arquivo original.
        const arquivoIdReal = arquivosClassif[idx]?.id;
        if (!arquivoIdReal) {
          console.error(
            "[substituir] arquivoClassif[idx].id ausente, não dá pra persistir",
          );
          alert(
            "Não foi possível identificar o arquivo a substituir. Recarregue a página.",
          );
          return;
        }

        const persistRes = await fetch(
          `/api/extracao/sessoes/${sessaoId}/arquivos/${arquivoIdReal}/substituir`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              storage_path: novoPath,
              bucket,
              nome_original: file.name,
              mime_type: file.type,
              tamanho_bytes: file.size,
            }),
          },
        );

        if (!persistRes.ok) {
          const body = await persistRes.json().catch(() => ({}));
          const motivo =
            (body as { mensagem?: string; erro?: string })?.mensagem ??
            (body as { erro?: string })?.erro ??
            `HTTP ${persistRes.status}`;
          console.error("[substituir] Persistência falhou:", motivo);
          alert(
            `Substituição não foi salva no banco: ${motivo}\n\nO arquivo subiu para o Storage mas o registro do diploma continua apontando para o arquivo anterior. Por favor tente novamente.`,
          );
          return;
        }

        // Atualiza sessao.arquivos para que futuras aberturas do preview usem o novo arquivo
        setSessao((prev) => {
          if (!prev) return prev;
          const novosArquivos = [...(prev.arquivos ?? [])];
          novosArquivos[idx] = {
            ...novosArquivos[idx],
            storage_path: novoPath,
            bucket,
            nome_original: file.name,
            mime_type: file.type,
            tamanho_bytes: file.size,
          };
          return { ...prev, arquivos: novosArquivos };
        });

        // Atualiza arquivosClassif para refletir o novo arquivo nos cards
        setArquivosClassif((prev) =>
          prev.map((a, i) =>
            i === idx
              ? {
                  ...a,
                  nome_original: file.name,
                  mime_type: file.type,
                  tamanho_bytes: file.size,
                }
              : a,
          ),
        );

        // Atualiza dialog com novo nome de arquivo
        setDialogComprobatorio((prev) =>
          prev != null ? { ...prev, nome_arquivo: file.name } : prev,
        );

        setPreviewMime(file.type);
        setPreviewUrl(signed.signedUrl);
        setDirty(true);
      } catch (e) {
        console.error("[substituir] Erro inesperado:", e);
        alert("Erro inesperado ao substituir o arquivo.");
      } finally {
        setSubstituindoArquivo(false);
        setCarregandoPreview(false);
      }
    },
    [
      dialogComprobatorio?.arquivo_index,
      sessaoId,
      sessao?.arquivos,
      arquivosClassif,
    ],
  );

  /** Descarta a sessão de extração e redireciona para a lista de processos. */
  const descartarExtracao = useCallback(async () => {
    if (!sessaoId) return;
    const confirmado = window.confirm(
      "⚠️ Tem certeza que deseja excluir esta importação?\n\nTodos os arquivos enviados e os dados extraídos serão descartados permanentemente. Esta ação não pode ser desfeita.",
    );
    if (!confirmado) return;
    setDescartando(true);
    try {
      const res = await fetch(`/api/extracao/sessoes/${sessaoId}/descartar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => ({}));
        throw new Error(
          (erro as { erro?: string })?.erro || "Falha ao descartar a extração",
        );
      }
      // Limpa o localStorage para que o banner de recovery não reapareça
      try {
        localStorage.removeItem("diploma:ultima-sessao");
      } catch {
        /* ignore */
      }
      router.push("/diploma/processos");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao descartar a extração");
    } finally {
      setDescartando(false);
    }
  }, [sessaoId, router]);

  /** Confirma um comprobatório (muda status para 'confirmado' + salva destinos). */
  const handleConfirmarComprobatorio = useCallback(
    (
      c: ConfirmacaoComprobatorio,
      destinoXml: boolean,
      destinoAcervo: boolean,
    ) => {
      setConfirmacoes((prev) => {
        const next = new Map(prev);
        next.set(c.tipo_xsd, { ...c, status: "confirmado" });
        return next;
      });
      // Salva os destinos escolhidos no card do arquivo.
      // ⚠️ IMPORTANTE: usa nome_arquivo (nome-based) — NÃO arquivo_index.
      // Motivo: arquivo_index é calculado contra sessao.arquivos (JSONB do Railway)
      // mas arquivosClassif é construído a partir de sessao.processo_arquivos (tabela
      // Supabase). Como o Railway insere os docs em paralelo, a ordem de inserção em
      // processo_arquivos pode diferir da ordem em sessao.arquivos, fazendo o índice
      // apontar para o arquivo errado e dessincronizar a UI.
      if (c.nome_arquivo) {
        setArquivosClassif((prev) =>
          prev.map((a) =>
            a.nome_original === c.nome_arquivo
              ? { ...a, destino_xml: destinoXml, destino_acervo: destinoAcervo }
              : a,
          ),
        );
      }
      setDialogComprobatorio(null);
      setDirty(true);
    },
    [],
  );

  /** Troca o tipo XSD de um comprobatório detectado. */
  const handleTrocarTipoComprobatorio = useCallback(
    (c: ConfirmacaoComprobatorio, novoTipo: TipoXsdComprobatorio) => {
      setConfirmacoes((prev) => {
        const next = new Map(prev);
        // Remove o tipo antigo
        next.delete(c.tipo_xsd);
        // Adiciona com o novo tipo (como detectado, precisa reconfirmar)
        next.set(novoTipo, {
          ...c,
          tipo_xsd: novoTipo,
          status: "detectado",
        });
        return next;
      });
      setDialogComprobatorio(null);
      setDirty(true);
    },
    [],
  );

  // ── Seleção manual de arquivo para comprobatório pendente (sessão 044) ───

  /** Lista de arquivos da sessão para o picker manual */
  const arquivosSessaoParaPicker = useMemo((): ArquivoSessao[] => {
    if (!sessao?.arquivos) return [];
    const extraidos = sessao.dados_extraidos as Record<string, unknown> | null;
    const porArquivo = (extraidos?.por_arquivo ?? []) as Array<{
      nome_original: string;
      tipo_documento_detectado?: string | null;
    }>;

    return sessao.arquivos.map((arq, index) => {
      const info = porArquivo.find(
        (p) => p.nome_original === arq.nome_original,
      );
      return {
        index,
        nome_original: arq.nome_original,
        mime_type: arq.mime_type,
        tipo_detectado: info?.tipo_documento_detectado ?? null,
      };
    });
  }, [sessao?.arquivos, sessao?.dados_extraidos]);

  /** Quando o operador seleciona manualmente um arquivo para um tipo pendente */
  const handleSelecionarArquivoManual = useCallback(
    (tipo: TipoXsdComprobatorio, arquivo: ArquivoSessao) => {
      // Cria a confirmação como "detectado" (amarelo) — operador ainda precisa confirmar
      setConfirmacoes((prev) => {
        const next = new Map(prev);
        next.set(tipo, {
          tipo_xsd: tipo,
          status: "detectado",
          nome_arquivo: arquivo.nome_original,
          arquivo_index: arquivo.index,
          confianca: undefined, // manual — sem confiança IA (undefined = campo omitido na serialização)
        });
        return next;
      });
      setTipoSelecaoManual(null);
      setDirty(true);
    },
    [],
  );

  // ── Gate: contar comprobatórios confirmados (sessão 043) ─────────────────
  const gateComprobatorios = useMemo(() => {
    let confirmados = 0;
    const total = COMPROBATORIOS_OBRIGATORIOS_FIC.length;

    for (const regra of COMPROBATORIOS_OBRIGATORIOS_FIC) {
      const tipos = regra.kind === "simples" ? [regra.tipo] : regra.tipos;
      const temConfirmado = tipos.some(
        (t) => confirmacoes.get(t)?.status === "confirmado",
      );
      if (temConfirmado) confirmados++;
    }

    return {
      confirmados,
      total,
      todosConfirmados: confirmados === total,
      faltam: total - confirmados,
    };
  }, [confirmacoes]);

  // ── Criar processo (POST /converter) ────────────────────────────────────
  const criarProcesso = useCallback(
    async (overrideJustificativa?: string) => {
      if (!sessaoId || criando) return;
      setCriando(true);
      setErroCriacao(null);

      // Força flush do auto-save antes de converter: salva tudo sincronamente.
      if (dirty) {
        try {
          const confirmacoesSerialized: Record<string, string> = {};
          for (const [tipo, c] of confirmacoes) {
            confirmacoesSerialized[tipo] = c.status;
          }

          await fetch(`/api/extracao/sessoes/${sessaoId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              dados_confirmados: {
                ...dadosRevisao,
                confirmacoes_comprobatorios: confirmacoesSerialized,
              },
              arquivos: arquivosComConfirmacoes.map((a) => ({
                id: a.id,
                destino_xml: a.destino_xml,
                destino_acervo: a.destino_acervo,
                tipo_xsd: a.tipo_xsd,
              })),
            }),
          });
          setDirty(false);
        } catch {
          // segue; o converter vai validar no banco
        }
      }

      try {
        const res = await fetch(`/api/extracao/sessoes/${sessaoId}/converter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            override_justificativa: overrideJustificativa ?? null,
          }),
        });

        const body = await res.json().catch(() => ({}));

        if (res.status === 422 && body?.erro === "GATE_BLOQUEADO") {
          setModalOverride({
            violacoes: body.violacoes ?? [],
            bloqueantes: body.bloqueantes ?? [],
          });
          setCriando(false);
          return;
        }

        if (!res.ok) {
          throw new Error(body?.mensagem ?? body?.erro ?? `HTTP ${res.status}`);
        }

        const processoId = body?.processo_id;
        if (!processoId) {
          throw new Error("Resposta sem processo_id");
        }

        // Sucesso → vai para o pipeline do diploma (interface principal pós-revisão)
        // FIX s075: não redirecionar para lista; manter no fluxo diploma
        setModalOverride(null);
        const diplomaId = body?.diploma_id;
        if (diplomaId) {
          router.push(`/diploma/diplomas/${diplomaId}`);
        } else {
          // ja_convertido: processo já existia → recarregar revisão atual
          router.refresh();
        }
      } catch (e) {
        console.error("[criar processo]", e);
        setErroCriacao(
          e instanceof Error ? e.message : "Erro ao criar processo",
        );
        setCriando(false);
      }
    },
    [
      sessaoId,
      criando,
      dirty,
      dadosRevisao,
      arquivosComConfirmacoes,
      confirmacoes,
      router,
    ],
  );

  // ── Render: faltando ID na URL (defensivo) ───────────────────────────────
  if (!sessaoId) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-red-600">ID da sessão não fornecido na URL.</p>
      </div>
    );
  }

  // ── Render: erro de fetch persistente ────────────────────────────────────
  // Sessão 034: só mostra painel de erro depois de 3 falhas consecutivas
  // (cada falha já tem 3 retries internos = 9 tentativas reais antes de
  // incomodar o usuário). Isso absorve "Failed to fetch" transitório do
  // load inicial — típico durante deploy ou hiccup de rede.
  if (erroFetch && !sessao && falhasConsecutivas >= FALHAS_LIMIAR_ERRO) {
    return (
      <ErroPainel
        titulo="Não foi possível carregar a sessão"
        mensagem={erroFetch}
        onVoltar={() => router.push("/diploma/processos")}
        onTentarNovamente={tentarNovamente}
      />
    );
  }

  // ── Render: timeout ──────────────────────────────────────────────────────
  if (timeoutEstourado) {
    return (
      <ErroPainel
        titulo="A extração demorou mais que o esperado"
        mensagem={
          "O processamento ultrapassou 7 minutos. Isso pode acontecer com arquivos muito grandes ou com instabilidade temporária. Tente novamente — seus arquivos já foram salvos e você pode reaproveitar."
        }
        onVoltar={() => router.push("/diploma/processos")}
      />
    );
  }

  // ── Render: sessão em erro ───────────────────────────────────────────────
  if (sessao?.status === "erro") {
    return (
      <ErroPainel
        titulo="Erro durante a extração"
        mensagem={sessao.erro_mensagem || "Erro desconhecido. Tente novamente."}
        onVoltar={() => router.push("/diploma/processos")}
      />
    );
  }

  // ── Render: loading enquanto busca o estado inicial ──────────────────────
  if (!sessao) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-24 text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-600" />
        <p className="mt-4 text-sm text-gray-500">Carregando sessão...</p>
      </div>
    );
  }

  // ── Render: processando — barra + etapas animadas ────────────────────────
  if (sessao.status === "processando") {
    return (
      <ProcessandoPainel
        totalArquivos={sessao.arquivos.length}
        etapaIndex={etapaIndex}
        tempoDecorrido={tempoDecorrido}
        erroFetch={erroFetch}
      />
    );
  }

  // ── Render: pronto (rascunho) — formulário + classificação + gate ────────
  return (
    <>
      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(voltarHref)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label={voltarLabel}
              title={voltarLabel}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Revisão dos dados extraídos
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {sessao.arquivos.length}{" "}
                {sessao.arquivos.length === 1
                  ? "arquivo processado"
                  : "arquivos processados"}
                {sessao.processing_ms &&
                  ` em ${(sessao.processing_ms / 1000).toFixed(1)}s`}
                {sessao.confianca_geral != null && (
                  <>
                    {" · "}
                    confiança {(sessao.confianca_geral * 100).toFixed(0)}%
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Indicador de auto-save */}
          <AutoSaveIndicator
            status={autoSaveStatus}
            dirty={dirty}
            ultimoSalvamento={ultimoSalvamento}
          />
        </div>

        {/* Banner de formulário bloqueado (diploma publicado/assinado) */}
        {formBloqueado && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">
                Formulário bloqueado — diploma publicado ou assinado
              </p>
              <p className="text-xs opacity-75 mt-0.5">
                O processo possui diploma(s) em estágio avançado. A revisão dos
                dados de extração está em modo somente leitura.
              </p>
            </div>
          </div>
        )}

        {/* Layout: 2 colunas em desktop */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* Coluna esquerda: Formulário + arquivos */}
          <div className="space-y-6">
            <FormularioRevisao
              dados={dadosRevisao}
              onChange={formBloqueado ? () => {} : handleDadosChange}
              cursos={cursos}
              cursoSelecionadoId={cursoSelecionadoId}
              onCursoSelecionado={
                formBloqueado ? () => {} : handleCursoSelecionado
              }
            />

            {/* Arquivos processados (somente listagem) */}
            <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                Arquivos processados
              </h3>
              <p className="mb-4 text-xs text-gray-500">
                Para definir o destino de cada arquivo (XML ou Acervo), confirme
                o documento no painel ao lado.
              </p>

              {arquivosClassif.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhum arquivo encontrado para esta sessão.
                </p>
              ) : (
                <div className="space-y-2">
                  {arquivosClassif.map((arq) => (
                    <CardArquivoClassificacao
                      key={arq.id}
                      arquivo={arq}
                      onChange={
                        formBloqueado
                          ? () => {}
                          : (patch) => handleArquivoChange(arq.id, patch)
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Debug dos dados extraídos */}
            <details className="rounded-md border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-900">
              <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">
                Ver JSON bruto extraído (debug)
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto rounded bg-gray-50 p-3 text-xs dark:bg-gray-950">
                {JSON.stringify(sessao.dados_extraidos, null, 2)}
              </pre>
            </details>
          </div>

          {/* Coluna direita: Gate FIC sticky + ação */}
          <aside className="lg:sticky lg:top-6 lg:h-fit lg:self-start">
            <GateFicComprobatorios
              confirmacoes={confirmacoes}
              onVisualizarDocumento={handleVisualizarComprobatorio}
              onSubstituirArquivo={(tipo) => setTipoSelecaoManual(tipo)}
            />

            {erroCriacao && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
                {erroCriacao}
              </div>
            )}

            {/* Sessão 074: processo já criado — modo revisão pós-auditoria */}
            {sessao?.status === "convertido_em_processo" ? (
              <>
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                  <p className="font-semibold">Revisão pós-auditoria</p>
                  <p className="mt-0.5 text-xs opacity-80">
                    Você está revisando os dados de extração de um processo já
                    confirmado. Alterações são salvas automaticamente.
                  </p>
                </div>
                {sessao.diploma_id && (
                  <button
                    onClick={() =>
                      router.push(`/diploma/diplomas/${sessao.diploma_id}`)
                    }
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
                  >
                    Voltar ao pipeline
                  </button>
                )}
              </>
            ) : (
              // Sessão 074: novo fluxo — processo já existe desde o upload (em_extracao).
              // Botão "Confirmar dados" confirma os dados revisados e transiciona
              // o processo de em_extracao → rascunho.
              // Fluxo legado (processo_id null): botão "Criar processo" como antes.
              <button
                onClick={() => criarProcesso()}
                disabled={
                  criando ||
                  !gateComprobatorios.todosConfirmados ||
                  formBloqueado
                }
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                  gateComprobatorios.todosConfirmados
                    ? "bg-violet-600 text-white hover:bg-violet-700"
                    : "bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                }`}
              >
                {criando && <Loader2 className="h-4 w-4 animate-spin" />}
                {criando
                  ? sessao.processo_id
                    ? "Confirmando dados..."
                    : "Criando processo..."
                  : gateComprobatorios.todosConfirmados
                    ? sessao.processo_id
                      ? "Confirmar dados"
                      : "Criar processo"
                    : `Confirmar ${gateComprobatorios.faltam} doc(s) restante(s)`}
              </button>
            )}

            <button
              onClick={() => router.push("/diploma/processos")}
              className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Voltar para a lista
            </button>

            <button
              onClick={descartarExtracao}
              disabled={descartando || criando}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              {descartando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {descartando ? "Excluindo..." : "Excluir importação e extração"}
            </button>
          </aside>
        </div>
      </div>

      {/* Dialog de visualização de comprobatório (sessão 043) */}
      {(() => {
        const arquivoAtual =
          dialogComprobatorio?.arquivo_index != null
            ? arquivosClassif[dialogComprobatorio.arquivo_index]
            : null;
        return (
          <DialogVisualizarDocumento
            confirmacao={dialogComprobatorio}
            previewUrl={previewUrl}
            mimeType={previewMime}
            carregandoPreview={carregandoPreview}
            destinoXmlInicial={arquivoAtual?.destino_xml ?? false}
            destinoAcervoInicial={arquivoAtual?.destino_acervo ?? false}
            onConfirmar={handleConfirmarComprobatorio}
            onTrocarTipo={handleTrocarTipoComprobatorio}
            onSubstituirArquivo={handleSubstituirArquivo}
            substituindo={substituindoArquivo}
            onFechar={() => setDialogComprobatorio(null)}
          />
        );
      })()}

      {/* Dialog de seleção manual de arquivo (sessão 044) */}
      <DialogSelecionarArquivo
        tipoAlvo={tipoSelecaoManual}
        arquivos={arquivosSessaoParaPicker}
        confirmacoes={confirmacoes}
        onSelecionar={handleSelecionarArquivoManual}
        onFechar={() => setTipoSelecaoManual(null)}
      />

      {/* Modal de override (só aparece em 422 GATE_BLOQUEADO) */}
      {modalOverride && (
        <ModalOverrideCriacao
          violacoes={modalOverride.violacoes}
          bloqueantes={modalOverride.bloqueantes}
          onCancelar={() => setModalOverride(null)}
          onConfirmar={async (justificativa) => {
            await criarProcesso(justificativa);
          }}
        />
      )}
    </>
  );
}

// ─── Subcomponente: indicador de auto-save ──────────────────────────────────

function AutoSaveIndicator({
  status,
  dirty,
  ultimoSalvamento,
}: {
  status: "idle" | "saving" | "saved" | "error";
  dirty: boolean;
  ultimoSalvamento: Date | null;
}) {
  // Formata "às HH:MM de DD/MM/AA"
  const timestampStr = ultimoSalvamento
    ? (() => {
        const hh = ultimoSalvamento.getHours().toString().padStart(2, "0");
        const mm = ultimoSalvamento.getMinutes().toString().padStart(2, "0");
        const dd = ultimoSalvamento.getDate().toString().padStart(2, "0");
        const mo = (ultimoSalvamento.getMonth() + 1)
          .toString()
          .padStart(2, "0");
        const aa = ultimoSalvamento.getFullYear().toString().slice(2);
        return `às ${hh}:${mm} de ${dd}/${mo}/${aa}`;
      })()
    : null;

  if (status === "saving") {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Salvando...
        </div>
        {timestampStr && (
          <span className="text-[11px] text-gray-400">
            Salvo automaticamente, {timestampStr}
          </span>
        )}
      </div>
    );
  }
  if (status === "saved") {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Salvo automaticamente
        </div>
        {timestampStr && (
          <span className="text-[11px] text-gray-400">{timestampStr}</span>
        )}
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          Erro ao salvar
        </div>
        {timestampStr && (
          <span className="text-[11px] text-gray-400">
            Último salvo {timestampStr}
          </span>
        )}
      </div>
    );
  }
  if (dirty) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Save className="h-3.5 w-3.5" />
          Alterações não salvas
        </div>
        {timestampStr && (
          <span className="text-[11px] text-gray-400">
            Último salvo {timestampStr}
          </span>
        )}
      </div>
    );
  }
  // idle sem ultimoSalvamento → nada
  if (!timestampStr) return null;
  // idle com timestamp → mostra permanente
  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1.5 text-xs text-green-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Salvo automaticamente
      </div>
      <span className="text-[11px] text-gray-400">{timestampStr}</span>
    </div>
  );
}

// ─── Subcomponente: painel de processamento ─────────────────────────────────

function ProcessandoPainel({
  totalArquivos,
  etapaIndex,
  tempoDecorrido,
  erroFetch,
}: {
  totalArquivos: number;
  etapaIndex: number;
  tempoDecorrido: number;
  erroFetch?: string | null;
}) {
  const etapa = ETAPAS_LOADING[etapaIndex];
  const Icone = etapa.icone;

  // Progresso fake suave: vai de 0 a 90% nos primeiros 2 min, e fica em 90% até o fim
  const progressoFake = Math.min(90, (tempoDecorrido / (2 * 60 * 1000)) * 90);
  const segundos = Math.floor(tempoDecorrido / 1000);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-10 shadow-sm dark:border-violet-900/50 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
              <Icone className="h-10 w-10 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="absolute inset-0 animate-ping rounded-full bg-violet-400 opacity-20" />
          </div>
        </div>

        <h1 className="text-center text-2xl font-bold text-gray-900 dark:text-gray-100">
          Nossa IA está trabalhando
        </h1>
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
          Processando {totalArquivos}{" "}
          {totalArquivos === 1 ? "arquivo" : "arquivos"}
          {segundos > 0 && ` • ${segundos}s decorridos`}
        </p>

        {/* Barra de progresso */}
        <div className="mt-8">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all duration-1000 ease-out"
              style={{ width: `${progressoFake}%` }}
            />
          </div>
        </div>

        {/* Etapa atual com transição */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
          <p
            key={etapaIndex}
            className="animate-fade-in text-sm font-medium text-violet-700 dark:text-violet-300"
          >
            {etapa.texto}
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
          Pode levar até 2 minutos. Não feche esta página.
        </p>

        {/* Camada 4 (sessão 034): erro de fetch visível durante processando */}
        {erroFetch && (
          <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <p className="font-semibold">Aviso:</p>
            <p className="mt-0.5">
              {erroFetch}. Estamos tentando novamente automaticamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subcomponente: painel de erro ──────────────────────────────────────────

function ErroPainel({
  titulo,
  mensagem,
  onVoltar,
  onTentarNovamente,
}: {
  titulo: string;
  mensagem: string;
  onVoltar: () => void;
  onTentarNovamente?: () => void;
}) {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/30">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
        <h1 className="mt-4 text-xl font-bold text-red-900 dark:text-red-200">
          {titulo}
        </h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          {mensagem}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onTentarNovamente && (
            <button
              onClick={onTentarNovamente}
              className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
          )}
          <button
            onClick={onVoltar}
            className="rounded-md bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Voltar para a lista
          </button>
        </div>
      </div>
    </div>
  );
}
