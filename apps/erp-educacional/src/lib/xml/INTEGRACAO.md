# Guia de Integração — Motor XML

Como integrar o motor de geração XML em diferentes camadas da aplicação.

---

## 1. Endpoint API Next.js

### Gerar XMLs de um diploma

```typescript
// app/api/diplomas/[id]/xml/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { montarDadosDiploma } from '@/lib/xml/montador';
import { gerarXMLs } from '@/lib/xml/gerador';
import { validarDiplomaDigital } from '@/lib/xml/validador';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Inicializar cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Buscar dados
    const dados = await montarDadosDiploma(supabase, params.id);

    // 3. Gerar XMLs
    const xmls = gerarXMLs(dados);

    // 4. Validar
    const validacao = validarDiplomaDigital(xmls.diploma_digital);

    if (!validacao.valido) {
      return NextResponse.json(
        { erro: 'XML gerado contém erros', detalhes: validacao.erros },
        { status: 400 }
      );
    }

    // 5. Retornar com sucesso
    return NextResponse.json({
      sucesso: true,
      codigo_validacao: dados.diploma.codigo_validacao,
      xmls: {
        diploma_digital: xmls.diploma_digital,
        historico_escolar: xmls.historico_escolar,
        doc_academica_registro: xmls.doc_academica_registro,
      },
      metadados: {
        diplomado_nome: dados.diplomado.nome,
        curso_nome: dados.curso.nome,
        // Bug #E (Onda 2): data_expedicao foi removido do tipo DadosDiploma.
        // Para metadados de log/portal, leia diretamente da tabela diplomas
        // (coluna data_expedicao) ou do retorno da registradora.
      },
    });

  } catch (error) {
    console.error('Erro ao gerar XMLs:', error);

    return NextResponse.json(
      {
        erro: 'Erro ao gerar XMLs',
        detalhes:
          error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
```

### Baixar XML como arquivo

```typescript
// app/api/diplomas/[id]/xml/download/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { montarDadosDiploma } from '@/lib/xml/montador';
import { gerarXMLs } from '@/lib/xml/gerador';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const tipo = request.nextUrl.searchParams.get('tipo') || 'diploma_digital';

    const dados = await montarDadosDiploma(supabase, params.id);
    const xmls = gerarXMLs(dados);

    const tipoMap: Record<string, [string, string]> = {
      diploma_digital: [xmls.diploma_digital, 'diploma-digital.xml'],
      historico_escolar: [xmls.historico_escolar, 'historico-escolar.xml'],
      doc_academica_registro: [
        xmls.doc_academica_registro,
        'doc-academica-registro.xml',
      ],
    };

    const [conteudo, nomeArquivo] = tipoMap[tipo] || tipoMap.diploma_digital;

    return new NextResponse(conteudo, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      },
    });

  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao baixar XML' },
      { status: 500 }
    );
  }
}
```

---

## 2. Salvar XMLs em Armazenamento (R2/Storage)

### Com Cloudflare R2

```typescript
// lib/xml/storage.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { XMLsGerados } from './gerador';

const s3Client = new S3Client({
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  endpoint: process.env.R2_ENDPOINT!,
});

export async function salvarXMLsEmR2(
  xmls: XMLsGerados,
  diplomaId: string
): Promise<{ diploma_digital: string; historico: string; doc_academica: string }> {
  const baseKey = `xmls/${diplomaId}`;
  const timestamp = new Date().toISOString().split('T')[0];

  const uploads = [
    {
      key: `${baseKey}/${timestamp}_diploma_digital.xml`,
      body: xmls.diploma_digital,
    },
    {
      key: `${baseKey}/${timestamp}_historico_escolar.xml`,
      body: xmls.historico_escolar,
    },
    {
      key: `${baseKey}/${timestamp}_doc_academica_registro.xml`,
      body: xmls.doc_academica_registro,
    },
  ];

  const urls: Record<string, string> = {};

  for (const { key, body } of uploads) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: body,
        ContentType: 'application/xml',
        Metadata: {
          'diploma-id': diplomaId,
          'generated-at': new Date().toISOString(),
        },
      })
    );

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    urls[key.split('/').pop()?.replace('.xml', '') || 'unknown'] = publicUrl;
  }

  return {
    diploma_digital: urls['timestamp_diploma_digital'],
    historico: urls['timestamp_historico_escolar'],
    doc_academica: urls['timestamp_doc_academica_registro'],
  };
}
```

