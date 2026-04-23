#!/usr/bin/env python3
"""
seed_fic_knowledge.py — S10 DS Agente

Ingesta documentos FIC na base de conhecimento do DS Agente via API REST.

Documentos suportados:
  1. FAQ de matrícula (Markdown embutido como padrão — substitua pelo real)
  2. Regulamento acadêmico (PDF ou Markdown — path via args)
  3. Grade curricular por curso (Markdown embutido)
  4. Calendário acadêmico 2026

Uso:
  # Cria agente "FIC Secretaria" + ingesta FAQ e grade embutidos
  $ AGENT_API_URL=http://localhost:3000 python scripts/seed_fic_knowledge.py

  # Passa regulamento real em PDF
  $ AGENT_API_URL=http://localhost:3000 \\
    REGULAMENTO_PDF=/path/to/regulamento.pdf \\
    python scripts/seed_fic_knowledge.py

  # Especifica agent_id existente (não cria novo)
  $ AGENT_API_URL=http://localhost:3000 \\
    AGENT_ID=<uuid> \\
    python scripts/seed_fic_knowledge.py

Env vars:
  AGENT_API_URL   — Base URL da API (default: http://localhost:3000)
  AGENT_ID        — UUID de agente já existente (pula criação)
  REGULAMENTO_PDF — Path para PDF do regulamento acadêmico
  COOKIE          — Cookie de sessão autenticada (ex: supabase-auth-token=...)
  DRY_RUN         — Se "1", apenas imprime o que faria (não chama API)
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# ──────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────
BASE_URL    = os.getenv("AGENT_API_URL", "http://localhost:3000")
AGENT_ID    = os.getenv("AGENT_ID", "")
REG_PDF     = os.getenv("REGULAMENTO_PDF", "")
COOKIE      = os.getenv("COOKIE", "")
DRY_RUN     = os.getenv("DRY_RUN", "0") == "1"

HEADERS = {
    "Content-Type": "application/json",
    **({"Cookie": COOKIE} if COOKIE else {}),
}

# ──────────────────────────────────────────────────────────────
# Agente padrão FIC Secretaria
# ──────────────────────────────────────────────────────────────
FIC_AGENT = {
    "name": "FIC Secretaria",
    "description": "Agente IA piloto da Secretaria FIC — responde dúvidas de matrícula, regulamento e grade.",
    "system_prompt": (
        "Você é a assistente virtual da Secretaria da FIC — Faculdades Integradas de Cassilândia.\n"
        "Responda com cordialidade e objetividade às dúvidas dos alunos sobre matrícula, grade curricular, "
        "calendário acadêmico e regulamento.\n"
        "Seja sempre claro e direto. Se não souber a resposta ou o assunto for muito específico, "
        "oriente o aluno a falar com um atendente da Secretaria.\n"
        "Nunca prometa descontos, preços específicos ou prazos que não estejam na base de conhecimento."
    ),
    "model": "gpt-4o-mini",
    "temperature": 0.5,
    "max_tokens": 250,
    "max_history": 8,
    "delay_seconds": 2,
    "activation_tags": [],          # Marcelo preenche com IDs reais das tags
    "tag_logic": "OR",
    "channels": ["whatsapp"],
    "split_messages": True,
    "handoff_on_human": True,
    "handoff_keywords": [
        "falar com atendente",
        "humano",
        "pessoa real",
        "atendimento humano",
        "secretaria",
    ],
    "enabled": False,               # Ativar só após validação no Playground (P-132)
}

# ──────────────────────────────────────────────────────────────
# Base de conhecimento embutida (substitua pelo conteúdo real)
# ──────────────────────────────────────────────────────────────
FAQ_MATRICULA = """
# FAQ — Matrícula FIC 2026

## Quando é o período de matrícula?
O período de matrícula para o 1º semestre 2026 é de 10/01 a 31/01/2026.
Para o 2º semestre, o período é de 01/06 a 30/06/2026.
Matrículas fora do prazo estão sujeitas a análise pela Secretaria e pagamento de taxa de rematrícula.

## Quais documentos são necessários para a matrícula?
- RG e CPF (originais e cópias)
- Comprovante de residência atualizado (últimos 3 meses)
- Certificado de conclusão do Ensino Médio e histórico escolar (para calouros)
- Foto 3x4 recente
- Comprovante de pagamento da taxa de matrícula

## Como faço para trancar a matrícula?
O trancamento deve ser solicitado na Secretaria até o 30º dia letivo do semestre.
Preencha o requerimento de trancamento e aguarde aprovação da Coordenação.
O trancamento só pode ser feito por até 2 semestres consecutivos.

