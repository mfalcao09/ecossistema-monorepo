"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  FileSignature,
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  GraduationCap,
  ExternalLink,
  Square,
  SquareCheck,
  Ban,
  Package,
  Download,
  Send,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

function lerCookieCSRF(): string {
  const match = document.cookie.match(/(?:^|; )fic-csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/** Envolve uma Promise com timeout — evita hang infinito nas chamadas BRy */
function comTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

/** Probe direto: tenta carregar ok.png da extensão Chrome para verificar se está instalada */
function probeExtensaoInstalada(): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const timer = setTimeout(() => resolve(false), 5000);
    img.onload = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = "chrome-extension://mbpaklahifpfndjiefdfjhmkefppocfm/ok.png";
  });
}

/** Carrega script externo via <script> tag no <head> — mais confiável que Next.js <Script> */
function carregarScriptBridge(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Se já foi carregado, resolver imediatamente
    if (window.BryWebExtension) { resolve(); return; }
    // Verificar se já existe um script com essa URL
    const existente = document.querySelector('script[src*="extension-api.js"]');
    if (existente) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://www.bry.com.br/downloads/extension/v2/api/v1/extension-api.js";
    script.async = true;
    const timer = setTimeout(() => { reject(new Error("Script bridge timeout 15s")); }, 15000);
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); reject(new Error("Falha ao carregar script bridge BRy")); };
    document.head.appendChild(script);
  });
}

// ── Tipos: BRy Extension ───────────────────────────────────────────────────

declare global {
  interface Window {
    BryWebExtension?: {
      isExtensionInstalled: () => Promise<boolean>;
      listCertificates: () => Promise<BryCertificate[]>;
      sign: (certId: string, input: string) => Promise<BrySignResult>;
      installComponents: () => Promise<unknown>;
    };
  }
}

interface BryCertificate {
  certId: string;
  name: string;
  label?: string;
  issuer: string;
  expirationDate: string;
  certificateType: string;
  certificateData: string;
}

interface BrySignResult {
  assinaturas: Array<{ hashes: string[]; nonce: string }>;
}

// ── Tipos: Diploma/Estado ──────────────────────────────────────────────────

interface DiplomaResumo {
  id: string;
  status: string;
  data_conclusao: string | null;
  created_at: string;
  updated_at: string;
  diplomados: { nome: string; cpf: string } | null;
  cursos: { nome: string; grau: string } | null;
  processos_emissao: { nome: string } | null;
}

interface PassoAssinatura {
  passo: number;
  descricao: string;
  tipoAssinante: string;
  perfil: string;
  specificNodeName: string | null;
  specificNodeNamespace: string | null;
  includeXPathEnveloped: boolean;
  status: string;
  nonce: string | null;
  erro_mensagem: string | null;
  cpfAssinante?: string | null;
  tipoCertificado?: "eCPF" | "eCNPJ" | null;
}

interface XmlComPassos {
  xml_gerado_id: string;
  tipo: string;
  tipo_bry: string | null;
  status_xml: string;
  passos: PassoAssinatura[];
}

interface AssinanteResumo {
  id: string;
  nome: string;
  cpf: string | null;
  tipo_certificado: "eCPF" | "eCNPJ";
  cargo: string;
}

interface EstadoAssinatura {
  diploma_id: string;
  status_diploma: string;
  bry_configurado: boolean;
  bry_ambiente: string | null;
  xmls: XmlComPassos[];
  assinantes?: AssinanteResumo[];
}

/**
 * Normaliza string para comparação: remove acentos, converte para maiúsculo.
 */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

/**
 * Encontra o assinante que corresponde ao certificado BRy selecionado.
 * Cruza o nome do certificado (CN) com o nome dos assinantes cadastrados.
 * Retorna o CPF do assinante encontrado + tipo, ou null se não encontrar.
 */
function encontrarAssinanteParaCertificado(
  cert: BryCertificate | null,
  assinantes: AssinanteResumo[]
): AssinanteResumo | null {
  if (!cert || assinantes.length === 0) return null;

  const nomeCert = normalizar(cert.name);

  // Tentar match exato primeiro
  const exato = assinantes.find((a) => normalizar(a.nome) === nomeCert);
  if (exato) return exato;

  // Tentar match parcial (certificado pode ter nome mais longo que o cadastro)
  const parcial = assinantes.find((a) =>
    nomeCert.includes(normalizar(a.nome)) || normalizar(a.nome).includes(nomeCert)
  );
  return parcial ?? null;
}

/**
 * Verifica se um passo de assinatura pode ser assinado pelo certificado selecionado.
 * Cruza cpfAssinante do passo com o CPF do assinante encontrado.
 */
function passoPertenceAoCertificado(
  passo: PassoAssinatura,
  assinanteMatch: AssinanteResumo | null
): boolean {
  // Sem match = não pode filtrar, mostra tudo (fallback)
  if (!assinanteMatch) return true;
  // Sem cpf no passo = fallback estático, mostra tudo
  if (!passo.cpfAssinante) return true;
  // Cruzar CPF do passo com CPF do assinante correspondente ao certificado
  return passo.cpfAssinante === assinanteMatch.cpf;
}

const STATUS_LABEL: Record<string, string> = {
  xml_gerado: "XML Gerado",
  aguardando_assinatura_emissora: "Aguardando Assinatura",
  em_assinatura: "Em Assinatura",
  assinatura_com_erro: "Erro na Assinatura",
  assinado: "Assinado",
};

const STATUS_COR: Record<string, string> = {
  xml_gerado: "bg-blue-100 text-blue-800",
  aguardando_assinatura_emissora: "bg-amber-100 text-amber-800",
  em_assinatura: "bg-purple-100 text-purple-800",
  assinatura_com_erro: "bg-red-100 text-red-800",
  assinado: "bg-green-100 text-green-800",
};

