/**
 * Cloudflare Security Headers Helper — ERP Educacional
 *
 * Utilities for validating and extracting Cloudflare security headers from requests.
 * Provides methods to verify that requests are routed through Cloudflare WAF and
 * to extract geolocation and threat information.
 *
 * Usage in Next.js middleware:
 * ```typescript
 * import { validateCloudflareHeaders, getCloudflareCountry } from '@/lib/security/cloudflare-headers';
 *
 * export function middleware(request: NextRequest) {
 *   if (!validateCloudflareHeaders(request)) {
 *     return NextResponse.json({ error: 'Invalid Cloudflare headers' }, { status: 403 });
 *   }
 *   const country = getCloudflareCountry(request);
 *   // ...
 * }
 * ```
 */

import { NextRequest } from 'next/server';

/**
 * Cloudflare-specific headers that should be present in requests.
 * These headers are injected by Cloudflare's edge and can be used for:
 * - Security validation (ensuring request passed through CF)
 * - Geolocation detection
 * - Threat scoring
 * - Bot detection
 */
export const CLOUDFLARE_HEADERS = {
  /** Client's real IP address */
  CLIENT_IP: 'cf-connecting-ip',

  /** Two-letter country code (ISO 3166-1 alpha-2) */
  COUNTRY: 'cf-ipcountry',

  /** Unique request identifier */
  RAY: 'cf-ray',

  /** Cloudflare threat score (0-100) */
  THREAT_SCORE: 'cf-threat-score',

  /** Cloudflare bot management score */
  BOT_SCORE: 'cf-bot-management-score',

  /** Bot Management risk score */
  BOT_RISK_SCORE: 'cf-bot-risk-score',

  /** Verification token for Cloudflare origin */
  VALIDATION_TOKEN: 'cf-validation-token',

  /** TLS version */
  TLS_VERSION: 'cf-tls-version',

  /** TLS cipher */
  TLS_CIPHER: 'cf-tls-cipher',

  /** ASN number */
  ASN: 'cf-asn',

  /** Whether request came through Cloudflare */
  REQUEST_PRIORITY: 'cf-request-priority',
} as const;

/**
 * Response containing Cloudflare header information
 */
export interface CloudflareHeaderInfo {
  clientIp: string | null;
  country: string | null;
  ray: string | null;
  threatScore: number | null;
  botScore: number | null;
  botRiskScore: number | null;
  tlsVersion: string | null;
  tlsCipher: string | null;
  asn: string | null;
}

/**
 * Validates that a request contains required Cloudflare headers.
 * Should be called in middleware to ensure requests are routed through Cloudflare.
 *
 * @param request - Next.js Request object
 * @returns True if request has valid Cloudflare headers, false otherwise
 *
 * @example
 * ```typescript
 * if (!validateCloudflareHeaders(request)) {
 *   console.warn('Request not from Cloudflare');
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
 * }
 * ```
 */
export function validateCloudflareHeaders(request: NextRequest): boolean {
  const clientIp = request.headers.get(CLOUDFLARE_HEADERS.CLIENT_IP);
  const country = request.headers.get(CLOUDFLARE_HEADERS.COUNTRY);
  const ray = request.headers.get(CLOUDFLARE_HEADERS.RAY);

  // All three essential headers should be present if request went through Cloudflare
  return !!(clientIp && country && ray);
}

/**
 * Checks if a request definitely came through Cloudflare.
 * More comprehensive than validateCloudflareHeaders but less strict.
 *
 * @param request - Next.js Request object
 * @returns True if request appears to be from Cloudflare
 */
export function isCloudflareRequest(request: NextRequest): boolean {
  // Check for at least one Cloudflare header
  const ray = request.headers.get(CLOUDFLARE_HEADERS.RAY);
  const clientIp = request.headers.get(CLOUDFLARE_HEADERS.CLIENT_IP);

  return !!(ray || clientIp);
}

/**
 * Extracts the client's country code from Cloudflare headers.
 * Returns ISO 3166-1 alpha-2 country code (e.g., "BR" for Brazil).
 *
 * @param request - Next.js Request object
 * @returns Two-letter country code or null if not available
 *
 * @example
 * ```typescript
 * const country = getCloudflareCountry(request);
 * if (country !== 'BR') {
 *   return NextResponse.json({ error: 'Access denied' }, { status: 403 });
 * }
 * ```
 */
export function getCloudflareCountry(request: NextRequest): string | null {
  return request.headers.get(CLOUDFLARE_HEADERS.COUNTRY);
}

/**
 * Extracts the client's real IP address from Cloudflare headers.
 * This is the actual IP of the end user, not the Cloudflare edge server.
 *
 * @param request - Next.js Request object
 * @returns Client IP address or null if not available
 *
 * @example
 * ```typescript
 * const clientIp = getCloudflareClientIp(request);
 * console.log(`Request from: ${clientIp}`);
 * ```
 */
