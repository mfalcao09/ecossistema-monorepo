---
name: Assinatura Digital em Documentos PDF
description: Decisão de design para assinatura digital nos documentos da FIC — modelo híbrido A+B + barra lateral
type: project
---

Documentos PDF da FIC (histórico, diploma, etc.) terão 3 elementos de assinatura digital:

1. **Barra lateral direita** (todas as páginas): Texto vertical rotacionado com URL de verificação, inspirado no modelo Registro de Imóveis. Ocupa a faixa entre a margem direita do conteúdo e a borda do timbrado.

2. **Box de assinatura ao final** (modelo dinâmico A/B):
   - Se couber na última página junto com conteúdo → modelo compacto inline (estilo UNOESTE)
   - Se não couber → empurra para página dedicada (estilo OAB/Protocolo)
   - Contém: QR Code, signatários (nome, CPF, cargo, tipo assinatura, data/hora), E-CNPJ da IES, código de verificação, URL pública

3. **Assinatura digital dos documentos é diferente da assinatura do diploma** — APIs diferentes dentro da BRy.

**Why:** Marcelo quer que todos os documentos emitidos pela IES tenham conferência e validação, com validade jurídica. Escolheu modelo híbrido após análise de 3 referências (UNOESTE, OAB, Registro de Imóveis).

**How to apply:** Prever seção de configuração de assinatura de documentos (similar à já existente para diplomas). O box atual é placeholder — será preenchido quando a integração de assinatura for implementada.
