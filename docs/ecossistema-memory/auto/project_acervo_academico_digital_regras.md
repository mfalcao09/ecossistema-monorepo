---
name: Acervo Acadêmico Digital — regras complementares ao XSD
description: O acervo acadêmico digital tem regras próprias (Portarias MEC 360/2022 e 613/2022 + Decreto 10.278/2020) distintas dos comprobatórios do Diploma Digital
type: project
---

O ERP FIC já tem módulo Acervo (`src/types/acervo.ts`, `src/app/(erp)/acervo/`). Ele segue regras complementares ao XSD do Diploma Digital:

**Base regulatória:**
- Portaria MEC 360/2022
- Portaria MEC 613/2022
- Decreto 10.278/2020 (digitalização de documentos públicos/privados, Anexo II)

**Diferenças-chave do Acervo vs Comprobatórios:**

| Aspecto | Comprobatórios (XSD) | Acervo Acadêmico Digital |
|---------|----------------------|--------------------------|
| Onde vivem | Embarcados no XML do Diploma (base64 PDF/A) | Documentos independentes no Supabase Storage |
| Origem | Sempre digitalizados | Pode ser **nato_digital** OU **digitalizado** |
| Metadata | Só `tipo` + `observacoes` | Anexo II do Dec 10.278: data digitalização, local, responsável (nome+CPF+cargo), equipamento, DPI, software, formato original, número doc original, data doc original |
| Organização | Por processo de diploma | Por **lotes** (`AcervoLote`) com período de referência |
| Status | Não tem | `rascunho`, `em_andamento`, `aguardando_assinatura`, `assinando`, `concluido`, `com_erros` |
| Acesso externo | Só via XML registrado | Token MEC (`AcervoMecToken` + `AcervoMecLog`) para auditoria |
| Templates | Não tem | `AcervoTemplate` para emissão de documentos nato-digitais |

**Prazos MEC (todos já vencidos em 2026-04):**
- Alunos atualmente matriculados → 18/05/2023 (vencido)
- Formados 2016-2022 → 18/05/2024 (vencido)
- Formados 2001-2015 → 18/05/2025 (vencido)

**Why:** Marcelo levantou na sessão 023 (07/04/2026) que precisamos entender o que vai pro acervo acadêmico digital, e que o acervo tem diretrizes COMPLEMENTARES ao XSD. Os arquivos auxiliares de um processo de diploma (que NÃO viram comprobatórios) podem precisar ir pro acervo se forem documentos acadêmicos do aluno.

**How to apply:** Ao implementar o fluxo de classificação de arquivos no novo processo, prever 3 destinos (não só 2):
1. **Comprobatório** → embarcado no XML do Diploma (PDF/A base64)
2. **Acervo acadêmico** → vai pro módulo Acervo com metadata Decreto 10.278
3. **Auxiliar** → fica só no processo, não vai pra lugar nenhum oficial

Antes de codar, decidir com Marcelo quais tipos de documento devem alimentar automaticamente o acervo (ex: histórico escolar do EM digitalizado deveria ir pro acervo + ser comprobatório do XML).
