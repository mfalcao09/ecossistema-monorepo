#!/usr/bin/env python3
"""Converte PLANO-REFORMULACAO-ATENDIMENTO-FIC.md → HTML estilizado com design tokens Nexvy."""

import re
from pathlib import Path
import markdown

HERE = Path(__file__).parent
MD = HERE / "PLANO-REFORMULACAO-ATENDIMENTO-FIC.md"
OUT = HERE / "PLANO-REFORMULACAO-ATENDIMENTO-FIC.html"

md_src = MD.read_text(encoding="utf-8")

# Gera HTML do corpo com tabelas, TOC, code fences, footnotes
md = markdown.Markdown(
    extensions=[
        "tables",
        "fenced_code",
        "codehilite",
        "attr_list",
        "def_list",
        "toc",
        "pymdownx.tilde",
        "pymdownx.caret",
        "pymdownx.details",
        "pymdownx.superfences",
        "pymdownx.tasklist",
    ],
    extension_configs={
        "toc": {"permalink": "#", "permalink_class": "anchor"},
        "codehilite": {"guess_lang": False, "css_class": "highlight"},
        "pymdownx.tasklist": {"custom_checkbox": True},
    },
    output_format="html5",
)

body_html = md.convert(md_src)
toc_html = md.toc  # HTML do sumário

TEMPLATE = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Plano de Reformulação Total — Módulo de Atendimento FIC</title>
<style>
/* ===== Design tokens Nexvy ===== */
:root {
  --primary: #345EF3;
  --primary-hover: #2B4ECF;
  --primary-bg: #EEF1FE;
  --bg: #FFFFFF;
  --bg-subtle: #F5F7FA;
  --bg-muted: #F0F2F5;
  --border: #E4E7EC;
  --border-strong: #D0D5DD;
  --text: #1D2939;
  --text-muted: #667085;
  --text-subtle: #98A2B3;
  --success: #12B76A;
  --warning: #F79009;
  --danger: #F04438;
  --info: #0BA5EC;
  --font-body: 'Roboto', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;
  --shadow-sm: 0 1px 2px rgba(16,24,40,0.06);
  --shadow-md: 0 4px 8px -2px rgba(16,24,40,0.1);
  --sidebar-w: 320px;
}

* { box-sizing: border-box; }

html, body {
  margin: 0; padding: 0;
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.65;
  color: var(--text);
  background: var(--bg-subtle);
}

/* ===== Layout ===== */
.wrap {
  display: grid;
  grid-template-columns: var(--sidebar-w) 1fr;
  min-height: 100vh;
}

/* Sidebar TOC */
aside.toc {
  background: var(--bg);
  border-right: 1px solid var(--border);
  padding: 24px 20px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  font-size: 13px;
}
aside.toc .header {
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
aside.toc .header h2 {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--primary);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
aside.toc .header p {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}
aside.toc ul {
  list-style: none;
  padding-left: 0;
  margin: 0;
}
aside.toc > ul > li { margin-bottom: 4px; }
aside.toc ul ul {
  padding-left: 12px;
  margin-top: 4px;
  margin-bottom: 8px;
}
aside.toc a {
  color: var(--text);
  text-decoration: none;
  display: block;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
  line-height: 1.4;
}
aside.toc a:hover {
  background: var(--primary-bg);
  color: var(--primary);
}
aside.toc ul ul a {
  color: var(--text-muted);
  font-size: 12.5px;
}
aside.toc ul ul ul a {
  color: var(--text-subtle);
  font-size: 12px;
}

/* Main */
main {
  padding: 56px 64px 80px;
  max-width: 1080px;
  margin: 0 auto;
  background: var(--bg);
  min-height: 100vh;
  box-shadow: var(--shadow-md);
}

@media (max-width: 1100px) {
  .wrap { grid-template-columns: 1fr; }
  aside.toc { display: none; }
  main { padding: 32px 24px; }
}

/* ===== Typography ===== */
h1, h2, h3, h4, h5, h6 {
  color: var(--text);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.25;
  scroll-margin-top: 24px;
}
h1 {
  font-size: 32px;
  margin-top: 0;
  margin-bottom: 8px;
  padding-bottom: 16px;
  border-bottom: 3px solid var(--primary);
}
h2 {
  font-size: 24px;
  margin-top: 48px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
h3 {
  font-size: 19px;
  margin-top: 32px;
  margin-bottom: 8px;
  color: var(--primary);
}
h4 { font-size: 16px; margin-top: 24px; margin-bottom: 6px; }
h5 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin-top: 20px; margin-bottom: 4px; }

p { margin: 8px 0 14px; }

a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
a.anchor {
  visibility: hidden;
  margin-left: 8px;
  color: var(--text-subtle);
  font-weight: 400;
  font-size: 0.8em;
}
h1:hover a.anchor, h2:hover a.anchor, h3:hover a.anchor, h4:hover a.anchor {
  visibility: visible;
}

strong { color: var(--text); font-weight: 700; }
em { color: var(--text); }

/* ===== Lists ===== */
ul, ol { padding-left: 24px; margin: 10px 0 16px; }
li { margin: 4px 0; }
li::marker { color: var(--primary); }

/* ===== Code ===== */
code {
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--primary-bg);
  color: #1A3FC7;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(52, 94, 243, 0.12);
}
pre {
  background: #0F1729;
  color: #E4E7EC;
  padding: 16px 20px;
  border-radius: var(--radius-lg);
  overflow-x: auto;
  margin: 16px 0;
  font-size: 13px;
  line-height: 1.55;
  box-shadow: var(--shadow-sm);
}
pre code {
  background: transparent;
  color: inherit;
  border: none;
  padding: 0;
  font-size: inherit;
}

