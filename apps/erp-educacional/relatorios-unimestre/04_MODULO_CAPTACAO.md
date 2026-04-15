# Módulo de Captação de Alunos — Análise Unimestre

**Módulo:** Captação
**Rotas Base:** `/captacao/publica/v2/*`, `/captacao/publica/admin/*`
**Prioridade:** Média

---

## 1. Visão Geral

O módulo de captação gerencia o funil de entrada de novos alunos, desde o pré-cadastro online até a assinatura do contrato de prestação de serviços via Clicksign. É o ponto de entrada do aluno no sistema.

---

## 2. Submódulos Identificados

### 2.1 Pré-Cadastro (Público)
**Rota:** `/captacao/publica/v2/pre-cadastro/TQd_oferta=16`

**Formulário de Pré-Cadastro:**
- **Nome Completo** (obrigatório) — texto, validação
- **E-mail** (obrigatório) — email com validação
- **CPF** (obrigatório) — numérico, 11 dígitos, algoritmo mod11

**Validações observadas:**
- E-mail deve ser único no sistema
- CPF deve ser válido
- Nome deve conter pelo menos 2 palavras

**Botão:** ENVIAR (azul escuro)
**Resultado:** "Minhas Inscrições" com status de envio

**Navegação:**
- Botão: "VOLTAR PARA PÁGINA INICIAL" (vermelho)

---

### 2.2 Jornada de Inscrição (Admin)
**Rota:** `/captacao/publica/admin/jornada/incluir-alterar-jornada`

**Funcionalidades:**
- Configuração das etapas da jornada de inscrição
- Definição de documentos obrigatórios
- Configuração de contratos

---

### 2.3 Contrato de Prestação de Serviços
**Rota:** `/captacao/publica/admin/jornada/incluir-alterar-jornada` (modal)

**Modal "Documento de Serviços":**
- Título: "Contrato de Prestação de Serviços"
- Aviso: documentos cadastrados no gestão online do tipo "Contratos e documentos para matrícula"

**Seção 1 — Contrato:**
- Obrigatório o aceite para continuar (checkbox)
- Habilitar assinatura via Clicksign (checkbox)
- Ambiente do Clicksign (configuração)

**Seção 2 — Produção:**
- Habilitar assinatura via Autentique (checkbox alternativa)

**Botões:** CONFIRMAR (verde), CANCELAR (cinza)

---

### 2.4 Assinatura Digital (via Clicksign)

**Modal "Aceite de documento":**
- Checkmark verde de sucesso
- Mensagem: "Assinatura feita com sucesso!"
- Sub-mensagem: "Quando todos assinarem, você receberá um e-mail com o documento assinado."
- Badge: "Ambiente seguro Clicksign"

**Botões:** ← Voltar | Avançar →

**Confirmação por Email (Gmail):**
- Assunto: "Documento assinado e finalizado"
- Documento PDF anexado (ex: `100917_MARILIA_LUCHTENBERG_9T_2026.1_693b0b1296ba3.pdf`)
- Lista de assinaturas realizadas
- Link para Clicksign para gerenciar documentos

---

## 3. Fluxo de Negócio

```
1. Candidato acessa portal de captação
   ↓
2. Preenche pré-cadastro (nome, e-mail, CPF)
   ↓
3. Sistema valida dados
   ↓
4. Recebe confirmação por e-mail
   ↓
5. Admin configura jornada (documentos, contrato)
   ↓
6. Sistema gera contrato de matrícula
   ↓
7. Integração Clicksign para assinatura
   ↓
8. Candidato recebe link de assinatura por e-mail
   ↓
9. Assinatura realizada no ambiente Clicksign
   ↓
10. Sistema recebe webhook de confirmação
   ↓
11. E-mail de confirmação com PDF assinado anexado
   ↓
12. Integração com módulo de Matrículas
```

---

## 4. Integrações

| Integração | Uso |
|-----------|-----|
| **Clicksign** | Assinatura digital de contratos |
| **Autentique** | Alternativa para assinatura (disponível mas não ativa) |
| **Gmail** | Notificação de assinatura concluída |

---

## 5. Rotas Consolidadas

| Rota | Descrição |
|------|-----------|
| `/captacao/publica/v2/pre-cadastro/` | Formulário de pré-cadastro |
| `/captacao/publica/admin/jornada/incluir-alterar-jornada` | Configuração da jornada |

---

## 6. Relevância para o ERP FIC

**Média relevância para Diploma Digital:** O módulo de captação não impacta diretamente o Diploma Digital, mas é importante para o ERP completo como ponto de entrada do aluno. Os dados coletados aqui (nome, CPF, email) são reutilizados em todo o sistema.

---

**Gerado em:** 21/03/2026 | **Fonte:** Vídeo 5
