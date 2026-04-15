# Política de Resposta a Incidentes de Segurança

## Diploma Digital — Faculdades Integradas de Cassilândia (FIC)

**Versão:** 1.0
**Data de Publicação:** 26 de março de 2026
**Data de Vigência:** 26 de março de 2026 até revisão
**Próxima Revisão:** 26 de setembro de 2026 (semestral)
**Aprovado por:** Marcelo Silva (Proprietário/DPO)

---

## 1. Objetivo e Escopo

### 1.1 Objetivo

Esta política estabelece o framework de resposta a incidentes de segurança da informação do Sistema de Diploma Digital da FIC. O objetivo é:

- Detectar e responder rapidamente a incidentes de segurança
- Minimizar o impacto de violações de dados e comprometimentos
- Garantir conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018)
- Proteger dados pessoais de diplomados, alunos, servidores e terceiros
- Manter a integridade, confidencialidade e disponibilidade dos sistemas
- Cumprimento das Portarias MEC 554/2019 e MEC 70/2025 para certificação de diploma digital

### 1.2 Escopo

Esta política aplica-se a **todos** os sistemas, dados e processos relacionados ao Diploma Digital da FIC, incluindo:

| Sistema/Componente | Responsabilidade |
|--------------------|-----------------|
| **Painel Administrativo (Web)** | Interface de cadastro de diplomas, gestão de usuários, emissão de certificados |
| **Portal Público (HTTPS)** | Consulta pública de diplomas, verificação de autenticidade |
| **APIs de Backend** | APIs REST para geração XML, assinatura digital, consulta de dados |
| **Banco de Dados PostgreSQL** | Armazenamento de dados pessoais, históricos escolares, metadados de diplomas |
| **Repositório de Documentos** | Armazenamento de XMLs assinados, RVDD (Representações Visuais), PDFs cifrados |
| **Sistema de Assinatura Digital** | Integração com APIs terceiras (BRy, Certisign, Soluti) para XAdES |
| **Certificados Digitais A3** | Armazenamento seguro de chaves privadas (ICP-Brasil) |
| **Infraestrutura Cloudflare** | WAF, rate limiting, DDoS protection, caching |
| **Infraestrutura Vercel** | Hospedagem de frontend e edge functions |
| **Supabase** | Hospedagem PostgreSQL, RLS (Row-Level Security), backups criptografados |

### 1.3 Conformidade Regulatória

Esta política garante conformidade com:

- **LGPD (Lei 13.709/2018):** Proteção de dados pessoais, notificação de incidentes (Art. 46-50)
- **Portaria MEC 554/2019:** Requisitos mínimos para diploma digital
- **Portaria MEC 70/2025:** Ampliação de prazos e novos requisitos de segurança
- **IN SESU/MEC 1/2020 e 2/2021:** Requisitos técnicos obrigatórios para emissão de diploma digital
- **ICP-Brasil:** Normas de certificação digital e assinatura eletrônica
- **OWASP Top 10:** Proteção contra vulnerabilidades web comuns
- **ISO 27035:** Incident management best practices

---

## 2. Definições

### 2.1 Incidente de Segurança

Um incidente de segurança é qualquer evento não planejado ou ação não autorizada que:

- Compromete a confidencialidade, integridade ou disponibilidade de informações
- Viola políticas de segurança da FIC ou requisitos regulatórios
- Pode resultar em acesso não autorizado a dados pessoais ou sistemas
- Impacta a operação normal dos serviços de diploma digital

**Exemplos de Incidentes:**
- Acesso não autorizado ao banco de dados
- Vazamento de dados pessoais de alunos ou servidores
- Comprometimento de chaves privadas de certificados digitais
- Falha de autenticação em massa
- Ataque de negação de serviço (DDoS) contra portais
- Modificação não autorizada de registros de diploma
- Injeção SQL ou XSS em formulários
- Descoberta de vulnerability em dependências npm/Python

### 2.2 Violação de Dados Pessoais (LGPD)

Conforme LGPD Art. 46, é qualquer acesso, transmissão, alteração ou destruição não autorizada de dados pessoais que:

- Afete um ou mais titulares de dados (alunos, diplomados, servidores)
- Inclua dados sensíveis: documentos pessoais (CPF, RG), informações acadêmicas, endereços, contatos
- Estejam em repouso (banco de dados) ou em trânsito (APIs, e-mail)

**Requisitos LGPD aplicáveis:**
- Art. 46: Comunicação à ANPD em caso de violação de segurança
- Art. 47: Comunicação ao titular de dados afetado
- Art. 48: Prazo máximo de 72 horas para notificação
- Art. 49: Investigação e relatório de impacto

### 2.3 Níveis de Severidade

| Nível | Classificação | SLA de Resposta | SLA de Resolução | Exemplos |
|-------|---------------|-----------------|------------------|----------|
| **P1** | **Crítico** | 1 hora | 4 horas | Vazamento de dados pessoais em massa; Comprometimento de chaves privadas; Indisponibilidade total de portal |
| **P2** | **Alto** | 4 horas | 24 horas | Falha de autenticação em mass; DDoS em andamento; SQL injection confirmada; Acesso não autorizado a dados de 1+ alunos |
| **P3** | **Médio** | 24 horas | 72 horas | Tentativa de acesso não autorizado bloqueada; Anomalia em logs; Rate limiting excedido; Certificado próximo de vencer |
| **P4** | **Baixo** | 72 horas | 7 dias | npm audit warning; Certificado com 6+ meses até vencer; Relatório de vulnerabilidade teórica; Erro de validação menor |

