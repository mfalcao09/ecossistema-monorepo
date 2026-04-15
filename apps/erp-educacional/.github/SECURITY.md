# Security Policy

## Diploma Digital — Faculdades Integradas de Cassilândia (FIC)

**Versão:** 1.0
**Data:** 26 de março de 2026
**Contato de Segurança:** Marcelo Silva (mrcelooo@gmail.com)

---

## 1. Versões Suportadas

| Versão | Branch | Status | Suporte até |
|--------|--------|--------|-------------|
| main | main | ✅ Ativa | Contínuo |
| develop | develop | 🔄 Desenvolvimento | Contínuo |
| v1.0.x | releases/v1.0 | ⚠️ LTS (após v1.0 release) | +12 meses |
| v0.x | releases/v0 | ❌ EOL | Fim de suporte |

**Política de Suporte:**
- **main:** Recebe patches de segurança imediatamente
- **develop:** Recebe patches de segurança em PR
- **LTS (quando aplicável):** 12 meses de suporte pós-release
- **EOL:** Sem suporte; upgrade recomendado

---

## 2. Relatando uma Vulnerabilidade

### 2.1 Não Publique Vulnerabilidades Publicamente

**⚠️ IMPORTANTE:** Se você descobrir uma vulnerabilidade, **NÃO** a reporte em:
- Issues públicas no GitHub
- Fóruns ou discussões
- Redes sociais
- E-mail público

Isso pode permitir que atacantes explorem a vulnerabilidade antes de correção.

### 2.2 Processo de Relatório Confidencial

**Opção 1: GitHub Security Advisory (Recomendado)**

1. Vá ao repo diploma-digital
2. Clique em **Security** tab
3. Clique em **Report a vulnerability** (canto inferior direito)
4. Preencha o formulário:
   - **Title:** Descrição breve da vuln
   - **Description:** Detalhes técnicos
   - **Severity:** CVSS v3.1 score
   - **Proof of Concept:** Passos reproduzir
5. Clique **Draft security advisory**
6. GitHub enviará notificação automática para Marcelo Silva

**GitHub criará um repositório privado para correção e discussão.**

**Opção 2: E-mail Direto (Se GitHub não disponível)**

Envie e-mail para: **mrcelooo@gmail.com**

Assunto: `[SECURITY] Vulnerability Report — Diploma Digital`

Conteúdo:
```
---
Vulnerability Title: [descrição breve]
Severity: [CRITICAL / HIGH / MEDIUM / LOW]
Affected Component: [ex: Portal Público, API, Banco de Dados]
Affected Versions: [ex: main, v1.0.0]
---

## Description
[Descrição detalhada]

## Proof of Concept
[Passos para reproduzir]

## Impact
[Qual é o impacto? Quem é afetado?]

## Remediation
[Sugestão de fix, se tiver]

## Timeline
Descoberta: [data]
Reportada: [hoje]
---
```

### 2.3 Tempo de Resposta

| Severidade | Tempo de Resposta | Prazo de Fix |
|-----------|------------------|-------------|
| **CRITICAL** | 1 hora | 24-48 horas |
| **HIGH** | 4 horas | 7 dias |
| **MEDIUM** | 24 horas | 30 dias |
| **LOW** | 72 horas | 90 dias |

**Definições de Severidade:**

- **CRITICAL:** Acesso não autorizado a dados pessoais, RCE, autenticação bypass
- **HIGH:** Vulnerabilidade confirmada com impacto claro (SQLi, XSS, CSRF)
- **MEDIUM:** Vulnerabilidade com mitigação existente ou impacto limitado
- **LOW:** Teórica, requer configuração especial, ou baixo impacto

### 2.4 Processo de Correção

**Fluxo:**

```
1. Receber relatório (GitHub ou e-mail)
   ↓
2. Confirmar e classificar severidade
   ↓
3. Criar branch privado em draft advisory
   ↓
4. Desenvolvimento de fix (sem commits públicos)
   ↓
5. Code review por outro dev
   ↓
6. Teste em staging
   ↓
7. Publicar patch em main/release
   ↓
8. Publicar advisory no GitHub
   ↓
9. Notificar reporter
```

**Exemplo de Commit de Fix:**

```bash
# Commit message (descriptivo mas sem revelar exploração)
git commit -m "sec(CRITICAL): Fix SQL injection in search endpoint

Fixes #[secret-issue-number]

This patch addresses a validation bypass in the search parameter
handling. Users should upgrade immediately.

Co-authored-by: Reporter Name <reporter@example.com>"
```

### 2.5 Divulgação Coordenada

**Após correção estar em main:**

1. GitHub Security Advisory é publicado automaticamente
2. CVE é requisitado (se aplicável)
3. Notificação a:
   - Dependabot users (automatic)
   - GitHub Security alerts (automatic)
   - Reporter (manual e-mail)
   - Stakeholders internos (manual)

