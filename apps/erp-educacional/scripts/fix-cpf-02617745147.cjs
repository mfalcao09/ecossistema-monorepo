#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const CPF = '02617745147';
const KITS = path.join(__dirname, '..', 'reference', 'xmls-legado', 'KITs', CPF);

// Lê .env.local
const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'documentos-digitais';

async function uploadFile(fileName, contentType) {
  const filePath = path.join(KITS, fileName);
  const buf = fs.readFileSync(filePath);
  console.log(`Uploading ${fileName} (${(buf.length / 1024 / 1024).toFixed(1)}MB)...`);

  const url = new URL(`/storage/v1/object/${BUCKET}/legado/${CPF}/${fileName}`, SUPABASE_URL);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'apikey': KEY,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buf,
  });

  if (response.ok) {
    console.log(`  ✅ ${fileName} OK`);
  } else {
    const text = await response.text();
    console.error(`  ❌ ${fileName} FAIL: ${response.status} - ${text}`);
  }
}

(async () => {
  console.log(`Fix upload para CPF ${CPF}`);
  await uploadFile(`${CPF}_diploma.xml`, 'application/xml');
  await uploadFile(`${CPF}_historico.xml`, 'application/xml');
  console.log('Done!');
})();
