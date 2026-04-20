#!/usr/bin/env node
/**
 * create-csuite-agent — CLI para instanciar agentes C-Suite e Diretores de Área
 *
 * Uso:
 *   pnpm create-csuite-agent --business fic --role cfo
 *   pnpm create-csuite-agent --business ecosystem --role d-governanca
 *   pnpm create-csuite-agent --business nexvy --role ceo --variant saas
 *   pnpm create-csuite-agent --list
 */

import { program } from 'commander';
import { generate, listTemplates } from '../dist/index.js';

program
  .name('create-csuite-agent')
  .description('Instancia agentes C-Suite e Diretores de Área do Ecossistema de IA')
  .version('0.1.0');

program
  .option(
    '--business <id>',
    'Negócio: fic | klesis | intentus | splendori | nexvy | ecosystem'
  )
  .option(
    '--role <role>',
    'Role: ceo | cfo | cao | cmo | cso | clo | coo | cto | cpo | chro | d-<area>'
  )
  .option(
    '--variant <setor>',
    'Variant: educacao | imobiliario | saas (auto-detectado do business se omitido)'
  )
  .option(
    '--target-dir <dir>',
    'Override do diretório destino (default: apps/{business}/agents/{role}/)'
  )
  .option(
    '--list',
    'Listar todos os templates disponíveis'
  )
  .action(async (opts) => {
    if (opts.list) {
      const templates = await listTemplates();
      console.log('\n📋 Templates disponíveis:\n');
      console.log('C-Suite:');
      for (const t of templates.cSuite) console.log(`  - ${t}`);
      console.log('\nDiretores de Área:');
      for (const t of templates.directors) console.log(`  - ${t}`);
      console.log('\nOrquestrador:');
      for (const t of templates.others) console.log(`  - ${t}`);
      console.log('');
      return;
    }

    if (!opts.business) {
      console.error('❌ --business é obrigatório');
      console.error('   Exemplo: --business fic --role cfo');
      process.exit(1);
    }

    if (!opts.role) {
      console.error('❌ --role é obrigatório');
      console.error('   Exemplo: --business fic --role cfo');
      process.exit(1);
    }

    const validBusinesses = ['fic', 'klesis', 'intentus', 'splendori', 'nexvy', 'ecosystem'];
    if (!validBusinesses.includes(opts.business)) {
      console.error(`❌ business "${opts.business}" inválido.`);
      console.error(`   Válidos: ${validBusinesses.join(' | ')}`);
      process.exit(1);
    }

    try {
      await generate({
        business: opts.business,
        role: opts.role,
        variant: opts.variant,
        targetDir: opts.targetDir,
        verbose: true,
      });
    } catch (err) {
      console.error(`\n❌ Erro ao criar agente: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