**Exemplo de Post no Advisory:**

```
## Summary
[Descrição clara para não-técnicos]

## Affected Versions
- [list]

## Patched Versions
- main (branch)
- v1.0.1 (release tag)

## Workarounds
If you cannot upgrade immediately:
- [Workaround 1]
- [Workaround 2]

## Credits
Reported by: [Reporter Name] (coordinated disclosure)

## References
- PR: #[number]
- Commit: [hash]
```

---

## 3. Certificados e Chaves Digitais

### 3.1 Segurança de Certificados A3

O Diploma Digital da FIC usa certificados digitais A3 (física + chip) para assinatura XAdES de documentos.

**Proteções:**

- Chaves privadas são armazenadas em:
  - Cloudflare Workers KV (secrets)
  - Supabase Vault (secrets criptografados)
  - Nunca em repositório Git
  - Nunca em logs

- Certificados são:
  - Registrados em ICP-Brasil
  - Renovados 30 dias antes de vencer
  - Monitoriados por alerts
  - Revogados imediatamente se comprometidos

### 3.2 Reportar Comprometimento de Certificado

Se você suspeitar que um certificado A3 foi comprometido:

1. **Notificar Marcelo Silva imediatamente** (paging 24/7)
2. GitHub Security Advisory com "CRITICAL" label
3. Não publicar em issues públicas

Procedimento de Revogação:
```
1. ICP-Brasil: https://www3.iti.gov.br/
2. Gerenciador de Certificados
3. Buscar por serial
4. Clicar "Revogar"
5. Razão: "Comprometimento de chave privada"
6. Propagação: 24-48 horas
```

---

## 4. Dependências e Vulnerable Packages

### 4.1 Scanning Automático

**Dependabot** verifica vulnerabilidades:
- **Frequência:** Weekly (Mondays 06:00 UTC-3)
- **Severidade:** Todas as severidades
- **PRs automáticas:** Sim, agrupadas por tipo

**GitHub Security:** Verifica segredos e padrões:
- **Secret scanning:** Contínuo
- **Push protection:** Ativo (bloqueia commits com secrets)

### 4.2 Vulnerabilidades Conhecidas

Se você encontrar uma vulnerabilidade em uma dependência:

1. **npm audit** mostrar alert:
   ```bash
   npm audit
   # Mostra CVE se houver
   ```

2. **Reportar:**
   - Se vulnerabilidade no npm: Report ao npm diretamente
   - Se vulnerabilidade em nosso código: Use Security Advisory

3. **Upgrade:**
   - Patch updates: Merge automático (recomendado)
   - Minor/major: Code review antes de merge

### 4.3 Vulnerabilidades Críticas

Se npm audit mostrar CRITICAL:

```bash
# 1. Verificar o que é crítico
npm audit --audit-level=critical

# 2. Tentar upgrade automático
npm audit fix

# 3. Se não funcionar, upgrade manual
npm update [package-name]

# 4. Se quebrar, reportar como compat issue
```

**Processo para CRITICAL:**

```
1. Notificar time technical de imediato
2. Verificar se há compat issue
3. Se houver, escalar para dev lead
4. Fix é P1 (máxima prioridade)
5. Deploy em hotfix branch
```

---

## 5. Configurações de Segurança Recomendadas

### 5.1 Branch Protection

Repository deve ter as seguintes proteções ativadas:

```
Settings > Branches > Branch protection rules

Para "main":
✅ Require a pull request before merging
   └─ Require approvals: 1 (mínimo)
   └─ Dismiss stale pull request approvals
   └─ Require status checks to pass
   └─ Require branches to be up to date
✅ Include administrators
✅ Restrict who can push
✅ Allow force pushes: NÃO
✅ Allow deletions: NÃO
✅ Require code scanning: SIM
```

### 5.2 GitHub Actions

Todas as workflows devem:
- ✅ Usar ações de fontes confiáveis
- ✅ Especificar versions exatas (não `@latest`)
- ✅ Evitar secrets em logs
- ✅ Usar trusted runners

Exemplo seguro:
```yaml
- uses: actions/checkout@v4  # Exato, não latest
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

Inseguro:
```yaml
- uses: some-org/some-action@latest  # ❌ Pode mudar
- run: echo ${{ secrets.TOKEN }}     # ❌ Expõe em logs
```

### 5.3 Secrets Management

Nenhum secret (chaves API, tokens, senhas) deve estar em:
- ❌ Repositório Git
- ❌ Commits
- ❌ PRs ou comments
- ❌ Logs públicos
- ❌ Issues ou discussions

**Local correto para secrets:**

```
GitHub:
  └─ Settings > Secrets and variables > Actions
       └─ [CLOUDFLARE_API_TOKEN]
       └─ [SUPABASE_SERVICE_ROLE_KEY]
       └─ [BRY_API_KEY]

