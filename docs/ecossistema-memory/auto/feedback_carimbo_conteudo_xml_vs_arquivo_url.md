---
name: carimbo_conteudo_xml_vs_arquivo_url
description: carimbo_tempo deve usar arquivo_url (XML assinado), NUNCA conteudo_xml (XML original não assinado)
type: feedback
---

🚨 Em `xml_gerados`: `conteudo_xml` é o XML ORIGINAL não assinado. `arquivo_url` aponta para o XML ASSINADO no storage (atualizado após finalize).

O carimbo do tempo DEVE ser aplicado sobre o XML assinado → SEMPRE priorizar `arquivo_url`.

**Por que:** Bug crítico descoberto na sessão 082 — carimbo aplicado sobre XML sem assinatura resultaria em pacote inválido para a registradora.

**Como aplicar:** Em qualquer rota que calcule hash ou aplique carimbo sobre XML: buscar conteúdo via `fetch(xml.arquivo_url)`, com fallback para `conteudo_xml` apenas quando `arquivo_url` ainda não existir (pré-finalize). Ver `carimbo/route.ts` e `carimbo-pipeline.ts`.