**Critérios de Classificação:**
- **Tipo de dados:** Dados pessoais = gravidade maior que logs técnicos
- **Número de afetados:** 1+ alunos = P2+; 100+ = P1
- **Disponibilidade:** Sistema indisponível = P1/P2
- **Conformidade:** Violação LGPD = P1/P2
- **Reversibilidade:** Dano irreversível = P1

---

## 3. Classificação de Incidentes

### 3.1 P1 — Incidente Crítico

**Critérios:**
- Vazamento confirmado de dados pessoais (LGPD Art. 46 ativado)
- Comprometimento de certificado digital A3 ou chaves privadas
- Indisponibilidade total do portal público ou painel administrativo (>1 hora)
- Modificação não autorizada de registros de diploma
- Acesso não autorizado generalizado ao banco de dados

**Exemplos Específicos:**
- Arquivo ZIP de XMLs com dados privados é baixado via exploit
- Chave privada do certificado A3 é exposta em arquivo de configuração no GitHub
- Servidor PostgreSQL fica offline por causa de ataque (disk full + exploração)
- Aluno consegue alterar notas/histórico via IDOR (Insecure Direct Object Reference)
- Portal público sofre SQL injection que expõe 500+ registros de alunos

**Resposta Imediata (0-1 hora):**
- Ativar equipe de resposta completa (24/7)
- Isolar sistemas afetados ou bloquear acesso via Cloudflare WAF
- Confirmar escopo do incidente
- Iniciar comunicação interna com DPO (Marcelo Silva)

### 3.2 P2 — Incidente Alto

**Critérios:**
- Falha de autenticação afetando múltiplos usuários
- DDoS ativo contra qualquer portal
- SQL injection ou XSS confirmada mas não explorada em massa
- Acesso não autorizado confirmado a dados de 1-10 alunos
- Comprometimento de conta de servidor/admin individual

**Exemplos Específicos:**
- Sistema de login está aceitando qualquer senha por 2 horas (bug crítico)
- 50 requisições/segundo vindo de um IP único (DDoS)
- Validação de input falha em campo de busca, permite `'; DROP TABLE --`
- Admin consegue ver dados de outro admin via RLS bypass
- Token de API de um terceiro integrador é exposto

**Resposta (0-4 horas):**
- Escalação para desenvolvedores senior
- Análise de logs e telemetria
- Execução de patch de hotfix se disponível
- Comunicação com stakeholders relevantes

### 3.3 P3 — Incidente Médio

**Critérios:**
- Tentativa de acesso não autorizado detectada e bloqueada
- Anomalia em logs que sugere reconhecimento/scanning
- Rate limiting excedido repetidamente (possível brute force)
- Certificado digital com <6 meses até vencimento
- Dependência npm com vulnerabilidade de severidade média (não explorada)

**Exemplos Específicos:**
- WAF bloqueia 100+ requisições de IP 203.0.113.45 tentando acessar `/admin/`
- Logs mostram múltiplas queries com `UNION SELECT` em 5 minutos, bloqueadas por RLS
- Alguém tenta fazer 1000 requisições/min a `/api/consultar-cpf` (rate limiting ativo)
- npm audit avisa que `lodash v4.17.20` tem ReDOS; atual é v4.17.21
- Certificado A3 vence em 4 meses

**Resposta (0-24 horas):**
- Investigação por desenvolvedor designado
- Coleta de evidências (logs, tráfego de rede)
- Notificação ao DPO se envolver dados pessoais
- Plano de mitigação

### 3.4 P4 — Incidente Baixo

**Critérios:**
- Vulnerabilidade potencial identificada mas sem vetor de exploração confirmado
- npm audit aviso de severidade baixa
- Certificado com >6 meses até vencimento
- Falha menor de validação em campo não-crítico
- Comportamento anômalo em métrica de performance

**Exemplos Específicos:**
- npm audit: `debug v2.6.8` tem issue de DoS teórica em labels
- Certificado vence em 11 meses
- Campo de data aceita `31/02/2026` sem rejeição
- Cache hit rate caiu de 85% para 78%

**Resposta (0-72 horas):**
- Fila de trabalho do desenvolvedor
- Plano de correção em sprint normal
- Documentação de workaround se necessário

---

## 4. Equipe de Resposta a Incidentes

### 4.1 Organograma

```
┌─────────────────────────────────────────────┐
│   Marcelo Silva                             │
│   Proprietário / DPO (Data Protection Officer) │
│   • Aprovação de decisões críticas          │
│   • Contato com ANPD                        │
│   • Comunicação externa                     │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴──────────┬──────────────┐
        │                    │              │
┌───────▼──────┐  ┌─────────▼────┐  ┌──────▼──────┐
│ Desenvolvedor│  │Desenvolvedor │  │Desenvolvedor│
│ Senior/Lead  │  │ Backend      │  │ Frontend    │
│ (Buchecha)   │  │ (DeepSeek)   │  │ (Qwen)      │
│ • Code review│  │ • APIs, DB   │  │ • Painel    │
│ • Triage     │  │ • Queries    │  │ • Portal    │
│ • Escalação  │  │ • Security   │  │ • Validação │
└──────────────┘  └──────────────┘  └─────────────┘
```

### 4.2 Papéis e Responsabilidades