## Posso me matricular em disciplinas de outro curso?
Sim, mediante aprovação da Coordenação e disponibilidade de vagas.
É necessário protocolar Requerimento de Aproveitamento de Estudos na Secretaria.

## Como solicitar aproveitamento de estudos de outra instituição?
Protocole na Secretaria o requerimento com histórico escolar e ementa das disciplinas cursadas.
O prazo de análise é de até 30 dias úteis.

## Onde faço a matrícula?
Pessoalmente na Secretaria (Bloco A, Térreo), de segunda a sexta das 8h às 12h e 14h às 18h.
Pelo portal do aluno em alunos.fic.edu.br (disponível para rematrícula).

## Qual o prazo para cancelamento sem multa?
Até 30 dias após o início das aulas, o cancelamento não gera multa.
Após esse prazo, aplica-se multa conforme contrato.
"""

GRADE_CURRICULAR = """
# Grade Curricular FIC — Cursos Presenciais 2026

## Administração (4 anos — 8 semestres)
**1º Semestre:** Fundamentos de Administração, Matemática Financeira, Comunicação Empresarial, Introdução à Economia, Metodologia Científica
**2º Semestre:** Contabilidade Geral, Direito Empresarial, Gestão de Pessoas, Estatística, Marketing
**3º Semestre:** Gestão Financeira, Comportamento Organizacional, Logística, Direito do Trabalho, Empreendedorismo
**4º Semestre:** Gestão de Projetos, Planejamento Estratégico, Finanças Corporativas, Pesquisa de Mercado, Optativa I
**5º–8º Semestres:** Módulos avançados + TCC (consulte Coordenação)

## Direito (5 anos — 10 semestres)
**1º Semestre:** Introdução ao Direito, Filosofia do Direito, Sociologia Jurídica, Teoria Geral do Estado, Português Jurídico
**2º Semestre:** Direito Civil I, Direito Constitucional I, Direito Penal I, Ciência Política, Metodologia Jurídica
**3º Semestre:** Direito Civil II, Direito Constitucional II, Direito Penal II, Direito Processual Civil I, Direito do Trabalho I
**4º Semestre:** Direito Civil III, Direito Processual Civil II, Direito Penal III, Direito Empresarial I, Direito Tributário
**5º–10º Semestres:** Módulos avançados + Estágio Curricular + TCC (consulte Coordenação)

## Ciências Contábeis (4 anos — 8 semestres)
**1º Semestre:** Contabilidade Introdutória, Matemática, Economia, Fundamentos de Administração, Informática
**2º Semestre:** Contabilidade Intermediária, Direito Tributário I, Cálculo, Estatística, Comunicação
**3º Semestre:** Contabilidade Avançada, Análise das Demonstrações Contábeis, Direito Tributário II, Custos, Gestão Financeira
**4º–8º Semestres:** Contabilidade Gerencial, Auditoria, Perícia, Estágio + TCC

## Pedagogia (4 anos — 8 semestres)
**1º Semestre:** Fundamentos da Educação, Psicologia do Desenvolvimento, Filosofia da Educação, Metodologia da Pesquisa, Língua Portuguesa
**2º Semestre:** Psicologia da Aprendizagem, Didática Geral, Educação Infantil, Ludicidade, Linguagem e Cultura
**3º–8º Semestres:** Estágios Supervisionados + TCC

## Horários das aulas
- **Matutino:** 7h10 – 11h50 (4 aulas de 50 min + intervalos)
- **Vespertino:** 13h10 – 17h50
- **Noturno:** 19h10 – 22h50 (3 aulas de 50 min)
"""

CALENDARIO_2026 = """
# Calendário Acadêmico FIC 2026

## 1º Semestre 2026
- **10/01–31/01:** Período de matrícula e rematrícula
- **03/02:** Início das aulas
- **17–21/02:** Carnaval (recesso acadêmico)
- **05/04:** Domingo de Páscoa (sem aulas na sexta 03/04)
- **21/04:** Tiradentes (feriado)
- **01/05:** Dia do Trabalho (feriado)
- **01/06–07/06:** Período de prova final P1
- **12/06:** Corpus Christi (feriado)
- **30/06:** Encerramento do 1º semestre
- **01/07–31/07:** Férias escolares

## 2º Semestre 2026
- **01/06–30/06:** Período de matrícula/rematrícula 2º semestre
- **03/08:** Início das aulas
- **07/09:** Independência do Brasil (feriado)
- **12/10:** Nossa Senhora Aparecida (feriado)
- **02/11:** Finados (feriado)
- **15/11:** Proclamação da República (feriado)
- **20/11:** Consciência Negra (feriado)
- **25/12:** Natal (feriado)
- **10/11–14/11:** Prova final P2
- **30/11:** Encerramento do 2º semestre
- **01/12–31/01/2027:** Férias escolares

