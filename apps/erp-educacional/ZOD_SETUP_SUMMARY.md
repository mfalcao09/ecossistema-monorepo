# Zod Validation Setup — Diploma Digital

## Status: COMPLETE ✅

### Files Created

#### 1. `src/lib/security/zod-schemas.ts` (340 linhas)
Schemas Zod reutilizáveis para validação de inputs críticos:

**Schemas Primitivos:**
- `cpfSchema` — CPF 11 dígitos
- `cnpjSchema` — CNPJ 14 dígitos
- `emailSchema` — Email RFC + lowercase
- `uuidSchema` — UUID v4
- `dataSchema` — Data YYYY-MM-DD
- `codigoDiplomaSchema` — Código FIC-YYYY-XXXXXXXX

**Schemas de Entidade:**
- `diplomadoSchema` — Criar/editar diplomado (nome, CPF, RG, email, data nascimento, etc.)
- `cursoSchema` — Criar/editar curso (nome, CNPJ, grau, modalidade, departamento)
- `diplomaSchema` — Criar/editar diploma (diplomado, curso, datas, livro, folha, status)
- `usuarioSchema` — Criar/editar usuário (email, nome, papel, ativo)
- `alterarSenhaSchema` — Alterar senha com validação de força e confirmação
- `consultaCpfSchema` — Portal: consultar por CPF + Turnstile token
- `validarCodigoSchema` — Portal: validar código de diploma + Turnstile token
- `gerarDiplomaSchema` — Gerar novo diploma
- `processarAssinaturaSchema` — Processar assinatura digital (tipo: emissora/registradora)
- `importarDiplomadasSchema` — Bulk import CSV (curso, arquivo, encoding)

**Características:**
- Todas mensagens em português
- `.transform()` para sanitização automática (trim, lowercase, uppercase)
- `.refine()` para validações customizadas (ex: senhas que conferem)
- Validações práticas, não over-engineered

#### 2. `src/lib/security/validate-request.ts` (200 linhas)
Helpers para validação de requisições Next.js:

**Funções:**
- `validarBody(request, schema)` — Valida JSON do body
  - Retorna `{ dados }` tipado ou `{ erro: NextResponse }`
  - Formata erros por campo
  - Tratamento de JSON malformado
  
- `validarQuery(queryParams, schema)` — Valida parâmetros de URL
  - Converte URLSearchParams para objeto
  - Mesma estrutura de retorno que validarBody
  
- `validarParams(params, schema)` — Valida parâmetros de rota
  - Normaliza array params
  - Uso em route handlers dinâmicos

**Exemplo de uso:**
```typescript
// Em um route handler POST
const result = await validarBody(request, diplomadoSchema)
if (result.erro) return result.erro
const dados = result.dados  // tipos inferidos!

// Criar diplomado
await db.diplomados.create(dados)
```

#### 3. `src/lib/security/validation.ts` (150 linhas)
Validação customizada complementar:

**Funções:**
- `validarCpf(cpf)` — Checksum CPF (algoritmo oficial)
- `validarCnpj(cnpj)` — Checksum CNPJ
- `validarData(data)` — Data válida + bissexto
- `sanitizarString(texto, maxLength)` — Trim + length control
- `sanitizarEmail(email)` — Lowercase + trim
- `validarForcaSenha(senha)` — Score + feedback

#### 4. `src/lib/security/index.ts` (40 linhas)
Barril de exports:
- Re-exporta tudo de `zod-schemas.ts`
- Re-exporta helpers de `validate-request.ts`
- Re-exporta funções de `validation.ts`
- Conveniência: `import { diplomadoSchema, validarBody } from '@/lib/security'`

---

## IMPORTANTE: Zod NÃO Instalado

**Status no package.json:** ❌ **Falta instalar**

```bash
npm install zod
# ou
yarn add zod
```

Os arquivos estão prontos, mas precisam dessa dependência para funcionar.

---

## Como Usar em Route Handlers

### Exemplo 1: Criar Diplomado
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { diplomadoSchema, validarBody } from '@/lib/security'

export async function POST(request: NextRequest) {
  // Valida body
  const result = await validarBody(request, diplomadoSchema)
  if (result.erro) return result.erro

  const dados = result.dados  // ✅ Tipado: { nome, cpf, email?, ... }

  // Use dados com confiança
  const diplomado = await db.diplomados.create(dados)

  return NextResponse.json({ id: diplomado.id })
}
```

### Exemplo 2: Consultar Diploma (Portal)
```typescript
import { consultaCpfSchema, validarQuery } from '@/lib/security'

export async function GET(request: NextRequest) {
  const result = await validarQuery(request.nextUrl.searchParams, consultaCpfSchema)
  if (result.erro) return result.erro

  const { cpf, turnstileToken } = result.dados

  // Valida Turnstile
  const isValid = await verificarTurnstile(turnstileToken)
  if (!isValid) return NextResponse.json({ erro: 'Token inválido' }, { status: 403 })

  // Busca diplomas
  const diplomas = await db.diplomas.findByCpf(cpf)
  return NextResponse.json(diplomas)
}
```

### Exemplo 3: Parâmetros de Rota
```typescript
import { uuidSchema, validarParams } from '@/lib/security'
import { z } from 'zod'

export async function GET(request, { params }) {
  const result = await validarParams(
    params,
    z.object({ id: uuidSchema })
  )
  if (result.erro) return result.erro

  const { id } = result.dados
  const diploma = await db.diplomas.findById(id)
  return NextResponse.json(diploma)
}
```

---

## Estrutura de Erro Retornado

Quando validação falha, retorna NextResponse 400:

```json
{
  "erro": "Validação falhou",
  "campos": {
    "cpf": ["CPF deve ter 11 dígitos numéricos"],
    "email": ["Email inválido"],
    "nome": ["Nome deve ter pelo menos 2 caracteres"]
  }
}
```

---

## Roadmap

- [ ] Instalar Zod: `npm install zod`
- [ ] Aplicar schemas em rotas críticas:
  - `POST /api/diplomados` → `diplomadoSchema`
  - `POST /api/diplomas` → `diplomaSchema`
  - `POST /api/usuarios` → `usuarioSchema`
  - `GET /api/portal/consulta` → `consultaCpfSchema`
  - Etc.
- [ ] Considerar middleware para validação global de rotas
- [ ] Adicionar logs de erro de validação (para auditoria)
- [ ] Documentar em Swagger/OpenAPI (opcional)

---

## Notas

- Todos os mensagens de erro são em português (conforme CLAUDE.md)
- Schemas são **práticos** — validam o essencial sem over-engineering
- Use `validarData()` em `validation.ts` para datas especiais
- Para validações customizadas, use `.refine()` ou `.superRefine()` no Zod
- Strings são automaticamente trimmed e length-limited

**Próximo passo:** `npm install zod` e começar a aplicar em rotas! 🚀
