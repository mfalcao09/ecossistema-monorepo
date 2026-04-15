# API BRy — Referência Técnica para Assinatura de Diploma Digital

> Documentação extraída do portal BRy para Desenvolvedores (ambiente de homologação)
> Swagger: BRy HUB Signer v3.5.1-RC2 (OAS3) — https://hub2.hom.bry.com.br/swagger-ui/index.html
> OpenAPI spec: /openapi/HUBSigner/
> Data de extração: 2026-03-26
> Versão XSD compatível: v1.05

---

## 1. Visão Geral

A API de Diploma Digital da BRy permite às IES integrar seus sistemas de gestão para emitir e/ou registrar diplomas de graduação no formato digital, conforme Portaria MEC nº 554/2019, IN SESU nº 1/2020 e IN nº 2/2023.

**IMPORTANTE:** A API NÃO valida conteúdo e conformidade do XSD do diploma. A adequação ao schema XSD publicado pelo MEC é responsabilidade do integrador (nosso sistema).

---

## 2. Autenticação

### 2.1. Pré-requisitos
1. Cadastrar aplicação no BRy Cloud
2. Obter token de acesso (JWT)

### 2.2. Obter Token de Acesso

**Endpoint:**
```
POST https://cloud-hom.bry.com.br/token-service/jwt     (homologação)
POST https://cloud.bry.com.br/token-service/jwt          (produção)
```

**Header:**
```
Content-Type: application/x-www-form-urlencoded
```

**Body (form-urlencoded):**
| Parâmetro      | Valor                                      |
|----------------|---------------------------------------------|
| grant_type *   | `client_credentials`                        |
| client_id *    | ID da aplicação (obtido na tela de apps)    |
| client_secret *| API Key (obtido na tela de apps)            |

**Retorno:** JSON com `access_token`, `refresh_token`, `expires_in`

### 2.3. Renovar Token

```
POST https://cloud-hom.bry.com.br/token-service/jwt
```

| Parâmetro        | Valor                                    |
|------------------|-------------------------------------------|
| grant_type *     | `refresh_token`                           |
| refresh_token *  | valor do refresh_token anterior            |

### 2.4. Validade dos Tokens
- Contas Pré-pago e Pós-pago: **30 minutos**
- Contas Pós-pago Licenciamento: **365 dias**
- Limite de renovação: **2 req/segundo**
- Fuso: **UTC-0** (campo `exp` no JWT)
- Decodificar via jwt.io para extrair `exp`

---

## 3. Arquitetura da Assinatura

### 3.1. Arquivos XML do Diploma Digital

O diploma digital é composto por:

**XMLs principais:**
1. **XML Documentação Acadêmica (Registro)** — dados privados do aluno
2. **XML Diplomado** — dados públicos para comprovação

**XMLs auxiliares (a partir da v1.04):**
3. **XML Histórico Escolar Digital** — histórico do aluno
4. **XML Lista de Diplomas Anulados** — listagem de anulações (IES Registradora)
5. **XML Arquivo de Fiscalização** — informações para o MEC
6. **XML Currículo Escolar Digital** (v1.05) — informações do currículo visando diplomação

### 3.2. Padrão de Assinatura
- **Formato:** XAdES (XML Advanced Electronic Signature)
- **Padrão:** ICP-Brasil
- **Política:** AD-RT (com referência temporal) para maioria das assinaturas; **AD-RA** (com referência de arquivamento) para assinaturas finais/envelope
- **Certificados:** ICP-Brasil obrigatório
  - e-CPF para pessoas físicas (representantes)
  - e-CNPJ para pessoas jurídicas (IES)

### 3.3. Fluxo de Assinatura em 3 Etapas (para cada assinante)

```
ETAPA 1: INICIALIZAR → API BRy define atributos da assinatura
ETAPA 2: ASSINAR     → Aplicação usa chave privada do assinante para cifrar signedAttributes
ETAPA 3: FINALIZAR   → API BRy monta estrutura completa (carimbo do tempo + referências)
```

