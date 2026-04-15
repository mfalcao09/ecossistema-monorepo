#!/usr/bin/env node
/**
 * ============================================================================
 * FIX: Re-upload dos XMLs com nomes corretos no Supabase Storage
 * ============================================================================
 *
 * PROBLEMA:
 *   No bucket, os arquivos estão com nomes invertidos:
 *   - CPF_diploma.xml contém <DocumentacaoAcademicaRegistro> (deveria ser <Diploma>)
 *   - CPF_historico.xml contém <Diploma> (deveria ser <DocumentacaoAcademicaRegistro>)
 *
 * SOLUÇÃO:
 *   Este script re-faz o upload dos arquivos da pasta KITs (que estão corretos)
 *   substituindo os que estão no bucket.
 *
 * COMO USAR:
 *   1. Abra o terminal na raiz do projeto diploma-digital
 *   2. Execute: node scripts/fix-storage-swap.cjs
 *   3. Aguarde — leva alguns minutos para processar ~312 arquivos
 *
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// Carrega variáveis de ambiente do .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'documentos-digitais';
const KITS_DIR = path.join(__dirname, '..', 'reference', 'xmls-legado', 'KITs');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Faltam variáveis SUPABASE no .env.local');
  process.exit(1);
}

async function uploadFile(storagePath, localPath, contentType) {
  const fileBuffer = fs.readFileSync(localPath);
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      'Content-Type': contentType,
      'x-upsert': 'true',  // Substitui se já existe
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }
  return true;
}

async function main() {
  console.log('🔄 Fix Storage Swap — Re-upload dos XMLs com nomes corretos');
  console.log('='.repeat(60));
  console.log(`📁 Pasta KITs: ${KITS_DIR}`);
  console.log(`🌐 Supabase: ${SUPABASE_URL}`);
  console.log(`📦 Bucket: ${BUCKET}`);
  console.log('');

  // Listar todas as pastas de CPF
  const entries = fs.readdirSync(KITS_DIR, { withFileTypes: true });
  const cpfDirs = entries
    .filter(e => e.isDirectory() && /^\d{11}$/.test(e.name))
    .map(e => e.name)
    .sort();

  console.log(`📋 Encontrados ${cpfDirs.length} CPFs para processar`);
  console.log('');

  let ok = 0;
  let erros = [];
  let pulados = 0;

  for (let i = 0; i < cpfDirs.length; i++) {
    const cpf = cpfDirs[i];
    const cpfDir = path.join(KITS_DIR, cpf);
    const diplomaLocal = path.join(cpfDir, `${cpf}_diploma.xml`);
    const historicoLocal = path.join(cpfDir, `${cpf}_historico.xml`);

    try {
      // Upload _diploma.xml (deve conter <Diploma>)
      if (fs.existsSync(diplomaLocal)) {
        await uploadFile(
          `legado/${cpf}/${cpf}_diploma.xml`,
          diplomaLocal,
          'application/xml'
        );
      } else {
        console.warn(`  ⚠️  ${cpf}: _diploma.xml não encontrado localmente`);
        pulados++;
      }

      // Upload _historico.xml (deve conter <DocumentacaoAcademicaRegistro>)
      if (fs.existsSync(historicoLocal)) {
        await uploadFile(
          `legado/${cpf}/${cpf}_historico.xml`,
          historicoLocal,
          'application/xml'
        );
      } else {
        console.warn(`  ⚠️  ${cpf}: _historico.xml não encontrado localmente`);
        pulados++;
      }

      ok++;
      // Progresso a cada 20
      if ((i + 1) % 20 === 0 || i === cpfDirs.length - 1) {
        console.log(`  ✅ Progresso: ${i + 1}/${cpfDirs.length} (${ok} ok, ${erros.length} erros)`);
      }
    } catch (err) {
      erros.push({ cpf, erro: err.message });
      console.error(`  ❌ ${cpf}: ${err.message}`);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('📊 RESULTADO FINAL');
  console.log(`  ✅ Sucesso: ${ok}`);
  console.log(`  ⚠️  Pulados: ${pulados}`);
  console.log(`  ❌ Erros: ${erros.length}`);

  if (erros.length > 0) {
    console.log('');
    console.log('Detalhes dos erros:');
    erros.forEach(e => console.log(`  - ${e.cpf}: ${e.erro}`));
  }

  console.log('');
  console.log('✅ Script finalizado!');
  console.log('   Agora o Claude precisa atualizar as referências no banco.');
  console.log('   Volte para a conversa e diga: "Upload concluído"');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