| Papel | Pessoa | Disponibilidade | Responsabilidades |
|-------|--------|-----------------|------------------|
| **DPO** | Marcelo Silva (mrcelooo@gmail.com) | 24/7 (com aviso) | Aprovação crítica, comunicação ANPD, conformidade legal |
| **Incident Commander** | Desenvolvedor Senior (Buchecha) | 24/7 em P1, 08:00-20:00 em P2+ | Triagem, escalonamento, delegação, relatório |
| **Técnico de Incidente** | Disponível (DeepSeek/Kimi) | 24/7 em P1, horário comercial em P2+ | Análise técnica, root cause, mitigação |
| **DevOps/Infra** | A designar | 24/7 em P1 | Isolamento de sistemas, rotação de chaves, backups |
| **Jurídico** | A designar | Horário comercial | Assessoria LGPD, comunicação regulatória |
| **Comunicação** | A designar | 24/7 em P1 | Mensagens internas, notificações a titulares |

### 4.3 Matriz de Escalação

**Ativar para P1 (24/7):**
1. Marcelo Silva (DPO) — Paging imediato
2. Desenvolvedor Senior (Buchecha) — Paging imediato
3. Desenvolvedor Backend (DeepSeek) — Paging imediato
4. Especialista em bugs (Kimi) — Standby

**Ativar para P2 (horário comercial + aviso):**
1. Desenvolvedor Senior (Buchecha) — Aviso via Slack + e-mail
2. Desenvolvedor relevante (Backend/Frontend) — Aviso
3. Marcelo Silva — Informação (cc em e-mail)

**Ativar para P3+ (trabalho normal):**
- Desenvolvedor relevante designado
- Documentação em thread Slack

### 4.4 Contato

| Papel | Nome | E-mail | Slack | Telefone | Disponível |
|-------|------|--------|-------|----------|-----------|
| DPO | Marcelo Silva | mrcelooo@gmail.com | @marcelo | A definir | Definir |
| Dev Lead | Buchecha | A definir | @buchecha | A definir | 24/7 |
| Dev Backend | DeepSeek | A definir | @deepseek | A definir | 24/7 |
| Dev Frontend | Qwen | A definir | @qwen | A definir | Horário comercial |
| Especialista Bugs | Kimi | A definir | @kimi | A definir | Standby |

---

## 5. Procedimento de Resposta (6 Fases)

### 5.1 Fase 1: Detecção e Alerta

**Objetivo:** Identificar que um incidente ocorreu.

**Fontes de Detecção:**

| Fonte | Ferramenta | O que observar | Ação |
|-------|-----------|---|---|
| **Logs de Segurança** | Security Logger (Supabase) | Padrões de acesso anômalo, rejeições de RLS | Escalar se >50 tentativas/hora |
| **WAF** | Cloudflare Dashboard | Requisições bloqueadas, padrões de ataque, IPs suspeitos | P2 se >1000 req/min; P1 se exploração confirmada |
| **Dependências** | GitHub Dependabot + npm audit | Vulnerabilidades em packages, security alerts | P4/P3 conforme CVSS |
| **Certificados** | Supabase + observação manual | Certificados próximos de vencer, revogações | P3 se <6 meses; P2 se <1 mês |
| **Relatórios de Usuários** | E-mail, formulário de feedback | "Não consigo logar", "Vi dados de outro aluno" | Escalar imediatamente se data/diplomas afetados |
| **OWASP ZAP Scanning** | Automated scans (semanal) | Vulnerabilidades de código, HTTPS issues, headers faltando | P3/P4 para não-críticas |
| **Performance Metrics** | Vercel + Cloudflare Analytics | Aumento anômalo de latência, taxa de erro >5%, rate limiting ativo | P2 se >1 hora; P3 se intermitente |
| **Backup Validation** | Supabase backups | Falha em backup automático, integridade comprometida | P2/P1 se crítica |

**Ação de Detecção (0-15 minutos):**

```
┌─────────────────────────────────┐
│ Alerta automático ou relatório   │
│ (origem: WAF, logs, usuário)     │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ 1. Avaliar urgência básica      │
│    - Dados pessoais envolvidos? │
│    - Sistema indisponível?      │
│    - Confirmado ou suspeita?    │
└────────────┬────────────────────┘
             │
        ┌────┴─────┐
        │           │
        ▼           ▼
    [P1/P2]     [P3/P4]
        │           │
        ▼           ▼
   Ativar        Logging
   resposta       apenas
```

### 5.2 Fase 2: Triagem e Classificação

**Objetivo:** Confirmar natureza, escopo e severidade do incidente.

**Checklist de Triagem (Incident Commander = Buchecha):**

```
□ Que tipo de incidente é? (segurança, performance, disponibilidade, conformidade)
□ Quais sistemas/dados estão envolvidos?
□ Qual é o escopo? (1 usuário, 10, 100, 1000+)
□ Há dados pessoais afetados? (CPF, nome, histórico, diploma?)
□ A disponibilidade foi impactada? (quanto tempo, % de funcionalidade)
□ Há evidência de exploração ativa ou tentativa apenas?
□ Qual é a severidade LGPD? (violação confirmada = P1/P2)
□ Qual é a severidade de business? (alunos não conseguem pegar diploma = P1)
□ Quando começou o incidente?
```

**Matriz de Classificação Rápida:**

| Cenário | Severidade |
|---------|-----------|
| Dados pessoais vazados + usuários afetados | P1 |
| Portal indisponível >1 hora | P1 |
| Comprometimento de chaves/certificados | P1 |
| Falha de autenticação em massa (>50 usuários) | P2 |
| DDoS em andamento | P2 |
| SQL injection confirmada mas bloqueada | P2 |
| Tentativa de acesso não autorizado bloqueada | P3 |
| npm vulnerability sem exploração conhecida | P3/P4 |
| Certificado vencendo em <6 meses | P3 |
| Rate limiting excedido | P3 |

