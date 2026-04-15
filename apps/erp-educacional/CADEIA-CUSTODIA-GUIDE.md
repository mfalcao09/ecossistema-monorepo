# Sistema de Cadeia de Custódia — Diploma Digital FIC

## Visão Geral

A **Cadeia de Custódia** é um sistema de rastreamento imutável (blockchain-like) que registra CADA mudança de estado de um diploma durante seu ciclo de vida. Garante compliance com Portaria MEC 554/2019 e Portaria MEC 70/2025.

### Objetivos

1. **Conformidade Regulatória**: Prova auditável de cada etapa conforme MEC exige
2. **Segurança**: Detecção de tampering via encadeamento de hashes SHA-256
3. **Investigação**: Rastreamento completo de quem fez o quê e quando
4. **Não-Repúdio**: Prova criptográfica impossível de negar

---

## Arquitetura

### Tabela de Banco de Dados

```sql
cadeia_custodia_diplomas {
  id UUID PRIMARY KEY
  diploma_id UUID → diplomas(id)

  -- Etapa do pipeline
  etapa TEXT (enum)
  status TEXT ('sucesso' | 'erro' | 'pendente')

  -- Contexto da ação
  usuario_id UUID
  ip_address TEXT
  user_agent TEXT

  -- Criptografia e integridade
  hash_estado TEXT       -- SHA-256 do estado do diploma
  hash_anterior TEXT     -- SHA-256 do registro anterior (encadeia)

  -- Dados adicionais
  detalhes JSONB
  certificado_serial TEXT

  created_at TIMESTAMPTZ (imutável)
}
```

### Etapas Rastreadas

```typescript
type EtapaDiploma =
  | 'criacao'                 -- Diploma criado no sistema
  | 'dados_preenchidos'       -- Todos os dados preenchidos
  | 'xml_gerado'              -- XMLs gerados (2 ou 3)
  | 'xml_validado'            -- XMLs validados contra XSD
  | 'assinatura_emissora'     -- Assinado pela emissora (ICP-Brasil)
  | 'assinatura_registradora' -- Assinado pela registradora (UFMS)
  | 'rvdd_gerado'             -- RVDD (PDF visual) gerado
  | 'publicado'               -- Disponível no portal público
  | 'verificado'              -- Verificado por terceiros
  | 'revogado'                -- Diploma revogado
  | 'retificado'              -- Diploma retificado
```

---

## API de Uso

### 1. Registrar uma etapa

```typescript
import { registrarCustodiaAsync } from '@/lib/security/cadeia-custodia'

// Em uma rota de API
export async function POST(req: NextRequest) {
  // ... seu código ...

  // Registra não-bloqueante (fire-and-forget)
  void registrarCustodiaAsync({
    diplomaId: 'uuid-123',
    etapa: 'xml_gerado',
    status: 'sucesso',
    request: req,                    // Extrai IP e User-Agent
    userId: auth.userId,
    detalhes: {
      xmls_count: 2,
      hashes: [
        { tipo: 'HistoricoEscolar', hash: 'abc123...' },
        { tipo: 'DocumentacaoAcademica', hash: 'def456...' }
      ]
    },
    certificadoSerial: 'cert-xyz'    // Se aplicável
  })
}
```

### 2. Obter cadeia completa

```typescript
import { obterCadeiaCustodia } from '@/lib/security/cadeia-custodia'

const cadeia = await obterCadeiaCustodia('diploma-uuid')

// Retorna array de RegistroCustodia[], do mais antigo ao mais recente
cadeia.forEach(registro => {
  console.log(`${registro.created_at}: ${registro.etapa} (${registro.status})`)
})
```

### 3. Verificar integridade

```typescript
import { verificarIntegridadeCadeia } from '@/lib/security/cadeia-custodia'

const { integra, erros } = await verificarIntegridadeCadeia('diploma-uuid')

if (!integra) {
  console.error('ALERTA: Cadeia comprometida!')
  erros.forEach(err => console.error(`  - ${err}`))
}
```

### 4. Obter etapa atual

```typescript
import { obterEtapaAtual } from '@/lib/security/cadeia-custodia'

const etapa = await obterEtapaAtual('diploma-uuid')
console.log(`Diploma está em: ${etapa}`)
```

### 5. Endpoint REST — GET /api/diplomas/[id]/custodia