export function getCloudflareClientIp(request: NextRequest): string | null {
  return request.headers.get(CLOUDFLARE_HEADERS.CLIENT_IP);
}

/**
 * Extracts the Cloudflare Ray ID from headers.
 * Useful for correlating requests with Cloudflare logs.
 *
 * @param request - Next.js Request object
 * @returns Ray ID or null if not available
 *
 * @example
 * ```typescript
 * const rayId = getCloudflareRayId(request);
 * if (rayId) {
 *   response.headers.set('X-Ray-ID', rayId);
 * }
 * ```
 */
export function getCloudflareRayId(request: NextRequest): string | null {
  return request.headers.get(CLOUDFLARE_HEADERS.RAY);
}

/**
 * Extracts threat score from Cloudflare headers.
 * Range: 0-100, where higher values indicate more suspicious behavior.
 * Useful for risk-based access control.
 *
 * @param request - Next.js Request object
 * @returns Threat score (0-100) or null if not available
 *
 * @example
 * ```typescript
 * const threatScore = getCloudflareTheatScore(request);
 * if (threatScore && threatScore > 50) {
 *   // Apply additional security checks
 *   return NextResponse.json({ error: 'Access denied' }, { status: 403 });
 * }
 * ```
 */
export function getCloudflareTheatScore(request: NextRequest): number | null {
  const score = request.headers.get(CLOUDFLARE_HEADERS.THREAT_SCORE);
  return score ? parseInt(score, 10) : null;
}

/**
 * Extracts bot management score from Cloudflare headers.
 * Range: 1-99, where higher values are more bot-like.
 * Only available if Bot Management is enabled.
 *
 * @param request - Next.js Request object
 * @returns Bot score (1-99) or null if not available or disabled
 *
 * @example
 * ```typescript
 * const botScore = getCloudflareBotsCore(request);
 * if (botScore && botScore > 80) {
 *   // Likely a bot, apply rate limiting or block
 * }
 * ```
 */
export function getCloudflareBotsCore(request: NextRequest): number | null {
  const score = request.headers.get(CLOUDFLARE_HEADERS.BOT_SCORE);
  return score ? parseInt(score, 10) : null;
}

/**
 * Extracts bot risk score from Cloudflare Bot Management.
 * Indicates likelihood of request being from a malicious bot.
 *
 * @param request - Next.js Request object
 * @returns Bot risk score or null if not available
 */
export function getCloudflareBotsRiskScore(request: NextRequest): number | null {
  const score = request.headers.get(CLOUDFLARE_HEADERS.BOT_RISK_SCORE);
  return score ? parseInt(score, 10) : null;
}

/**
 * Extracts all available Cloudflare security information from request headers.
 * Useful for comprehensive logging and security decisions.
 *
 * @param request - Next.js Request object
 * @returns Object containing all extracted Cloudflare header information
 *
 * @example
 * ```typescript
 * const info = getAllCloudflareHeaders(request);
 * console.log(`Request from ${info.country} (${info.clientIp})`);
 * console.log(`Ray ID: ${info.ray}`);
 * console.log(`Threat Score: ${info.threatScore}`);
 * ```
 */
export function getAllCloudflareHeaders(
  request: NextRequest
): CloudflareHeaderInfo {
  return {
    clientIp: getCloudflareClientIp(request),
    country: getCloudflareCountry(request),
    ray: getCloudflareRayId(request),
    threatScore: getCloudflareTheatScore(request),
    botScore: getCloudflareBotsCore(request),
    botRiskScore: getCloudflareBotsRiskScore(request),
    tlsVersion: request.headers.get(CLOUDFLARE_HEADERS.TLS_VERSION),
    tlsCipher: request.headers.get(CLOUDFLARE_HEADERS.TLS_CIPHER),
    asn: request.headers.get(CLOUDFLARE_HEADERS.ASN),
  };
}

/**
 * Validates that a request is from a specific country.
 * Used for geo-fencing admin routes to Brazil-only access.
 *
 * @param request - Next.js Request object
 * @param allowedCountries - Array of ISO country codes to allow
 * @returns True if country is in allowed list, false otherwise
 *
 * @example
 * ```typescript
 * if (!validateCountryAccess(request, ['BR'])) {
 *   return NextResponse.json({ error: 'Access denied' }, { status: 403 });
 * }
 * ```
 */
export function validateCountryAccess(
  request: NextRequest,
  allowedCountries: string[]
): boolean {
  const country = getCloudflareCountry(request);

  if (!country) {
    // If no country header, be conservative and deny
    console.warn('No country header found in Cloudflare request');
    return false;
  }

  return allowedCountries.includes(country.toUpperCase());
}