**Análise de Impacto (15-30 min):**

```sql
-- Query rápida no Supabase para avaliar escopo

-- 1. Quantos usuários foram afetados?
SELECT COUNT(DISTINCT user_id)
FROM security_logs
WHERE event_type = 'unauthorized_access'
AND timestamp > NOW() - INTERVAL '1 hour';

-- 2. Quantos registros de diploma foram acessados?
SELECT COUNT(*)
FROM diplomas
WHERE updated_at > NOW() - INTERVAL '1 hour'
AND NOT updated_by IN (SELECT id FROM users WHERE role = 'admin');

-- 3. Há tentativas de acesso a dados sensíveis?
SELECT ip, COUNT(*) as attempts, array_agg(path) as paths
FROM api_logs
WHERE status = 401 OR status = 403
AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY ip HAVING COUNT(*) > 10;
```

**Saída de Classificação:**

```
INCIDENTE #2025-03-26-001
├─ Severidade: P2 (Alto)
├─ Tipo: Tentativa de SQL Injection
├─ Afetados: 0 usuários (bloqueado por RLS)
├─ Dados expostos: Nenhum confirmado
├─ Tempo de detecção: 14 minutos
├─ Violação LGPD: Não
├─ Ativar: Dev Backend, Sec Logger review
└─ Próximo: Fase 3 (Contenção)
```

### 5.3 Fase 3: Contenção

**Objetivo:** Interromper o incidente imediatamente e prevenir propagação.

**Ações Imediatas por Severidade:**

#### P1 — Ações em 5 minutos:

```bash
# 1. Bloquear automaticamente via Cloudflare WAF
# (Incident Commander executa)
CF_API_TOKEN=xxx \
CF_ZONE_ID=yyy \
./scripts/cloudflare-waf-emergency-block.sh <attacker-ip> <severity>

# 2. Isolar banco de dados
# (DevOps executa via Supabase console)
# - Desabilitar RLS temporariamente? NÃO (pode expor mais)
# - Ativar emergency backup? SIM
# - Congelar alterações de schema? SIM

# 3. Revogar chaves/tokens comprometidas
# (Sec lead executa)
# - Certificado A3: Solicitar revogação ICP-Brasil (telefonar)
# - API tokens: Deletar e regenerar
# - Secrets de GitHub: Rotacionar em .env

# 4. Informar DPO
# Slack: @marcelo INCIDENTE P1 EM ANDAMENTO - Veja detalhes no thread
```

#### P2 — Ações em 1 hora:

```bash
# 1. Investigar fonte do ataque
# - IP/User-Agent anômalo?
# - Bot ou pessoa?
# - Padrão de reconhecimento ou exploração real?

# 2. Aplicar mitigação técnica
# - Rate limiting mais agressivo?
# - Bloquear padrão de requisição via WAF rule?
# - Rollback de deploy recente?

# 3. Notificar equipe
# - Slack: #incidentes com resumo de 5 linhas
# - E-mail: DPO + Dev lead

# 4. Começar documentação
# - Timestamp, ações tomadas, próximos passos
```

#### P3/P4 — Ações em 24 horas:

```bash
# 1. Logging e documentação
# 2. Plano de investigação
# 3. Notificação ao DPO se aplicável
```

**Ações Técnicas Específicas:**

| Cenário | Ação | Comando/Link |
|---------|------|---|
| **Bloquear IP via WAF** | Criar regra challenge/block | Cloudflare Dashboard > Security > WAF |
| **Revogar certificado A3** | Telefonar ICP-Brasil | +55 11 3627-5122 |
| **Rotacionar chaves API** | Deletar old, criar new | Supabase > Project Settings > API Keys |
| **Isolar banco de dados** | Backup offline + quiesce writes | Supabase > Backups > On-Demand |
| **Desabilitar usuário comprometido** | Marcar como suspended | Supabase table `users` SET `disabled = true` |
| **Limpar sessões ativas** | Invalidar tokens | RPC `invalidate_sessions(<user_id>)` |
| **Rollback de deploy** | Reverter para versão anterior | Vercel Dashboard > Deployments > Rollback |

**RLS Emergency Policy (se necessário):**

```sql
-- Congelar acesso a dados sensíveis durante incidente
ALTER TABLE diplomas ENABLE ROW LEVEL SECURITY;
CREATE POLICY emergency_lockdown ON diplomas
  USING (false);  -- Bloqueia TODOS os acessos
  -- Depois: DROP POLICY; para restaurar

-- Auditoria intensiva
ALTER TABLE diplomas ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_only ON diplomas
  USING (current_user_id() IN (SELECT id FROM users WHERE role = 'incident_commander'));
```

### 5.4 Fase 4: Erradicação

**Objetivo:** Eliminar a causa raiz e prevenir recorrência.

**Root Cause Analysis (RCA):**

```markdown
## RCA Template

**1. O que aconteceu?**
   - Descrição técnica do incidente
   - Timeline exata (timestamps UTC)
   - Sistemas afetados

**2. Por que aconteceu?**
   - Causa técnica: [ex: validação de input ausente]
   - Causa operacional: [ex: review de código pulado]
   - Causa de segurança: [ex: RLS misconfigured]

**3. Quais eram as defesas?**
   - Qual deveria ter bloqueado isso?
   - Por que falhou?

**4. Não era óbvio antes?**
   - Por que isso não foi pego no code review?
   - Por que não foi achado em scanning?

**5. Como evitar no futuro?**
   - Fix técnico específico (commit reference)
   - Melhoria de processo (policy change)
   - Melhoria de tooling (novo scan, new rule)
```