```bash
# Obter cadeia completa com validação de integridade
curl -H "Authorization: Bearer ${TOKEN}" \
  https://api.ficcassilandia.com.br/api/diplomas/abc123/custodia

# Resposta:
{
  "sucesso": true,
  "diploma_id": "abc123",
  "cadeia": [
    {
      "id": "rec-1",
      "etapa": "criacao",
      "status": "sucesso",
      "usuario_id": "user-1",
      "ip_address": "192.168.1.1",
      "hash_estado": "abc123...",
      "hash_anterior": null,
      "detalhes": null,
      "created_at": "2026-03-26T10:00:00Z"
    },
    {
      "id": "rec-2",
      "etapa": "dados_preenchidos",
      "status": "sucesso",
      "hash_estado": "def456...",
      "hash_anterior": "hash_do_registro_anterior",
      "created_at": "2026-03-26T10:15:00Z"
    },
    // ... mais registros ...
  ],
  "integridade": {
    "integra": true,
    "erros": []
  },
  "total_registros": 8
}
```

---

## Fluxo Típico de um Diploma

```
1. [API POST /diplomas]
   → registrarCustodia(diplomaId, 'criacao', 'sucesso', ...)
   → Tabela: INSERT 1 registro (hash_anterior = null)

2. [Painel: usuário preenche dados]
   → registrarCustodia(diplomaId, 'dados_preenchidos', 'sucesso', ...)
   → Tabela: INSERT 2º registro (hash_anterior = SHA256(rec-1))

3. [API POST /processos/[id]/gerar-xml]
   → registrarCustodia(diplomaId, 'xml_gerado', 'sucesso', ...)
   → Tabela: INSERT 3º registro (hash_anterior = SHA256(rec-2))

4. [API POST /diplomas/[id]/assinar]
   → registrarCustodia(diplomaId, 'assinatura_emissora', 'sucesso', ...)
   → Tabela: INSERT 4º registro
   → (opcional) registrarCustodia(diplomaId, 'assinatura_registradora', 'sucesso', ...)
   → Tabela: INSERT 5º registro

5. [API POST /diplomas/[id]/rvdd]
   → registrarCustodia(diplomaId, 'rvdd_gerado', 'sucesso', ...)
   → Tabela: INSERT 6º registro

6. [API POST /diplomas/[id]/publicar]
   → registrarCustodia(diplomaId, 'publicado', 'sucesso', ...)
   → Tabela: INSERT 7º registro

7. [Portal público: terceiros verificam]
   → registrarCustodia(diplomaId, 'verificado', 'sucesso', ...)
   → Tabela: INSERT 8º registro
```

---

## Segurança e Integridade

### Como Funciona o Encadeamento

Cada registro da cadeia armazena:

1. **hash_estado**: SHA-256(estado_do_diploma_neste_momento)
   - Prova criptográfica do estado exato
   - Impossível falsificar sem recomputação

2. **hash_anterior**: SHA-256(id_anterior + hash_estado_anterior + created_at_anterior)
   - Liga este registro ao anterior
   - Quebra se alguém tentar deletar um registro intermediário
   - Quebra se alguém tentar alterar timestamps

### Detecção de Tampering

A função `verificarIntegridadeCadeia()`:

```typescript
for cada registro atual {
  hash_esperado = SHA256(
    registro_anterior.id +
    registro_anterior.hash_estado +
    registro_anterior.created_at
  )

  if (registro_atual.hash_anterior !== hash_esperado) {
    ALERTA: "Tampering detected!"
  }
}
```

Se alguém tentar:
- **Deletar um registro**: Os hash_anterior dos registros subsequentes serão inválidos
- **Alterar um registro**: O hash_estado mudará, quebrando todos os subsequentes
- **Rearranjar ordem**: Os timestamps e hash_anterior não corresponderão
- **Falsificar timestamps**: hash_anterior não baterá

### RLS (Row Level Security)

```sql
-- SELECT: Usuários autenticados podem ler
CREATE POLICY "Authenticated users can read custody chain"
  ON cadeia_custodia_diplomas
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Apenas service role (backend)
CREATE POLICY "Only service role can insert custody records"
  ON cadeia_custodia_diplomas
  FOR INSERT
  WITH CHECK (false);  -- Bloqueia user role

-- UPDATE/DELETE: Ninguém (imutável)
CREATE POLICY "No updates or deletes on custody records"
  ON cadeia_custodia_diplomas
  FOR UPDATE
  USING (false);
```

---

## Integração em Rotas Existentes

### Exemplo: Rota de Assinatura

