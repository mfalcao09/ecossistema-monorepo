---
name: Pendência — Distinção assinatura eletrônica BRy vs assinatura digital ICP-Brasil
description: Marcelo levantou em 07/04/2026 que existe distinção entre "assinatura eletrônica BRy" (para documentos da IES como histórico) e "assinatura digital ICP-Brasil" (para Diploma Digital MEC). Não há documentação no projeto sobre essa distinção — pendência de definição.
type: project
---

Em 07/04/2026 (sessão 023), Marcelo perguntou sobre a inserção da emissão de **histórico escolar como documento digital** no fluxo de criação de processo, mencionando que usaria **assinatura eletrônica BRy** — explicitamente diferente da assinatura digital ICP-Brasil usada no Diploma Digital MEC.

**O que existe documentado no projeto (07/04/2026):**
- `docs/bry-api-referencia-tecnica.md` cobre BRy HUB Signer v3.5.1-RC2 mas só fala da assinatura **digital** XAdES AD-RA com certificado ICP-Brasil A3 (para os 3 XMLs do Diploma).
- `PLANO-HISTORICO-ESCOLAR.md` menciona que o histórico do XML é assinado JUNTO com o diploma (mesmo lote BRy, ICP-Brasil) — mas não trata o histórico como documento digital independente da IES.
- O módulo Acervo (`src/types/acervo.ts`) tem status `aguardando_assinatura`/`assinando` mas o type não distingue qual padrão de assinatura usa.
- NÃO há documentação no projeto sobre BRy oferecendo assinatura **eletrônica avançada/simples** (Lei 14.063/2020) como serviço separado.

**Conhecimento de domínio (Lei 14.063/2020 — fora do projeto):**
- Assinatura eletrônica **simples** → comprovação de autoria sem certificado ICP
- Assinatura eletrônica **avançada** → certificado não-ICP qualificado
- Assinatura eletrônica **qualificada** = assinatura **digital** ICP-Brasil
- BRy oferece todos os 3 níveis via HUB Signer.

**Hipótese de trabalho (PRECISA CONFIRMAR COM MARCELO):**
- **Diploma Digital (3 XMLs MEC)** → assinatura digital ICP-Brasil A3 via BRy (já documentado)
- **Histórico escolar como documento independente da IES** (PDF emitido no dia a dia, fora do pacote do Diploma) → assinatura eletrônica avançada BRy
- **Demais documentos da IES** (declarações, atestados, certificados) → assinatura eletrônica BRy
- O mesmo histórico pode existir em DUAS formas:
  1. XML embarcado no pacote do Diploma → assinado digitalmente ICP
  2. PDF expedido pela secretaria → assinado eletronicamente BRy

**Why:** Marcelo perguntou onde inserir a expedição do histórico digital (com assinatura eletrônica BRy) no fluxo do novo processo. Ele explicitou que é DIFERENTE da assinatura ICP do Diploma. Eu não encontrei documentação prévia desse fluxo no projeto e não posso assumir como funciona.

**How to apply:** Antes de escrever qualquer linha de código sobre histórico escolar como documento digital, perguntar a Marcelo:
1. O histórico expedido com assinatura eletrônica BRy é INDEPENDENTE do XML do Diploma, ou é a mesma coisa em formatos diferentes?
2. Em que momento do fluxo a secretária expede esse histórico — durante a criação do processo, depois, ou em paralelo?
3. Quem assina (cargo/pessoa)?
4. Esse histórico vai para o Acervo Acadêmico Digital (Decreto 10.278)?
5. Há expedição de OUTROS documentos da IES com assinatura eletrônica BRy (declarações, atestados)? Se sim, é o módulo "Expedição de Documentos" mencionado por ele?

Não inventar o fluxo — esperar definição.