**Remediação Técnica:**

| Tipo de Incidente | Passo 1 | Passo 2 | Passo 3 |
|-------------------|--------|--------|--------|
| **SQL Injection** | Aplicar input validation | Auditar queries similar | Code review de queries |
| **Acesso não autorizado** | Revisar RLS rules | Auditoria de permissões | Testes de RLS |
| **Vulnerabilidade npm** | Update dependência | Rebuild | Test coverage |
| **Certificado comprometido** | Revogar em ICP-Brasil | Gerar novo | Atualizar sistemas |
| **Brute force** | Aumentar rate limiting | Adicionar CAPTCHA | Alertas |

**Verificação Pós-Remediação:**

```bash
# 1. Validar que fix foi aplicado
git log --oneline | grep -i "sec:"  # Verificar commit

# 2. Reproduzir cenário de ataque
# (Manual testing ou automation)

# 3. Executar scan de segurança
npm audit fix
npx owasp-zap scan <url>

# 4. Validar em staging antes de prod
# Fazer deploy em environment de teste
# Confirmar fix sem quebrar funcionalidade

# 5. Documentar em security guidelines
# Adicionar pattern ao SECURITY.md
```

### 5.5 Fase 5: Recuperação

**Objetivo:** Restaurar operação normal com confiança.

**Plano de Recuperação:**

```
┌──────────────────────────────────────────┐
│ Preparar Recuperação (Devs + DPO)        │
│ ├─ Validar que fix está pronto           │
│ ├─ Plano de comunicação pronto            │
│ ├─ Procedimento de rollback preparado    │
│ └─ Teste em staging completado           │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Deploy Produção (Dev Lead autoriza)      │
│ ├─ Blue/green ou canary (se P1/P2)       │
│ ├─ Monitorar logs em tempo real          │
│ ├─ Métricas de erro < 1%                 │
│ └─ Nenhuma regressão de performance      │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Validação (Incident Commander)           │
│ ├─ Sistema respondendo normalmente       │
│ ├─ Nenhum erro crítico em logs           │
│ ├─ Dados íntegros (spot check)          │
│ └─ Usuários conseguem acessar            │
└──────────┬───────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ Comunicar Recuperação (DPO/Comms)        │
│ ├─ Status update a stakeholders          │
│ ├─ Notificação a alunos se afetados      │
│ └─ Confirmação de operação normal        │
└──────────────────────────────────────────┘
```

**Checklist de Recuperação:**

```
□ Fix foi testado em staging?
□ Rollback plan documentado?
□ DPO aprovou o plan?
□ Monitoramento está ativo (dashboard)?
□ Logs não mostram novos erros?
□ Performance dentro de SLA?
□ Certificados/chaves estão válidas?
□ RLS policies estão ativas novamente?
□ Backup foi feito pós-incidente?
□ Notificações foram enviadas?
□ Equipe foi notificada de "all-clear"?
```

**Testes Pós-Recuperação (30-60 min):**

```bash
# 1. Health check de APIs
curl -s https://api.diploma.fic.edu.br/health | jq .

# 2. Validar que data está íntegra
SELECT COUNT(*) FROM diplomas WHERE updated_at > NOW() - INTERVAL '2 hours';

# 3. Teste de ponta a ponta
# - Login como aluno
# - Consultar diploma
# - Validar assinatura XML
# - Download de PDF

# 4. Verificar não há nova tentativas de ataque
SELECT COUNT(*) FROM api_logs WHERE status IN (401, 403, 400)
AND timestamp > NOW() - INTERVAL '30 minutes';
```

### 5.6 Fase 6: Pós-Incidente

**Objetivo:** Aprender com o incidente e melhorar resiliência.

**Post-Mortem (48 horas após resolução):**

```markdown
# Post-Mortem — Incidente #2025-03-26-001

## Executive Summary
- Duração total: 2h 14m
- Impacto: 0 dados vazados, 100% uptime restaurado
- Causa: Validação de input ausente em campo de busca

## Timeline
| Timestamp | Evento | Responsável |
|-----------|--------|------------|
| 14:32 UTC | Alerta WAF: SQLi detectada | Sistema |
| 14:43 UTC | Classificada P2 | Buchecha |
| 14:47 UTC | RCA: Campo de busca vulnerável | DeepSeek |
| 15:02 UTC | Fix preparado em staging | Qwen |
| 15:08 UTC | Deploy para produção | Buchecha |
| 15:11 UTC | Validação completada | DeepSeek |
| 16:46 UTC | Post-mortem iniciada | Time |

## Root Cause
Campo `search_name` no formulário de consulta aceita entrada arbitrária sem sanitização.
Validação Zod estava OK, mas query Supabase fazia concatenação de string.

## Why We Missed It
1. Code review focou em lógica, não em segurança
2. npm audit não detectou (vulnerabilidade em nosso código, não em dependência)
3. OWASP ZAP scan era manual (não contínuo)

## Fix
- Substituir concatenação por parameterized query
- Adicionar validação Zod stricto
- Adicionar OWASP ZAP scanning automático (semanal)

## Actions (5Ws)
| O quê? | Quem? | Prazo | Status |
|--------|-------|-------|--------|
| Audit todas as queries SQL | DeepSeek | 3 dias | Em progresso |
| Implementar parameterized queries padrão | Buchecha | 1 semana | Pendente |
| Adicionar ZAP scanning semanal ao CI/CD | Qwen | 2 semanas | Pendente |
| Training para team sobre SQLi | Kimi | 1 semana | Pendente |
| Melhorar code review checklist | Buchecha | 3 dias | Pendente |

## Approved By
- Desenvolvedor: [assinatura]
- DPO: [assinatura]
- Data: 2025-03-28
```

