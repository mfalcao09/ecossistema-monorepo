---
name: Dados sempre do XML
description: Regra máxima do Diploma Digital — dados exibidos devem vir SEMPRE do XML, nunca de informações presumidas ou inseridas manualmente no banco
type: feedback
---

Dados exibidos no sistema de diploma digital devem vir SEMPRE do XML do diploma e nunca de informações que nós inserimos/presumimos no banco de dados. O banco de dados deve ser SEMPRE alimentado pelo XML. Cada XML é um caso e os dados daquele caso estarão no próprio XML.

**Why:** Marcelo definiu isso como regra máxima do sistema. Dados presumidos (como "provavelmente Noturno" ou "provavelmente Cassilândia") NÃO devem ser inseridos no banco. Apenas dados extraídos diretamente do XML são confiáveis.

**How to apply:** Nunca sugerir preenchimento manual de campos que "provavelmente" teriam determinado valor. Se um campo não existe no XML, ele fica NULL no banco — e o sistema deve lidar com isso. Sempre verificar a estrutura real do XML antes de afirmar que um dado não existe.
