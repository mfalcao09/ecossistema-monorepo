---
name: Decisão arquitetural — API Diploma Digital (Initialize/Finalize) + BRy Signer Desktop para Token A3 USB
description: 🔑 FIC usa Token A3 USB. API = HUB Signer Initialize/Finalize (NÃO Easy Signer). Passo 2 (chave privada) via BRy Signer Desktop. NÃO KMS.
type: project
---

Decisão em 11/04/2026 (sessão 059):

**Cenário:** FIC usa certificado ICP-Brasil A3 em Token USB físico. A chave privada NUNCA sai do dispositivo.

**API escolhida: API de Diploma Digital (HUB Signer) — Initialize/Finalize**
- NÃO usa Easy Signer (produto separado, baseado em envelopes)
- NÃO usa KMS/Nuvem (certificado não está em cloud)
- Usa o fluxo padrão de 3 etapas da API de Diploma Digital

**Endpoints reais:**
- Token: `POST https://cloud-hom.bry.com.br/token-service/jwt` (client_credentials, form-urlencoded)
- Initialize: `POST https://diploma.hom.bry.com.br/api/xml-signature-service/v2/signatures/initialize` (multipart/form-data)
- Finalize: `POST https://diploma.hom.bry.com.br/api/xml-signature-service/v2/signatures/finalize` (multipart/form-data)
- Verify: `POST https://diploma.hom.bry.com.br/api/xml-verification-service/v1/signatures/verify`
- Extra timestamp: `POST https://diploma.hom.bry.com.br/xml/v1/upgrade/extra-archive-timestamp`

**Fluxo de assinatura para cada XML:**
1. Nosso servidor → POST /initialize (XML + public key + params) → BRy retorna { signedAttributes, initializedDocuments }
2. BRy Signer Desktop (no PC da secretária) → recebe signedAttributes, acessa Token A3 USB, assina com chave privada → retorna signatureValue
3. Nosso servidor → POST /finalize (signatureValue + initializedDocument + params) → BRy retorna XML assinado em Base64

**Passo 2 — Como funciona:**
- BRy Signer Desktop é software da BRy instalado no computador da secretária
- Nosso frontend envia o signedAttributes para o browser da secretária
- O BRy Signer (extensão/desktop) acessa o Token USB e assina
- O signatureValue volta ao browser e é enviado ao nosso servidor

**Parâmetros Initialize (multipart/form-data):**
- nonce: identificador do item
- signatureFormat: ENVELOPED
- hashAlgorithm: SHA256
- certificate: chave pública em Base64
- profile: ADRT (representantes) ou ADRA (envelope final)
- originalDocuments[0][nonce]: nonce do documento
- originalDocuments[0][content]: XML a ser assinado
- originalDocuments[0][specificNode][name]: DadosDiploma (ou vazio no envelope)
- originalDocuments[0][specificNode][namespace]: http://portal.mec.gov.br/diplomadigital/arquivos-em-xsd

**Parâmetros Finalize (multipart/form-data):**
- nonce, signatureFormat, hashAlgorithm, certificate, profile: mesmos
- returnType: BASE64
- finalizations[0][content]: XML a ser assinado
- finalizations[0][signatureValue]: signedAttributes cifrado com chave privada, em Base64
- finalizations[0][initializedDocument]: valor retornado no initialize

**Softwares necessários na FIC:**
- BRy Signer Desktop (extensão navegador) — ainda NÃO instalado
- Token USB A3 ICP-Brasil com drivers

**How to apply:** Reescrever rota /api/diplomas/[id]/assinar com fluxo real Initialize/Finalize. Frontend precisa orquestrar o passo 2 via BRy Signer.
