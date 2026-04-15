---
name: FIC — Lista de comprobatórios obrigatórios para criar processo de diploma
description: Regra de negócio FIC (mais estrita que XSD): mínimo de 4 comprobatórios obrigatórios para criar processo, com regra de alternativa para certidões
type: project
---

Decisão de Marcelo em 07/04/2026 sobre regra de negócio FIC para validar criação de processo de diploma:

**Mínimo obrigatório (4 comprobatórios):**
1. **DocumentoIdentidadeDoAluno** = RG do aluno (sempre obrigatório)
2. **ProvaConclusaoEnsinoMedio** = Histórico escolar do Ensino Médio (sempre obrigatório)
3. **CertidaoNascimento OU CertidaoCasamento** = pelo menos UMA das duas (alternativa)
4. **TituloEleitor** = sempre obrigatório

**Comparação com XSD v1.05:**
- XSD exige apenas `minOccurs="1"` na `DocumentacaoComprobatoria` → mínimo absoluto = 1 documento qualquer
- Regra FIC é mais estrita: 4 documentos mínimos com tipos específicos
- Validação FIC vai BLOQUEAR a criação do processo até esses 4 estarem presentes
- Tipos NÃO listados acima (ProvaColacao, ComprovacaoEstagioCurricular, AtoNaturalizacao, Outros) são opcionais

**Why:** Marcelo escolheu a abordagem mais restritiva para garantir qualidade na origem do processo. Não basta o XSD ser válido — o processo da FIC tem padrão de qualidade próprio e o sistema deve forçá-lo.

**How to apply:**
- Criar lista configurável `COMPROBATORIOS_OBRIGATORIOS_FIC` (não cravar no código — outras IES podem ter regras diferentes no futuro)
- Implementar regra de "alternativa" entre CertidaoNascimento e CertidaoCasamento (1 dos 2 é suficiente)
- Validação visual progressiva: mostrar checklist com os 4 itens, marcar verde quando atendido, vermelho quando faltando
- Botão "Criar processo" desabilitado enquanto checklist não estiver completo
- Tooltip do botão lista os pendentes
- Salvar rascunho NÃO precisa atender essa regra
