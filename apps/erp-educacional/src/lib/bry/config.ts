// ─────────────────────────────────────────────────────────────────────────────
// Configuração BRy Diploma Digital — API HUB Signer
//
// Endpoints e credenciais para o fluxo Initialize/Finalize.
// Em homologação usa cloud-hom / diploma.hom; produção usa cloud / diploma.
// ─────────────────────────────────────────────────────────────────────────────

export interface BryConfig {
  /** URL do token service (OAuth2 client_credentials) — API Diploma Digital */
  tokenUrl: string;
  /** URL base da API de assinatura de diploma digital */
  signatureBaseUrl: string;
  /** URL base do serviço de carimbo do tempo — API Assinatura Digital (fw2) */
  timestampBaseUrl: string;
  /** Client ID da aplicação cadastrada no BRy Cloud — API Diploma Digital */
  clientId: string;
  /** Client Secret (API Key) da aplicação — API Diploma Digital */
  clientSecret: string;
  /** true = homologação, false = produção */
  isHomologacao: boolean;
  // ── Credenciais separadas para o Carimbo do Tempo (API Assinatura Digital) ──
  // O serviço fw2.bry.com.br pertence à API Assinatura Digital da BRy,
  // produto diferente da API Diploma Digital. Exige token OAuth2 de um
  // servidor distinto (iss diferente). Se não configuradas, usa as principais.
  /** URL do token service para o carimbo (API Assinatura Digital) */
  timestampTokenUrl?: string;
  /** Client ID para o carimbo (API Assinatura Digital) */
  timestampClientId?: string;
  /** Client Secret para o carimbo (API Assinatura Digital) */
  timestampClientSecret?: string;
}

const AMBIENTES = {
  homologacao: {
    tokenUrl: "https://cloud-hom.bry.com.br/token-service/jwt",
    signatureBaseUrl:
      "https://diploma.hom.bry.com.br/api/xml-signature-service/v2/signatures",
    timestampBaseUrl:
      "https://fw2.bry.com.br/api/carimbo-service/v1/timestamps",
  },
  producao: {
    tokenUrl: "https://cloud.bry.com.br/token-service/jwt",
    signatureBaseUrl:
      "https://diploma.bry.com.br/api/xml-signature-service/v2/signatures",
    timestampBaseUrl:
      "https://fw2.bry.com.br/api/carimbo-service/v1/timestamps",
  },
} as const;

/**
 * Carrega configuração BRy das variáveis de ambiente.
 * Retorna null se as credenciais não estiverem configuradas.
 */
export function getBryConfig(): BryConfig | null {
  const clientId = process.env.BRY_CLIENT_ID?.trim();
  const clientSecret = process.env.BRY_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  const isHom =
    (process.env.BRY_AMBIENTE ?? "homologacao") === "homologacao";
  const amb = isHom ? AMBIENTES.homologacao : AMBIENTES.producao;

  return {
    tokenUrl: process.env.BRY_TOKEN_URL ?? amb.tokenUrl,
    signatureBaseUrl:
      process.env.BRY_SIGNATURE_BASE_URL ?? amb.signatureBaseUrl,
    timestampBaseUrl:
      process.env.BRY_TIMESTAMP_BASE_URL ?? amb.timestampBaseUrl,
    clientId,
    clientSecret,
    isHomologacao: isHom,
    // Credenciais separadas para API Assinatura Digital (carimbo fw2.bry.com.br)
    // Se não definidas, timestamp-service usará as credenciais principais como fallback
    timestampTokenUrl: process.env.BRY_TIMESTAMP_TOKEN_URL?.trim() || undefined,
    timestampClientId: process.env.BRY_TIMESTAMP_CLIENT_ID?.trim() || undefined,
    timestampClientSecret: process.env.BRY_TIMESTAMP_CLIENT_SECRET?.trim() || undefined,
  };
}

/**
 * URL do endpoint extra-archive-timestamp (para renovar AD-RA no futuro).
 */
export function getExtraTimestampUrl(isHom: boolean): string {
  return isHom
    ? "https://diploma.hom.bry.com.br/xml/v1/upgrade/extra-archive-timestamp"
    : "https://diploma.bry.com.br/xml/v1/upgrade/extra-archive-timestamp";
}