**Ações Pós-Mortem:**

```
1. Revisar post-mortem em equipe (1h meeting)
2. Documentar lições aprendidas no Wiki
3. Atualizar políticas/procedimentos conforme necessário
4. Criar PRs para todos os action items
5. Agendar follow-up em 30 dias
```

**Ciclo de Feedback (30 dias pós-incidente):**

```
Dia 7: Verificar que todas as PRs foram criadas
Dia 14: Revisar progresso dos action items
Dia 30: Validar que remediação foi concluída e efetiva
       - Nenhum incidente similar desde então?
       - Métricas de segurança melhoraram?
       - Equipe absorveu lições aprendidas?
```

---

## 6. LGPD — Notificação Obrigatória

### 6.1 Quando Notificar

**Obrigação de notificar ANPD (Autoridade Nacional de Proteção de Dados):**

A notificação é **obrigatória** se houver **violação de segurança** que afete dados pessoais.

**LGPD Art. 46:** "Pessoa jurídica de direito público ou privado responsável por banco de dados de pessoas naturais deve comunicar à autoridade nacional e ao titular dos dados a ocorrência de incidente de segurança nos seus sistemas que resulte em violação dos direitos dos titulares."

**Critérios:**

```
Violação = Incidente P1 ou P2 com:
├─ Dados pessoais afetados (CPF, nome, histórico, contato)
├─ Acesso não autorizado confirmado
└─ Risco ao titular (não basta risco teórico)

Exemplos de NÃO-notificação:
├─ Tentativa bloqueada (sem exposição)
├─ Bug que não resulta em vazamento
├─ Incidente P3/P4 sem violação

Exemplos de NOTIFICAÇÃO:
├─ Dados de 10 alunos foram vistos por hacker
├─ Arquivo ZIP com XMLs foi baixado via exploit
├─ Senha de admin foi comprometida e usada para acessar dados
```

### 6.2 Prazo (LGPD Art. 48)

**72 horas a partir da DETECÇÃO do incidente.**

```
Detecção: 14:30 UTC - 26 de março
Prazo: 14:30 UTC - 29 de março (72 horas depois)

NOTA: Prazo é de 72 horas, não "próximo dia útil"
```

### 6.3 Processo de Notificação

**Passo 1: Confirmação (0-24h após detecção)**

```
Cheklist:
□ Violação confirmada ou suspeita?
□ Quais dados foram expostos?
□ Quantos titulares afetados?
□ Qual foi o vetor de ataque?
□ Foi remediado?

Decisão: Notificar SIM / NÃO?

SE SIM → Notificar DPO e iniciar redação
```

**Passo 2: Redação de Notificação ANPD (24-48h)**

Usar template de notificação ANPD:

```markdown
# Notificação de Violação de Segurança — ANPD

## Dados do Responsável
- Razão Social: Faculdades Integradas de Cassilândia (FIC)
- CNPJ: [XXX.XXX.XXX-XX]
- Endereço: [Endereço FIC]
- Contato DPO: Marcelo Silva (mrcelooo@gmail.com)

## Descrição do Incidente
**O quê:** [Descrição clara]
**Quando:** [Data/hora exata]
**Como detectamos:** [Origem do alerta]
**Por quê ocorreu:** [Causa raiz]

## Dados Pessoais Afetados
- Tipos de dados: CPF, nome, histórico escolar, endereço
- Número de titulares: [N]
- Período de exposição: [de X até Y]
- Consentimento/base legal: [Legítimo interesse para educação]

## Ações Tomadas
- Ação 1: [Descrição]
- Ação 2: [Descrição]
- Ação 3: [Descrição]

## Medidas de Mitigação
- Medida 1: [Descrição]
- Medida 2: [Descrição]

## Avaliação de Risco
Risco ao titular: [BAIXO / MÉDIO / ALTO]
- Por quê: [Explicação]

## Contato
DPO: Marcelo Silva
E-mail: mrcelooo@gmail.com
Telefone: [A definir]
```

**Passo 3: Envio Formal (antes de 72h)**

```
Para: [email-anpd@anpd.gov.br]  # Ver site ANPD para e-mail correto
CC: DPO (Marcelo Silva)
Assunto: NOTIFICAÇÃO DE VIOLAÇÃO DE SEGURANÇA — FIC

[Conteúdo conforme template acima]
```

### 6.4 Notificação a Titulares de Dados

**LGPD Art. 47:** Comunicar ao titular dos dados ocorrência de incidente.

**Quando:** Conforme LGPD, "sem culpa" = tão logo possível (recomendação: junto com ANPD ou até 48h depois)

**Como:** E-mail + SMS (se telefone disponível)

```markdown
# E-mail Template — Notificação a Alunos

Assunto: IMPORTANTE: Incidente de Segurança no Sistema de Diploma Digital

---

Prezado(a) [Nome],

Em [data], identificamos um incidente de segurança em nossos sistemas que pode ter impactado seus dados pessoais.

**O que aconteceu:**
[Descrição clara em linguagem simples]

**Seus dados afetados:**
- Nome completo
- CPF
- [Outros]

**Ações que tomamos:**
1. Bloqueamos o acesso imediato
2. Isolamos os dados afetados
3. Iniciamos investigação completa
4. Atualizamos nossos sistemas de segurança

**O que você deve fazer:**
- [Ação 1: ex: trocar senha]
- [Ação 2: ex: monitorar conta]
- [Ação 3: ex: contatar suporte]

**Próximos passos:**
- Faremos contato adicional em [data]
- Você pode nos contatar em [email/telefone]
- Dúvidas: atendimento@diploma.fic.edu.br

Confidencialidade garantida.

Atenciosamente,
Marcelo Silva
Diretor — Diploma Digital FIC
```

