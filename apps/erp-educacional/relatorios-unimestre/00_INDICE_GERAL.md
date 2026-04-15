# Análise do Sistema Unimestre — Índice Geral

**Projeto:** ERP Educacional FIC — Diploma Digital
**Data da Análise:** 21 de março de 2026
**Método:** Extração e análise de ~889 frames de 5 vídeos de demonstração (~5 horas)
**Revisado por:** Buchecha (MiniMax M2.7) — Líder de codificação

---

## Objetivo

Mapear todas as funcionalidades, rotas e módulos do sistema Unimestre (ERP educacional utilizado pela FIC) para servir como **referência funcional** na construção do nosso próprio ERP Educacional. Este mapeamento NÃO é uma cópia — é uma análise de referência.

---

## Estrutura de Módulos (Validada por Buchecha)

| # | Módulo | Arquivo | Descrição |
|---|--------|---------|-----------|
| 1 | **Acadêmico** | `01_MODULO_ACADEMICO.md` | Cursos, turmas, disciplinas, grades, horários, documentação |
| 2 | **Financeiro** | `02_MODULO_FINANCEIRO.md` | Planos de pagamento, bolsas, negociação, tesouraria, recebimentos |
| 3 | **Matrículas** | `03_MODULO_MATRICULAS.md` | Inscrição, rematrícula, wizard 5 passos, planilha |
| 4 | **Captação** | `04_MODULO_CAPTACAO.md` | Pré-cadastro, jornada, contrato, integração Clicksign |
| 5 | **Pessoas** | `05_MODULO_PESSOAS.md` | Alunos, professores, colaboradores, cadastro, grupos |
| 6 | **Pedagógico** | `06_MODULO_PEDAGOGICO.md` | Provas, avaliações, desempenho, médias, diário de classe |
| 7 | **Relatórios** | `07_MODULO_RELATORIOS.md` | Relatórios, listagens, documentos, exportação PDF |
| 8 | **Administrativo** | `08_MODULO_ADMINISTRATIVO.md` | Logs, auditoria, notícias, ocorrências, arquivos |
| 9 | **Configurações** | `09_MODULO_CONFIGURACOES.md` | Permissões, grupos, menus, parâmetros do sistema |
| — | **Portais e Integrações** | `10_PORTAIS_E_INTEGRACOES.md` | Portal do Aluno, Portal do Professor, Clicksign, Google |

---

## Arquitetura Geral do Unimestre

### URLs Base Identificadas
- `faculdadesdigitais-unimestre.com/portais/c/ac/ac/`
- `facultadsdeapore.unimestresupeior.com/`

### Padrão de Rotas
```
/{ambiente}/{visibilidade}/{modulo}/{submodulo}/{acao}
```

### 3 Ambientes Principais
1. **Portal Administrativo** (`/projetos/portal_online/`) — Administradores
2. **Portal Acadêmico/Gestão** (`/gestao/publica/academico/`) — Secretaria, Professores, Coordenadores
3. **Portal do Aluno** (`/projetos/portal_online/`) — Alunos

### Integrações Externas
- **Clicksign** — Assinatura digital de documentos/contratos
- **Gmail** — Notificações e confirmações por email
- **Google Meet** — Videoconferências para aulas síncronas
- **Google Classroom** — Gerenciamento de aulas

### Funcionalidades Transversais (não são módulos)
- Assinatura Digital (Clicksign) → usado em Captação e Financeiro
- Portal do Aluno → interface/view do aluno que consome dados dos módulos
- Portal do Professor → interface/view do professor
- Prova Online → funcionalidade do módulo Pedagógico

---

## Stack Técnica Observada
- **Backend:** PHP (inferido pela extensão .php em URLs)
- **Frontend:** HTML5, CSS3, JavaScript (framework reativo — React ou Vue.js)
- **Tema:** Design responsivo com paleta roxo/púrpura principal
- **Protocolo:** HTTPS, RESTful
- **Autenticação:** Sessão/JWT com roles (admin, secretaria, professor, aluno)

---

## Dados do Diploma Digital Encontrados

O sistema já possui campos e documentos relacionados ao Diploma Digital:
1. **DIPLOMA DIGITAL** — Documento em formato digital
2. **HISTÓRICO DIGITAL FINAL** — Histórico escolar digital
3. **XML DIPLOMA DIGITAL** — Estrutura XML do diploma
4. **XML HISTÓRICO DIGITAL FINAL** — Histórico em XML
5. **XML DOCUMENTAÇÃO ACADÊMICA** — Documentação acadêmica completa em XML
6. **XML CURRÍCULO DIGITAL** — Currículo em XML
7. **PDF CURRÍCULO DIGITAL** — Representação visual em PDF

Parâmetros do sistema relacionados:
- `tecfy_curricula_digital_classe_jadols`
- `tecfy_diploma_digital_n_nipo_cert`
- `tecfy_diploma_digital_n_nipo_core`
- `tecfy_diploma_digital_n_nipo_part`

---

## Observação Importante

> **Diretriz Fundamental:** O Unimestre é APENAS REFERÊNCIA funcional. Toda a arquitetura, banco de dados e código do ERP FIC serão desenvolvidos DO ZERO pelo nosso time de IAs (Claude, Buchecha, DeepSeek, Qwen, Kimi, Codestral).

---

**Gerado em:** 21/03/2026 | **Revisão:** Buchecha (MiniMax M2.7)