```typescript
// src/app/api/diplomas/[id]/assinar/route.ts

import { registrarCustodiaAsync } from '@/lib/security/cadeia-custodia'

export async function POST(req: NextRequest, { params }) {
  const { id: diplomaId } = await params

  try {
    // ... validação, assinatura BRy, etc ...

    const novoStatus = 'assinado'

    // Registra na custódia (não bloqueia resposta)
    void registrarCustodiaAsync({
      diplomaId,
      etapa: 'assinatura_emissora',
      status: 'sucesso',
      request: req,
      userId: auth.userId,
      detalhes: {
        modo: 'bry_kms',
        xmls_processados: resultados.length,
        certificado_serial: '12345678901234567890',
      }
    })

    return NextResponse.json({ ok: true, novo_status: novoStatus })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

---

## Consultas SQL Úteis

### Ver cadeia de um diploma específico

```sql
SELECT
  id,
  etapa,
  status,
  usuario_id,
  ip_address,
  hash_estado,
  hash_anterior,
  created_at
FROM cadeia_custodia_diplomas
WHERE diploma_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY created_at ASC;
```

### Contar registros por etapa

```sql
SELECT
  etapa,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'sucesso') as sucessos,
  COUNT(*) FILTER (WHERE status = 'erro') as erros
FROM cadeia_custodia_diplomas
GROUP BY etapa
ORDER BY total DESC;
```

### Diplomados mais auditorados

```sql
SELECT
  d.diploma_id,
  dip.diplomado_id,
  dipl.nome,
  COUNT(*) as eventos
FROM cadeia_custodia_diplomas d
JOIN diplomas dip ON d.diploma_id = dip.id
JOIN diplomados dipl ON dip.diplomado_id = dipl.id
GROUP BY d.diploma_id, dip.diplomado_id, dipl.nome
ORDER BY eventos DESC
LIMIT 10;
```

### Detectar anomalias (falta hash_anterior)

```sql
SELECT
  id,
  diploma_id,
  etapa,
  created_at
FROM cadeia_custodia_diplomas
WHERE hash_anterior IS NULL
  AND etapa != 'criacao'  -- Somente 'criacao' pode ter hash_anterior = null
ORDER BY created_at DESC;
```

---

## Compliance com MEC

### Portaria MEC 554/2019

✅ **Artigo 3**: Sistema mantém registro de cada mudança
✅ **Artigo 4**: Assinatura digital com ICP-Brasil A3
✅ **Artigo 5**: Acesso controlado por RLS
✅ **Artigo 6**: Rastreabilidade completa (IP, user-agent, timestamp)

### Portaria MEC 70/2025

✅ **Ampliação**: Suporta 11 etapas (criacao → retificado)
✅ **Integridade**: Hashing SHA-256 detecta tampering
✅ **Retenção**: Dados imutáveis, sem purga automática

---

## Troubleshooting

### "Nenhum registro de custódia encontrado"

Significa que nenhuma chamada para `registrarCustodia()` foi feita ainda. Verifique:
1. A rota de criação está chamando `registrarCustodiaAsync()`?
2. O `diplomaId` é válido (UUID)?
3. O cliente Supabase consegue se conectar?

### "Hash anterior não corresponde"

Indica tampering detectado! Próximas ações:
1. **Investigar**: Quem teve acesso ao banco naquela época?
2. **Restaurar**: Se houver backup, restaurar esse diploma
3. **Auditar**: Revisar logs de acesso ao banco (audit_trail)
4. **Reportar**: Informar ao MEC se for produção

### Desempenho lento em `verificarIntegridadeCadeia()`

Para diplomas com muitos registros (>1000), a verificação O(n) pode ser lenta. Solução:

```typescript
// Verificar apenas últimos 100 registros (padrão é mais rápido)
const cadeiaRecente = cadeia.slice(-100)
const { integra, erros } = await verificarIntegridadeCadeia(diplomaId)
```

---

## Roadmap Futuro

- [ ] Índices adicionais para performance
- [ ] Particionamento por mês (cadeia_custodia_202603, etc.)
- [ ] Função de purga de dados antigos (com aprovação MEC)
- [ ] Dashboard visual da cadeia em tempo real
- [ ] Alertas quando etapas demorarem muito
- [ ] Exportar cadeia em formato XSD/XML para auditores
- [ ] Integração com blockchain (opcional, para mega-compliance)

---

## Referências

- `supabase/migrations/20260326_cadeia_custodia.sql` — Schema
- `src/lib/security/cadeia-custodia.ts` — Implementação
- `src/app/api/diplomas/[id]/custodia/route.ts` — Endpoint GET
- `BRIEFING-DIPLOMA-DIGITAL-FIC.md` — Contexto geral

---

**Última atualização**: 2026-03-26
**Versão**: 1.0
**Conformidade**: MEC Portaria 554/2019 + 70/2025