**Envio:**
```bash
# Usar BCC para privacidade
# Não colocar todos os e-mails em TO/CC

Para: [aluno 1] (BCC)
Cc: atendimento@diploma.fic.edu.br

[Conteúdo]
```

---

## 7. Comunicação

### 7.1 Comunicação Interna

**Canais:**

| Severidade | Canal Primário | Frequência | Quem |
|-----------|---|---|---|
| **P1** | Slack #emergencias (paging 24/7) | Imediata + a cada 30 min | Incident Commander |
| **P2** | Slack #incidentes | Imediata + a cada 1h | Dev Lead |
| **P3** | Slack #incidentes (thread) | 1x ao iniciar + 1x ao encerrar | Dev responsável |
| **P4** | GitHub issue | Quando conveniente | Dev responsável |

**Formato de Mensagem Slack:**

```
🚨 INCIDENTE P1: [TÍTULO]
└─ Detectado: 14:32 UTC
└─ Afetados: [X usuários / sistema Y]
└─ Estatus: [Detectado / Contido / Investigando / Resolvido]
└─ Próxima atualização: 14:45 UTC

CC: @marcelo @buchecha @deepseek
```

**Atualização a cada 30 minutos (P1) / 1 hora (P2):**

```
UPDATE P1:
├─ RCA: Identificamos a causa [XXX]
├─ Ação: Implementando fix
├─ ETA resolução: 16:00 UTC
└─ Próxima atualização: 15:15 UTC
```

### 7.2 Comunicação Externa (para Alunos/Comunidade)

**Critério:** P1 com impacto operacional (indisponibilidade, perda de dados) > 30 minutos

**Template de Status Page:**

```html
<div class="incident-banner">
  <h2>🔧 Manutenção em Andamento</h2>
  <p>
    O portal de diploma digital está passando por manutenção
    de segurança. Esperamos estar totalmente operacional em
    aproximadamente 1 hora.
  </p>
  <p>
    Agradecemos sua paciência. Dúvidas:
    <a href="mailto:atendimento@diploma.fic.edu.br">
      atendimento@diploma.fic.edu.br
    </a>
  </p>
  <small>Última atualização: 14:50 UTC</small>
</div>
```

### 7.3 Comunicação com Mídia

**Aplica se:** Vazamento confirmado que envolva dados de 100+ alunos OU afete disponibilidade por >4 horas

**Processo:**
1. Marcelo Silva (DPO) é responsável por comunicação externa
2. Preparar statement factual e transparente
3. Não especular sobre causa até estar 100% certo
4. Enfatizar ações tomadas e medidas futuras

**Template:**

```
[STATEMENT PARA IMPRENSA]

Faculdades Integradas de Cassilândia (FIC) informa que identificou
um incidente de segurança em seu sistema de Diploma Digital em [data/hora].

FATOS:
- Incidente foi detectado às [hora] UTC
- [Descrição factual do que aconteceu]
- [Número de pessoas afetadas, se aplicável]

AÇÕES TOMADAS:
- [Ação 1]
- [Ação 2]
- [Ação 3]

CONFORMIDADE:
FIC está em total conformidade com a LGPD (Lei 13.709/2018) e
notificou a ANPD conforme obrigação legal.

PRÓXIMOS PASSOS:
- [Investigação em progresso]
- [Comunicação adicional em X data]

Contato para imprensa: [email oficial]
```

---

## 8. Ferramentas e Recursos

### 8.1 Stack de Monitoramento e Resposta

| Ferramenta | Uso | Dashboard | Contato |
|-----------|-----|-----------|---------|
| **Cloudflare WAF** | Detecção de ataques, rate limiting | dash.cloudflare.com | Zona ID: [XXX] |
| **Supabase Security Logs** | Logs de acesso, eventos RLS | app.supabase.com > Logs | DB URL: [XXX] |
| **Vercel Analytics** | Performance, taxa de erro | vercel.com/dashboard | Project: diploma-digital |
| **npm audit** | Vulnerabilidades de dependência | Terminal: `npm audit` | Run locally |
| **GitHub Security** | Dependabot, secret scanning | repo > Security tab | Repo: diploma-digital |
| **OWASP ZAP** | Scanning de vulnerabilidades web | Local: `zaproxy` | Semanal |
| **Supabase Backups** | Recuperação de dados | app.supabase.com > Backups | Automated daily |

### 8.2 Acessos Necessários (A Definir)

```
[ ] Cloudflare account — Marcelo Silva
[ ] Supabase console — Dev Team
[ ] Vercel dashboard — Dev Team
[ ] GitHub repo (admin) — Dev Team
[ ] ANPD contact — Marcelo Silva (DPO)
[ ] ICP-Brasil (certificado) — Contato ICP
[ ] BRy API keys (assinatura) — Segurança
```

### 8.3 Runbooks Rápidos

**Runbook 1: Bloquear IP via WAF**

```bash
#!/bin/bash
IP_ATACANTE="203.0.113.45"
ZONE_ID="[sua-zone-id]"
API_TOKEN="[seu-api-token]"

curl -X POST \
  https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/firewall/rules \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"block\",
    \"priority\": 1,
    \"expression\": \"(ip.src eq ${IP_ATACANTE})\",
    \"description\": \"Emergency: Block attacker IP\"
  }"

echo "✓ IP bloqueado"
```

