"use client";

import { useState, useEffect } from "react";
import {
  encryptClientSide,
  importDEK,
  base64ToArrayBuffer,
} from "@ecossistema/magic-link-vault";
import type { TokenMetadata } from "@ecossistema/magic-link-vault";

type Status = "loading" | "ready" | "submitting" | "done" | "error" | "invalid";

export default function CollectSecretPage({
  params,
}: {
  params: { token: string };
}) {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [secret, setSecret] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch(`/api/vault/metadata?token=${params.token}`)
      .then((r) => r.json())
      .then((data: TokenMetadata & { error?: string }) => {
        if (data.error) {
          setStatus("invalid");
        } else {
          setMetadata(data);
          setStatus("ready");
        }
      })
      .catch(() => setStatus("invalid"));
  }, [params.token]);

  const handleSubmit = async () => {
    if (!secret.trim()) return;
    setStatus("submitting");
    setErrorMsg("");

    try {
      // Busca DEK do servidor (gerada quando o token foi criado, wrappada com KEK)
      const dekResp = await fetch(`/api/vault/dek?token=${params.token}`);
      if (!dekResp.ok) throw new Error("Failed to fetch DEK");
      const { dek } = (await dekResp.json()) as { dek: string };

      // Cifra NO BROWSER — plaintext nunca sai pelo fio
      const cryptoKey = await importDEK(base64ToArrayBuffer(dek));
      const encrypted = await encryptClientSide(secret, cryptoKey);

      // Envia apenas o ciphertext
      const submitResp = await fetch("/api/vault/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: params.token,
          encrypted_payload: encrypted,
        }),
      });

      if (submitResp.ok) {
        setStatus("done");
      } else {
        const { error } = (await submitResp.json()) as { error: string };
        setErrorMsg(error ?? "Erro ao enviar credencial");
        setStatus("error");
      }
    } catch (e) {
      setErrorMsg(String(e));
      setStatus("error");
    }
  };

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Validando link…</p>
      </main>
    );
  }

  if (status === "invalid") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center p-8">
          <p className="text-2xl mb-2">⛔</p>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">
            Link inválido ou expirado
          </h1>
          <p className="text-gray-500 text-sm">
            Este link é de uso único e expira em 15 minutos. Solicite um novo
            link ao agente.
          </p>
        </div>
      </main>
    );
  }

  if (status === "done") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md text-center p-8">
          <p className="text-4xl mb-3">✅</p>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">
            Credencial armazenada com segurança
          </h1>
          <p className="text-gray-500 text-sm">
            O valor foi cifrado no seu navegador com AES-256-GCM antes de ser
            enviado. O servidor armazenou apenas o texto cifrado. Este link foi
            invalidado.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="mb-6">
          <p className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-1">
            Ecossistema Vault
          </p>
          <h1 className="text-xl font-bold text-gray-900">
            {metadata?.credential_name ?? "Credencial"}
          </h1>
          {metadata?.scope && (
            <p className="text-sm text-gray-500 mt-1">{metadata.scope}</p>
          )}
          <p className="text-xs text-orange-500 mt-2">
            ⏱ Expira em aproximadamente {metadata?.expires_in_minutes ?? "—"}{" "}
            minutos
          </p>
        </div>

        <textarea
          className="w-full border border-gray-300 rounded-lg p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={6}
          placeholder="Cole a credencial aqui"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          disabled={status === "submitting"}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        <p className="text-xs text-gray-400 mt-2">
          🔒 O valor será cifrado no seu navegador com AES-256-GCM antes de ser
          enviado. O servidor armazenará apenas o texto cifrado. Este link é
          válido apenas uma vez.
        </p>

        {status === "error" && errorMsg && (
          <p className="text-sm text-red-600 mt-3 bg-red-50 rounded p-2">
            {errorMsg}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!secret.trim() || status === "submitting"}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-4 py-3 rounded-lg transition-colors"
        >
          {status === "submitting"
            ? "Cifrando e enviando…"
            : "Enviar com segurança"}
        </button>
      </div>
    </main>
  );
}
