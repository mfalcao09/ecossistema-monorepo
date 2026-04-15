---
name: FIC é apenas emissora — registradora vem do XML
description: A FIC atua somente como IES Emissora. A Registradora (historicamente UFMS/694) pode mudar e NUNCA deve ser presumida — o dado vem do diploma registrado.
type: project
---

FIC (código MEC 1606) atua APENAS como IES Emissora no fluxo de diploma digital. A IES Registradora historicamente é a UFMS (código MEC 694), mas isso não é regra absoluta — pode ser alterada.

**Why:** Marcelo definiu que a identidade da registradora não deve ser hardcoded ou presumida. Alinha-se com a REGRA MÁXIMA: dados devem vir sempre do XML/fonte autoritativa, nunca de presunções.

**How to apply:** Ao gerar código de validação, montar XML ou qualquer lógica que envolva a registradora, SEMPRE buscar o dado da registradora dinamicamente (do diploma registrado ou configuração explícita), nunca assumir UFMS. O pipeline do SaaS da FIC para na Fase 3 (Trânsito) — a Fase 4+ é responsabilidade da Registradora.
