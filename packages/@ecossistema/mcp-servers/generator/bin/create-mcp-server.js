#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * create-mcp-server
 * -----------------
 * Gera um novo MCP server copiando packages/@ecossistema/mcp-servers/template/
 * e substituindo placeholders.
 */
'use strict';

const path = require('node:path');
const { program } = require('commander');
const fs = require('fs-extra');
const YAML = require('yaml');

// --------------------------------------------------------------------- utils
function toSnake(name) {
  return name.replace(/-/g, '_').replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()).replace(/^_/, '');
}
function toKebab(name) {
  return name.replace(/_/g, '-').toLowerCase();
}
function validName(name) {
  return /^[a-z][a-z0-9-]*$/.test(name);
}
function findMonorepoRoot(start) {
  let cur = start;
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'pnpm-workspace.yaml'))) return cur;
    cur = path.dirname(cur);
  }
  throw new Error('pnpm-workspace.yaml não encontrado — estou no monorepo?');
}
async function replaceInFile(filePath, replacements) {
  if (!(await fs.pathExists(filePath))) return;
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) return;
  let content = await fs.readFile(filePath, 'utf8');
  for (const [from, to] of replacements) content = content.split(from).join(to);
  await fs.writeFile(filePath, content, 'utf8');
}
async function walk(dir, fn) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__pycache__' || entry.name === '.pytest_cache') continue;
      await walk(full, fn);
    } else {
      await fn(full);
    }
  }
}

// ------------------------------------------------------------------ commands
program
  .name('create-mcp-server')
  .argument('<name>', 'nome do MCP server (kebab-case, ex: whatsapp)')
  .option('--business <id>', 'business_id do registry', 'ecosystem')
  .option('--tools <list>', 'tools separadas por vírgula', '')
  .option('--resources <list>', 'resource URIs separadas por vírgula', '')
  .option('--dry-run', 'só imprime o plano', false)
  .action(async (rawName, opts) => {
    const name = toKebab(rawName);
    if (!validName(name)) {
      console.error(`[erro] nome inválido: ${rawName}. Use kebab-case (ex: whatsapp-mcp).`);
      process.exit(1);
    }
    const serverName = name.endsWith('-mcp') ? name : `${name}-mcp`;
    const pyPkgName = toSnake(serverName);
    const tools = opts.tools.split(',').map((s) => s.trim()).filter(Boolean);
    const resources = opts.resources.split(',').map((s) => s.trim()).filter(Boolean);

    const root = findMonorepoRoot(process.cwd());
    const mcpBase = path.join(root, 'packages', '@ecossistema', 'mcp-servers');
    const templateDir = path.join(mcpBase, 'template');
    const targetDir = path.join(mcpBase, serverName);

    if (!(await fs.pathExists(templateDir))) {
      console.error(`[erro] template não encontrado em ${templateDir}`);
      process.exit(1);
    }
    if (await fs.pathExists(targetDir)) {
      console.error(`[erro] já existe: ${targetDir}`);
      process.exit(1);
    }

    console.log(`\n→ Gerando ${serverName} (${pyPkgName})`);
    console.log(`  business : ${opts.business}`);
    console.log(`  tools    : ${tools.length ? tools.join(', ') : '(nenhum)'}`);
    console.log(`  resources: ${resources.length ? resources.join(', ') : '(nenhum)'}`);
    console.log(`  destino  : ${path.relative(root, targetDir)}\n`);

    if (opts.dryRun) {
      console.log('[dry-run] — não vou modificar arquivos.');
      process.exit(0);
    }

    // 1. Copia o template (exceto caches).
    await fs.copy(templateDir, targetDir, {
      filter: (src) => !src.includes('__pycache__') && !src.includes('.pytest_cache'),
    });

    // 2. Renomeia a pasta do pacote Python.
    const srcOld = path.join(targetDir, 'src', 'template_mcp');
    const srcNew = path.join(targetDir, 'src', pyPkgName);
    if (await fs.pathExists(srcOld)) await fs.move(srcOld, srcNew);

    // 3. Substitui placeholders em todos os arquivos.
    const replacements = [
      ['template-mcp', serverName],
      ['template_mcp', pyPkgName],
      ['Template MCP', toTitle(serverName)],
    ];
    await walk(targetDir, async (file) => {
      const rel = path.relative(targetDir, file);
      if (
        rel.endsWith('.py') ||
        rel.endsWith('.toml') ||
        rel.endsWith('.md') ||
        rel.endsWith('.json') ||
        rel.endsWith('.yaml') ||
        rel.endsWith('.yml') ||
        rel.endsWith('Dockerfile') ||
        rel.endsWith('.env.example')
      ) {
        await replaceInFile(file, replacements);
      }
    });

    // 4. Stubs de tools e resources.
    for (const t of tools) {
      const file = path.join(srcNew, 'tools', `${toSnake(t)}.py`);
      await fs.writeFile(
        file,
        toolStub(toSnake(t), pyPkgName),
        'utf8'
      );
    }
    for (const r of resources) {
      const safe = toSnake(r.replace(/[:\/.]/g, '_'));
      const file = path.join(srcNew, 'resources', `${safe}.py`);
      await fs.writeFile(file, resourceStub(r, safe, pyPkgName), 'utf8');
    }

    // 5. Atualiza registry.yaml.
    const registryPath = path.join(mcpBase, 'registry.yaml');
    const registryRaw = await fs.readFile(registryPath, 'utf8');
    const registry = YAML.parse(registryRaw) || { version: 1, servers: [] };
    registry.servers = registry.servers || [];
    if (registry.servers.some((s) => s.name === serverName)) {
      console.warn(`[aviso] ${serverName} já existe no registry; pulando.`);
    } else {
      registry.servers.push({
        name: serverName,
        business: opts.business,
        path: `packages/@ecossistema/mcp-servers/${serverName}`,
        status: 'planned',
        runtime: 'railway',
        tools,
        resources,
        scopes: ['operator'],
      });
      await fs.writeFile(registryPath, YAML.stringify(registry), 'utf8');
    }

    console.log(`✅  Criado ${path.relative(root, targetDir)}`);
    console.log(`   Próximos passos:`);
    console.log(`   1) cd ${path.relative(root, targetDir)}`);
    console.log(`   2) cp .env.example .env  (preencha)`);
    console.log(`   3) pip install -e ".[dev]"`);
    console.log(`   4) python -m ${pyPkgName}.server`);
  });

program.parse();

// ------------------------------------------------------------------- helpers
function toTitle(kebab) {
  return kebab
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function toolStub(toolName, pkg) {
  return `"""Tool \`${toolName}\` — gerado por create-mcp-server (stub)."""
from __future__ import annotations

from ..auth.scopes import require_scope


def register(mcp: "object") -> None:  # pragma: no cover
    @mcp.tool  # type: ignore[attr-defined]
    @require_scope("operator")
    def ${toolName}() -> dict:
        """TODO: descrever ${toolName}."""
        raise NotImplementedError("Implementar ${toolName} em ${pkg}.tools.${toolName}")
`;
}

function resourceStub(uri, safeName, pkg) {
  return `"""Resource \`${uri}\` — gerado por create-mcp-server (stub)."""
from __future__ import annotations

from ..auth.scopes import require_scope


def register(mcp: "object") -> None:  # pragma: no cover
    @mcp.resource("${uri}")  # type: ignore[attr-defined]
    @require_scope("reader")
    def ${safeName}() -> dict:
        """TODO: implementar ${uri}."""
        raise NotImplementedError("Implementar ${uri} em ${pkg}.resources.${safeName}")
`;
}
