# Plano Técnico v2 — Fluxo Novo Processo + Expedição Histórico-PDF

> **Sessão 028 — 08/04/2026**
> **Status:** ✅ Aprovado por Marcelo após code review do Buchecha (MiniMax M2.7)
> **Base:** [`plano-tecnico-fluxo-novo-processo-sessao-028.md`](./plano-tecnico-fluxo-novo-processo-sessao-028.md) (v1, 939 linhas)
> **Este documento:** registra APENAS os deltas da v1 → v2 (correções Buchecha + esclarecimento BRy).
> **Regra de leitura:** ler v1 como base e aplicar os patches abaixo.

---

## 1. Resumo das correções aplicadas

| # | Severidade | Problema (Buchecha) | Correção aprovada |
|---|-----------|--------------------|-------------------|
| 1 | 🔴 Crítico | FK circular `processo_arquivos` ↔ `diploma_documentos_comprobatorios` | Remover ALTER em DDC; FK unidirecional só em `processo_arquivos.ddc_id` |
| 2 | 🔴 Crítico | Token OAuth2 em singleton de módulo quebra em cold-start Vercel | Cachear token na tabela `configuracoes` (chave `bry_assinatura_token`) |
| 3 | 🔴 Crítico | Timeout 120s excede limite Vercel Pro (60s) | Estender Railway (que já hospeda Ghostscript) com `POST /extrair-documentos`; Next.js vira proxy fino |
| 4 | 🟠 Alto | `expires_at` sem cleanup automático | Remover coluna; botão manual "Descartar rascunho"; reavaliar cron se volume crescer |
| 5 | 🟠 Alto | Race condition no auto-save | Optimistic locking via coluna `version int` |
| 🎁 | 🟡 Médio | Zod schemas duplicados | (bônus, aplicar em refactor futuro) |

**Esclarecimento BRy (por Marcelo):** credenciais BRy (`client_id` + `client_secret`) são as mesmas para `api-diploma-digital` e `api-assinatura-digital`. O que muda é **o ambiente** (homologação vs produção) e **a URL base da API**. As credenciais atuais no banco (`configuracoes.bry_kms`) são de homologação; as de produção ainda estão sendo criadas pela equipe BRy.

---

## 2. Patches por seção da v1

### 📍 Patch 2.1 — Seção 4.1 (Schema `processo_arquivos`)

**v1 (remover):**
```sql
-- Link reverso (cascade cleanup quando DDC é deletado)
ALTER TABLE diploma_documentos_comprobatorios
ADD COLUMN processo_arquivo_id uuid REFERENCES processo_arquivos(id) ON DELETE SET NULL;
```

**v2 (substituir por):**
```sql
-- FK unidirecional: processo_arquivos → DDC (quando arquivo é anexado ao XML)
-- Nenhum ALTER em diploma_documentos_comprobatorios.
-- Para buscar o arquivo de origem de um DDC, usar:
--   SELECT * FROM processo_arquivos WHERE ddc_id = :ddc_id LIMIT 1;
CREATE INDEX idx_processo_arquivos_ddc_id
  ON processo_arquivos(ddc_id)
  WHERE ddc_id IS NOT NULL;
```

**Razão:** FK bidirecional cria ordem obrigatória de INSERT e complica `ON DELETE`. A direção `processo_arquivos → DDC` já cobre 100% dos casos de uso (toda operação parte do arquivo, não do DDC).

---

### 📍 Patch 2.2 — Seção 4.2 (Schema `extracao_sessoes`)

**v1 (remover):**
```sql
expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
```

**E também remover do mesmo schema/seção:**
```sql
-- Job pg_cron diário de cleanup
SELECT cron.schedule('cleanup-extracao-sessoes', '0 3 * * *', $$
  DELETE FROM extracao_sessoes WHERE expires_at < now() AND status = 'rascunho';
$$);
```

**v2 (substituir por):**
```sql
-- Sem expiração automática. Limpeza acontece via:
-- 1. Conclusão (status = 'concluido' → sessão vira processo, arquivos migram)
-- 2. Descarte manual (status = 'descartado' via botão "Descartar rascunho" em Tela 2)
-- Reavaliar cron se volume de rascunhos > 500 linhas ativas.

-- Optimistic locking para auto-save
version int NOT NULL DEFAULT 1,
```

**Endpoint novo (acrescentar à seção 5 Backend):**
```ts
// DELETE /api/extracao/sessoes/[id]
// Marca sessão como descartada (soft-delete, não remove arquivos do Storage ainda)
export const DELETE = protegerRota(async (req, { userId, params }) => {
  const supabase = await createClient();
  const { error } = await supabase
    .from('extracao_sessoes')
    .update({ status: 'descartado', atualizado_em: new Date().toISOString() })
    .eq('id', params.id)
    .eq('usuario_id', userId); // só o dono descarta
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
```

