/**
 * seed-projects.ts — envia um trace "hello world" para cada projeto,
 * confirmando que as API keys funcionam e que o pipeline trace-write está vivo.
 *
 * Uso:
 *   LANGFUSE_HOST=... \
 *   BUSINESS_KEYS='{"fic":{"pk":"pk-...","sk":"sk-..."}, ...}' \
 *   pnpm tsx scripts/seed-projects.ts
 *
 * Valida:
 *   1. Web aceita trace → 200
 *   2. Worker processa (batch write) em ~10s
 *   3. Trace aparece em UI
 */

import { Langfuse } from 'langfuse';

const HOST = requireEnv('LANGFUSE_HOST');
const KEYS_JSON = requireEnv('BUSINESS_KEYS');

type KeyBundle = { pk: string; sk: string };
const keys = JSON.parse(KEYS_JSON) as Record<string, KeyBundle>;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ ENV ${name} obrigatória`);
    process.exit(1);
  }
  return v;
}

async function seedOne(businessId: string, bundle: KeyBundle): Promise<void> {
  const lf = new Langfuse({
    publicKey: bundle.pk,
    secretKey: bundle.sk,
    baseUrl: HOST,
  });

  const trace = lf.trace({
    name: `seed:${businessId}`,
    userId: `seed-bot`,
    metadata: {
      business_id: businessId,
      seed: true,
      source: 'seed-projects.ts',
    },
  });

  trace.span({
    name: 'hello',
    input: { message: 'seed trace' },
    output: { ok: true },
    metadata: { article_ref: 'seed' },
  });

  await lf.flushAsync();
  console.log(`  ✓ ${businessId}: trace ${trace.id}`);
}

async function main() {
  console.log(`▶ Seeding ${Object.keys(keys).length} projetos em ${HOST}...\n`);

  for (const [businessId, bundle] of Object.entries(keys)) {
    try {
      await seedOne(businessId, bundle);
    } catch (err) {
      console.error(`  ✗ ${businessId}: ${(err as Error).message}`);
    }
  }

  console.log('\n▶ Aguarde ~10s e verifique na UI → Traces.');
  console.log('   Deve aparecer 1 trace "seed:<business>" em cada projeto.');
}

main().catch((err) => {
  console.error('✗ Falha fatal:', err);
  process.exit(1);
});
