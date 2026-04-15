/**
 * NovoProjetoDialog.tsx — Dialog de criação de projeto de Parcelamento
 *
 * Fluxo em 4 steps (Sessão 130 — redesign completo):
 *
 *   Step 1 — Tipo de projeto
 *     • Masterplan (em breve — disabled)
 *     • Parcelamento Individual (default)
 *
 *   Step 2 — Upload KMZ/KML (drag-and-drop)
 *     • Parse inline via kmlParser.parseKmlFile()
 *     • Exibe área em m² (não hectares!), perímetro e nº vértices
 *     • Ao clicar "Continuar": CRIA o projeto no banco com status "rascunho"
 *       + salva geometria (PostGIS). Assim se o usuário abandonar, volta a
 *       rascunho no dashboard e pode retomar depois.
 *
 *   Step 3 — Mapa + localização
 *     • Mapbox satellite com polígono
 *     • Cidade cravada via reverseGeocode() (Nominatim primeiro — evita
 *       "Região Metropolitana de X")
 *     • UF selecionável, descrição opcional (textarea)
 *     • Mostra área em m² e perímetro
 *     • Ao "Continuar": UPDATE city/state/description no banco
 *
 *   Step 4 — Parâmetros urbanísticos declarados
 *     • Tipo de empreendimento: Loteamento Aberto / Fechado / Condomínio
 *       de Lotes / Desmembramento (radio)
 *     • Padrão: Popular / Médio / Alto / Luxo (radio) → pré-preenche defaults
 *     • Percentuais: Área Pública (ou "Lazer" se condomínio), Verde, Viário, APP
 *     • Lote mínimo (m²)
 *     • Calcula "Área Líquida de Lotes" = 100 - soma dos %
 *     • Validação: soma ≤ 100
 *     • "Concluir" → UPDATE final + status "em_analise" → dashboard
 *
 * Retomada de rascunho:
 *   • Prop `resumeProjectId` opcional. Quando passado e open=true, busca o
 *     projeto pelo id e detecta em qual step retomar:
 *       - Sem geometry → Step 2
 *       - Sem city → Step 3
 *       - Sem tipo_parcelamento → Step 4
 *       - Tudo preenchido → Step 4 (último)
 *
 * Regras CLAUDE.md aplicadas:
 *   - .maybeSingle() nos hooks (já está em useParcelamentoProjects)
 *   - DOMPurify não usado (sem HTML de IA aqui)
 *   - PostgrestError tratado no catch (extrai message/details/hint/code)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  LayoutGrid,
  Square,
  Upload,
  FileCheck2,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import {
  parseKmlFile,
  formatAreaM2,
  formatPerimeter,
  type KMLParseResult,
} from "@/lib/parcelamento/kmlParser";
import { reverseGeocode } from "@/lib/parcelamento/ibgeApi";
import {
  useCreateParcelamentoProject,
  useUpdateParcelamentoGeometry,
  useUpdateParcelamentoParams,
  useParcelamentoProject,
} from "@/hooks/useParcelamentoProjects";
import { useToast } from "@/hooks/use-toast";
import type {
  BoundingBox,
  ParcelamentoProjectType,
  TipoParcelamento,
  PadraoEmpreendimento,
} from "@/lib/parcelamento/types";

// ---------------------------------------------------------------------------
// Tipos locais
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3 | 4;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se setado, retoma wizard de um rascunho existente. */
  resumeProjectId?: string | null;
}

// ---------------------------------------------------------------------------
// Constantes — labels e defaults (Lei 6.766 + benchmarks)
// ---------------------------------------------------------------------------

const TIPO_LABELS: Record<TipoParcelamento, string> = {
  loteamento_aberto: "Loteamento Aberto",
  loteamento_fechado: "Loteamento com Fechamento",
  condominio_lotes: "Condomínio de Lotes",
  desmembramento: "Desmembramento",
};

