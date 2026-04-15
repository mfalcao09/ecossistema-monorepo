# Módulo de Verificação de Revogação de Certificados

## Visão Geral

Este módulo implementa verificação de revogação de certificados digitais ICP-Brasil via **CRL (Certificate Revocation List)** e **OCSP (Online Certificate Status Protocol)** para o sistema de Diploma Digital da FIC.

**Objetivo:** Garantir que os certificados utilizados para assinar XMLs de diploma não foram revogados, mantendo a integridade e legalidade dos diplomas emitidos.

---

## Arquivos Criados

### 1. `certificate-revocation.ts`
Módulo principal de verificação de revogação.

**Funções públicas:**

```typescript
// Verifica revogação via OCSP (tempo real) e CRL (fallback)
async function verificarRevogacao(
  certificadoPEM: string,
  issuerPEM?: string
): Promise<RevocationCheckResult>

// Verifica apenas via CRL
async function verificarCRL(
  certificadoPEM: string,
  crlDistributionPoints?: string[]
): Promise<RevocationCheckResult>

// Verifica apenas via OCSP
async function verificarOCSP(
  certificadoPEM: string,
  issuerPEM: string,
  ocspUrl?: string
): Promise<RevocationCheckResult>

// Obter estatísticas de cache
function obterEstatisticasCache(): {
  crlCacheSize: number
  ocspCacheSize: number
  totalCacheSize: number
}

// Limpar caches em memória
function limparCaches(): void
```

**Tipos principais:**

```typescript
interface RevocationCheckResult {
  revogado: boolean              // Indicação final
  metodo: 'ocsp' | 'crl' | 'nenhum'
  status: 'valido' | 'revogado' | 'desconhecido' | 'erro'
  dataRevogacao?: Date           // Se revogado
  motivoRevogacao?: string
  verificadoEm: Date
  ttl?: number                   // TTL da resposta (segundos)
  detalhes?: string
}
```

### 2. `certificate-chain.ts`
Validação de cadeia de certificados (leaf → intermediário(s) → raiz).

**Funções públicas:**

```typescript
// Valida cadeia a partir de array de PEMs
async function validarCadeiaCertificado(
  certificados: string[],
  verificarRevogacao?: boolean
): Promise<ResultadoValidacaoCadeia>

// Valida cadeia extraída de XML assinado
async function validarCadeiaDoXML(
  xmlContent: string,
  verificarRevogacao?: boolean
): Promise<ResultadoValidacaoCadeia>

// Formata resultado para logs
function formatarResultadoValidacao(
  resultado: ResultadoValidacaoCadeia
): string
```

**Tipos principais:**

```typescript
interface ResultadoValidacaoCadeia {
  valida: boolean
  totalCertificados: number
  cadeia: CertificadoNaCadeia[]  // Detalhes de cada cert
  erros: string[]
  avisos: string[]
  nivelConfianca: number         // 0-100%
  validadoEm: string
}
```

### 3. `src/app/api/diplomas/[id]/verificar-certificado/route.ts`
Endpoint HTTP para verificação de revogação.

**Métodos:**

- **POST** `/api/diplomas/[id]/verificar-certificado`
  - Realiza verificação completa de revogação
  - Parâmetros opcionais: `verificarRevogacao`, `verificarCadeia`, `xml`
  - Requer autenticação (admin/gestor_diplomas)
  - Registra auditoria automaticamente

- **GET** `/api/diplomas/[id]/verificar-certificado`
  - Retorna status de cache e documentação

---

## Fluxo de Verificação

### Estratégia Híbrida (Padrão)

```
certificado.pem
     ↓
[Extrair OCSP URL e CRL Distribution Points]
     ↓
┌─────────────────────────────────────────────┐
│ TENTAR OCSP (tempo real)                    │
│ - Mais rápido (tipicamente < 1s)            │
│ - Resposta sempre "fresca"                  │
│ - Pode falhar se responder offline          │
└─────────────────────────────────────────────┘
     ↓
  SE FALHAR ou NÃO DISPONÍVEL
     ↓
┌─────────────────────────────────────────────┐
│ FALLBACK: CRL                               │
│ - Baixar lista de revogados                 │
│ - Procurar serial no histórico              │
│ - Cache local (1 hora)                      │
└─────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────┐
│ RESULTADO                                   │
│ - revogado: true/false                      │
│ - status: valido|revogado|desconhecido|erro│
│ - tempo: medido em ms                       │
└─────────────────────────────────────────────┘
```

---

## Uso Prático

### 1. Verificação Básica