**A Etapa 2 é feita pela aplicação (nosso sistema).** A chave privada pode ser acessada por:
- **Arquivo** (PKCS#12)
- **Navegador** (extensão para acessar repositório de certificados)
- **Nuvem** (certificado em nuvem com autorização do signatário)

---

## 4. Endpoints da API

### Base URL
```
Homologação: https://diploma.hom.bry.com.br/api/xml-signature-service/v2/signatures/
Produção:    https://diploma.bry.com.br/api/xml-signature-service/v2/signatures/
```

### 4.1. Inicializar Assinatura
```
POST {base}/initialize
```

### 4.2. Finalizar Assinatura
```
POST {base}/finalize
```

### 4.3. Carimbo de Arquivamento Extra
```
POST https://diploma.hom.bry.com.br/xml/v1/upgrade/extra-archive-timestamp
```

---

## 5. XML Documentação Acadêmica — Fluxo Completo

### Passo 1: Assinatura do Representante da Emissora (e-CPF)

Assina o nodo `DadosDiploma` (ou `DadosDiplomaPorDecisaoJudicial` se decisão judicial).

**Inicialização — Tabela 1 (POST /initialize):**

| Parâmetro multipart                          | Valor                                                         |
|-----------------------------------------------|---------------------------------------------------------------|
| nonce                                         | Número qualquer para identificação do item no lote            |
| signatureFormat                               | `ENVELOPED`                                                   |
| hashAlgorithm                                 | `SHA256`                                                      |
| certificate                                   | Chave pública do certificado (e-CPF) em Base64                |
| profile                                       | `ADRT`                                                        |
| originalDocuments[0][nonce]                    | Nonce do documento                                            |
| originalDocuments[0][content]                  | O XML a ser assinado                                          |
| originalDocuments[0][specificNode][name]       | `DadosDiploma`                                                |
| originalDocuments[0][specificNode][namespace]  | `http://portal.mec.gov.br/diplomadigital/arquivos-em-xsd`    |

**Header:**
```
Content-Type: multipart/form-data
Authorization: "access_token"
```

**Retorno da inicialização:**
```json
{
  "signedAttributes": ["<base64 hash para cifrar>"],
  "initializedDocuments": ["<dado para salvar e enviar na finalização>"]
}
```

**Finalização — Tabela 2 (POST /finalize):**

| Parâmetro multipart                    | Valor                                                              |
|-----------------------------------------|--------------------------------------------------------------------|
| nonce                                   | Mesmo nonce                                                        |
| signatureFormat                         | `ENVELOPED`                                                        |
| hashAlgorithm                           | `SHA256`                                                           |
| certificate                             | Mesma chave pública em Base64                                      |
| profile                                 | `ADRT`                                                             |
| returnType                              | `BASE64`                                                           |
| finalizations[0][content]               | XML a ser assinado                                                 |
| finalizations[0][signatureValue]        | signedAttributes[0] cifrado com chave privada, codificado Base64   |
| finalizations[0][initializedDocument]   | initializedDocument[0] retornado na inicialização                  |

### Passo 2: Assinatura da IES Emissora (e-CNPJ)

Mesma estrutura da Tabela 1/2, com alterações:

| Alteração              | Valor                                                |
|------------------------|------------------------------------------------------|
| **Adicionar:**         |                                                      |
| includeXPathEnveloped  | `false`                                              |
| **Alterar:**           |                                                      |
| certificate            | Chave pública do certificado da IES Emissora (e-CNPJ)|

### Passo 3: Assinatura Final da IES Emissora — Envelope (e-CNPJ)

Assina TODO o documento (incluindo assinaturas anteriores). **Política muda para AD-RA.**

| Alteração                                    | Valor                                                    |
|----------------------------------------------|----------------------------------------------------------|
| **Adicionar:**                               |                                                          |
| includeXPathEnveloped                        | `false`                                                  |
| **Remover:**                                 |                                                          |
| originalDocuments[0][specificNode][name]      | (removido)                                               |
| originalDocuments[0][specificNode][namespace] | (removido)                                               |
| **Alterar:**                                 |                                                          |
| certificate                                  | Chave pública e-CNPJ da IES Emissora                    |
| profile                                      | **`ADRA`** (Referência de Arquivamento)                  |

**Retorno:** XMLs assinados e finalizados em Base64, prontos para decodificação.

---

## 6. XML Diplomado — Fluxo Completo

O XML Diplomado é gerado pela IES Registradora. Deve **copiar inteiro** o nodo `infDiploma` do XML Documentação Acadêmica, **inclusive com as assinaturas** já geradas.

**Assinaturas copiadas do XML Documentação Acadêmica:**
- Representante da Emissora (e-CPF)
- IES Emissora (e-CNPJ)

**Assinaturas novas a gerar:**

### Passo 1: Representante da Registradora (e-CPF)
Assina nodo `DadosRegistro` (ou `DadosRegistroPorDecisaoJudicial`).

| Alteração         | Valor                                                    |
|-------------------|----------------------------------------------------------|
| specificNode.name | `DadosRegistro`                                          |
| certificate       | e-CPF do representante da Registradora                   |

### Passo 2: Assinatura Final da Registradora (e-CNPJ)
Assina todo o documento. **Política AD-RA.**

| Alteração                                    | Valor                                                    |
|----------------------------------------------|----------------------------------------------------------|
| **Remover:**                                 |                                                          |
| originalDocuments[0][specificNode][name]      | (removido)                                               |
| originalDocuments[0][specificNode][namespace] | (removido)                                               |
| **Alterar:**                                 |                                                          |
| certificate                                  | e-CNPJ da IES Registradora                               |
| profile                                      | **`ADRA`**                                               |
| **Adicionar:**                               |                                                          |
| includeXPathEnveloped                        | `false`                                                  |

**Retorno:** XMLs Diplomados assinados em Base64, prontos para disponibilização.

---

## 7. XML Histórico Escolar Digital

Gerado pela IES Emissora. Pode ser **Parcial** ou **Integral**.

**Política recomendada:** AD-RT (mínimo referência temporal). AD-RA recomendada para guarda de longo prazo.

### Passo 1: Assinatura Representante da Secretaria (APENAS para Histórico Integral)
- Certificado: e-CPF
- Profile: `ADRT`
- Sem specificNode (assina o documento inteiro)

**Tabela de Inicialização:**

| Parâmetro multipart              | Valor                                                 |
|----------------------------------|-------------------------------------------------------|
| nonce                            | Identificação do item no lote                         |
| signatureFormat                  | `ENVELOPED`                                           |
| hashAlgorithm                    | `SHA256`                                              |
| certificate                      | Chave pública e-CPF do representante da Secretaria    |
| profile                          | `ADRT`                                                |
| originalDocuments[0][nonce]      | Nonce do documento                                    |
| originalDocuments[0][content]    | O XML do Histórico Escolar                            |

### Passo 2: Assinatura Final da IES Emissora (e-CNPJ)
- Mesma estrutura, com `certificate` da IES Emissora (e-CNPJ)
- Profile: pode ser `ADRT` ou `ADRA` (recomendado `ADRA` para longo prazo)

---

## 8. XML Currículo Escolar Digital (v1.05)

Assinado em separado dos demais XMLs.

### Passo 1: Assinatura do Coordenador do Curso (e-CPF)
- Profile: `ADRT` (recomendado AD-RC mínimo)
- Sem specificNode

### Passo 2: Assinatura Final IES Emissora (e-CNPJ)
- Mesma estrutura padrão

---

## 9. XMLs Auxiliares (Anulados + Fiscalização)

Os XMLs de Lista de Diplomas Anulados e Arquivo de Fiscalização seguem o mesmo padrão de assinatura base (Tabela 1 e 2), com assinatura pela IES correspondente (Registradora para Anulados, Emissora para Fiscalização).

---

## 10. Assinatura em Lote

Todos os endpoints suportam envio em lote. O lote usa arrays indexados:

**Inicialização:**
```
originalDocuments[0][nonce], originalDocuments[0][content], ...
originalDocuments[1][nonce], originalDocuments[1][content], ...
...
originalDocuments[9][nonce], originalDocuments[9][content], ...
```

**Finalização:**
```
finalizations[0][content], finalizations[0][signatureValue], finalizations[0][initializedDocument]
finalizations[1][content], finalizations[1][signatureValue], finalizations[1][initializedDocument]
...
finalizations[9][content], finalizations[9][signatureValue], finalizations[9][initializedDocument]
```

### Limites
- **Tamanho máximo da requisição:** 100MB
- **Lote recomendado:** máximo 10 documentos por requisição
- **Requisições por segundo:** máximo 20 por aplicação/IP
- Retorno: array de XMLs assinados em Base64

---

## 11. Assinatura com Certificado em Nuvem

Para certificados armazenados em nuvem (Cloud KMS), existe um fluxo simplificado de **etapa única** que combina inicialização + assinatura + finalização.

Documentação específica: [Assinatura XML/XAdES com certificado em nuvem]

---

## 12. Carimbo de Arquivamento Extra (ArchiveTimeStamp)

Assinaturas com política AD-RA permitem adição de novos carimbos de arquivamento sequencialmente, garantindo validade de longo prazo.

**IMPORTANTE:** O novo carimbo deve ser adicionado ANTES da expiração do certificado digital do carimbo anterior.

**Endpoint:**
```
POST https://diploma.hom.bry.com.br/xml/v1/upgrade/extra-archive-timestamp
```

| Parâmetro multipart     | Valor                                                      |
|--------------------------|-------------------------------------------------------------|
| signature[0..9]          | XML completamente assinado (até 10 por requisição)         |
| signatureFormat          | `ENVELOPED`                                                |
| hashAlgorithm            | `SHA256`                                                   |
| includeXPathEnveloped    | `false`                                                    |
| returnType               | `LINK` ou `BASE64`                                         |

---

## 13. Verificação do Diploma Digital

Duas formas:
1. **Manual:** Upload no verificador do ITI (https://verificador.iti.gov.br) ou do MEC (https://validadordiplomadigital.mec.gov.br/diploma)
2. **Integrada:** Via API BRy de Verificação XML

A verificação de conformidade com a IN SESU nº1/2020 está disponível apenas no Verificador do MEC.

---

## 14. Custos

- **1,5 créditos** por assinatura em cada arquivo do diploma digital
- Contas novas recebem créditos iniciais para teste
- Modo pré-pago: créditos avulsos ou plano mensal
- Modo pós-pago: contrato com faixa de consumo

---

## 15. Ambientes

| Ambiente      | BRy Cloud                          | API Assinatura                                        |
|---------------|-------------------------------------|-------------------------------------------------------|
| Homologação   | https://cloud-hom.bry.com.br       | https://diploma.hom.bry.com.br/api/xml-signature-service/v2/ |
| Produção      | https://cloud.bry.com.br           | https://diploma.bry.com.br/api/xml-signature-service/v2/     |

---

## 16. Problemas Comuns na Validação (FAQ #9)

**Estrutura do XML:**
- XML não aderente ao XSD
- Código de validação fora do padrão: "ID e-MEC Emissora" + "." + "ID e-MEC Registradora" + "." + sequencial

**Certificados:**
- Não usar ICP-Brasil
- e-CPF inválido nos passos de pessoa física
- e-CNPJ inválido nos passos de pessoa jurídica

**Perfis de assinatura:**
- Não usar ADRC/ADRT nas etapas 1, 2 e 3
- Não usar ADRA na etapa final (envelope)
- Não assinar nodo específico `DadosDiploma` nas etapas 1 e 2
- Não assinar nodo específico `DadosRegistro` na etapa 3

**Dica:** É possível enviar o diploma SEM assinaturas ao validador do MEC para confirmar apenas a conformidade com o XSD antes de assinar.

---

## 17. Repositório de Exemplos

GitLab BRy: https://gitlab.com/brytecnologia-team/integracao/api-autenticacao
Postman: Disponível via link no Swagger

---

## 18. Swagger — BRy HUB Signer (Detalhes Complementares)

O Swagger (BRy HUB Signer v3.5.1-RC2) expõe TODOS os serviços REST agrupados em:

### Seções do Swagger

| Seção                    | Descrição                                                    |
|--------------------------|--------------------------------------------------------------|
| **Assinador CMS**        | Assinatura CMS/CAdES (não usado no diploma digital)         |
| **Assinador PDF**        | Assinatura PDF/PAdES (útil para RVDD se necessário)          |
| **Assinador XML** ★      | Assinatura XML/XAdES — **PRINCIPAL para Diploma Digital**    |
| **Utilitários**          | Marker PDF, merge, cifragem, extração de assinaturas         |
| **Verificadores**        | Verificação de assinaturas CMS, PDF e XML                    |
| **Validação Certificados**| Validação de certificados x509v3                            |
| **Completadores** ★      | Upgrade de assinatura + Carimbo de Arquivamento Extra (ATS)  |
| **Certificado em Arquivo**| Gerenciamento de PKCS12 no HUB (volátil)                   |
| **Certificados Confiáveis**| Cache de autoridades confiáveis                            |
| **Health**               | Liveness check do HUB                                       |

### Endpoints XML (★ relevantes para nosso projeto)

| Método | Path                                                | Descrição                                |
|--------|-----------------------------------------------------|------------------------------------------|
| POST   | /api/xml-signature-service/v1/signatures/kms        | Assinar com Certificado em Nuvem (etapa única) |
| POST   | /api/xml-signature-service/v2/signatures/initialize | Inicializar assinatura XML/XAdES         |
| POST   | /api/xml-signature-service/v2/signatures/finalize   | Finalizar assinatura XML/XAdES           |
| POST   | /api/xml-signature-service/v1/signatures/pkcs12     | Assinar com certificado em arquivo (PKCS12, etapa única) |
| GET    | /fw/v1/xml/operacoes/{id}/assinaturas/{hash}        | Recuperar documento via link (cache)     |

### Endpoints Completadores (★ relevantes)

| Método | Path                                       | Descrição                                       |
|--------|--------------------------------------------|-------------------------------------------------|
| POST   | /xml/v1/upgrade/signature                  | Upgrade de assinatura XML/XAdES                 |
| POST   | /xml/v1/upgrade/extra-archive-timestamp    | Renotarizar com novo Carimbo de Arquivamento    |

### Endpoints Verificadores (★ relevantes)

| Método | Path                                                    | Descrição                              |
|--------|---------------------------------------------------------|----------------------------------------|
| POST   | /api/xml-verification-service/v1/signatures/verify      | Verificar assinatura XML               |

### Parâmetros Completos — Initialize (do Swagger)

| Parâmetro                                    | Tipo    | Obrig. | Descrição                                                                    |
|----------------------------------------------|---------|--------|------------------------------------------------------------------------------|
| nonce                                        | string  | ★      | Identificador da requisição no lote                                          |
| certificate                                  | string  | ★      | Certificado (chave pública) em Base64                                        |
| returnType                                   | string  | ★      | `LINK` ou `BASE64`                                                           |
| hashAlgorithm                                | string  | ★      | `SHA1`, `SHA256`, `SHA512`                                                   |
| profile                                      | string  | ★      | `BASIC`, `COMPLETE`, `ADRB`, `ADRT`, `ADRV`, `ADRC`, `ADRA`, `ETSI_B`, `ETSI_T`, `ETSI_LT`, `ETSI_LTA` |
| signatureFormat                              | string  | ★      | `ENVELOPED`, `ENVELOPING`, `DETACHED`                                        |
| operationType                                | string  |        | `SIGNATURE`, `CO_SIGNATURE`                                                  |
| binaryContent                                | boolean |        | `true` = qualquer formato, `false` = XML                                     |
| includeXPathEnveloped                        | boolean |        | Inclui regra XPath para ignorar assinaturas anteriores                       |
| generateSimplifiedXMLDSig                    | boolean |        | Gera sem prefixo `ds:` nas tags                                             |
| includeSigningTime                           | boolean |        | Inclui hora local nos atributos assinados                                    |
| canonicalizerType                            | string  |        | `INCLUSIVE` ou `EXCLUSIVE`                                                   |
| originalDocuments[N][nonce]                   | string  |        | Nonce do documento N                                                         |
| originalDocuments[N][content]                 | binary  | ★      | XML a ser assinado (ou URL para download)                                    |
| originalDocuments[N][information]             | string  |        | Informações sobre o arquivo                                                  |
| originalDocuments[N][filename]                | string  |        | Nome do arquivo                                                              |
| originalDocuments[N][specificNode][id]        | string  |        | ID do nodo a ser assinado                                                    |
| originalDocuments[N][specificNode][name]      | string  |        | Nome do nodo (ex: `DadosDiploma`)                                            |
| originalDocuments[N][specificNode][namespace] | string  |        | Namespace do nodo                                                            |
| policyOid                                    | string  |        | OID da política de assinatura                                                |
| lineBreak                                    | boolean |        | Quebra de linha no Base64 (padrão: true)                                     |
| generationId                                 | string  |        | Tipo de geração de IDs: `SEQUENCIAL`, `PADRONIZADO`                          |

### Parâmetros Completos — Finalize (do Swagger)

| Parâmetro                                    | Tipo    | Obrig. | Descrição                                                                    |
|----------------------------------------------|---------|--------|------------------------------------------------------------------------------|
| nonce                                        | string  | ★      | Nonce da requisição                                                          |
| certificate                                  | string  | ★      | Mesmo certificado da inicialização                                           |
| returnType                                   | string  | ★      | `LINK` ou `BASE64`                                                           |
| hashAlgorithm                                | string  | ★      | Mesmo da inicialização                                                       |
| profile                                      | string  | ★      | Mesmo da inicialização                                                       |
| signatureFormat                              | string  | ★      | Mesmo da inicialização                                                       |
| operationType                                | string  |        | Mesmo da inicialização                                                       |
| binaryContent                                | boolean |        | Mesmo da inicialização                                                       |
| includeXPathEnveloped                        | string  |        | Mesmo da inicialização                                                       |
| finalizations[N][nonce]                      | string  |        | Nonce da assinatura                                                          |
| finalizations[N][content]                    | binary  | ★      | XML a ser assinado (mesma ordem da inicialização)                            |
| finalizations[N][signatureValue]             | string  | ★      | signedAttributes cifrado com chave privada, em Base64                        |
| finalizations[N][initializedDocument]        | string  | ★      | initializedDocument retornado da inicialização                               |
| policyOid                                    | string  |        | OID da política                                                              |
| lineBreak                                    | boolean |        | Quebra de linha no Base64                                                    |

### Endpoint KMS (Certificado em Nuvem) — Parâmetros Adicionais

| Parâmetro  | Tipo    | Obrig. | Descrição                                                          |
|------------|---------|--------|--------------------------------------------------------------------|
| kms_type   | string  | ★      | Header. Tipo: `BRYKMS`, `DINAMO`, `PSC`, `INTEGRABRY`             |
| kms_data   | object  | ★      | Credenciais de acesso ao certificado em nuvem                      |

### Headers HTTP (Rate Limiting)

| Header                 | Descrição                                    |
|------------------------|----------------------------------------------|
| X-Rate-Limit-Limit     | Limite máximo de requisições por time-window  |
| X-Rate-Limit-Remaining | Requisições restantes                        |
| X-Rate-Limit-Reset     | Tempo em ms da time-window                   |

### Resposta de Erro Padrão (400)

```json
{
  "status": 401,
  "message": "Mensagem do erro",
  "chave": "chave.do.erro",
  "timestamp": 2272158000,
  "traceId": "44f3cf5846a683ce"
}
```

### Formatos de Assinatura Suportados pelo HUB

- **CMS** (Cryptographic Message Syntax) — RFC 5652
- **PDF** (Portable Document Format) Signature — ISO 32000-1
- **CAdES** (CMS Advanced Electronic Signatures) — DOC-ICP 15.03 / ETSI EN 319 122-1
- **PAdES** (PDF Advanced Electronic Signature) — DOC-ICP 15.03 / ETSI EN 319 142-1
- **XMLDSig** (XML Digital Signature) — W3C
- **XAdES** (XML Advanced Electronic Signature) — DOC-ICP 15.03 / ETSI TS 101 903 ★

Hash: SHA1, SHA256, SHA512. Carimbo do tempo: RFC 3161.

---

## 19. Resumo do Fluxo Completo (FIC como Emissora)

```
┌─────────────────────────────────────────────────────────┐
│           XML DOCUMENTAÇÃO ACADÊMICA                     │
├─────────────────────────────────────────────────────────┤
│ 1. Representante Emissora (e-CPF) → nodo DadosDiploma   │
│    profile: ADRT                                         │
│ 2. IES Emissora FIC (e-CNPJ) → nodo DadosDiploma        │
│    profile: ADRT, includeXPathEnveloped: false           │
│ 3. Envelope IES Emissora (e-CNPJ) → documento inteiro   │
│    profile: ADRA, sem specificNode                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│           XML DIPLOMADO (IES Registradora)               │
├─────────────────────────────────────────────────────────┤
│ → Copiar nodo infDiploma COM assinaturas da Emissora    │
│ 1. Representante Registradora (e-CPF) → DadosRegistro   │
│    profile: ADRT                                         │
│ 2. IES Registradora (e-CNPJ) → documento inteiro        │
│    profile: ADRA                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│           XML HISTÓRICO ESCOLAR                          │
├─────────────────────────────────────────────────────────┤
│ 1. (Se Integral) Repr. Secretaria (e-CPF) → inteiro     │
│    profile: ADRT                                         │
│ 2. IES Emissora FIC (e-CNPJ) → inteiro                  │
│    profile: ADRT ou ADRA                                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│           XML CURRÍCULO ESCOLAR (v1.05)                  │
├─────────────────────────────────────────────────────────┤
│ 1. Coordenador do Curso (e-CPF) → inteiro               │
│    profile: ADRT                                         │
│ 2. IES Emissora FIC (e-CNPJ) → inteiro                  │
│    profile: ADRT ou ADRA                                 │
└─────────────────────────────────────────────────────────┘
```