/**
 * Validates threat level for sensitive endpoints.
 * Can be used to enforce CAPTCHA or MFA for high-threat requests.
 *
 * @param request - Next.js Request object
 * @param maxThreatScore - Maximum allowed threat score (0-100)
 * @returns True if threat score is below threshold, false otherwise
 *
 * @example
 * ```typescript
 * if (!validateThreatScore(request, 30)) {
 *   // Challenge with CAPTCHA
 *   return NextResponse.json(
 *     { error: 'Please complete CAPTCHA' },
 *     { status: 429 }
 *   );
 * }
 * ```
 */
export function validateThreatScore(
  request: NextRequest,
  maxThreatScore: number = 50
): boolean {
  const threatScore = getCloudflareTheatScore(request);

  if (threatScore === null) {
    // If no threat score, assume safe (Cloudflare didn't flag it)
    return true;
  }

  return threatScore <= maxThreatScore;
}

/**
 * Validates bot detection for API endpoints.
 * Prevents automated attacks while allowing legitimate bots (Google, Bing).
 *
 * @param request - Next.js Request object
 * @param maxBotScore - Maximum allowed bot score (1-99, higher = more bot-like)
 * @returns True if bot score indicates legitimate traffic, false otherwise
 *
 * @example
 * ```typescript
 * if (!validateBotScore(request, 40)) {
 *   return NextResponse.json({ error: 'Access denied' }, { status: 403 });
 * }
 * ```
 */
export function validateBotScore(
  request: NextRequest,
  maxBotScore: number = 50
): boolean {
  const botScore = getCloudflareBotsCore(request);

  if (botScore === null) {
    // If Bot Management not enabled, assume safe
    return true;
  }

  return botScore <= maxBotScore;
}

/**
 * Adds Cloudflare information headers to a response for debugging/logging.
 * Should only be used in development or for authorized users.
 *
 * @param request - Next.js Request object
 * @param headers - Headers object to add to (e.g., response.headers)
 *
 * @example
 * ```typescript
 * const response = NextResponse.json(data);
 * addCloudflareInfoHeaders(request, response.headers);
 * return response;
 * ```
 */
export function addCloudflareInfoHeaders(
  request: NextRequest,
  headers: Headers
): void {
  const info = getAllCloudflareHeaders(request);

  if (info.ray) headers.set('X-Ray-ID', info.ray);
  if (info.clientIp) headers.set('X-Client-IP', info.clientIp);
  if (info.country) headers.set('X-Client-Country', info.country);
  if (info.threatScore !== null) {
    headers.set('X-Threat-Score', info.threatScore.toString());
  }
  if (info.botScore !== null) {
    headers.set('X-Bot-Score', info.botScore.toString());
  }
}

/**
 * Creates audit log entry for security events using Cloudflare headers.
 * Useful for correlating application logs with Cloudflare WAF events.
 *
 * @param request - Next.js Request object
 * @param eventType - Type of security event (e.g., "auth_failure", "rate_limit")
 * @param details - Additional event details
 * @returns Audit log entry object
 *
 * @example
 * ```typescript
 * const auditLog = createCloudflareAuditLog(
 *   request,
 *   'suspicious_activity',
 *   { endpoint: '/api/admin/users', action: 'blocked' }
 * );
 * await saveAuditLog(auditLog);
 * ```
 */
export function createCloudflareAuditLog(
  request: NextRequest,
  eventType: string,
  details?: Record<string, unknown>
): Record<string, unknown> {
  const info = getAllCloudflareHeaders(request);

  return {
    timestamp: new Date().toISOString(),
    eventType,
    cloudflare: {
      rayId: info.ray,
      clientIp: info.clientIp,
      country: info.country,
      threatScore: info.threatScore,
      botScore: info.botScore,
      asn: info.asn,
    },
    request: {
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent'),
    },
    details,
  };
}

/**
 * Determines if a request should be challenged (CAPTCHA/MFA).
 * Uses multiple signals from Cloudflare for risk assessment.
 *
 * @param request - Next.js Request object
 * @param riskThresholds - Custom risk thresholds
 * @returns True if request should be challenged, false otherwise
 *
 * @example
 * ```typescript
 * if (shouldChallenge(request)) {
 *   return NextResponse.json(
 *     { error: 'Please complete CAPTCHA' },
 *     { status: 429 }
 *   );
 * }
 * ```
 */
export function shouldChallenge(
  request: NextRequest,
  riskThresholds: {
    threatScore?: number;
    botScore?: number;
    allowedCountries?: string[];
  } = {}
): boolean {
  const {
    threatScore: maxThreatScore = 50,
    botScore: maxBotScore = 40,
    allowedCountries = ['BR'],
  } = riskThresholds;

  // Check country restriction
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    if (!validateCountryAccess(request, allowedCountries)) {
      return true;
    }
  }

  // Check threat score
  if (!validateThreatScore(request, maxThreatScore)) {
    return true;
  }

  // Check bot score
  if (!validateBotScore(request, maxBotScore)) {
    return true;
  }

  return false;
}