---

### 📍 Patch 2.3 — Seção 5.3 (PUT `/api/extracao/sessoes/[id]`)

**v1 (remover o bloco do handler PUT).**

**v2 (substituir por):**
```ts
export const PUT = protegerRota(async (req, { userId, params }) => {
  const supabase = await createClient();
  const body = await req.json();

  // Validação Zod (dados_extraidos + version esperada)
  const schema = z.object({
    dados_extraidos: z.record(z.any()),
    version: z.number().int().min(1), // versão que o cliente acha que está salva
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido', detalhes: parsed.error.format() }, { status: 400 });
  }

  // Optimistic locking: só atualiza se version bater
  const { data, error } = await supabase
    .from('extracao_sessoes')
    .update({
      dados_extraidos: parsed.data.dados_extraidos,
      version: parsed.data.version + 1,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('usuario_id', userId)
    .eq('version', parsed.data.version)  // 🔑 trava concorrência
    .select('version')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data) {
    // version não bateu → alguém editou em outra aba
    return NextResponse.json(
      { error: 'Conflito de versão', code: 'VERSION_CONFLICT' },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, version: data.version });
});
```

**Contrato frontend:**
- Toda resposta do servidor (GET e PUT) devolve `version`.
- Frontend guarda `version` local, envia no próximo PUT.
- Ao receber 409, frontend faz re-fetch, mostra toast: "Seus dados foram atualizados em outra aba. Recarregamos a versão mais recente."

---

### 📍 Patch 2.4 — Seção 6 (Cliente BRy `api-assinatura-digital`)

**v1 (remover):**
```ts
// Singleton em módulo — cache de token OAuth2
let tokenCache: { access_token: string; expires_at: number } | null = null;

export async function getBryAssinaturaToken() {
  if (tokenCache && tokenCache.expires_at > Date.now() + 60_000) {
    return tokenCache.access_token;
  }
  // ... fetch novo token
  tokenCache = { access_token, expires_at: Date.now() + expires_in * 1000 };
  return access_token;
}
```

**Por que quebra:** Em Vercel, cada invocation serverless roda em um isolate novo. `tokenCache` nunca é reutilizado entre requisições → cada chamada busca token novo → rate limit BRy + latência.

**v2 (substituir por):**
```ts
// src/lib/bry/assinatura-token.ts
import { createClient } from '@/lib/supabase/server';

interface BryTokenCache {
  access_token: string;
  expires_at: string; // ISO timestamp
}

/**
 * Cache de token OAuth2 da api-assinatura-digital BRy.
 * Persistido em configuracoes (chave 'bry_assinatura_token') para sobreviver
 * a cold-starts da Vercel e compartilhar entre invocations.
 */
export async function getBryAssinaturaToken(): Promise<string> {
  const supabase = await createClient();

  // 1. Tenta usar cache
  const { data: cached } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'bry_assinatura_token')
    .maybeSingle();

  if (cached?.valor) {
    const tok = cached.valor as unknown as BryTokenCache;
    const expiraEm = new Date(tok.expires_at).getTime();
    // margem de 60s para renovação antecipada
    if (expiraEm > Date.now() + 60_000) {
      return tok.access_token;
    }
  }

  // 2. Cache miss → busca credenciais BRy (mesmas de bry_kms)
  const { data: kmsConfig, error: kmsErr } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'bry_kms')
    .maybeSingle();

  if (kmsErr || !kmsConfig?.valor) {
    throw new Error('Credenciais BRy não configuradas em configuracoes.bry_kms');
  }

  const creds = kmsConfig.valor as { client_id: string; client_secret: string };

  // 3. URL depende do ambiente (hom vs prod) — vem de env var
  const baseUrl = process.env.BRY_ASSINATURA_DIGITAL_URL;
  if (!baseUrl) {
    throw new Error('BRY_ASSINATURA_DIGITAL_URL não definida em env');
  }

  // 4. Busca token novo
  const res = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.client_id,
      client_secret: creds.client_secret,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`BRy OAuth falhou: ${res.status} ${errText}`);
  }

  const { access_token, expires_in } = await res.json();
  const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

  // 5. Persiste no cache
  await supabase
    .from('configuracoes')
    .upsert(
      {
        chave: 'bry_assinatura_token',
        valor: { access_token, expires_at },
        descricao: 'Cache de token OAuth2 api-assinatura-digital BRy (auto-renovado)',
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'chave' }
    );

  return access_token;
}
```

