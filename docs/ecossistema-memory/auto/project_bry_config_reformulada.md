---
name: Configuração BRy reformulada com OAuth2
description: Detalhes da reformulação da página de configuração BRy — OAuth2, certificados, endpoints auto-preenchidos
type: project
---

## Reformulação completa (commit ef136cc, 2026-03-27)

A página `AbaIntegracao.tsx` foi reescrita com 3 blocos:

### Bloco 1: Credenciais OAuth2
- `bry_client_id` + `bry_client_secret_enc` (novas colunas no Supabase)
- Fluxo: `POST /token-service/jwt` com `grant_type=client_credentials`
- Substituiu o JWT estático (campo `assinatura_api_key_enc` mantido como legado)

### Bloco 2: Certificado Digital ICP-Brasil
- Tipo: `bry_certificado_tipo` (nova coluna): `hsm_cloud`, `pkcs12`, `manual`
- HSM Cloud: UUID compartimento + credencial (PIN/OTP/TOKEN) — campos existentes
- PKCS12: só para homologação (aviso no UI)
- Manual: fluxo initialize → assinar externamente → finalize

### Bloco 3: Endpoints (auto-preenchidos)
- Token: `https://cloud-hom.bry.com.br/token-service/jwt` (hom) / `https://cloud.bry.com.br/token-service/jwt` (prod)
- XML Signature: `https://diploma.hom.bry.com.br/api/xml-signature-service/v2/signatures` (hom) / `https://diploma.bry.com.br/api/xml-signature-service/v2/signatures` (prod)
- Verificação: `https://diploma.hom.bry.com.br/api/xml-verification-service/v1/signatures/verify`

### API teste de conexão atualizada
- Etapa 1: Obtém token via OAuth2
- Etapa 2: Testa endpoint de verificação com o token
- HTTP 400 do verify = sucesso (token válido, payload vazio esperado)

**Why:** A configuração anterior usava endpoints errados (KMS) e autenticação por JWT estático.

**How to apply:** Quando Marcelo obtiver credenciais BRy, preencher Client ID e Client Secret no painel.