```typescript
import { verificarRevogacao } from '@/lib/security/certificate-revocation'

// Certificado do signatário (extraído de XML)
const certPEM = `-----BEGIN CERTIFICATE-----
MIIDz...
-----END CERTIFICATE-----`

const resultado = await verificarRevogacao(certPEM)

if (resultado.revogado) {
  console.error('⚠️ Certificado foi revogado!', resultado.dataRevogacao)
} else if (resultado.status === 'valido') {
  console.log('✓ Certificado válido')
} else if (resultado.status === 'desconhecido') {
  console.warn('? Status desconhecido (rever manualmente)')
}
```

### 2. Verificação com Certificado Emissor

```typescript
// Para OCSP, é necessário o certificado do emissor
const resultado = await verificarRevogacao(
  certificadoAssinante,
  certificadoAC  // AC que emitiu o certificado do assinante
)
```

### 3. Validação de Cadeia

```typescript
import { validarCadeiaCertificado } from '@/lib/security/certificate-chain'

// Array: [leaf, intermediário1, intermediário2, raiz]
const certificados = [certLeaf, certIntermed, certRaiz]

const resultado = await validarCadeiaCertificado(
  certificados,
  true  // verificar revogação de cada um
)

if (!resultado.valida) {
  console.error('Cadeia inválida:', resultado.erros)
}

console.log(`Confiança: ${resultado.nivelConfianca}%`)
```

### 4. Validação de XML Assinado

```typescript
import { validarCadeiaDoXML } from '@/lib/security/certificate-chain'

const xmlAssinado = fs.readFileSync('diploma.xml', 'utf-8')

const resultado = await validarCadeiaDoXML(xmlAssinado, true)

if (resultado.valida) {
  console.log('✓ XML com cadeia válida')
}
```

### 5. Via API HTTP

```bash
# Verificar certificados de um diploma
curl -X POST http://localhost:3000/api/diplomas/abc123/verificar-certificado \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "verificarRevogacao": true,
    "verificarCadeia": true
  }'

# Resposta:
{
  "diplomaId": "abc123",
  "valido": true,
  "algumRevogado": false,
  "certificados": [
    {
      "indice": 0,
      "titular": "Reitor da FIC",
      "serial": "1234567890ABCDEF",
      "revogacao": {
        "revogado": false,
        "metodo": "ocsp",
        "status": "valido",
        "ttl": 3600
      },
      "validoTemporalmente": true
    }
  ],
  "cadeia": {
    "valida": true,
    "totalCertificados": 3,
    "nivelConfianca": 95
  },
  "cache": {
    "crlCacheSize": 2,
    "ocspCacheSize": 5
  },
  "verificadoEm": "2025-03-26T10:30:00Z",
  "tempoExecucaoMs": 450
}
```

---

## Cache e Performance

### Estratégia de Cache

**CRL Cache:**
- TTL: 1 hora (configurável)
- Armazenamento: Map em memória
- Chave: URL do CDP
- Dados: Lista de seriais revogados

**OCSP Cache:**
- TTL: Até a próxima atualização (nextUpdate) ou 1 hora
- Armazenamento: Map em memória
- Chave: `${serialNumber}-${ocspUrl}`
- Dados: Resposta OCSP parseada

### Limpeza de Cache

```typescript
import { limparCaches } from '@/lib/security/certificate-revocation'

// Limpar caches manualmente
limparCaches()

// Ou configurar limpeza periódica
setInterval(() => {
  limparCaches()
}, 24 * 60 * 60 * 1000) // A cada 24 horas
```

### Monitoramento de Cache

```typescript
import { obterEstatisticasCache } from '@/lib/security/certificate-revocation'

const stats = obterEstatisticasCache()
console.log(`CRL entries: ${stats.crlCacheSize}`)
console.log(`OCSP entries: ${stats.ocspCacheSize}`)
console.log(`Total: ${stats.totalCacheSize}`)
```

---

## Integração com Sistema de Auditoria

Todas as verificações são automaticamente registradas no trail de auditoria:

```typescript
{
  usuario_id: "admin-001",
  acao: "verificar-certificado",    // AcaoAuditoria
  entidade: "assinatura",            // EntidadeAuditavel
  entidade_id: "diploma-abc123",
  detalhes: {
    verificacao_tipo: "revogacao-certificado",
    certificados_verificados: 3,
    algum_revogado: false,
    cadeia_verificada: true,
    resultado_final: true,
    tempo_ms: 450
  }
}
```

---

## Configuração de Produção

### Timeouts

```typescript
const OCSP_REQUEST_TIMEOUT = 5000        // 5 segundos
const CRL_DOWNLOAD_TIMEOUT = 10000       // 10 segundos
```

**Recomendações:**
- OCSP: 5-10 segundos (deve ser rápido)
- CRL: 10-30 segundos (arquivo pode ser grande)

