---
name: Decisões arquiteturais Bloco 3 — assinatura BRy (08/04/2026)
description: Marcelo decidiu caminho de chave privada (navegador+extensão), certificados (Aleciana, Marcelo, FIC) e priorização do plano Sprint 2 completo Railway
type: project
---

Decisões finais de Marcelo (08/04/2026) fechando arquitetura da assinatura BRy:

**D2 — Caminho de chave privada: NAVEGADOR + EXTENSÃO BRy Signer**
- NÃO é KMS em nuvem (opção B recomendada pelo Claude).
- NÃO é PKCS#12 em arquivo (opção A).
- É opção C: assinatura híbrida. Servidor orquestra initialize + finalize; ETAPA 2 (cifrar signedAttributes com chave privada) acontece no browser do signatário via extensão BRy.
- Implica: token A3 físico conectado na máquina do signatário + extensão instalada no browser + tela "Assinar" no ERP que intermedia a comunicação.

**D3 — Certificados (ambiente homologação):**
- e-CPF Aleciana (Diretora Acadêmica) — token físico dela
- e-CPF Marcelo (Diretor Presidente) — token físico dele
- e-CNPJ FIC — **custodiante físico é o próprio Marcelo** (confirmado 08/04/2026: e-CNPJ vinculado ao CPF de Marcelo como representante legal da FIC)

**D4 — Priorização: Sprint 2 completa com extração Railway**
- Plano v2 longo, sem atalho/mock inline
- Seguir arquitetura aprovada: Tela 1 drag-drop → callback Railway → Tela 2 revisão com gate FIC 4 comprobatórios

**Why:** O caminho navegador+extensão garante que a chave privada nunca saia do token físico do signatário, responsabilidade legal inequívoca (assinatura é literalmente do dono do certificado), zero segredo gerenciado pelo servidor. Custo: UX mais complexa e dependência de extensão instalada.

**How to apply:**
- No Bloco 3 (rewrite cliente BRy), desenhar um fluxo híbrido: API `/api/diplomas/[id]/assinar/initialize` (server) → frontend chama extensão BRy via postMessage/SDK → API `/api/diplomas/[id]/assinar/finalize` (server)
- Precisamos investigar: a extensão BRy Signer expõe API JavaScript pra ser invocada do nosso frontend? Tem SDK oficial? Qual lib BRy usar?
- Tela "Assinar" precisa guiar o usuário: "Conecte seu token A3", "Selecione o certificado na extensão", "Aguarde a assinatura", etc.
- Marcelo e Aleciana precisarão instalar a extensão + ter tokens A3 prontos antes do primeiro teste hom
- e-CNPJ FIC: custodiante = Marcelo (mesma máquina dele precisa ter os DOIS tokens A3 conectados na hora de assinar o envelope final, ou assinar em dois momentos no mesmo browser)
