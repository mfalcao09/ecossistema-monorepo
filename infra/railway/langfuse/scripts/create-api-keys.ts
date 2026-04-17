/**
 * create-api-keys.ts — cria 1 projeto + 1 par de API keys por negócio.
 *
 * Uso (após Langfuse estar rodando):
 *   pnpm tsx scripts/create-api-keys.ts
 *
 * Env necessárias:
 *   LANGFUSE_HOST               (ex: http://localhost:3000 ou https://langfuse.ecossistema.internal)
 *   LANGFUSE_ADMIN_PUBLIC_KEY   (da org 'ecossistema' — peguei na UI > Settings > API Keys do projeto default)
 *   LANGFUSE_ADMIN_SECRET_KEY
 *
 * Saída:
 *   Imprime tabela com public/secret keys por business.
 *   ⚠️ Salvar MANUALMENTE em Supabase Vault (tabela secret_store do ECOSYSTEM).
 *
 * Uma vez que S12 (vault) estiver pronto, trocar a impressão por write direto no Vault.
 */

// NOTA: este script usa a Admin API do Langfuse v3 via fetch cru (sem SDK)
// porque os endpoints /api/admin/* não estão no SDK público.

const HOST = requireEnv('LANGFUSE_HOST');
const ADMIN_PK = requireEnv('LANGFUSE_ADMIN_PUBLIC_KEY');
const ADMIN_SK = requireEnv('LANGFUSE_ADMIN_SECRET_KEY');

const BUSINESSES = [
  { id: 'ecosystem',  name: 'Ecossistema (shared)' },
  { id: 'fic',        name: 'Faculdades Integradas de Cassilândia' },
  { id: 'klesis',     name: 'Colégio Klésis' },
  { id: 'intentus',   name: 'Intentus Real Estate' },
  { id: 'splendori',  name: 'Splendori Incorporadora' },
  { id: 'nexvy',      name: 'Nexvy Comunicação' },
] as const;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ ENV ${name} obrigatória — aborto`);
    process.exit(1);
  }
  return v;
}

function authHeader(pk: string, sk: string): string {
  return `Basic ${Buffer.from(`${pk}:${sk}`).toString('base64')}`;
}

type ProjectResponse = { id: string; name: string };
type ApiKeyResponse = { publicKey: string; secretKey: string; id: string };

async function createProject(name: string, businessId: string): Promise<ProjectResponse> {
  const res = await fetch(`${HOST}/api/public/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(ADMIN_PK, ADMIN_SK),
    },
    body: JSON.stringify({
      name: `ecossistema-${businessId}`,
      metadata: { business_id: businessId, display_name: name },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createProject(${businessId}) falhou: ${res.status} ${body}`);
  }
  return res.json() as Promise<ProjectResponse>;
}

async function createApiKey(projectId: string): Promise<ApiKeyResponse> {
  const res = await fetch(`${HOST}/api/public/projects/${projectId}/apiKeys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(ADMIN_PK, ADMIN_SK),
    },
    body: JSON.stringify({ note: `auto-provisioned ${new Date().toISOString()}` }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`createApiKey(${projectId}) falhou: ${res.status} ${body}`);
  }
  return res.json() as Promise<ApiKeyResponse>;
}

async function main() {
  console.log(`▶ Langfuse host: ${HOST}`);
  console.log(`▶ Criando ${BUSINESSES.length} projetos + API keys...\n`);

  const results: Array<{ business: string; projectId: string; pk: string; sk: string }> = [];

  for (const b of BUSINESSES) {
    try {
      const project = await createProject(b.name, b.id);
      const key = await createApiKey(project.id);
      results.push({ business: b.id, projectId: project.id, pk: key.publicKey, sk: key.secretKey });
      console.log(`  ✓ ${b.id} → project=${project.id}`);
    } catch (err) {
      console.error(`  ✗ ${b.id}: ${(err as Error).message}`);
    }
  }

  console.log('\n────────────────────────────────────────────────────────────────');
  console.log('RESULTADO — salvar em Supabase Vault (ECOSYSTEM.secret_store):');
  console.log('────────────────────────────────────────────────────────────────');
  console.log('business     | project_id                | public_key | secret_key');
  console.log('-------------+---------------------------+------------+------------');
  for (const r of results) {
    console.log(`${r.business.padEnd(12)} | ${r.projectId.padEnd(25)} | ${r.pk} | ${r.sk}`);
  }
  console.log('────────────────────────────────────────────────────────────────');
  console.log('\n⚠️  Secret keys NÃO são recuperáveis depois. Salve AGORA.');
  console.log('   Naming convention no Vault: langfuse.<business>.{public_key,secret_key}');
}

main().catch((err) => {
  console.error('✗ Falha fatal:', err);
  process.exit(1);
});