/* ===== Tables ===== */
table {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0 24px;
  font-size: 13.5px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg);
  box-shadow: var(--shadow-sm);
}
thead {
  background: var(--primary-bg);
}
th {
  text-align: left;
  padding: 12px 16px;
  font-weight: 700;
  color: var(--text);
  border-bottom: 2px solid var(--primary);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
td {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--bg-subtle); }

/* ===== Blockquote ===== */
blockquote {
  border-left: 4px solid var(--primary);
  background: var(--primary-bg);
  margin: 16px 0;
  padding: 12px 20px;
  color: var(--text);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}
blockquote p { margin: 4px 0; }

/* ===== Horizontal rule ===== */
hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 40px 0;
}

/* ===== Status/emoji markers (inline) ===== */
/* Auto-color ✅🔄❌⏭️🔴🟡🟢🟠 left alone — emojis keep their own color */

/* Callout boxes via [!TIP], [!WARNING] etc — não usamos no MD, mas preparado */
.callout {
  padding: 12px 16px;
  border-radius: var(--radius-md);
  margin: 16px 0;
  border-left: 4px solid var(--info);
  background: rgba(11, 165, 236, 0.08);
}

/* ===== Print ===== */
@media print {
  .wrap { display: block; }
  aside.toc { display: none; }
  main { box-shadow: none; padding: 0; max-width: 100%; }
  pre, table { page-break-inside: avoid; }
  h1, h2, h3 { page-break-after: avoid; }
  a { color: var(--text); text-decoration: none; }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.8em; color: var(--text-muted); }
  body { background: white; font-size: 11pt; }
}

/* ===== Hero ===== */
.hero {
  background: linear-gradient(135deg, var(--primary) 0%, #1E40AF 100%);
  color: white;
  padding: 40px 48px;
  border-radius: var(--radius-lg);
  margin-bottom: 40px;
  box-shadow: var(--shadow-md);
}
.hero h1 {
  color: white;
  border-bottom: none;
  margin: 0 0 8px;
  padding: 0;
  font-size: 32px;
}
.hero .subtitle {
  font-size: 16px;
  opacity: 0.95;
  margin: 0;
}
.hero .meta {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.2);
  font-size: 13px;
}
.hero .meta span { opacity: 0.9; }
.hero .meta strong { opacity: 1; }

/* ===== Code highlight (pygments) ===== */
.highlight .hll { background-color: #49483e }
.highlight .c { color: #75715e; font-style: italic }
.highlight .k { color: #66d9ef }
.highlight .n { color: #f8f8f2 }
.highlight .p { color: #f8f8f2 }
.highlight .s { color: #e6db74 }
.highlight .na { color: #a6e22e }
.highlight .nb { color: #ae81ff }
.highlight .nc { color: #a6e22e }
.highlight .nf { color: #a6e22e }
.highlight .s1 { color: #e6db74 }
.highlight .s2 { color: #e6db74 }

/* Footer */
.footer {
  margin-top: 60px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}
</style>
</head>
<body>
<div class="wrap">
  <aside class="toc">
    <div class="header">
      <h2>Navegação</h2>
      <p>Plano mestre — S089</p>
    </div>
    __TOC__
  </aside>
  <main>
    <div class="hero">
      <h1>Plano de Reformulação Total — Módulo de Atendimento FIC</h1>
      <p class="subtitle">O melhor módulo de atendimento educacional do Brasil · baseado em benchmark DKW/Nexvy/helenaCRM</p>
      <div class="meta">
        <span><strong>Criado:</strong> 2026-04-20 · Sessão S089</span>
        <span><strong>Supersede:</strong> plano v2 (13/04)</span>
        <span><strong>Base:</strong> 58 vídeos · 1.726 frames · 225 screenshots</span>
      </div>
    </div>
    __BODY__
    <div class="footer">
      Fonte única de verdade para o módulo Atendimento FIC · Gerado a partir de <code>PLANO-REFORMULACAO-ATENDIMENTO-FIC.md</code>
    </div>
  </main>
</div>
</body>
</html>
"""

# Remove o H1 do body (já está no hero) e o bloco de metadados inicial
body_html = re.sub(
    r'<h1[^>]*>Plano de Reformulação Total[^<]*</h1>\s*(?:<p[^>]*>[^<]*(?:<[^>]+>[^<]*</[^>]+>[^<]*)*?</p>\s*){1,6}',
    '',
    body_html,
    count=1,
)

html = TEMPLATE.replace("__TOC__", toc_html).replace("__BODY__", body_html)
OUT.write_text(html, encoding="utf-8")

size_kb = OUT.stat().st_size // 1024
print(f"[ok] {OUT.name} gerado ({size_kb}KB)")