**Runbook 2: Revogar Certificado A3 (ICP-Brasil)**

```
1. Aceder: https://www3.iti.gov.br/
2. Certificados > Gerenciador de Certificados
3. Buscar certificado por serial
4. Clicar "Revogar"
5. Motivo: Comprometimento de chave privada
6. Confirmar
7. Esperar: Propagação em 24-48h
```

**Runbook 3: Forçar Logout de Todos os Usuários**

```sql
-- Supabase: Invalidar todas as sessões ativas
UPDATE auth.sessions
SET
  expires_at = NOW(),
  updated_at = NOW()
WHERE user_id IS NOT NULL;

-- Ou para um usuário específico:
UPDATE auth.sessions
SET expires_at = NOW()
WHERE user_id = 'UUID_DO_USUARIO';
```

---

## 9. Treinamento e Simulações

### 9.1 Treinamento Obrigatório

**Novo Membro da Equipe:**
- Leitura desta política (1h)
- Walkthrough de processo com Incident Commander (1h)
- Simulação tabletop observando (1h)

**Trimestral:**
- Atualização de política (30 min)
- Novo case study / lição aprendida (1h)

### 9.2 Simulação Trimestral

**Formato:** Tabletop exercise (não afeta produção)

**Agenda (2 horas):**

```
14:00 - Cenário é apresentado (15 min)
        "Detetar SQL injection em portal"

14:15 - Discussão de resposta (45 min)
        "O que fazemos? Em que ordem?"

15:00 - Feedback e lessons learned (30 min)
        "O que funciona? O que melhorar?"

15:30 - Atualizar procedure conforme achados (15 min)
        "Vamos documentar isso"
```

**Próximas Simulações Agendadas:**
- Q2 2026: Vazamento de dados pessoais
- Q3 2026: Comprometimento de certificado A3
- Q4 2026: Indisponibilidade de portal

### 9.3 Teste Anual de Recuperação de Desastre

**Escopo:** Simular falha completa de produção

```
Objetivo: Validar que conseguimos:
├─ Restaurar banco de dados de backup
├─ Regenerar certificados
├─ Redeployed sem perda de dados
└─ Recuperar completamente em < 2 horas

Frequência: Anual (recomendação: dezembro)
Tempo alocado: 4 horas
Resultado esperado: Relatório de sucesso/gaps
```

---

## 10. Revisão da Política

### 10.1 Cronograma de Revisão

- **Semestral:** 26 de setembro de 2026 (review completo)
- **Ad-hoc:** Após incidente P1 ou mudança regulatória

### 10.2 Mudanças Documentadas

| Versão | Data | Mudança | Aprovado Por |
|--------|------|---------|-------------|
| 1.0 | 26/03/2026 | Criação inicial | Marcelo Silva |
| 1.1 | [Data] | [Descrição] | [Assinatura] |

### 10.3 Contato para Sugestões

Alguma sugestão para melhorar esta política?

E-mail: [DPO-email]
Slack: #seguranca-discussion
GitHub: Security advisories in diploma-digital repo

---

## Apêndices

### A. Checklist de Resposta Rápida (Laminate & Post)

```
INCIDENTE DETECTADO?
□ Slack #emergencias
□ Notificar Incident Commander
□ Classificar: [P1] [P2] [P3] [P4]

P1? IMEDIATO:
□ Marcelo Silva (DPO)
□ Dev Lead (Buchecha)
□ Isolar sistema
□ Bloquear ataque (WAF)

TODO INCIDENTE:
□ Documentar timeline
□ Preservar evidências (logs)
□ RCA quando seguro
□ Notificar ANPD se P1+violação
□ Post-mortem em 48h
```

### B. Contatos de Emergência (A Manter Atualizado)

```
EQUIPE FIC:
Marcelo Silva (DPO): mrcelooo@gmail.com | [Telefone TBD]

EXTERNOS:
ANPD (Autoridade Nacional de Proteção de Dados): [email TBD]
ICP-Brasil (Certificado Digital): +55 11 3627-5122
Cloudflare Support: [account manager]
Supabase Support: support@supabase.io
Vercel Support: support@vercel.com

FORNECEDORES DE ASSINATURA:
BRy: [contato]
Certisign: [contato]
Soluti: [contato]
```

### C. Referências Regulatórias

- **LGPD (Lei 13.709/2018):**
  - Art. 46-50: Obrigações de notificação
  - Art. 60-65: Direitos do titular

- **Portaria MEC 554/2019:**
  - Anexo I: Requisitos técnicos de segurança

- **Portaria MEC 70/2025:**
  - Novos prazos e requisitos

- **IN SESU/MEC 1/2020:**
  - Segurança da informação em sistemas educacionais

- **ICP-Brasil:**
  - Normas de certificação digital e revogação

- **OWASP Top 10 (2021):**
  - Vulnerabilidades web comuns

---

## Aprovações

| Papel | Nome | Assinatura | Data |
|-------|------|-----------|------|
| Proprietário / DPO | Marcelo Silva | ________________ | __ / __ / ____ |
| Desenvolvedor Lead | Buchecha (MiniMax) | ________________ | __ / __ / ____ |
| Desenvolvedor Backend | DeepSeek | ________________ | __ / __ / ____ |

---

**Documento:** POLITICA-RESPOSTA-INCIDENTES.md
**Classificação:** Confidencial — Equipe Técnica Apenas
**Última atualização:** 26 de março de 2026
**Próxima revisão programada:** 26 de setembro de 2026