### Fallbacks

Se OCSP falhar:
1. Tentar próximo responder OCSP (se múltiplos)
2. Tentar CRL dos CDPs

Se CRL falhar:
1. Tentar próximo CDP
2. Se todos CDPs falharem: status = `desconhecido`

### ACs Conhecidas

```typescript
const ACS_RAIZ_CONHECIDAS = [
  'AC Raiz ICP-Brasil',
  'Autoridade Certificadora Raiz Brasileira',
  'ICP-Brasil Root',
  // ... adicionar conforme necessário
]
```

---

## Tratamento de Erros

### Possíveis Erros

| Erro | Causa | Ação |
|------|-------|------|
| `Certificado não decodificável` | PEM inválido | Rejeitar certificado |
| `Nenhum CDP ou OCSP URL` | Extensões faltando | Status = `desconhecido` |
| `Timeout OCSP` | Responder offline | Fallback para CRL |
| `HTTP erro no CRL` | Servidor indisponível | Tentar próximo CDP |
| `CRL não parseável` | Formato inválido | Tentar próximo CDP |

### Logs de Segurança

```
[REVOGACAO] OCSP check em 234ms: valido
[REVOGACAO] OCSP falhou, tentando CRL: Connection timeout
[CRL] Erro ao processar CDP https://...: Invalid DER format
[CADEIA] Validação completa em 560ms. Válida: true, Confiança: 95%
```

---

## Teste e Validação

### Testes de Unidade (Exemplo)

```typescript
import { verificarRevogacao } from '@/lib/security/certificate-revocation'

describe('Certificate Revocation', () => {
  it('should detect revoked certificate', async () => {
    const revokedCert = fs.readFileSync('./test/revoked-cert.pem', 'utf-8')
    const issuer = fs.readFileSync('./test/issuer-cert.pem', 'utf-8')

    const result = await verificarRevogacao(revokedCert, issuer)

    expect(result.revogado).toBe(true)
    expect(result.status).toBe('revogado')
  })

  it('should accept valid certificate', async () => {
    const validCert = fs.readFileSync('./test/valid-cert.pem', 'utf-8')

    const result = await verificarRevogacao(validCert)

    expect(result.revogado).toBe(false)
  })
})
```

### Certificados de Teste

Para testes, usar:
- **AC Raiz ICP-Brasil** (teste/homologação)
- Certificados disponíveis em: https://www.iti.gov.br/

---

## Conformidade Regulatória

### Portarias e Normas

- **Portaria MEC 554/2019**: Requer verificação de revogação
- **Portaria MEC 70/2025**: Ampliação + novos requisitos
- **RFC 6960**: Especificação OCSP
- **RFC 5280**: Certificados X.509 e CRL
- **ITI - DOC-ICP-15**: Visão geral de assinaturas digitais

### Requisito de Lei

> "A verificação de revogação de certificados é obrigatória para validação de assinaturas digitais em documentos eletrônicos de valor legal" — IN SESU/MEC 1/2020

---

## Troubleshooting

### OCSP não funciona

**Problema:** OCSP sempre falha, CRL funciona

**Solução:**
1. Verificar conectividade para responder OCSP
2. Validar URL extraída do certificado
3. Confirmar que certificado emissor está disponível
4. Aumentar timeout se servidor for lento

### CRL muito grande

**Problema:** Download de CRL lento ou falha de memória

**Solução:**
1. Aumentar timeout de download
2. Reduzir TTL de cache (atualizar frequentemente)
3. Implementar streaming de CRL ao invés de carregar tudo
4. Usar CRL Delta (apenas mudanças)

### Cache crescendo indefinidamente

**Problema:** Memória crescente

**Solução:**
1. Implementar limite máximo de cache
2. Usar LRU (Least Recently Used) eviction
3. Executar `limparCaches()` periodicamente
4. Considerar Redis para cache distribuído

---

## Próximas Implementações

- [ ] Suporte a CRL Delta
- [ ] Integration com banco de dados para cache persistente
- [ ] Múltiplos responders OCSP com fallback automático
- [ ] Validação de resposta OCSP (verificar assinatura)
- [ ] Suporte a OCSP Stapling
- [ ] Alertas de certificados próximos de expirar
- [ ] Dashboard de monitoramento de revogações

---

## Referências

- [ITI - Infraestrutura de Chaves Públicas Brasileira](https://www.iti.gov.br/)
- [RFC 6960 - OCSP](https://tools.ietf.org/html/rfc6960)
- [RFC 5280 - X.509](https://tools.ietf.org/html/rfc5280)
- [Node.js crypto module](https://nodejs.org/api/crypto.html)