**Variável de ambiente nova (.env + Vercel):**
```
# Homologação (padrão atual)
BRY_ASSINATURA_DIGITAL_URL=https://hom.bry.com.br/api-assinatura-digital

# Produção (trocar quando receber credenciais de prod)
# BRY_ASSINATURA_DIGITAL_URL=https://prod.bry.com.br/api-assinatura-digital
```

**Esclarecimento registrado:** credenciais (`client_id` + `client_secret`) são as mesmas de `bry_kms`. O switch hom↔prod acontece via env var `BRY_ASSINATURA_DIGITAL_URL` + troca das credenciais em `configuracoes.bry_kms` quando a equipe BRy entregar as de produção.

---

### 📍 Patch 2.5 — Seção 5.1 (`POST /api/extracao/iniciar`)

**v1 (remover todo o bloco de chamada direta ao Gemini dentro do API route do Next.js).**

**v2 (substituir por):**

O Next.js API route vira um **proxy fino** que delega para o microserviço Railway (que já hospeda Ghostscript). Isso elimina o timeout 60s da Vercel Pro e permite processamento batch/longo.

```ts
// src/app/api/extracao/iniciar/route.ts
export const POST = protegerRota(async (req, { userId }) => {
  const supabase = await createClient();
  const body = await req.json();

  // Validação
  const schema = z.object({
    arquivos: z.array(z.object({
      storage_path: z.string(),
      nome_original: z.string(),
      mime_type: z.string(),
      tamanho_bytes: z.number(),
    })).min(1),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  // Cria sessão rascunho
  const { data: sessao, error: sessErr } = await supabase
    .from('extracao_sessoes')
    .insert({
      usuario_id: userId,
      status: 'processando',
      arquivos: parsed.data.arquivos,
      dados_extraidos: {},
      version: 1,
    })
    .select()
    .single();

  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });

  // Delega extração ao Railway (assíncrono — Railway fará callback via PUT /api/extracao/sessoes/[id]/callback)
  const railwayUrl = process.env.RAILWAY_CONVERTER_URL;
  if (!railwayUrl) {
    return NextResponse.json({ error: 'RAILWAY_CONVERTER_URL não definida' }, { status: 500 });
  }

  // Fire-and-forget: não espera extração terminar (evita timeout Vercel)
  fetch(`${railwayUrl}/extrair-documentos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': process.env.RAILWAY_INTERNAL_TOKEN!,
    },
    body: JSON.stringify({
      sessao_id: sessao.id,
      arquivos: parsed.data.arquivos,
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/extracao/sessoes/${sessao.id}/callback`,
      callback_token: process.env.RAILWAY_CALLBACK_TOKEN,
    }),
    cache: 'no-store',
  }).catch(err => {
    // log e segue — callback eventualmente marcará erro
    console.error('[extracao/iniciar] Railway fire-and-forget falhou:', err);
  });

  // Retorna imediatamente — frontend faz polling em GET /api/extracao/sessoes/[id]
  return NextResponse.json({
    sessao_id: sessao.id,
    status: 'processando',
    version: 1,
  });
});
```

**Callback novo:** `PUT /api/extracao/sessoes/[id]/callback`
```ts
// Chamado pelo Railway quando termina a extração
export const PUT = async (req: NextRequest, { params }: { params: { id: string } }) => {
  // Autenticação via header (Railway usa token compartilhado)
  const token = req.headers.get('x-railway-callback-token');
  if (token !== process.env.RAILWAY_CALLBACK_TOKEN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json(); // { dados_extraidos, erro? }
  const supabase = await createClient(); // service_role (sem RLS — operação interna)

  if (body.erro) {
    await supabase
      .from('extracao_sessoes')
      .update({ status: 'erro', erro_mensagem: body.erro })
      .eq('id', params.id);
    return NextResponse.json({ ok: true });
  }

  await supabase
    .from('extracao_sessoes')
    .update({
      status: 'rascunho',
      dados_extraidos: body.dados_extraidos,
      version: 2, // bump: cliente precisa re-fetch antes de editar
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', params.id);

  return NextResponse.json({ ok: true });
};
```

**Endpoint Railway novo (a implementar no microserviço):**
```
POST /extrair-documentos
  Headers:  X-Internal-Token: <token>
  Body:     { sessao_id, arquivos[], callback_url, callback_token }
  Response: 202 Accepted { job_id }

  Processa assíncrono:
    1. Baixa arquivos do Supabase Storage
    2. Chama Gemini 2.5 Flash para cada arquivo
    3. Agrega dados_extraidos por tipo de documento
    4. PUT no callback_url com { dados_extraidos }
    5. Em caso de erro: PUT callback com { erro: "mensagem" }
  Timeout interno: 180s (sem pressão do Vercel)
```

**Polling frontend:**
```ts
// Em Tela 2 (revisão pós-extração), durante status = 'processando'
useEffect(() => {
  if (sessao.status !== 'processando') return;
  const iv = setInterval(async () => {
    const res = await fetch(`/api/extracao/sessoes/${sessao.id}`, { cache: 'no-store' });
    const novo = await res.json();
    if (novo.status !== 'processando') {
      setSessao(novo);
      clearInterval(iv);
    }
  }, 3000);
  return () => clearInterval(iv);
}, [sessao.status, sessao.id]);
```

---

### 📍 Patch 2.6 — Seção 8 (Frontend Tela 2) — botão Descartar

Acrescentar no header da Tela 2:
```tsx
<button
  onClick={async () => {
    if (!confirm('Descartar este rascunho? Os arquivos enviados serão perdidos.')) return;
    await fetch(`/api/extracao/sessoes/${sessao.id}`, { method: 'DELETE' });
    router.push('/diploma/processos');
  }}
  className="text-sm text-red-600 hover:text-red-800"
>
  Descartar rascunho
</button>
```

---

## 3. Variáveis de ambiente consolidadas

Adicionar em `.env.local` + Vercel + Railway:

```bash
# BRy api-assinatura-digital (NOVO)
BRY_ASSINATURA_DIGITAL_URL=https://hom.bry.com.br/api-assinatura-digital

# Railway microserviço (EXISTENTE + NOVOS)
RAILWAY_CONVERTER_URL=https://converter-service.up.railway.app
RAILWAY_INTERNAL_TOKEN=<gerado 32 bytes hex>
RAILWAY_CALLBACK_TOKEN=<gerado 32 bytes hex>

# App URL (para Railway saber onde mandar callback)
NEXT_PUBLIC_APP_URL=https://gestao.ficcassilandia.com.br
```

---

## 4. Sprints atualizados (delta)

**Sprint 1 — Schema + Gate FIC** (inalterado, exceto pelos patches 2.1 e 2.2):
- DDL sem ALTER em DDC, com `version int` em `extracao_sessoes`, sem `expires_at`.

**Sprint 2 — Extração IA** (delta por patch 2.5):
- Não mais chamar Gemini direto do Next.js API route.
- Implementar endpoint Railway `/extrair-documentos` (linguagem do microserviço já existente — Python/Node, confirmar com Marcelo em Sprint 2).
- Next.js vira proxy fino + callback receiver.
- +0,5 dia para ajustar microserviço Railway.

**Sprint 3 — Auto-save + concorrência** (delta por patch 2.3):
- Adicionar optimistic locking no PUT.
- Frontend trata 409 com re-fetch + toast.
- +0,25 dia.

**Sprint 4 — BRy Cliente** (delta por patch 2.4):
- Token em `configuracoes.bry_assinatura_token`.
- Variável `BRY_ASSINATURA_DIGITAL_URL`.
- Credenciais reusam `bry_kms`.
- Inalterado em esforço.

**Sprint 5 — Histórico PDF + Template** (inalterado — template já existe, economia de ~1,5 dia confirmada).

**Total:** ~0,75 dia extra vs v1. Aceitável.

---

## 5. Itens não tratados nesta v2 (backlog)

| Item | Origem | Tratamento |
|------|--------|-----------|
| Zod schemas duplicados | Buchecha bônus | Refactor futuro, fora do MVP |
| Cron de cleanup de rascunhos | Alto 4 | Reavaliar quando volume > 500 linhas ativas |
| Diferenciação assinatura eletrônica vs ICP-Brasil | pendência sessão anterior | Aguarda definição de Marcelo (fora do escopo desta sprint) |

---

## 6. Aprovação final

✅ **Crítico 1** — FK unidirecional: aprovado
✅ **Crítico 2** — Cache Supabase: aprovado (credenciais mesmas, só ambiente muda)
✅ **Crítico 3** — Railway extension: aprovado
✅ **Alto 4** — Remover expires_at + botão manual: aprovado (cron só se volume crescer)
✅ **Alto 5** — Optimistic locking: assumido como parte do pacote Buchecha (padrão técnico low-risk)

**Próximo passo:** Sprint 1 — migration + `regras-fic.ts` + `gate-criacao-processo.ts` + unit tests.
