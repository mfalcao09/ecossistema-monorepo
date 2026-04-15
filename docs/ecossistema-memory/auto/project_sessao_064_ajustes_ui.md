---
name: Sessão 064 — 6 Ajustes UI FormularioRevisao
description: 6 ajustes no FormularioRevisao e Dialog: Dados do Processo simplificado, disciplinas agrupadas+editáveis, campos extras, estágio não-obrig., assinantes read-only, checkboxes XML/acervo no dialog
type: project
---

Sessão 064 (11/04/2026): 6 ajustes UI no FormularioRevisao e componentes relacionados. Commit `ea74208`, deploy READY 55s.

**Why:** Marcelo pediu simplificação e melhorias de UX após ver o formulário em produção.

**How to apply:**
- `DadosRevisao` agora tem `campos_extras?: Array<{chave: string; valor: string}>` para campos personalizados
- `TITULACAO_DOCENTE_OPTIONS` adicionado ao FormularioRevisao para select de titulação nas disciplinas
- `onConfirmar` no DialogVisualizarDocumento agora tem assinatura `(confirmacao, destinoXml, destinoAcervo)` — qualquer código que chame esse callback precisa dos 3 parâmetros
- `CardArquivoClassificacao` agora é somente leitura (sem checkboxes) — destinos são definidos no dialog
- Seção "Assinantes" não tem mais CRUD; assinantes vêm das configurações do módulo

**Pendências herdadas:**
- Formulário antigo (`/diploma/processos/[id]/page.tsx`) ainda não removido
- 61 disciplinas com docente_nome = NULL no processo b71cdb1b
- Auto-preenchimento Curso/Emissora/IES ainda pendente