### Com Supabase Storage

```typescript
// lib/xml/storage-supabase.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { XMLsGerados } from './gerador';

export async function salvarXMLsEmSupabase(
  supabase: SupabaseClient,
  xmls: XMLsGerados,
  diplomaId: string
): Promise<{ diploma_digital: string; historico: string; doc_academica: string }> {
  const baseFolder = `diplomasxml/${diplomaId}`;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const files = [
    { name: `${timestamp}_diploma_digital.xml`, content: xmls.diploma_digital },
    { name: `${timestamp}_historico_escolar.xml`, content: xmls.historico_escolar },
    {
      name: `${timestamp}_doc_academica_registro.xml`,
      content: xmls.doc_academica_registro,
    },
  ];

  const urls: Record<string, string> = {};

  for (const { name, content } of files) {
    const { data, error } = await supabase.storage
      .from('diplomas-xml')
      .upload(`${baseFolder}/${name}`, new Blob([content]), {
        contentType: 'application/xml',
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('diplomas-xml')
      .getPublicUrl(data.path);

    urls[name.replace('.xml', '')] = urlData.publicUrl;
  }

  return {
    diploma_digital: urls[`${timestamp}_diploma_digital`],
    historico: urls[`${timestamp}_historico_escolar`],
    doc_academica: urls[`${timestamp}_doc_academica_registro`],
  };
}
```

---

## 3. Integração no Painel Administrativo

### Componente React para gerar XMLs

```typescript
// components/painel/diploma-xml-generator.tsx

'use client';

import { useState } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

export function DiplomaXMLGenerator({ diplomaId }: { diplomaId: string }) {
  const supabase = useSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  const gerar = async () => {
    setLoading(true);
    setErro(null);

    try {
      const response = await fetch(`/api/diplomas/${diplomaId}/xml`);

      if (!response.ok) {
        throw new Error('Erro ao gerar XMLs');
      }

      const data = await response.json();
      setResultado(data);

    } catch (error) {
      setErro(
        error instanceof Error ? error.message : 'Erro desconhecido'
      );
    } finally {
      setLoading(false);
    }
  };

  const baixar = (tipo: string) => {
    window.location.href = `/api/diplomas/${diplomaId}/xml/download?tipo=${tipo}`;
  };

  return (
    <div className="space-y-4">
      <button
        onClick={gerar}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        {loading ? 'Gerando...' : 'Gerar XMLs'}
      </button>

      {erro && (
        <div className="p-3 bg-red-100 text-red-700 rounded">
          {erro}
        </div>
      )}

      {resultado && (
        <div className="space-y-2">
          <div className="p-3 bg-green-100 text-green-700 rounded">
            ✓ XMLs gerados com sucesso!
          </div>

          <div className="space-y-1 text-sm">
            <div>
              <strong>Código de Validação:</strong>{' '}
              {resultado.codigo_validacao}
            </div>
            <div>
              <strong>Diplomado:</strong> {resultado.metadados.diplomado_nome}
            </div>
            <div>
              <strong>Curso:</strong> {resultado.metadados.curso_nome}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => baixar('diploma_digital')}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm"
            >
              Diploma Digital
            </button>
            <button
              onClick={() => baixar('historico_escolar')}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm"
            >
              Histórico
            </button>
            <button
              onClick={() => baixar('doc_academica_registro')}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm"
            >
              Doc. Acadêmica
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 4. Job de Geração em Massa

### Supabase Functions / Edge Functions

```typescript
// supabase/functions/gerar-xmls-diploma/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { diplomaId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Importar e executar geração
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/api/diplomas/${diplomaId}/xml`,
      {
        headers: {
          'authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
      }
    );

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ erro: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    }
    );
  }
});
```

