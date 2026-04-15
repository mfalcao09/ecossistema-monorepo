---
name: Regra dos 3 destinos para arquivos do processo de diploma
description: Todo arquivo importado para extração FICA NO PROCESSO PARA SEMPRE; secretária marca por checkboxes destinos adicionais (XML, Acervo, ou só processo)
type: project
---

Decisão de Marcelo em 07/04/2026 sobre destinos dos arquivos uploadados na criação de processo:

**REGRA UNIVERSAL (não negociável):**
Todo documento importado para extração **PERMANECE NO PROCESSO PARA SEMPRE**. Mesmo os auxiliares. Mesmo os complementares. Mesmo os obrigatórios. Independente do que a secretária marcar como destino, o arquivo nunca sai do processo.

**3 categorias funcionais (não exclusivas — múltiplos destinos via checkbox):**

| Categoria | Destinos automáticos | Exemplo |
|-----------|---------------------|---------|
| **Comprobatórios obrigatórios** | XML do Diploma + Acervo Acadêmico + Processo | RG, Histórico do EM, Certidão de Nascimento, Título de Eleitor |
| **Complementares pessoais** | Acervo Acadêmico + Processo | Comprovante de endereço, foto 3x4, etc. (documentos pessoais que NÃO têm tipo XSD válido) |
| **Auxiliares de extração** | Apenas Processo | Arquivos enviados só para a IA extrair dados (lista de matérias, lista de professores, planilhas internas, etc.) |

**Mecanismo de UI:**
- Cada arquivo na tela de revisão pós-extração tem **checkboxes independentes** (não é dropdown único):
  - ☐ Comprobatório do XML (se marcado, exige escolha de tipo XSD válido)
  - ☐ Compor acervo acadêmico
  - ☑ Permanecer no processo (sempre marcado e desabilitado — não pode desmarcar)
- A secretária pode marcar múltiplos destinos para o mesmo arquivo
- Pré-sugestão IA marca automaticamente conforme o tipo detectado, mas a secretária pode ajustar

**Why:** Marcelo deixou claro: "todo documento importado para extração deve permanecer dentro do processo, sempre". Isso garante rastreabilidade total — auditoria pode sempre voltar ao processo e ver TUDO que foi enviado, mesmo o que não virou comprobatório oficial. Os checkboxes dão flexibilidade sem perder essa garantia.

**Acervo é organizado por CPF da pessoa (D4 confirmado):**
Os arquivos que vão pro acervo são linkados ao CPF do aluno, formando uma "ficha" digital com todos os documentos pessoais do aluno ao longo do tempo. Não é por lote nem por processo — é por pessoa.

**How to apply:**
- Schema do banco precisa de tabela de junção `processo_arquivos_destinos` (ou flags `destino_xml`, `destino_acervo`, `destino_processo`) — discutir migration depois
- Tabela `processo_arquivos` mantém os arquivos vinculados ao processo permanentemente (nunca soft-delete por mudança de classificação)
- Quando arquivo é marcado como acervo, criar registro paralelo em `acervo_documentos` linkado ao CPF do aluno + referência ao arquivo original em `processo_arquivos`
- Validação do botão "Criar processo": exigir os 4 comprobatórios obrigatórios FIC (tipos específicos), permitir N complementares e N auxiliares