const LABELS_TIPO_XML: Record<string, string> = {
  documentacao_academica: "Doc. Acadêmica",
  diplomado: "Diplomado",
  historico_escolar: "Histórico Escolar",
  curriculo_escolar: "Currículo Escolar",
};

const PASSO_STATUS_COR: Record<string, string> = {
  pendente: "bg-gray-100 text-gray-700",
  inicializado: "bg-yellow-100 text-yellow-800",
  assinado_extensao: "bg-blue-100 text-blue-800",
  finalizado: "bg-green-100 text-green-800",
  erro: "bg-red-100 text-red-800",
};

const PASSO_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  inicializado: "Inicializado",
  assinado_extensao: "Cifrado",
  finalizado: "Finalizado ✓",
  erro: "Erro",
};

// ── Resultado do lote ──────────────────────────────────────────────────────

interface ResultadoLote {
  diplomaId: string;
  nome: string;
  sucesso: boolean;
  mensagem: string;
}

// ── Componente Principal ───────────────────────────────────────────────────

export default function AssinaturasPage() {
  const [diplomas, setDiplomas] = useState<DiplomaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState("");

  // ── BRy Extension (nível da página) ──────────────────────────────────────
  const [extensaoInstalada, setExtensaoInstalada] = useState(false);
  const [detectandoExtensao, setDetectandoExtensao] = useState(true);
  const [bryScriptStatus, setBryScriptStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [certificados, setCertificados] = useState<BryCertificate[]>([]);
  const [certSelecionadoId, setCertSelecionadoId] = useState("");
  const certSelecionado = certificados.find((c) => c.certId === certSelecionadoId) ?? null;

  // ── Seleção para lote ────────────────────────────────────────────────────
  const [loteSelecionados, setLoteSelecionados] = useState<Set<string>>(new Set());

  // ── Estado do lote em execução ───────────────────────────────────────────
  const [assinandoLote, setAssinandoLote] = useState(false);
  const [loteProgresso, setLoteProgresso] = useState({ atual: 0, total: 0 });
  const [loteDiplomaAtual, setLoteDiplomaAtual] = useState("");
  const [lotePassoAtual, setLotePassoAtual] = useState("");
  const [loteResultados, setLoteResultados] = useState<ResultadoLote[]>([]);
  const cancelarLoteRef = useRef(false);

  // ── Estado individual (expansão) ─────────────────────────────────────────
  const [estadoIndividual, setEstadoIndividual] = useState<EstadoAssinatura | null>(null);
  const [carregandoIndividual, setCarregandoIndividual] = useState(false);
  const [assinandoIndividual, setAssinandoIndividual] = useState(false);
  const [passoIndividualAtual, setPassoIndividualAtual] = useState("");
  const [erroIndividual, setErroIndividual] = useState<string | null>(null);

  // ── CSRF ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setCsrfToken(lerCookieCSRF());
  }, []);

  // ── Detectar extensão BRy ────────────────────────────────────────────────
  // Fluxo segue a sequência EXATA do código de referência da BRy:
  // 1. Image probe (chrome-extension://...ok.png) — confirma que a extensão Chrome existe
  // 2. Carrega script bridge (extension-api.js) → cria window.BryWebExtension
  // 3. isExtensionInstalled() via bridge — ESSENCIAL: inicializa canal CustomEvent
  // 4. installComponents() — garante módulo nativo (Token USB) pronto
  // 5. listCertificates() — lista certificados do Token A3
  const verificarExtensao = useCallback(async () => {
    setDetectandoExtensao(true);
    setExtensaoInstalada(false);
    setCertificados([]);
    setErro(null);

    try {
      // ── Passo 1: Image probe direto — não depende do script bridge
      console.log("[BRy] 1/5 Iniciando image probe...");
      const probeOk = await probeExtensaoInstalada();
      console.log("[BRy] 1/5 Probe resultado:", probeOk);

      if (!probeOk) {
        setExtensaoInstalada(false);
        setDetectandoExtensao(false);
        setBryScriptStatus("error");
        return;
      }

      // ── Passo 2: Extensão existe! Carregar o script bridge
      console.log("[BRy] 2/5 Carregando script bridge...");
      setBryScriptStatus("loading");
      try {
        await carregarScriptBridge();
      } catch (err) {
        console.warn("[BRy] 2/5 Script bridge falhou:", err);
        setExtensaoInstalada(true);
        setDetectandoExtensao(false);
        setBryScriptStatus("error");
        setErro("Extensão detectada, mas o módulo de comunicação não carregou. Recarregue a página.");
        return;
      }

      // Aguardar o script criar window.BryWebExtension (pode levar um pouco)
      console.log("[BRy] 2/5 Script carregou, aguardando BryWebExtension...");
      let ext: typeof window.BryWebExtension = undefined;
      for (let tentativa = 0; tentativa < 20; tentativa++) {
        ext = window.BryWebExtension;
        if (ext) break;
        await new Promise((r) => setTimeout(r, 250));
      }

      if (!ext) {
        console.warn("[BRy] 2/5 BryWebExtension não apareceu após 5s");
        setExtensaoInstalada(true);
        setDetectandoExtensao(false);
        setBryScriptStatus("error");
        setErro("Script BRy carregou, mas window.BryWebExtension não foi criado. Recarregue a página.");
        return;
      }

      console.log("[BRy] 2/5 BryWebExtension disponível. Métodos:", Object.keys(ext));
      setBryScriptStatus("loaded");
      setExtensaoInstalada(true);

      // ── Passo 3: isExtensionInstalled() via bridge — inicializa canal de comunicação
      // O código de referência SEMPRE chama isso antes de installComponents/listCertificates
      console.log("[BRy] 3/5 Chamando isExtensionInstalled() via bridge...");
      try {
        const instalada = await comTimeout(ext.isExtensionInstalled(), 8000, "isExtensionInstalled");
        console.log("[BRy] 3/5 isExtensionInstalled() =", instalada);

        if (!instalada) {
          console.warn("[BRy] 3/5 Bridge diz que extensão não está instalada");
          setErro("Extensão BRy detectada mas não respondeu via API. Reinstale a extensão.");
          setDetectandoExtensao(false);
          return;
        }
      } catch (err) {
        console.warn("[BRy] 3/5 isExtensionInstalled() falhou:", err);
        // Continuar mesmo assim — o probe já confirmou que está instalada
      }

      // ── Passo 4: installComponents() — instala módulo nativo se necessário
      console.log("[BRy] 4/5 Chamando installComponents()...");
      try {
        const installResult = await comTimeout(ext.installComponents(), 15000, "installComponents");
        console.log("[BRy] 4/5 installComponents() resultado:", installResult);
      } catch (err) {
        console.warn("[BRy] 4/5 installComponents() falhou:", err);
        // Prosseguir — pode já estar instalado, ou pode funcionar mesmo assim
      }

      // ── Passo 5: listCertificates() — listar certificados do Token A3
      console.log("[BRy] 5/5 Chamando listCertificates()...");
      const certs = await comTimeout(
        ext.listCertificates(), 15000, "listCertificates"
      );
      console.log("[BRy] 5/5 listCertificates() retornou:", certs?.length, "certificados", certs);
      certs.forEach((c) => { c.label = c.name; });
      setCertificados(certs);
      if (certs.length === 1) setCertSelecionadoId(certs[0].certId);

      if (certs.length === 0) {
        setErro("Extensão ativa mas nenhum certificado encontrado. Verifique se o Token USB está conectado e se o módulo nativo BRy está instalado.");
      }
    } catch (err) {
      console.error("[BRy] Erro na detecção:", err);
      const msg = err instanceof Error && err.message.startsWith("Timeout")
        ? "Extensão BRy não respondeu a tempo. Verifique se o Token USB está conectado e o módulo nativo instalado."
        : `Erro ao verificar extensão BRy: ${err instanceof Error ? err.message : String(err)}`;
      setErro(msg);
    } finally {
      setDetectandoExtensao(false);
    }
  }, []);

  // Iniciar detecção automaticamente ao montar o componente
  useEffect(() => {
    verificarExtensao();
  }, [verificarExtensao]);

  // ── Carregar diplomas pendentes ──────────────────────────────────────────
  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      const resp = await fetch("/api/diplomas/pendentes-assinatura");
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.erro ?? `Erro ${resp.status}`);
      }
      const { diplomas: lista } = await resp.json();
      setDiplomas(lista);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Carregar estado individual ───────────────────────────────────────────
  const carregarEstadoIndividual = useCallback(async (diplomaId: string) => {
    try {
      setCarregandoIndividual(true);
      setErroIndividual(null);
      const resp = await fetch(`/api/diplomas/${diplomaId}/assinar`);
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.erro ?? `Erro ${resp.status}`);
      }
      setEstadoIndividual(await resp.json());
    } catch (e) {
      setErroIndividual(e instanceof Error ? e.message : "Erro ao carregar estado");
    } finally {
      setCarregandoIndividual(false);
    }
  }, []);

  // Quando expande, carregar estado
  useEffect(() => {
    if (expandidoId) {
      carregarEstadoIndividual(expandidoId);
    } else {
      setEstadoIndividual(null);
      setErroIndividual(null);
    }
  }, [expandidoId, carregarEstadoIndividual]);

  // ── Executar um passo de assinatura (shared) ─────────────────────────────
  async function executarPassoAssinatura(
    diplomaId: string,
    xml: XmlComPassos,
    passo: PassoAssinatura,
    cert: BryCertificate,
    token: string,
    onProgresso?: (msg: string) => void,
  ): Promise<void> {
    const ext = window.BryWebExtension;
    if (!ext) throw new Error("Extensão BRy não encontrada");

    // ETAPA 1: Initialize
    onProgresso?.(`Passo ${passo.passo}: Enviando para BRy...`);
    const initResp = await fetch(`/api/diplomas/${diplomaId}/assinar/initialize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
      body: JSON.stringify({
        xml_gerado_id: xml.xml_gerado_id,
        passo: passo.passo,
        certificate: cert.certificateData,
        tipo_assinante: passo.tipoAssinante,
        perfil: passo.perfil,
        specific_node_name: passo.specificNodeName,
        specific_node_namespace: passo.specificNodeNamespace,
        include_xpath_enveloped: passo.includeXPathEnveloped ? false : undefined,
      }),
    });

    if (!initResp.ok) {
      const data = await initResp.json();
      throw new Error(data.erro ?? `Initialize falhou (${initResp.status})`);
    }
    const initData = await initResp.json();

    // ETAPA 2: Cifrar com extensão BRy
    onProgresso?.(`Passo ${passo.passo}: Cifrando com Token USB...`);
    const inputExtension = {
      formatoDadosEntrada: "Base64",
      formatoDadosSaida: "Base64",
      algoritmoHash: "SHA256",
      assinaturas: [{
        hashes: [initData.signedAttributes[0].content],
        nonce: initData.signedAttributes[0].nonce,
      }],
    };

    const assinatura = await ext.sign(cert.certId, JSON.stringify(inputExtension));
    const signatureValue = assinatura.assinaturas[0].hashes[0];

    // ETAPA 3: Finalize
    onProgresso?.(`Passo ${passo.passo}: Finalizando assinatura...`);
    const finResp = await fetch(`/api/diplomas/${diplomaId}/assinar/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
      body: JSON.stringify({
        xml_gerado_id: xml.xml_gerado_id,
        passo: passo.passo,
        signature_value: signatureValue,
        certificate: cert.certificateData,
        perfil: passo.perfil,
        include_xpath_enveloped: passo.includeXPathEnveloped ? false : undefined,
      }),
    });

    if (!finResp.ok) {
      const data = await finResp.json();
      throw new Error(data.erro ?? `Finalize falhou (${finResp.status})`);
    }

    onProgresso?.(`Passo ${passo.passo}: Concluído ✓`);
  }

  // ── Assinar todos os passos de um diploma (filtrados pelo certificado) ───
  async function assinarTodosDiploma(
    diplomaId: string,
    cert: BryCertificate,
    token: string,
    onProgresso?: (msg: string) => void,
  ): Promise<void> {
    // Buscar estado
    const resp = await fetch(`/api/diplomas/${diplomaId}/assinar`);
    if (!resp.ok) throw new Error("Erro ao buscar estado de assinatura");
    const estado: EstadoAssinatura = await resp.json();

    if (!estado.bry_configurado) {
      throw new Error("BRy não configurado no servidor");
    }

    // Identificar qual assinante corresponde ao certificado selecionado
    const assinanteMatch = encontrarAssinanteParaCertificado(cert, estado.assinantes ?? []);

    if (!assinanteMatch) {
      throw new Error(
        `Certificado "${cert.name}" não corresponde a nenhum assinante cadastrado. ` +
        `Verifique a página Assinantes.`
      );
    }

    // Iterar XMLs e passos pendentes FILTRADOS pelo certificado
    let passosAssinados = 0;
    for (const xml of estado.xmls) {
      for (const passo of xml.passos) {
        if (
          (passo.status === "pendente" || passo.status === "erro") &&
          passoPertenceAoCertificado(passo, assinanteMatch)
        ) {
          // Checar cancelamento
          if (cancelarLoteRef.current) throw new Error("Cancelado pelo usuário");

          onProgresso?.(`${LABELS_TIPO_XML[xml.tipo] ?? xml.tipo} — Passo ${passo.passo}: ${passo.descricao}`);
          await executarPassoAssinatura(diplomaId, xml, passo, cert, token, onProgresso);
          passosAssinados++;
        }
      }
    }

    if (passosAssinados === 0) {
      throw new Error(
        `Nenhum passo pendente para o certificado "${assinanteMatch.nome}" (${assinanteMatch.tipo_certificado}). ` +
        `Os passos deste assinante já foram concluídos ou pertencem a outro certificado.`
      );
    }
  }

  // ── LOTE: Assinar todos os selecionados ──────────────────────────────────
  async function iniciarLote() {
    if (!certSelecionado || loteSelecionados.size === 0) return;

    const ids = pendentes
      .filter((d) => loteSelecionados.has(d.id))
      .map((d) => d);

    setAssinandoLote(true);
    setLoteResultados([]);
    setLoteProgresso({ atual: 0, total: ids.length });
    cancelarLoteRef.current = false;

    const resultados: ResultadoLote[] = [];

    for (let i = 0; i < ids.length; i++) {
      if (cancelarLoteRef.current) break;

      const diploma = ids[i];
      const nome = diploma.diplomados?.nome ?? "Sem nome";

      setLoteProgresso({ atual: i + 1, total: ids.length });
      setLoteDiplomaAtual(nome);
      setLotePassoAtual("Carregando...");

      try {
        await assinarTodosDiploma(
          diploma.id,
          certSelecionado,
          csrfToken,
          (msg) => setLotePassoAtual(msg),
        );

        resultados.push({
          diplomaId: diploma.id,
          nome,
          sucesso: true,
          mensagem: "Todos os passos assinados com sucesso",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro desconhecido";
        resultados.push({
          diplomaId: diploma.id,
          nome,
          sucesso: false,
          mensagem: msg,
        });

        // Se cancelado, parar
        if (msg === "Cancelado pelo usuário") break;
        // Continuar com o próximo diploma mesmo com erro
      }

      setLoteResultados([...resultados]);
    }

    setAssinandoLote(false);
    setLoteDiplomaAtual("");
    setLotePassoAtual("");

    // Recarregar lista
    await carregar();
  }

  // ── INDIVIDUAL: Assinar um passo ─────────────────────────────────────────
  async function assinarPassoIndividual(xml: XmlComPassos, passo: PassoAssinatura) {
    if (!certSelecionado || !expandidoId) return;

    setAssinandoIndividual(true);
    setErroIndividual(null);

    try {
      await executarPassoAssinatura(
        expandidoId,
        xml,
        passo,
        certSelecionado,
        csrfToken,
        (msg) => setPassoIndividualAtual(msg),
      );
      // Recarregar estado
      await carregarEstadoIndividual(expandidoId);
    } catch (e) {
      setErroIndividual(e instanceof Error ? e.message : "Erro ao assinar");
    } finally {
      setAssinandoIndividual(false);
      setPassoIndividualAtual("");
    }
  }

  // ── INDIVIDUAL: Assinar todos pendentes de um diploma (filtrados) ─────────
  async function assinarTodosIndividual() {
    if (!certSelecionado || !expandidoId || !estadoIndividual) return;

    setAssinandoIndividual(true);
    setErroIndividual(null);

    try {
      const assinanteMatch = encontrarAssinanteParaCertificado(
        certSelecionado, estadoIndividual.assinantes ?? []
      );

      for (const xml of estadoIndividual.xmls) {
        for (const passo of xml.passos) {
          if (
            (passo.status === "pendente" || passo.status === "erro") &&
            passoPertenceAoCertificado(passo, assinanteMatch)
          ) {
            setPassoIndividualAtual(`${LABELS_TIPO_XML[xml.tipo] ?? xml.tipo} — Passo ${passo.passo}`);
            await executarPassoAssinatura(
              expandidoId, xml, passo, certSelecionado, csrfToken,
              (msg) => setPassoIndividualAtual(msg),
            );
          }
        }
      }
      await carregarEstadoIndividual(expandidoId);
      await carregar();
    } catch (e) {
      setErroIndividual(e instanceof Error ? e.message : "Erro ao assinar");
    } finally {
      setAssinandoIndividual(false);
      setPassoIndividualAtual("");
    }
  }

  // ── Geração de Pacote para Registradora ──────────────────────────────────
  const [gerandoPacote, setGerandoPacote] = useState<string | null>(null); // diplomaId em andamento
  const [urlDownload, setUrlDownload] = useState<Record<string, string>>({}); // diplomaId → url
  const [pacoteErro, setPacoteErro] = useState<string | null>(null);

  async function gerarPacote(diplomaId: string) {
    setGerandoPacote(diplomaId);
    setPacoteErro(null);

    try {
      const resp = await fetch(`/api/diplomas/${diplomaId}/pacote-registradora`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({}),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error ?? data.erro ?? `Erro ${resp.status}`);
      }

      if (data.pacote?.url_download) {
        setUrlDownload((prev) => ({ ...prev, [diplomaId]: data.pacote.url_download }));
      }

      // Recarregar lista para refletir novo status
      await carregar();
    } catch (e) {
      setPacoteErro(e instanceof Error ? e.message : "Erro ao gerar pacote");
    } finally {
      setGerandoPacote(null);
    }
  }

  // ── Derivados ────────────────────────────────────────────────────────────
  // Diplomas que ainda precisam de assinatura
  const STATUSES_COMPLETOS = ["assinado", "aguardando_envio_registradora", "enviado_registradora", "registrado", "publicado"];
  const pendentes = diplomas.filter((d) => !STATUSES_COMPLETOS.includes(d.status));
  const assinados = diplomas.filter((d) => d.status === "assinado");
  const prontoParaRegistradora = diplomas.filter((d) =>
    ["aguardando_envio_registradora", "enviado_registradora"].includes(d.status)
  );

  const toggleSelecao = (id: string) => {
    setLoteSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (loteSelecionados.size === pendentes.length) {
      setLoteSelecionados(new Set());
    } else {
      setLoteSelecionados(new Set(pendentes.map((d) => d.id)));
    }
  };

  // Contadores do estado individual
  const totalPassosInd = estadoIndividual?.xmls.reduce((a, x) => a + x.passos.length, 0) ?? 0;
  const passosOkInd = estadoIndividual?.xmls.reduce(
    (a, x) => a + x.passos.filter((p) => p.status === "finalizado").length, 0
  ) ?? 0;
  const temPendentesInd = passosOkInd < totalPassosInd;

  const podeAssinar = extensaoInstalada && !!certSelecionado;

  // Identificar assinante correspondente ao certificado selecionado
  const assinanteMatchIndividual = estadoIndividual
    ? encontrarAssinanteParaCertificado(certSelecionado, estadoIndividual.assinantes ?? [])
    : null;

  // Contar apenas passos do certificado selecionado
  const passosDoMeuCert = estadoIndividual?.xmls.reduce(
    (a, x) => a + x.passos.filter((p) =>
      (p.status === "pendente" || p.status === "erro") &&
      passoPertenceAoCertificado(p, assinanteMatchIndividual)
    ).length, 0
  ) ?? 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <FileSignature size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Assinaturas Digitais</h1>
            <p className="text-sm text-gray-500">
              Assine XMLs de diplomas com o Token A3 USB via extensão BRy Signer
            </p>
          </div>
        </div>
        <button
          onClick={carregar}
          disabled={carregando || assinandoLote}
          className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={carregando ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* ── Painel de Certificado (global) ──────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-gray-600" />
          <span className="font-semibold text-sm text-gray-800">Certificado Digital</span>
          {bryScriptStatus === "loading" || detectandoExtensao ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 animate-pulse">
              {bryScriptStatus === "loading" ? "Carregando…" : "Verificando…"}
            </span>
          ) : extensaoInstalada ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Extensão ativa</span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Extensão não detectada</span>
          )}
        </div>

        {bryScriptStatus !== "loading" && !detectandoExtensao && !extensaoInstalada && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <AlertTriangle size={14} className="mt-0.5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <strong>Extensão BRy Signer não detectada.</strong> Certifique-se de que está instalada para{" "}
              <a href="https://chrome.google.com/webstore/detail/mbpaklahifpfndjiefdfjhmkefppocfm"
                target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Chrome</a>
              {" ou "}
              <a href="https://addons.mozilla.org/pt-BR/firefox/addon/assinatura-digital-navegador"
                target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Firefox</a>
              {" "}e habilitada para este domínio.
              <div className="mt-2">
                <button
                  onClick={verificarExtensao}
                  className="text-xs px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-md transition-colors"
                >
                  Verificar novamente
                </button>
              </div>
            </div>
          </div>
        )}

        {extensaoInstalada && certificados.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Nenhum certificado encontrado. Conecte o Token A3 USB e recarregue.</p>
            {/* Box: módulo nativo */}
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <Download size={16} className="mt-0.5 text-blue-600 flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-blue-800">Módulo Nativo BRy não instalado?</p>
                <p className="text-blue-700 text-xs">
                  Além da extensão do navegador, é necessário instalar o <strong>BRy Signer Desktop</strong> — o aplicativo que faz a ponte entre o browser e o Token USB.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <a
                    href="https://www.bry.com.br/bry-signer/download"
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
                  >
                    <Download size={12} />
                    Baixar BRy Signer Desktop
                    <ExternalLink size={10} className="opacity-70" />
                  </a>
                  <a
                    href="https://extension.bry.com.br/simple/"
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 text-xs font-medium rounded-md transition-colors"
                  >
                    <ExternalLink size={12} />
                    Guia de instalação (detecta seu sistema)
                  </a>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Após instalar, conecte o Token A3 USB e clique em <strong>Verificar novamente</strong> acima.
                </p>
              </div>
            </div>
          </div>
        )}

        {extensaoInstalada && certificados.length > 0 && (
          <div>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={certSelecionadoId}
              onChange={(e) => setCertSelecionadoId(e.target.value)}
            >
              <option value="">Selecione o certificado...</option>
              {certificados.map((c) => (
                <option key={c.certId} value={c.certId}>
                  {c.name} — {c.certificateType} (exp: {c.expirationDate})
                </option>
              ))}
            </select>
            {certSelecionado && (
              <div className="mt-1.5 space-y-1">
                <p className="text-xs text-gray-500">
                  Emissor: {certSelecionado.issuer} · Tipo: {certSelecionado.certificateType}
                </p>
                {assinanteMatchIndividual ? (
                  <p className="text-xs text-green-700 font-medium">
                    Assinante identificado: {assinanteMatchIndividual.nome} ({assinanteMatchIndividual.tipo_certificado})
                    {assinanteMatchIndividual.cpf && ` · ${assinanteMatchIndividual.cpf}`}
                  </p>
                ) : estadoIndividual?.assinantes && estadoIndividual.assinantes.length > 0 ? (
                  <p className="text-xs text-amber-600">
                    Certificado não corresponde a nenhum assinante cadastrado.
                    Verifique a página Assinantes.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Erro global */}
      {erro && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <XCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Carregando */}
      {carregando && (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
          <Loader2 size={18} className="animate-spin" />
          <span>Carregando diplomas...</span>
        </div>
      )}

      {/* Vazio */}
      {!carregando && diplomas.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <ShieldCheck size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">Nenhum diploma aguardando assinatura</p>
          <p className="text-gray-400 text-sm mt-1">
            Gere os XMLs de um diploma primeiro, depois ele aparecerá aqui.
          </p>
        </div>
      )}

      {/* ── Painel de Lote em Execução ────────────────────────────────────── */}
      {assinandoLote && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              <span className="font-semibold text-sm text-blue-800">
                Assinando em lote — {loteProgresso.atual}/{loteProgresso.total}
              </span>
            </div>
            <button
              onClick={() => { cancelarLoteRef.current = true; }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
            >
              <Ban size={12} />
              Cancelar
            </button>
          </div>

          {/* Barra de progresso */}
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(loteProgresso.atual / loteProgresso.total) * 100}%` }}
            />
          </div>

          <div className="text-sm text-blue-700">
            <p className="font-medium">{loteDiplomaAtual}</p>
            <p className="text-xs text-blue-600">{lotePassoAtual}</p>
          </div>
        </div>
      )}

      {/* ── Resultados do Lote ────────────────────────────────────────────── */}
      {!assinandoLote && loteResultados.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-800">
              Resultado do lote — {loteResultados.filter((r) => r.sucesso).length}/{loteResultados.length} com sucesso
            </span>
            <button
              onClick={() => setLoteResultados([])}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Fechar
            </button>
          </div>
          <div className="divide-y">
            {loteResultados.map((r) => (
              <div key={r.diplomaId} className="flex items-center gap-2 py-2 text-sm">
                {r.sucesso ? (
                  <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
                ) : (
                  <XCircle size={14} className="text-red-500 flex-shrink-0" />
                )}
                <span className="font-medium text-gray-800">{r.nome}</span>
                <span className={`text-xs ${r.sucesso ? "text-green-600" : "text-red-600"}`}>
                  — {r.mensagem}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pendentes ───────────────────────────────────────────────────────── */}
      {pendentes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <KeyRound size={16} className="text-amber-600" />
              Pendentes de assinatura ({pendentes.length})
            </h2>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loteSelecionados.size === pendentes.length && pendentes.length > 0}
                  onChange={toggleTodos}
                  className="rounded border-gray-300"
                />
                Selecionar todos
              </label>

              {loteSelecionados.size > 0 && podeAssinar && (
                <button
                  onClick={iniciarLote}
                  disabled={assinandoLote}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {assinandoLote ? (
                    <><Loader2 size={14} className="animate-spin" /> Assinando...</>
                  ) : (
                    <><ShieldCheck size={14} /> Assinar {loteSelecionados.size} diploma{loteSelecionados.size > 1 ? "s" : ""}</>
                  )}
                </button>
              )}

              {loteSelecionados.size > 0 && !podeAssinar && (
                <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                  Selecione um certificado acima
                </span>
              )}
            </div>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {pendentes.map((diploma) => {
              const isExpandido = expandidoId === diploma.id;
              const isSelecionado = loteSelecionados.has(diploma.id);
              // Destacar se este diploma está sendo assinado no lote
              const isLoteAtivo = assinandoLote && loteDiplomaAtual === (diploma.diplomados?.nome ?? "Sem nome");

              return (
                <div
                  key={diploma.id}
                  className={`border rounded-xl overflow-hidden transition-all ${
                    isLoteAtivo ? "border-blue-400 shadow-md ring-2 ring-blue-100" :
                    isExpandido ? "border-blue-300 shadow-md" : "border-gray-200"
                  }`}
                >
                  {/* Linha resumo */}
                  <div
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                      isExpandido ? "bg-blue-50/50" : isLoteAtivo ? "bg-blue-50/30" : ""
                    }`}
                    onClick={() => !assinandoLote && setExpandidoId(isExpandido ? null : diploma.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelecionado}
                      onChange={(e) => { e.stopPropagation(); toggleSelecao(diploma.id); }}
                      disabled={assinandoLote}
                      className="rounded border-gray-300 flex-shrink-0"
                    />

                    <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {isLoteAtivo ? (
                        <Loader2 size={16} className="text-blue-600 animate-spin" />
                      ) : (
                        <GraduationCap size={16} className="text-indigo-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {diploma.diplomados?.nome ?? "Sem nome"}
                        </span>
                        <span className="text-xs text-gray-400">
                          {diploma.diplomados?.cpf ?? ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{diploma.cursos?.nome ?? "Curso"}</span>
                        {diploma.processos_emissao?.nome && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{diploma.processos_emissao.nome}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      STATUS_COR[diploma.status] ?? "bg-gray-100 text-gray-700"
                    }`}>
                      {STATUS_LABEL[diploma.status] ?? diploma.status}
                    </span>

                    <Link
                      href={`/diploma/diplomas/${diploma.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
                      title="Ver diploma"
                    >
                      <ExternalLink size={14} />
                    </Link>

                    {isExpandido ? (
                      <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                    )}
                  </div>

                  {/* ── Painel expandido individual ─────────────────────────── */}
                  {isExpandido && (
                    <div className="border-t bg-white px-4 py-4 space-y-4">
                      {/* Carregando */}
                      {carregandoIndividual && (
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <Loader2 size={14} className="animate-spin" />
                          <span>Carregando passos de assinatura...</span>
                        </div>
                      )}

                      {/* Erro individual */}
                      {erroIndividual && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                          <XCircle size={14} className="mt-0.5 flex-shrink-0" />
                          <span>{erroIndividual}</span>
                        </div>
                      )}

                      {/* XMLs e passos */}
                      {estadoIndividual && !carregandoIndividual && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                              {passosOkInd}/{totalPassosInd} passos concluídos
                            </span>
                            {estadoIndividual.bry_configurado && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                                BRy {estadoIndividual.bry_ambiente}
                              </span>
                            )}
                          </div>

                          {estadoIndividual.xmls.map((xml) => (
                            <div key={xml.xml_gerado_id} className="border rounded-lg overflow-hidden">
                              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
                                <span className="font-medium text-xs text-gray-700">
                                  {LABELS_TIPO_XML[xml.tipo] ?? xml.tipo}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  xml.status_xml === "assinado" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                                }`}>
                                  {xml.status_xml}
                                </span>
                              </div>
                              <div className="divide-y">
                                {xml.passos.map((passo) => {
                                  const cor = PASSO_STATUS_COR[passo.status] ?? PASSO_STATUS_COR.pendente;
                                  const label = PASSO_STATUS_LABEL[passo.status] ?? passo.status;
                                  const pertenceAoCert = passoPertenceAoCertificado(passo, assinanteMatchIndividual);
                                  const podeClicarPasso =
                                    podeAssinar && estadoIndividual.bry_configurado &&
                                    !assinandoIndividual && !assinandoLote &&
                                    (passo.status === "pendente" || passo.status === "erro") &&
                                    pertenceAoCert;
                                  const esmaecido = certSelecionado && !pertenceAoCert && passo.status !== "finalizado";

                                  return (
                                    <div key={passo.passo} className={`flex items-center justify-between px-3 py-2 ${esmaecido ? "opacity-40" : ""}`}>
                                      <div className="flex items-center gap-2">
                                        {passo.status === "finalizado" ? (
                                          <CheckCircle2 size={14} className="text-green-600" />
                                        ) : passo.status === "erro" ? (
                                          <XCircle size={14} className="text-red-500" />
                                        ) : pertenceAoCert ? (
                                          <div className="h-3.5 w-3.5 rounded-full border-2 border-blue-500 bg-blue-100" />
                                        ) : (
                                          <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-300" />
                                        )}
                                        <div>
                                          <p className="text-xs text-gray-800">
                                            Passo {passo.passo}: {passo.descricao}
                                          </p>
                                          {passo.erro_mensagem && (
                                            <p className="text-xs text-red-500">{passo.erro_mensagem}</p>
                                          )}
                                          {esmaecido && (
                                            <p className="text-xs text-gray-400 italic">Outro certificado</p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${cor}`}>{label}</span>
                                        {podeClicarPasso && (
                                          <button
                                            className="text-xs px-2 py-1 border border-blue-300 text-blue-700 rounded hover:bg-blue-50 transition-colors"
                                            onClick={() => assinarPassoIndividual(xml, passo)}
                                          >
                                            Assinar
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}

                          {/* Progresso individual */}
                          {assinandoIndividual && (
                            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                              <Loader2 size={14} className="animate-spin" />
                              <span>{passoIndividualAtual}</span>
                            </div>
                          )}

                          {/* Botão assinar todos do meu certificado */}
                          {podeAssinar && estadoIndividual.bry_configurado && passosDoMeuCert > 0 && !assinandoLote && (
                            <button
                              onClick={assinarTodosIndividual}
                              disabled={assinandoIndividual}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {assinandoIndividual ? (
                                <><Loader2 size={14} className="animate-spin" /> Assinando...</>
                              ) : (
                                <><ShieldCheck size={14} /> Assinar {passosDoMeuCert} passo{passosDoMeuCert > 1 ? "s" : ""} deste certificado</>
                              )}
                            </button>
                          )}

                          {/* Aviso quando certificado não tem passos pendentes */}
                          {podeAssinar && estadoIndividual.bry_configurado && temPendentesInd && passosDoMeuCert === 0 && (
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                              <AlertTriangle size={14} className="flex-shrink-0" />
                              <span>
                                O certificado selecionado (<strong>{assinanteMatchIndividual?.nome ?? certSelecionado?.name}</strong>)
                                não possui passos pendentes neste diploma.
                                {assinanteMatchIndividual
                                  ? " Os passos restantes pertencem a outro assinante."
                                  : " Verifique se este certificado está cadastrado na página Assinantes."}
                              </span>
                            </div>
                          )}

                          {/* Todos os XMLs assinados */}
                          {estadoIndividual.status_diploma === "assinado" && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                              <CheckCircle2 size={14} />
                              <span><strong>Assinado!</strong> Todos os XMLs foram assinados com sucesso.</span>
                            </div>
                          )}
                          {/* Pacote pronto para registradora */}
                          {estadoIndividual.status_diploma === "aguardando_envio_registradora" && (
                            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                              <Package size={14} />
                              <span><strong>Pronto!</strong> XMLs assinados com sucesso. Gere o pacote na seção abaixo.</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Assinados ─────────────────────────────────────────────────────── */}
      {assinados.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-600" />
            Assinados recentemente ({assinados.length})
          </h2>
          <div className="space-y-2">
            {assinados.map((diploma) => (
              <div
                key={diploma.id}
                className="flex items-center gap-3 px-4 py-3 border border-green-100 rounded-xl bg-green-50/30"
              >
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={16} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm text-gray-900 truncate block">
                    {diploma.diplomados?.nome ?? "Sem nome"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {diploma.cursos?.nome ?? "Curso"}
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">
                  Assinado
                </span>
                <Link
                  href={`/diploma/diplomas/${diploma.id}`}
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <ExternalLink size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Prontos para Registradora ───────────────────────────────────── */}
      {prontoParaRegistradora.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Package size={16} className="text-blue-600" />
            Prontos para Registradora ({prontoParaRegistradora.length})
          </h2>
          {pacoteErro && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <XCircle size={14} />
              <span>{pacoteErro}</span>
            </div>
          )}
          <div className="space-y-2">
            {prontoParaRegistradora.map((diploma) => (
              <div
                key={diploma.id}
                className="flex items-center gap-3 px-4 py-3 border border-blue-100 rounded-xl bg-blue-50/40"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  {diploma.status === "enviado_registradora" ? (
                    <Send size={16} className="text-blue-600" />
                  ) : (
                    <Package size={16} className="text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm text-gray-900 truncate block">
                    {diploma.diplomados?.nome ?? "Sem nome"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {diploma.cursos?.nome ?? "Curso"} · XMLs assinados — pronto para envio
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Botão Gerar Pacote ZIP */}
                  {diploma.status === "aguardando_envio_registradora" && !urlDownload[diploma.id] && (
                    <button
                      onClick={() => gerarPacote(diploma.id)}
                      disabled={gerandoPacote === diploma.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                    >
                      {gerandoPacote === diploma.id ? (
                        <><Loader2 size={12} className="animate-spin" /> Gerando...</>
                      ) : (
                        <><Package size={12} /> Gerar Pacote</>
                      )}
                    </button>
                  )}
                  {/* Botão Download (após gerar pacote) */}
                  {urlDownload[diploma.id] && (
                    <a
                      href={urlDownload[diploma.id]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Download size={12} /> Baixar ZIP
                    </a>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    diploma.status === "enviado_registradora"
                      ? "bg-blue-200 text-blue-900"
                      : "bg-blue-100 text-blue-800"
                  }`}>
                    {diploma.status === "enviado_registradora" ? "Enviado" : "Pronto"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instruções */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600 space-y-2">
        <p className="font-semibold text-gray-700 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          Pré-requisitos para assinatura
        </p>
        <ul className="space-y-1 ml-6 list-disc">
          <li>Token A3 USB ICP-Brasil conectado ao computador</li>
          <li>
            <a
              href="https://www.bry.com.br/bry-signer/download"
              target="_blank" rel="noopener noreferrer"
              className="text-blue-600 underline font-medium"
            >BRy Signer Desktop</a>{" "}instalado no computador (módulo nativo — ponte entre browser e Token USB)
          </li>
          <li>
            Extensão BRy Signer instalada no navegador:{" "}
            <a
              href="https://chrome.google.com/webstore/detail/mbpaklahifpfndjiefdfjhmkefppocfm"
              target="_blank" rel="noopener noreferrer"
              className="text-blue-600 underline"
            >Chrome</a>
            {" / "}
            <a
              href="https://addons.mozilla.org/pt-BR/firefox/addon/assinatura-digital-navegador"
              target="_blank" rel="noopener noreferrer"
              className="text-blue-600 underline"
            >Firefox</a>
            {" — ou use o "}
            <a
              href="https://extension.bry.com.br/simple/"
              target="_blank" rel="noopener noreferrer"
              className="text-blue-600 underline"
            >guia de instalação completo</a>
            {" (detecta seu sistema automaticamente)"}
          </li>
          <li>XMLs do diploma já gerados e validados pelo XSD v1.05</li>
          <li>Credenciais BRy configuradas no servidor (ambiente homologação ou produção)</li>
        </ul>
      </div>
    </div>
  );
}
