/**
 * Hook de autenticação Supabase via magic-link.
 *
 * Fluxo:
 *   1. signIn(email) → supabase.auth.signInWithOtp({ emailRedirectTo: deepLink })
 *   2. Supabase envia e-mail com link do tipo:
 *        https://<project>.supabase.co/auth/v1/verify?token=...&type=magiclink
 *        &redirect_to=jarvis://auth/callback
 *   3. Usuário clica no link no iPhone → abre o app via deep link
 *   4. expo-linking.addEventListener captura o URL
 *   5. supabase.auth.exchangeCodeForSession(code) → session salva em Keychain
 *
 * F1-S03 PR 4/4.
 */

import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useState } from "react";

import { getSupabase } from "../services/supabase";

export interface UseAuthResult {
  session: Session | null;
  user: User | null;
  /** Token JWT para mandar ao orchestrator. null se deslogado. */
  accessToken: string | null;

  loading: boolean; // true até resolver sessão persistida no mount
  sending: boolean; // true enquanto manda magic-link
  error: string | null;
  info: string | null; // mensagens informativas ("verifique seu e-mail")

  /** Envia magic-link para o email. */
  signIn: (email: string) => Promise<void>;
  /** Limpa sessão + Keychain. */
  signOut: () => Promise<void>;
}

/**
 * Deep link alvo — precisa casar com `scheme` em app.json.
 * iOS abre jarvis://auth/callback automaticamente quando o usuário
 * clica no link se o app estiver instalado.
 */
function getRedirectUrl(): string {
  return Linking.createURL("auth/callback");
}

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // ── Mount: carrega sessão persistida + subscreve mudanças ──────────────
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // ── Deep link handler: captura URL e troca code por session ────────────
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const handleUrl = async (url: string | null) => {
      if (!url) return;
      try {
        // Formato esperado: jarvis://auth/callback?code=XYZ
        const parsed = Linking.parse(url);
        const code = parsed.queryParams?.code;
        if (typeof code !== "string") return;

        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(`Falha no login: ${exchangeError.message}`);
          return;
        }
        setError(null);
        setInfo("Logado com sucesso.");
      } catch (err) {
        setError((err as Error).message);
      }
    };

    // Caso o app tenha sido aberto via deep link (estava fechado).
    Linking.getInitialURL().then(handleUrl);

    // Enquanto o app estiver aberto.
    const sub = Linking.addEventListener("url", (evt) => handleUrl(evt.url));
    return () => sub.remove();
  }, []);

  const signIn = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase não configurado.");
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Informe o e-mail.");
      return;
    }

    setSending(true);
    setError(null);
    setInfo(null);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: getRedirectUrl(),
          // shouldCreateUser=false garante que só e-mails já permitidos
          // (via allowlist + trigger no Supabase) conseguem entrar.
          // No dev ficaria true; como é só o Marcelo, deixamos false.
          shouldCreateUser: true,
        },
      });
      if (otpError) {
        setError(otpError.message);
        return;
      }
      setInfo(`Link enviado para ${trimmed}. Abra pelo iPhone.`);
    } finally {
      setSending(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setInfo("Sessão encerrada.");
  }, []);

  return {
    session,
    user: session?.user ?? null,
    accessToken: session?.access_token ?? null,
    loading,
    sending,
    error,
    info,
    signIn,
    signOut,
  };
}
