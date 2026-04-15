#!/usr/bin/env node
/**
 * extrair-registro-xmls.cjs
 *
 * Baixa cada _historico.xml do Storage público,
 * extrai NumeroRegistro, DataRegistroDiploma, LivroRegistro, ProcessoDoDiploma
 * e atualiza a tabela diplomas.
 *
 * Uso:
 *   node scripts/extrair-registro-xmls.cjs --diagnostico
 *   node scripts/extrair-registro-xmls.cjs --executar
 */

const https = require('https');
const http = require('http');

// ── Config Supabase ─────────────────────────────────────────
const SUPABASE_URL = 'https://ifdnjieklngcfodmtied.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ Defina SUPABASE_SERVICE_ROLE_KEY no ambiente');
  process.exit(1);
}

const modo = process.argv[2] || '--diagnostico';
const EXECUTAR = modo === '--executar';

// ── Helpers ─────────────────────────────────────────────────
function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, {
      method: options.method || 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': options.prefer || '',
        ...options.headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extrairTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}>([^<]+)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔍 Modo: ${EXECUTAR ? 'EXECUTAR' : 'DIAGNÓSTICO'}\n`);

  // Buscar todos diplomas legados sem numero_registro
  const diplomas = await fetchJson(
    `${SUPABASE_URL}/rest/v1/diplomas?is_legado=eq.true&numero_registro=is.null&select=id,xml_url,diplomado_id`,
  );

  if (!Array.isArray(diplomas)) {
    console.error('❌ Erro ao buscar diplomas:', diplomas);
    return;
  }

  console.log(`📋 ${diplomas.length} diplomas sem numero_registro\n`);

  let sucesso = 0;
  let semDados = 0;
  let erros = 0;
  const resultados = [];

  for (const diploma of diplomas) {
    try {
      if (!diploma.xml_url) {
        console.log(`  ⚠️  ${diploma.id} — sem xml_url`);
        semDados++;
        continue;
      }

      // O xml_url aponta para _historico.xml que tem os DadosRegistro
      const xmlContent = await fetchText(diploma.xml_url);

      if (!xmlContent || xmlContent.length < 100) {
        console.log(`  ⚠️  ${diploma.id} — XML vazio ou inacessível`);
        semDados++;
        continue;
      }

      const numeroRegistro = extrairTag(xmlContent, 'NumeroRegistro');
      const dataRegistro = extrairTag(xmlContent, 'DataRegistroDiploma');
      const livroRegistro = extrairTag(xmlContent, 'LivroRegistro');
      const processoDiploma = extrairTag(xmlContent, 'ProcessoDoDiploma');
      const dataExpedicao = extrairTag(xmlContent, 'DataExpedicaoDiploma');

      if (!numeroRegistro) {
        console.log(`  ⚠️  ${diploma.id} — NumeroRegistro não encontrado no XML`);
        semDados++;
        continue;
      }

      const dados = {
        diploma_id: diploma.id,
        numero_registro: numeroRegistro,
        data_registro: dataRegistro,
        livro_registro: livroRegistro,
        processo_diploma: processoDiploma,
        data_expedicao: dataExpedicao,
      };

      resultados.push(dados);
      console.log(`  ✅ ${diploma.id} — Reg: ${numeroRegistro}, Livro: ${livroRegistro}, Data: ${dataRegistro}`);

      if (EXECUTAR) {
        // Montar update
        const updatePayload = {
          numero_registro: numeroRegistro,
        };
        if (dataRegistro) updatePayload.data_registro = dataRegistro;
        if (dataExpedicao && !diploma.data_expedicao) updatePayload.data_expedicao = dataExpedicao;

        await fetchJson(
          `${SUPABASE_URL}/rest/v1/diplomas?id=eq.${diploma.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify(updatePayload),
            prefer: 'return=minimal',
          }
        );
      }

      sucesso++;
    } catch (err) {
      console.log(`  ❌ ${diploma.id} — Erro: ${err.message}`);
      erros++;
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 RESUMO`);
  console.log(`   Encontrados: ${sucesso}`);
  console.log(`   Sem dados:   ${semDados}`);
  console.log(`   Erros:       ${erros}`);
  console.log(`   Total:       ${diplomas.length}`);
  if (!EXECUTAR && sucesso > 0) {
    console.log(`\n💡 Execute com --executar para salvar no banco`);
  }
  console.log(`${'═'.repeat(60)}\n`);
}

main().catch(console.error);
