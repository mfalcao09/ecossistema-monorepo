import { VirtualKeyMissingError } from './errors.js';
import type { BusinessId } from './types.js';

const KEY_ENV_MAP: Record<BusinessId, string> = {
  ecosystem: 'LITELLM_VK_ECOSYSTEM',
  fic: 'LITELLM_VK_FIC',
  klesis: 'LITELLM_VK_KLESIS',
  intentus: 'LITELLM_VK_INTENTUS',
  splendori: 'LITELLM_VK_SPLENDORI',
  nexvy: 'LITELLM_VK_NEXVY',
};

export function resolveVirtualKey(businessId: BusinessId): string {
  const envVar = KEY_ENV_MAP[businessId];
  if (!envVar) throw new VirtualKeyMissingError(businessId);

  const key = process.env[envVar];
  if (!key) throw new VirtualKeyMissingError(businessId);

  return key;
}

export function isValidBusinessId(id: string): id is BusinessId {
  return id in KEY_ENV_MAP;
}