---

## 5. Webhook MEC

### Notificar MEC após geração

```typescript
// lib/xml/webhook-mec.ts

export async function notificarMECGeracaoXML(
  diplomaId: string,
  codigoValidacao: string,
  urlRepositorio: string
): Promise<void> {
  const payload = {
    tipo: 'diploma_digital_gerado',
    diploma_id: diplomaId,
    codigo_validacao: codigoValidacao,
    url_repositorio: urlRepositorio,
    timestamp: new Date().toISOString(),
  };

  const response = await fetch(
    process.env.WEBHOOK_MEC_URL || 'https://diplomadigital.mec.gov.br/webhook',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WEBHOOK_MEC_TOKEN}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao notificar MEC: ${response.statusText}`);
  }
}
```

---

## 6. Testes Automatizados

### Com Vitest

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

```typescript
// lib/xml/__tests__/integracao.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { montarDadosDiploma } from '../montador';
import { gerarXMLs } from '../gerador';
import { validarDiplomaDigital } from '../validador';

describe('Integração XML com Banco', () => {
  let supabase: any;

  beforeAll(() => {
    supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  });

  it('deve gerar XMLs válidos a partir do banco', async () => {
    // Use um diploma de teste do seu banco
    const diplomaId = 'seu-diploma-de-teste-uuid';

    const dados = await montarDadosDiploma(supabase, diplomaId);
    const xmls = gerarXMLs(dados);
    const validacao = validarDiplomaDigital(xmls.diploma_digital);

    expect(validacao.valido).toBe(true);
  });
});
```

---

## 7. Variáveis de Ambiente Necessárias

```env
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# Cloudflare R2 (opcional)
R2_ENDPOINT=https://xxxxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxxxx
R2_SECRET_ACCESS_KEY=xxxxx
R2_BUCKET_NAME=diplomas-xml
R2_PUBLIC_URL=https://diplomas-xml.xxxxx.com

# Webhooks
WEBHOOK_MEC_URL=https://diplomadigital.mec.gov.br/webhook
WEBHOOK_MEC_TOKEN=xxxxx
```

---

## 8. Monitoramento e Logs

### Com Sentry

```typescript
// lib/xml/logging.ts

import * as Sentry from '@sentry/nextjs';

export async function registrarGeracaoXML(
  diplomaId: string,
  resultado: 'sucesso' | 'erro',
  detalhes?: Record<string, any>
): Promise<void> {
  Sentry.captureMessage(
    `Geração XML - ${resultado}`,
    resultado === 'erro' ? 'error' : 'info'
  );

  // Log estruturado em banco
  // await supabase.from('logs_xml').insert({
  //   diploma_id: diplomaId,
  //   resultado,
  //   detalhes,
  //   timestamp: new Date(),
  // });
}
```

---

## Checklist de Implantação

- [ ] Criar tabelas no banco (ver BANCO.md)
- [ ] Definir variáveis de ambiente
- [ ] Criar endpoints API (`/api/diplomas/[id]/xml`)
- [ ] Testar geração com dados de teste
- [ ] Validar XMLs com XSD oficial do MEC
- [ ] Integrar armazenamento (R2 ou Storage)
- [ ] Criar UI no painel administrativo
- [ ] Testes automatizados rodando
- [ ] Logs e monitoramento em produção
- [ ] Documentação atualizada
- [ ] Backup de XMLs gerados

---

**Status:** Em Desenvolvimento
**Próximo Passo:** Integração com assinatura digital (BRy/Certisign)
