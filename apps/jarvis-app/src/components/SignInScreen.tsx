/**
 * Tela de login — magic-link Supabase.
 *
 * Renderizada pelo App.tsx quando `useAuth.session` é null.
 * Ao mandar o link, orienta Marcelo a abrir o e-mail no iPhone onde o
 * deep link `jarvis://auth/callback` redireciona de volta pro app.
 *
 * F1-S03 PR 4/4.
 */

import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { UseAuthResult } from "../hooks/useAuth";

export interface SignInScreenProps {
  auth: UseAuthResult;
  /** Mostrar aviso de config quando SUPABASE_URL/ANON_KEY não setadas. */
  supabaseConfigured: boolean;
}

export function SignInScreen({ auth, supabaseConfigured }: SignInScreenProps) {
  const [email, setEmail] = useState("");

  const handleSubmit = async () => {
    if (!email.trim()) return;
    await auth.signIn(email);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>Jarvis</Text>
        <Text style={styles.subtitle}>ecossistema · entrar</Text>

        {!supabaseConfigured ? (
          <View style={styles.warning}>
            <Text style={styles.warningTitle}>Supabase não configurado</Text>
            <Text style={styles.warningBody}>
              Defina <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_URL</Text> e{" "}
              <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_ANON_KEY</Text> no{" "}
              <Text style={styles.code}>.env.local</Text>.
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor="#5F7A99"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              editable={!auth.sending}
              onSubmitEditing={handleSubmit}
              returnKeyType="send"
            />

            <Pressable
              style={({ pressed }) => [
                styles.button,
                (!email.trim() || auth.sending) && styles.buttonDisabled,
                pressed && !auth.sending && styles.buttonPressed,
              ]}
              onPress={handleSubmit}
              disabled={!email.trim() || auth.sending}
            >
              {auth.sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Enviar link por e-mail</Text>
              )}
            </Pressable>

            {auth.info && <Text style={styles.infoText}>✓ {auth.info}</Text>}
            {auth.error && <Text style={styles.errorText}>⚠ {auth.error}</Text>}

            <Text style={styles.hint}>
              Abra o e-mail no iPhone onde o Jarvis está instalado — o link
              volta pro app automaticamente.
            </Text>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F14",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    padding: 24,
    gap: 14,
  },
  brand: {
    color: "#E6F1FF",
    fontSize: 56,
    fontWeight: "700",
    letterSpacing: -1,
    textAlign: "center",
  },
  subtitle: {
    color: "#64FFDA",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 16,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#1B2530",
    color: "#E6F1FF",
    borderRadius: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#1E88E5",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonPressed: {
    backgroundColor: "#1565C0",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  infoText: {
    color: "#64FFDA",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  errorText: {
    color: "#FF8A8A",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  hint: {
    color: "#5F7A99",
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
  warning: {
    padding: 16,
    backgroundColor: "#2A1F14",
    borderLeftWidth: 3,
    borderLeftColor: "#FFB86B",
    borderRadius: 6,
  },
  warningTitle: {
    color: "#FFB86B",
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 6,
  },
  warningBody: {
    color: "#E6F1FF",
    fontSize: 13,
    lineHeight: 18,
  },
  code: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    color: "#64FFDA",
  },
});