const TIPO_DESC: Record<TipoParcelamento, string> = {
  loteamento_aberto:
    "Lei 6.766 — lotes com acesso público, doação de áreas ao município.",
  loteamento_fechado:
    "Loteamento com cercamento e controle de acesso (convênio com município).",
  condominio_lotes:
    "Lei 4.591 + 13.465 — lotes em condomínio, áreas internas privativas.",
  desmembramento:
    "Subdivisão de gleba sem abertura de novas vias (Lei 6.766 art. 2º §2º).",
};

const PADRAO_LABELS: Record<PadraoEmpreendimento, string> = {
  popular: "Popular",
  medio: "Médio",
  alto: "Alto",
  luxo: "Luxo",
};

/**
 * Defaults de parcelamento por padrão de empreendimento.
 * Referência: Lei 6.766 art. 4º (mínimo 35% para uso público em loteamentos)
 * e benchmarks de mercado do setor imobiliário brasileiro.
 *
 * Os valores são sugestões editáveis — o usuário pode ajustar livremente.
 */
const PADRAO_DEFAULTS: Record<
  PadraoEmpreendimento,
  {
    pct_area_publica: number;
    pct_area_verde: number;
    pct_sistema_viario: number;
    pct_app_declarado: number;
    lote_minimo_m2: number;
  }
> = {
  popular: {
    pct_area_publica: 5,
    pct_area_verde: 15,
    pct_sistema_viario: 25,
    pct_app_declarado: 0,
    lote_minimo_m2: 125,
  },
  medio: {
    pct_area_publica: 5,
    pct_area_verde: 18,
    pct_sistema_viario: 25,
    pct_app_declarado: 0,
    lote_minimo_m2: 250,
  },
  alto: {
    pct_area_publica: 5,
    pct_area_verde: 22,
    pct_sistema_viario: 25,
    pct_app_declarado: 0,
    lote_minimo_m2: 450,
  },
  luxo: {
    pct_area_publica: 5,
    pct_area_verde: 28,
    pct_sistema_viario: 25,
    pct_app_declarado: 0,
    lote_minimo_m2: 1000,
  },
};

// Lista estática de UFs (mesma ordem do IBGE)
const UF_LIST: { value: string; label: string }[] = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];

// ---------------------------------------------------------------------------
// Helper — computa bbox a partir das coordenadas parseadas do KML
// ---------------------------------------------------------------------------

function computeBBoxFromCoords(coords: [number, number][]): BoundingBox {
  let west = Infinity,
    east = -Infinity,
    south = Infinity,
    north = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { west, south, east, north };
}