Vercel:
  └─ Project Settings > Environment Variables
       └─ [.env.production.local]

Supabase:
  └─ Project Settings > API Keys
       └─ Service Role Key (confidencial)
```

---

## 6. OWASP Top 10 Proteções

Este projeto implementa proteções contra as 10 vulnerabilidades mais comuns:

| OWASP | Proteção | Implementação |
|-------|----------|---|
| A01: Broken Access Control | RLS no Supabase, validação de permissão em APIs | Ativo ✅ |
| A02: Cryptographic Failures | TLS 1.3, cifra de dados em repouso, backup criptografado | Ativo ✅ |
| A03: Injection | Parameterized queries, input validation com Zod, XSS filters | Ativo ✅ |
| A04: Insecure Design | Threat modeling, security requirements em design | Em progresso |
| A05: Security Misconfiguration | WAF Cloudflare, CSP headers, security headers | Ativo ✅ |
| A06: Vulnerable & Outdated Components | Dependabot, npm audit, OWASP ZAP scanning | Ativo ✅ |
| A07: Authentication Failures | MFA, rate limiting, session management seguro | Ativo ✅ |
| A08: Software & Data Integrity | Assinatura XAdES, integridade de XMLs, hash verification | Ativo ✅ |
| A09: Logging & Monitoring | Security logger, WAF logs, Vercel analytics | Ativo ✅ |
| A10: SSRF Protection | Validação de URL, whitelist de endpoints, firewall | Ativo ✅ |

---

## 7. Checklist de Code Review de Segurança

Antes de mergear qualquer PR, reviewers devem verificar:

```markdown
## Security Checklist

- [ ] Nenhum secret foi commitado?
- [ ] Input foi validado com Zod ou equivalente?
- [ ] Output foi escapado (XSS protection)?
- [ ] Queries SQL foram parametrizadas?
- [ ] RLS rules estão aplicadas?
- [ ] Autenticação foi verificada?
- [ ] Rate limiting está ativo se API?
- [ ] Logging foi adicionado para ações sensíveis?
- [ ] Nenhuma performance regression?
- [ ] Testes cobrem casos de segurança?
- [ ] Documentação foi atualizada?
- [ ] LGPD compliance foi verificado?
```

**Template de Comment:**

```
## Security Review ✅

Revisei a PR quanto a:
- ✅ Input validation (Zod)
- ✅ SQL injection (parameterized)
- ✅ XSS (output escaping)
- ✅ RLS (permissões)
- ✅ Secrets (nenhum exposto)

Approved for merge.
```

---

## 8. Incidentes Passados

Documentação de incidentes anteriores ajuda a aprender:

| Data | Título | Severidade | Status |
|------|--------|-----------|--------|
| [Nenhum reportado] | - | - | ✅ Seguro |

Quando incidentes ocorrem, eles são documentados em:
- `docs/POLITICA-RESPOSTA-INCIDENTES.md` (full details)
- Público: GitHub Security Advisories (redacted)

---

## 9. Conformidade Regulatória

Este projeto está em conformidade com:

- ✅ **LGPD (Lei 13.709/2018):** Proteção de dados pessoais, notificação de incidentes
- ✅ **Portaria MEC 554/2019:** Diploma digital seguro
- ✅ **ICP-Brasil:** Certificados digitais, assinatura eletrônica
- ✅ **OWASP Top 10 (2021):** Proteção contra vulnerabilidades web
- ✅ **ISO 27035:** Incident management

Para detalhes, veja `docs/LGPD-INDEX.md` e `docs/POLITICA-RESPOSTA-INCIDENTES.md`.

---

## 10. Contatos de Segurança

| Papel | Contato | E-mail | Disponibilidade |
|-------|---------|--------|-----------------|
| **DPO (Data Protection Officer)** | Marcelo Silva | mrcelooo@gmail.com | 24/7 (aviso) |
| **Security Lead** | TBD | TBD | Horário comercial |
| **Incident Commander** | Buchecha | TBD | 24/7 (P1 only) |

---

## 11. Agradecimentos

Agradecemos a todos que ajudam a manter o Diploma Digital seguro por reportarem vulnerabilidades responsavelmente.

**Pesquisadores de Segurança Responsáveis:**
- (Quando houver, adicionar nomes aqui)

---

## 12. Revisão e Atualização

Esta política é revisada:
- **Semestralmente:** 26 de setembro de 2026
- **Ad-hoc:** Após incidente ou mudança regulatória

Última atualização: 26 de março de 2026
Próxima revisão: 26 de setembro de 2026

---

**Documento:** SECURITY.md
**Classificação:** Público (para segurança responsável)
**Repositório:** diploma-digital (GitHub)