## Datas importantes
- **Colação de grau:** Cerimônias em junho e dezembro (confirmação na Secretaria)
- **Divulgação de notas:** Até 5 dias úteis após a prova
- **Revisão de prova:** Até 3 dias após divulgação das notas (protocolo na Secretaria)
"""

KNOWLEDGE_BASE = [
    {"title": "FAQ Matrícula FIC 2026", "content": FAQ_MATRICULA},
    {"title": "Grade Curricular FIC 2026", "content": GRADE_CURRICULAR},
    {"title": "Calendário Acadêmico FIC 2026", "content": CALENDARIO_2026},
]

# ──────────────────────────────────────────────────────────────
# Funções de API
# ──────────────────────────────────────────────────────────────
def api_post(path: str, data: dict) -> dict:
    """POST para a API interna."""
    import urllib.request
    url = f"{BASE_URL}{path}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    for k, v in HEADERS.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        raise RuntimeError(f"HTTP {e.code} em {url}: {body_text}") from e


def api_post_file(path: str, file_path: str, title: str) -> dict:
    """POST multipart para upload de arquivo."""
    import urllib.request
    import mimetypes

    boundary = "----FICSeedBoundary"
    file_bytes = Path(file_path).read_bytes()
    mime = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    filename = Path(file_path).name

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="title"\r\n\r\n'
        f"{title}\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode() + file_bytes + f"\r\n--{boundary}--\r\n".encode()

    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    if COOKIE:
        req.add_header("Cookie", COOKIE)

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        raise RuntimeError(f"HTTP {e.code}: {body_text}") from e


# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────
def main() -> int:
    print(f"\n🤖 seed_fic_knowledge.py — {'DRY RUN' if DRY_RUN else 'modo real'}")
    print(f"   API: {BASE_URL}")

    agent_id = AGENT_ID

    # 1. Cria agente (se não informado)
    if not agent_id:
        print("\n📦 Criando agente 'FIC Secretaria'…")
        if DRY_RUN:
            print(f"   [dry-run] POST /api/atendimento/ds-agentes")
            print(f"   payload: {json.dumps(FIC_AGENT, ensure_ascii=False, indent=2)}")
            agent_id = "dry-run-agent-id"
        else:
            result = api_post("/api/atendimento/ds-agentes", FIC_AGENT)
            agent_id = result["agent"]["id"]
            print(f"   ✅ Agente criado: {agent_id}")
    else:
        print(f"\n♻️  Usando agente existente: {agent_id}")

    # 2. Ingesta base embutida
    for doc in KNOWLEDGE_BASE:
        print(f"\n📄 Ingestando: {doc['title']}")
        if DRY_RUN:
            print(f"   [dry-run] POST /api/atendimento/ds-agentes/{agent_id}/knowledge")
            print(f"   chars: {len(doc['content'])}")
        else:
            result = api_post(
                f"/api/atendimento/ds-agentes/{agent_id}/knowledge",
                {"title": doc["title"], "content": doc["content"]},
            )
            print(f"   ✅ {result.get('chunks_created', '?')} chunk(s) criado(s)")

    # 3. Regulamento acadêmico em PDF (se fornecido)
    if REG_PDF:
        pdf_path = Path(REG_PDF)
        if not pdf_path.exists():
            print(f"\n❌ Arquivo não encontrado: {REG_PDF}")
            return 1
        print(f"\n📑 Ingestando regulamento PDF: {pdf_path.name}")
        if DRY_RUN:
            print(f"   [dry-run] POST multipart {pdf_path} ({pdf_path.stat().st_size} bytes)")
        else:
            result = api_post_file(
                f"/api/atendimento/ds-agentes/{agent_id}/knowledge",
                str(pdf_path),
                "Regulamento Acadêmico FIC",
            )
            print(f"   ✅ {result.get('chunks_created', '?')} chunk(s) criado(s)")
    else:
        print("\n⚠️  REGULAMENTO_PDF não informado. Para ingestar o regulamento real:")
        print("   REGULAMENTO_PDF=/path/to/regulamento.pdf python scripts/seed_fic_knowledge.py")

    print(f"\n✅ Seed concluído! Agente ID: {agent_id}")
    print("\n📋 Próximos passos:")
    print("   1. Acesse /atendimento/ds-agente e abra o Playground para validar")
    print("   2. Configure as tags de ativação (P-130: definir tags 'matricula', 'duvida')")
    print("   3. Cadastre OPENAI_API_KEY no vault (P-130)")
    print("   4. Ative a flag ATENDIMENTO_DS_AGENTE_ENABLED=true em dev para testar")
    print("   5. Ative o agente em staging → prod após validação (P-132)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
