"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  KeyRound,
  FileSignature,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// AssinadorBry — Componente de assinatura digital via BRy Web Extension
//
// Orquestra o fluxo Initialize → BryWebExtension.sign() → Finalize
// para cada passo de assinatura de cada XML do diploma.
//
// Requisitos:
// - Extensão BRy Signer instalada no navegador (Chrome ou Firefox)
// - Token A3 USB ICP-Brasil conectado
// - Credenciais BRy configuradas no servidor
// ─────────────────────────────────────────────────────────────────────────────

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
  initialized_at: string | null;
  signed_at: string | null;
  finalized_at: string | null;
  erro_mensagem: string | null;
}

interface XmlComPassos {
  xml_gerado_id: string;
  tipo: string;
  tipo_bry: string | null;
  status_xml: string;
  passos: PassoAssinatura[];
}

interface EstadoAssinatura {
  diploma_id: string;
  status_diploma: string;
  bry_configurado: boolean;
  bry_ambiente: string | null;
  xmls: XmlComPassos[];
}

interface AssinadorBryProps {
  diplomaId: string;
  csrfToken: string;
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

const LABELS_TIPO: Record<string, string> = {
  documentacao_academica: "Documentação Acadêmica",
  diplomado: "Diplomado",
  historico_escolar: "Histórico Escolar",
  curriculo_escolar: "Currículo Escolar",
};

const STATUS_COR: Record<string, string> = {
  pendente: "bg-gray-100 text-gray-700",
  inicializado: "bg-yellow-100 text-yellow-800",
  assinado_extensao: "bg-blue-100 text-blue-800",
  finalizado: "bg-green-100 text-green-800",
  erro: "bg-red-100 text-red-800",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  inicializado: "Aguardando extensão",
  assinado_extensao: "Cifrado",
  finalizado: "Finalizado ✓",
  erro: "Erro",
};

export default function AssinadorBry({ diplomaId, csrfToken }: AssinadorBryProps) {
  const [estado, setEstado] = useState<EstadoAssinatura | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [extensaoInstalada, setExtensaoInstalada] = useState(false);
  const [certificados, setCertificados] = useState<BryCertificate[]>([]);
  const [certSelecionadoId, setCertSelecionadoId] = useState("");

  const [assinando, setAssinando] = useState(false);
  const [passoAtual, setPassoAtual] = useState("");

  const certSelecionado = certificados.find((c) => c.certId === certSelecionadoId) ?? null;

  // ── Detectar extensão BRy ─────────────────────────────────────────────────
  useEffect(() => {
    const ext = window.BryWebExtension;
    if (ext && typeof ext.isExtensionInstalled === "function") {
      comTimeout(ext.isExtensionInstalled(), 8000, "isExtensionInstalled")
        .then((instalada) => {
          setExtensaoInstalada(instalada);
          if (instalada) {
            return comTimeout(ext.listCertificates(), 10000, "listCertificates")
              .then((certs) => {
                certs.forEach((c) => { c.label = c.name; });
                setCertificados(certs);
                if (certs.length === 1) setCertSelecionadoId(certs[0].certId);
              });
          }
        })
        .catch(() => {
          setErro("Extensão BRy não respondeu. Verifique se está instalada e o Token USB está conectado.");
        });
    }
  }, []);

  // ── Carregar estado ───────────────────────────────────────────────────────
  const carregarEstado = useCallback(async () => {
    try {
      setCarregando(true);
      const resp = await fetch(`/api/diplomas/${diplomaId}/assinar`);
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.erro ?? `Erro ${resp.status}`);
      }
      setEstado(await resp.json());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setCarregando(false);
    }
  }, [diplomaId]);

  useEffect(() => { carregarEstado(); }, [carregarEstado]);

  // ── Executar passo (Initialize → Sign → Finalize) ─────────────────────────
  async function executarPasso(xml: XmlComPassos, passo: PassoAssinatura) {
    if (!certSelecionado) {
      setErro("Selecione um certificado antes de assinar.");
      return;
    }

    setAssinando(true);
    setErro(null);

    try {
      // ETAPA 1: Initialize
      setPassoAtual(`Passo ${passo.passo}: Enviando para BRy...`);
      const initResp = await fetch(`/api/diplomas/${diplomaId}/assinar/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          xml_gerado_id: xml.xml_gerado_id,
          passo: passo.passo,
          certificate: certSelecionado.certificateData,
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
      setPassoAtual(`Passo ${passo.passo}: Cifrando com Token USB...`);
      const inputExtension = {
        formatoDadosEntrada: "Base64",
        formatoDadosSaida: "Base64",
        algoritmoHash: "SHA256",
        assinaturas: [{
          hashes: [initData.signedAttributes[0].content],
          nonce: initData.signedAttributes[0].nonce,
        }],
      };

      const ext = window.BryWebExtension;
      if (!ext) throw new Error("Extensão BRy não encontrada");

      const assinatura = await ext.sign(certSelecionado.certId, JSON.stringify(inputExtension));
      const signatureValue = assinatura.assinaturas[0].hashes[0];

      // ETAPA 3: Finalize
      setPassoAtual(`Passo ${passo.passo}: Finalizando assinatura...`);
      const finResp = await fetch(`/api/diplomas/${diplomaId}/assinar/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          xml_gerado_id: xml.xml_gerado_id,
          passo: passo.passo,
          signature_value: signatureValue,
          certificate: certSelecionado.certificateData,
          perfil: passo.perfil,
          include_xpath_enveloped: passo.includeXPathEnveloped ? false : undefined,
        }),
      });

      if (!finResp.ok) {
        const data = await finResp.json();
        throw new Error(data.erro ?? `Finalize falhou (${finResp.status})`);
      }

      const finData = await finResp.json();

      // Feedback do auto-carimbo (dispara no último passo de cada XML)
      if (finData.carimbo?.aplicado) {
        setPassoAtual(`Passo ${passo.passo}: Concluído! ⏱️ Carimbo do tempo aplicado automaticamente.`);
      } else if (finData.carimbo?.erro) {
        // Carimbo falhou mas assinatura OK — avisar sem bloquear
        setPassoAtual(`Passo ${passo.passo}: Assinado ✓ (carimbo automático falhou — aplique manualmente)`);
        console.warn("[AssinadorBry] Auto-carimbo falhou:", finData.carimbo.erro);
      } else {
        setPassoAtual(`Passo ${passo.passo}: Concluído!`);
      }

      // Se o pacote já está pronto (todos XMLs assinados e carimbados), notificar
      if (finData.pacote_pronto) {
        setPassoAtual("✅ Todos os XMLs assinados e carimbados! Gere o pacote para a registradora.");
      }

      await carregarEstado();

    } catch (e) {
      setErro(`Erro no passo ${passo.passo}: ${e instanceof Error ? e.message : "Erro"}`);
    } finally {
      setAssinando(false);
    }
  }

  // ── Assinar todos pendentes ───────────────────────────────────────────────
  async function assinarTodos() {
    if (!estado || !certSelecionado) return;
    for (const xml of estado.xmls) {
      for (const passo of xml.passos) {
        if (passo.status === "pendente" || passo.status === "erro") {
          await executarPasso(xml, passo);
          if (erro) return;
        }
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <div className="flex items-center gap-2 p-4 text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Carregando estado da assinatura...</span>
      </div>
    );
  }

  const totalPassos = estado?.xmls.reduce((a, x) => a + x.passos.length, 0) ?? 0;
  const passosOk = estado?.xmls.reduce(
    (a, x) => a + x.passos.filter((p) => p.status === "finalizado").length, 0
  ) ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-lg">Assinatura Digital</h3>
          {estado?.bry_configurado ? (
            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              BRy {estado.bry_ambiente}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
              Simulação
            </span>
          )}
        </div>
        {totalPassos > 0 && (
          <span className="text-sm text-gray-500">{passosOk}/{totalPassos} passos</span>
        )}
      </div>

      {/* Erro */}
      {erro && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Extensão não instalada */}
      {!extensaoInstalada && estado?.bry_configurado && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
          <div>
            <strong>Extensão BRy Signer não detectada.</strong>
            <div className="mt-1 flex gap-3">
              <a href="https://chrome.google.com/webstore/detail/mbpaklahifpfndjiefdfjhmkefppocfm"
                target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                Chrome
              </a>
              <a href="https://addons.mozilla.org/pt-BR/firefox/addon/assinatura-digital-navegador"
                target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                Firefox
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Seletor de certificado */}
      {extensaoInstalada && estado?.bry_configurado && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="h-4 w-4 text-gray-600" />
            <span className="font-medium text-sm">Certificado Digital</span>
          </div>
          {certificados.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum certificado encontrado. Conecte o Token USB.</p>
          ) : (
            <select
              className="w-full border rounded px-3 py-2 text-sm"
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
          )}
          {certSelecionado && (
            <div className="mt-2 text-xs text-gray-500 space-y-0.5">
              <p>Emissor: {certSelecionado.issuer}</p>
              <p>Tipo: {certSelecionado.certificateType}</p>
            </div>
          )}
        </div>
      )}

      {/* XMLs e passos */}
      {estado?.xmls.map((xml) => (
        <div key={xml.xml_gerado_id} className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
            <span className="font-medium text-sm">{LABELS_TIPO[xml.tipo] ?? xml.tipo}</span>
            <span className={`text-xs px-2 py-0.5 rounded ${
              xml.status_xml === "assinado" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
            }`}>
              {xml.status_xml}
            </span>
          </div>
          <div className="divide-y">
            {xml.passos.map((passo) => {
              const cor = STATUS_COR[passo.status] ?? STATUS_COR.pendente;
              const label = STATUS_LABEL[passo.status] ?? "Pendente";
              const podeClicar =
                estado.bry_configurado && extensaoInstalada && certSelecionado &&
                !assinando && (passo.status === "pendente" || passo.status === "erro");

              return (
                <div key={passo.passo} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {passo.status === "finalizado" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : passo.status === "erro" ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                    )}
                    <div>
                      <p className="text-sm">Passo {passo.passo}: {passo.descricao}</p>
                      {passo.erro_mensagem && (
                        <p className="text-xs text-red-500 mt-0.5">{passo.erro_mensagem}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${cor}`}>{label}</span>
                    {podeClicar && (
                      <button
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded hover:bg-gray-50 transition-colors"
                        onClick={() => executarPasso(xml, passo)}
                        disabled={assinando}
                      >
                        <ShieldCheck className="h-3 w-3" />
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

      {/* Progresso */}
      {assinando && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{passoAtual}</span>
        </div>
      )}

      {/* Assinar todos */}
      {estado?.bry_configurado && extensaoInstalada && certSelecionado && passosOk < totalPassos && (
        <button
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          onClick={assinarTodos}
          disabled={assinando}
        >
          {assinando ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Assinando...</>
          ) : (
            <><ShieldCheck className="h-4 w-4" /> Assinar Todos os Passos Pendentes</>
          )}
        </button>
      )}

      {/* Diploma assinado */}
      {estado?.status_diploma === "assinado" && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          <strong>Diploma totalmente assinado!</strong>
        </div>
      )}
    </div>
  );
}