/** Extrai mensagem legível de qualquer shape de erro (Error, PostgrestError, etc.) */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return (
      e.message ??
      e.details ??
      e.hint ??
      (e.code ? `Código: ${e.code}` : JSON.stringify(err))
    );
  }
  return "Erro desconhecido";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NovoProjetoDialog({
  open,
  onOpenChange,
  resumeProjectId = null,
}: Props) {
  const { toast } = useToast();

  // Hook de retomada: busca projeto existente quando resumeProjectId setado
  const { data: resumeProject } = useParcelamentoProject(
    open ? resumeProjectId : null
  );

  // State
  const [step, setStep] = useState<Step>(1);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectType, setProjectType] =
    useState<ParcelamentoProjectType | null>("individual");

  // Step 2 — KMZ
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<KMLParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Step 3 — Localização
  const [projectName, setProjectName] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUF] = useState("");
  const [description, setDescription] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  // Step 4 — Parâmetros urbanísticos
  const [tipoParcelamento, setTipoParcelamento] =
    useState<TipoParcelamento | null>(null);
  const [padraoEmpreendimento, setPadraoEmpreendimento] =
    useState<PadraoEmpreendimento | null>(null);
  const [pctAreaPublica, setPctAreaPublica] = useState<number>(0);
  const [pctAreaVerde, setPctAreaVerde] = useState<number>(0);
  const [pctSistemaViario, setPctSistemaViario] = useState<number>(0);
  const [pctAppDeclarado, setPctAppDeclarado] = useState<number>(0);
  const [loteMinimoM2, setLoteMinimoM2] = useState<number>(0);

  // Submission
  const [submitting, setSubmitting] = useState(false);

  // Mapbox
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // Mutations
  const createProject = useCreateParcelamentoProject();
  const updateGeometry = useUpdateParcelamentoGeometry();
  const updateParams = useUpdateParcelamentoParams();

  // -------------------------------------------------------------------------
  // Reset quando dialog fecha (mas só se NÃO estamos retomando)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!open) {
      setStep(1);
      setProjectId(null);
      setProjectType("individual");
      setFile(null);
      setParseResult(null);
      setParseError(null);
      setProjectName("");
      setCity("");
      setUF("");
      setDescription("");
      setTipoParcelamento(null);
      setPadraoEmpreendimento(null);
      setPctAreaPublica(0);
      setPctAreaVerde(0);
      setPctSistemaViario(0);
      setPctAppDeclarado(0);
      setLoteMinimoM2(0);
      setMapError(null);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    }
  }, [open]);

  // -------------------------------------------------------------------------
  // Retomada de rascunho: quando resumeProject chega, hidrata o state e
  // pula para o step apropriado.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!open || !resumeProject) return;

    setProjectId(resumeProject.id);
    setProjectName(resumeProject.name ?? "");
    setCity(resumeProject.city ?? "");
    setUF(resumeProject.state ?? "");
    setDescription(resumeProject.description ?? "");

    // Step 4 fields
    if (resumeProject.tipo_parcelamento) {
      setTipoParcelamento(resumeProject.tipo_parcelamento);
    }
    if (resumeProject.padrao_empreendimento) {
      setPadraoEmpreendimento(resumeProject.padrao_empreendimento);
    }
    setPctAreaPublica(resumeProject.pct_area_publica ?? 0);
    setPctAreaVerde(resumeProject.pct_area_verde ?? 0);
    setPctSistemaViario(resumeProject.pct_sistema_viario ?? 0);
    setPctAppDeclarado(resumeProject.pct_app_declarado ?? 0);
    setLoteMinimoM2(resumeProject.lote_minimo_m2 ?? 0);

    // Hidrata parseResult a partir do geometry salvo (se existir) para que
    // o mapa consiga renderizar no Step 3/4 mesmo sem re-upload de KMZ.
    if (resumeProject.geometry && resumeProject.area_m2) {
      try {
        const rawGeom =
          typeof resumeProject.geometry === "string"
            ? JSON.parse(resumeProject.geometry)
            : resumeProject.geometry;
        // Extrai o primeiro polígono (ignora multi-anéis)
        let coords: [number, number][] = [];
        if (rawGeom.type === "MultiPolygon") {
          coords = rawGeom.coordinates[0]?.[0] ?? [];
        } else if (rawGeom.type === "Polygon") {
          coords = rawGeom.coordinates[0] ?? [];
        }
        if (coords.length > 0) {
          // Calcula centróide aproximado (centro do bbox)
          const bbox = computeBBoxFromCoords(coords);
          setParseResult({
            coordinates: coords,
            name: resumeProject.name,
            area_m2: resumeProject.area_m2,
            perimeter_m: resumeProject.perimeter_m ?? 0,
            centroid: {
              lng: (bbox.west + bbox.east) / 2,
              lat: (bbox.south + bbox.north) / 2,
            },
          });
        }
      } catch (e) {
        console.warn("[NovoProjetoDialog] falha ao parse geometry:", e);
      }
    }

    // Determina qual step retomar
    let targetStep: Step = 2;
    if (!resumeProject.area_m2) {
      targetStep = 2;
    } else if (!resumeProject.city) {
      targetStep = 3;
    } else if (!resumeProject.tipo_parcelamento) {
      targetStep = 4;
    } else {
      targetStep = 4;
    }
    setStep(targetStep);
  }, [open, resumeProject]);

  // -------------------------------------------------------------------------
  // Step 3/4: inicializa Mapbox e desenha o polígono
  // -------------------------------------------------------------------------
  useEffect(() => {
    if ((step !== 3 && step !== 4) || !parseResult || !mapContainerRef.current) {
      return;
    }

    const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
    if (!token) {
      setMapError("VITE_MAPBOX_TOKEN não configurado.");
      return;
    }

    if (!document.querySelector('link[data-mapbox-css]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.13.0/mapbox-gl.css";
      link.setAttribute("data-mapbox-css", "true");
      document.head.appendChild(link);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mapInstance: any = null;
    let cancelled = false;

    import("mapbox-gl")
      .then((mod) => {
        if (cancelled) return;
        const mapboxgl = mod.default;
        mapboxgl.accessToken = token;

        const { centroid, coordinates, area_m2 } = parseResult;
        const zoom = area_m2 ? Math.max(10, 17 - Math.log2(area_m2 / 10_000)) : 13;

        mapInstance = new mapboxgl.Map({
          container: mapContainerRef.current!,
          style: "mapbox://styles/mapbox/satellite-streets-v12",
          center: [centroid.lng, centroid.lat],
          zoom,
        });
        mapRef.current = mapInstance;

        mapInstance.on("load", () => {
          if (cancelled) return;
          mapInstance.addSource("terreno", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: [coordinates],
              },
            },
          });
          mapInstance.addLayer({
            id: "terreno-fill",
            type: "fill",
            source: "terreno",
            paint: { "fill-color": "#3b82f6", "fill-opacity": 0.25 },
          });
          mapInstance.addLayer({
            id: "terreno-line",
            type: "line",
            source: "terreno",
            paint: { "line-color": "#3b82f6", "line-width": 2.5 },
          });

          const bbox = computeBBoxFromCoords(coordinates);
          mapInstance.fitBounds(
            [
              [bbox.west, bbox.south],
              [bbox.east, bbox.north],
            ],
            { padding: 40, duration: 600 }
          );
          mapInstance.addControl(new mapboxgl.NavigationControl(), "top-right");
        });
      })
      .catch(() => {
        if (!cancelled) setMapError("Falha ao carregar Mapbox GL.");
      });

    return () => {
      cancelled = true;
      if (mapInstance) mapInstance.remove();
      mapRef.current = null;
    };
  }, [step, parseResult]);

  // -------------------------------------------------------------------------
  // Parse KMZ/KML
  // -------------------------------------------------------------------------
  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f);
    setParseError(null);
    setParseResult(null);
    setParsing(true);

    try {
      const result = await parseKmlFile(f);
      if (!result.ok || !result.data) {
        setParseError(result.error ?? "Falha ao processar arquivo");
        return;
      }
      setParseResult(result.data);
      if (result.data.name && result.data.name !== "Área" && !projectName) {
        setProjectName(result.data.name);
      }
    } catch (err) {
      setParseError(extractErrorMessage(err));
    } finally {
      setParsing(false);
    }
  }, [projectName]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  // -------------------------------------------------------------------------
  // Step 2 → Step 3: cria projeto no banco + salva geometria + geocode
  // -------------------------------------------------------------------------
  const handleGoToStep3 = useCallback(async () => {
    if (!parseResult) return;
    setSubmitting(true);

    try {
      let currentId = projectId;

      // Se ainda não existe projeto, cria agora (rascunho)
      if (!currentId) {
        const created = await createProject.mutateAsync({
          name: projectName.trim() || parseResult.name || "Novo Projeto",
          tipo: "loteamento", // default; pode refinar no step 4
          state: "",
          city: "",
        });
        currentId = created.id;
        setProjectId(currentId);
      }

      // Salva geometria
      const { coordinates, area_m2, perimeter_m } = parseResult;
      const bbox = computeBBoxFromCoords(coordinates);
      await updateGeometry.mutateAsync({
        projectId: currentId,
        geometry: {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [coordinates] },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        bbox,
        area_m2,
        perimeter_m,
        file_name: file?.name,
        file_format: file?.name.toLowerCase().endsWith(".kmz") ? "kmz" : "kml",
      });

      // Avança e dispara reverse geocoding
      setStep(3);
      setGeocoding(true);
      try {
        const result = await reverseGeocode(
          parseResult.centroid.lat,
          parseResult.centroid.lng
        );
        if (result.city && !city) setCity(result.city);
        if (result.uf && !uf) setUF(result.uf);
      } catch {
        // silencioso — usuário preenche manualmente
      } finally {
        setGeocoding(false);
      }
    } catch (err) {
      console.error("[NovoProjetoDialog] falha ao salvar rascunho:", err);
      toast({
        title: "Erro ao salvar rascunho",
        description: extractErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    parseResult,
    projectId,
    projectName,
    file,
    city,
    uf,
    createProject,
    updateGeometry,
    toast,
  ]);

  // -------------------------------------------------------------------------
  // Step 3 → Step 4: salva localização (city, state, description)
  // -------------------------------------------------------------------------
  const handleGoToStep4 = useCallback(async () => {
    if (!projectId || !city.trim() || !uf) {
      toast({
        title: "Preencha os campos",
        description: "Cidade e UF são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await updateParams.mutateAsync({
        projectId,
        city: city.trim(),
        state: uf,
        description: description.trim() || null,
      });
      setStep(4);
    } catch (err) {
      console.error("[NovoProjetoDialog] falha step3:", err);
      toast({
        title: "Erro ao salvar localização",
        description: extractErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }, [projectId, city, uf, description, updateParams, toast]);

  // -------------------------------------------------------------------------
  // Aplica defaults quando padrão é selecionado (só se campos estiverem zerados)
  // -------------------------------------------------------------------------
  const handlePadraoChange = useCallback(
    (newPadrao: PadraoEmpreendimento) => {
      setPadraoEmpreendimento(newPadrao);
      const defs = PADRAO_DEFAULTS[newPadrao];
      // Só aplica defaults se todos os percentuais ainda estiverem zerados
      // (não sobrescreve edições do usuário)
      if (
        pctAreaPublica === 0 &&
        pctAreaVerde === 0 &&
        pctSistemaViario === 0 &&
        pctAppDeclarado === 0
      ) {
        setPctAreaPublica(defs.pct_area_publica);
        setPctAreaVerde(defs.pct_area_verde);
        setPctSistemaViario(defs.pct_sistema_viario);
        setPctAppDeclarado(defs.pct_app_declarado);
      }
      if (loteMinimoM2 === 0) {
        setLoteMinimoM2(defs.lote_minimo_m2);
      }
    },
    [pctAreaPublica, pctAreaVerde, pctSistemaViario, pctAppDeclarado, loteMinimoM2]
  );

  // Soma dos percentuais e área líquida
  const somaPct =
    pctAreaPublica + pctAreaVerde + pctSistemaViario + pctAppDeclarado;
  const areaLiquidaPct = Math.max(0, 100 - somaPct);
  const somaExcede = somaPct > 100;

  // Label "Área Pública" vira "Área de Lazer" em condomínio
  const isCondominio = tipoParcelamento === "condominio_lotes";
  const areaPublicaLabel = isCondominio
    ? "Área de Lazer (%)"
    : "Área Pública (%)";

  // -------------------------------------------------------------------------
  // Step 4 → Concluir: salva params finais + finalize=true (em_analise)
  // -------------------------------------------------------------------------
  const handleFinalize = useCallback(async () => {
    if (!projectId || !tipoParcelamento || !padraoEmpreendimento) {
      toast({
        title: "Preencha todos os campos",
        description: "Tipo e padrão são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    if (somaExcede) {
      toast({
        title: "Percentuais inválidos",
        description: "A soma dos percentuais não pode ultrapassar 100%.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await updateParams.mutateAsync({
        projectId,
        tipo_parcelamento: tipoParcelamento,
        padrao_empreendimento: padraoEmpreendimento,
        pct_area_publica: pctAreaPublica,
        pct_area_verde: pctAreaVerde,
        pct_sistema_viario: pctSistemaViario,
        pct_app_declarado: pctAppDeclarado,
        lote_minimo_m2: loteMinimoM2,
        finalize: true,
      });
      toast({
        title: "Projeto criado!",
        description: "Projeto movido para 'Em Análise' no dashboard.",
      });
      onOpenChange(false);
    } catch (err) {
      console.error("[NovoProjetoDialog] falha finalize:", err);
      toast({
        title: "Erro ao concluir",
        description: extractErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    projectId,
    tipoParcelamento,
    padraoEmpreendimento,
    pctAreaPublica,
    pctAreaVerde,
    pctSistemaViario,
    pctAppDeclarado,
    loteMinimoM2,
    somaExcede,
    updateParams,
    toast,
    onOpenChange,
  ]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const canGoToStep2 = projectType === "individual";
  const canGoToStep3 = !!parseResult && !parsing && !submitting;
  const canGoToStep4Btn =
    !!city.trim() && !!uf && !submitting && !!projectId;
  const canFinalize =
    !!tipoParcelamento &&
    !!padraoEmpreendimento &&
    !somaExcede &&
    !submitting &&
    !!projectId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            {resumeProjectId ? "Continuar Rascunho" : "Novo Projeto de Parcelamento"}
          </DialogTitle>
          <DialogDescription>
            Passo {step} de 4 —{" "}
            {step === 1 && "Escolha o tipo de projeto"}
            {step === 2 && "Importe o arquivo KMZ/KML com os limites do terreno"}
            {step === 3 && "Confirme a localização do terreno"}
            {step === 4 && "Defina os parâmetros urbanísticos"}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`h-2 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            </div>
          ))}
        </div>

        {/* ========== STEP 1: Tipo ========== */}
        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-2 py-4">
            <Card className="p-6 cursor-not-allowed border-2 opacity-60 relative border-gray-200">
              <Badge className="absolute top-3 right-3 bg-amber-100 text-amber-800 border-amber-300">
                Em breve
              </Badge>
              <LayoutGrid className="h-10 w-10 text-gray-400 mb-3" />
              <h3 className="font-semibold text-lg mb-2">Masterplan</h3>
              <p className="text-sm text-gray-600">
                Contêiner de múltiplas fases — loteamentos e empreendimentos
                comerciais dentro de uma mesma incorporação, cada um com
                viabilidade própria e lançamentos independentes.
              </p>
            </Card>

            <Card
              className={`p-6 cursor-pointer border-2 transition-all hover:shadow-md ${
                projectType === "individual"
                  ? "border-blue-600 bg-blue-50/50"
                  : "border-gray-200"
              }`}
              onClick={() => setProjectType("individual")}
            >
              <Square className="h-10 w-10 text-blue-600 mb-3" />
              <h3 className="font-semibold text-lg mb-2">
                Parcelamento Individual
              </h3>
              <p className="text-sm text-gray-600">
                Projeto único — 1 área, 1 cálculo de viabilidade, 1 fluxo.
                Ideal para loteamentos ou condomínios horizontais isolados.
              </p>
              {projectType === "individual" && (
                <CheckCircle2 className="h-5 w-5 text-blue-600 mt-3" />
              )}
            </Card>
          </div>
        )}

        {/* ========== STEP 2: Upload KMZ ========== */}
        {step === 2 && (
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="project-name">Nome do Projeto</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ex: Loteamento Splendori (opcional — preenche do KMZ)"
                className="mt-1"
              />
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
                dragActive
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
              }`}
              onClick={() => document.getElementById("kmz-file-input")?.click()}
            >
              <input
                id="kmz-file-input"
                type="file"
                accept=".kml,.kmz"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />

              {!file && !parseResult && (
                <>
                  <Upload className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                  <p className="font-medium text-gray-700 mb-1">
                    Arraste o arquivo KMZ/KML aqui
                  </p>
                  <p className="text-sm text-gray-500">
                    ou clique para selecionar do computador
                  </p>
                </>
              )}

              {file && parsing && (
                <>
                  <Loader2 className="h-12 w-12 mx-auto text-blue-600 mb-3 animate-spin" />
                  <p className="font-medium text-gray-700">
                    Processando {file.name}...
                  </p>
                </>
              )}

              {parseResult && !parsing && (
                <>
                  <FileCheck2 className="h-12 w-12 mx-auto text-green-600 mb-3" />
                  <p className="font-medium text-gray-700 mb-1">
                    {file?.name ?? parseResult.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatAreaM2(parseResult.area_m2)} ·{" "}
                    {formatPerimeter(parseResult.perimeter_m)}
                  </p>
                </>
              )}
            </div>

            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {parseResult && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-500 text-xs">Nome</div>
                  <div className="font-semibold truncate">
                    {parseResult.name}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-500 text-xs">Área</div>
                  <div className="font-semibold">
                    {formatAreaM2(parseResult.area_m2)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-500 text-xs">Perímetro</div>
                  <div className="font-semibold">
                    {formatPerimeter(parseResult.perimeter_m)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-gray-500 text-xs">Vértices</div>
                  <div className="font-semibold">
                    {parseResult.coordinates.length}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========== STEP 3: Mapa + localização ========== */}
        {step === 3 && parseResult && (
          <div className="py-4 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Mapa */}
              <div className="space-y-2">
                <Label>Visualização do terreno</Label>
                <div
                  ref={mapContainerRef}
                  className="w-full h-[320px] rounded-lg border bg-gray-100"
                />
                {mapError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{mapError}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Form */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="project-name-3">Nome do Projeto *</Label>
                  <Input
                    id="project-name-3"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Ex: Loteamento Splendori"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label htmlFor="city">
                      Cidade *{" "}
                      {geocoding && (
                        <Loader2 className="inline h-3 w-3 animate-spin ml-1" />
                      )}
                    </Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Cidade"
                      disabled={geocoding}
                    />
                  </div>
                  <div>
                    <Label htmlFor="uf">UF *</Label>
                    <Select value={uf} onValueChange={setUF}>
                      <SelectTrigger id="uf">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {UF_LIST.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.value} — {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Observações sobre o terreno, histórico, contexto..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-blue-700">Área</div>
                    <div className="font-bold text-blue-900">
                      {formatAreaM2(parseResult.area_m2)}
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-blue-700">Perímetro</div>
                    <div className="font-bold text-blue-900">
                      {formatPerimeter(parseResult.perimeter_m)}
                    </div>
                  </div>
                </div>

                {parseResult.centroid && (
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {parseResult.centroid.lat.toFixed(5)},{" "}
                    {parseResult.centroid.lng.toFixed(5)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========== STEP 4: Parâmetros urbanísticos ========== */}
        {step === 4 && parseResult && (
          <div className="py-4 space-y-5">
            {/* Tipo de empreendimento */}
            <div>
              <Label className="mb-2 block">
                Tipo de Empreendimento *
              </Label>
              <RadioGroup
                value={tipoParcelamento ?? ""}
                onValueChange={(v) =>
                  setTipoParcelamento(v as TipoParcelamento)
                }
                className="grid grid-cols-1 md:grid-cols-2 gap-2"
              >
                {(Object.keys(TIPO_LABELS) as TipoParcelamento[]).map((t) => (
                  <label
                    key={t}
                    htmlFor={`tipo-${t}`}
                    className={`flex items-start gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                      tipoParcelamento === t
                        ? "border-blue-600 bg-blue-50/50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <RadioGroupItem
                      value={t}
                      id={`tipo-${t}`}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {TIPO_LABELS[t]}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {TIPO_DESC[t]}
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Padrão */}
            <div>
              <Label className="mb-2 block">Padrão do Empreendimento *</Label>
              <RadioGroup
                value={padraoEmpreendimento ?? ""}
                onValueChange={(v) =>
                  handlePadraoChange(v as PadraoEmpreendimento)
                }
                className="grid grid-cols-2 md:grid-cols-4 gap-2"
              >
                {(Object.keys(PADRAO_LABELS) as PadraoEmpreendimento[]).map(
                  (p) => (
                    <label
                      key={p}
                      htmlFor={`padrao-${p}`}
                      className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                        padraoEmpreendimento === p
                          ? "border-blue-600 bg-blue-50/50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <RadioGroupItem value={p} id={`padrao-${p}`} />
                      <span className="font-medium text-sm">
                        {PADRAO_LABELS[p]}
                      </span>
                    </label>
                  )
                )}
              </RadioGroup>
              {padraoEmpreendimento && (
                <p className="text-xs text-gray-500 mt-2">
                  Sugestões pré-preenchidas baseadas em Lei 6.766 + benchmarks
                  de mercado. Ajuste livremente abaixo.
                </p>
              )}
            </div>

            {/* Percentuais */}
            <div>
              <Label className="mb-2 block">Distribuição de Áreas (%)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label htmlFor="pct-publica" className="text-xs text-gray-600">
                    {areaPublicaLabel}
                  </Label>
                  <Input
                    id="pct-publica"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={pctAreaPublica}
                    onChange={(e) =>
                      setPctAreaPublica(Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="pct-verde" className="text-xs text-gray-600">
                    Área Verde (%)
                  </Label>
                  <Input
                    id="pct-verde"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={pctAreaVerde}
                    onChange={(e) =>
                      setPctAreaVerde(Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="pct-viario" className="text-xs text-gray-600">
                    Sistema Viário (%)
                  </Label>
                  <Input
                    id="pct-viario"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={pctSistemaViario}
                    onChange={(e) =>
                      setPctSistemaViario(Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="pct-app" className="text-xs text-gray-600">
                    APP (%)
                  </Label>
                  <Input
                    id="pct-app"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={pctAppDeclarado}
                    onChange={(e) =>
                      setPctAppDeclarado(Number(e.target.value) || 0)
                    }
                  />
                </div>
              </div>

              {/* Resumo da soma */}
              <div
                className={`mt-3 p-3 rounded-lg border ${
                  somaExcede
                    ? "bg-red-50 border-red-200"
                    : "bg-green-50 border-green-200"
                }`}
              >
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Soma das áreas:</span>
                  <span
                    className={`font-bold ${
                      somaExcede ? "text-red-700" : "text-gray-900"
                    }`}
                  >
                    {somaPct.toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    })}
                    %
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600">
                    Área Líquida de Lotes:
                  </span>
                  <span
                    className={`font-bold ${
                      somaExcede ? "text-red-700" : "text-green-700"
                    }`}
                  >
                    {areaLiquidaPct.toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    })}
                    % ·{" "}
                    {formatAreaM2(
                      (parseResult.area_m2 * areaLiquidaPct) / 100
                    )}
                  </span>
                </div>
                {somaExcede && (
                  <p className="text-xs text-red-700 mt-2">
                    ⚠ A soma não pode ultrapassar 100%.
                  </p>
                )}
              </div>
            </div>

            {/* Lote mínimo */}
            <div>
              <Label htmlFor="lote-minimo">Tamanho Mínimo de Lote (m²) *</Label>
              <Input
                id="lote-minimo"
                type="number"
                min={0}
                step={1}
                value={loteMinimoM2}
                onChange={(e) => setLoteMinimoM2(Number(e.target.value) || 0)}
                className="max-w-[200px]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lei 6.766 art. 4º II — mínimo nacional de 125 m² para
                loteamentos abertos. Condomínios e alto padrão tendem a ser
                maiores.
              </p>
            </div>
          </div>
        )}

        {/* ========== Footer ========== */}
        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
          <div>
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep((s) => (s - 1) as Step)}
                disabled={submitting}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {projectId ? "Salvar rascunho" : "Cancelar"}
            </Button>

            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!canGoToStep2}>
                Continuar <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {step === 2 && (
              <Button onClick={handleGoToStep3} disabled={!canGoToStep3}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    Continuar <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}

            {step === 3 && (
              <Button onClick={handleGoToStep4} disabled={!canGoToStep4Btn}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    Continuar <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            )}

            {step === 4 && (
              <Button onClick={handleFinalize} disabled={!canFinalize}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Concluindo...
                  </>
                ) : (
                  <>Concluir</>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
