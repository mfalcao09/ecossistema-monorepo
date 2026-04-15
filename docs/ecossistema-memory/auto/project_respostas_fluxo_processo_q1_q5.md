---
name: Respostas Q1-Q5 fluxo novo processo (08/04/2026)
description: Decisões finais de Marcelo sobre geração histórico-PDF, signatários, escopo sprint, documentos expedição e modo de aprovação
type: project
---

Decisões finais de Marcelo (08/04/2026) fechando o fluxo de criação do processo + expedição:

**Q1 — Geração do histórico-PDF:** SOB DEMANDA. Botão "Gerar PDF" disponível após geração do XML. Automático não ficaria funcional.

**Q2 — Signatários do histórico-PDF:** Secretária ESCOLHE entre as duas combinações na hora da expedição:
- Diretora Acadêmica + Diretor Presidente, OU
- Secretária + Diretora Acadêmica

**Q3 — Escopo da sprint atual:** Fluxo de criação do processo COM expedição do histórico-PDF incluída (template + campo de assinatura dentro deste fluxo). O módulo "Expedição de Documentos" amplo fica para depois — o histórico será amarrado a ele posteriormente.

**Q4 — Lista de documentos do módulo Expedição futuro:**
1. Declaração de matrícula
2. Atestado de frequência
3. Certificado de conclusão pré-diploma
4. Declaração para fins de estágio
5. Histórico parcial
6. Declaração de previsão de término do curso
7. Declaração de pagamentos anual
8. Declaração de quitação de débitos
9. Declaração de colação de grau

**Q5 — Modo de trabalho:** Escrever plano técnico COMPLETO e aguardar aprovação antes de tocar em código. Nada de implementação sem OK explícito.

**Why:** Fechar o escopo do fluxo de criação do processo antes de partir para implementação; garantir que o histórico tenha caminho próprio sem travar o diploma; e manter o princípio de que Marcelo aprova antes de codar.

**How to apply:** Na próxima sessão, apresentar plano técnico completo contemplando: (a) schema de banco com 3 destinos, (b) componente React da tela de revisão pós-extração, (c) gate FIC de 4 comprobatórios, (d) template do histórico-PDF com escolha de signatários, (e) botão "Gerar PDF do histórico" sob demanda, (f) stubs de arquitetura para o futuro módulo Expedição (sem implementar).
