/**
 * ============================================================
 * EXEMPLOS PRÁTICOS DE INTEGRAÇÃO — Auditoria no ERP FIC
 * ============================================================
 *
 * Este arquivo contém exemplos completos de como integrar
 * o sistema de auditoria em diferentes contextos do ERP.
 *
 * Copie e adapte os padrões abaixo para suas rotas.
 */

import { NextRequest, NextResponse } from 'next/server'
import { registrarAuditoriaAPI, registrarAuditoria } from '@/lib/security'
import { AcaoAuditoria, EntidadeAuditavel } from '@/lib/security'

// ============================================================
// EXEMPLO 1: Criar Diploma
// ============================================================
/**
 * POST /api/diplomas
 * Cria um novo diploma digital
 */
export async function exemplo_criar_diploma(request: NextRequest) {
  try {
    const usuario = { id: 'uuid-usuario-logado' } // obter do session/JWT
    const novosDados = await request.json()

    // ... validações e processamento ...

    const diplomaCriado = {
      id: 'dip-new-12345',
      diplomado_id: novosDados.diplomado_id,
      curso_id: novosDados.curso_id,
      status: 'rascunho',
      data_emissao: new Date().toISOString(),
    }

    // ✅ REGISTRAR AUDITORIA (não bloqueia resposta)
    registrarAuditoriaAPI(request, {
      usuario_id: usuario.id,
      acao: 'criar',
      entidade: 'diploma',
      entidade_id: diplomaCriado.id,
      detalhes: {
        diplomado_id: diplomaCriado.diplomado_id,
        curso_id: diplomaCriado.curso_id,
        status_inicial: 'rascunho',
        data_emissao: diplomaCriado.data_emissao,
      },
    })

    return NextResponse.json({ sucesso: true, diploma: diplomaCriado })
  } catch (erro) {
    console.error('Erro ao criar diploma:', erro)
    return NextResponse.json({ erro: 'Falha ao criar diploma' }, { status: 500 })
  }
}

// ============================================================
// EXEMPLO 2: Editar Diploma (com tracking de mudanças)
// ============================================================
/**
 * PATCH /api/diplomas/[id]
 * Edita dados existentes do diploma
 */
export async function exemplo_editar_diploma(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const usuario = { id: 'uuid-usuario-logado' }
    const alteracoes = await request.json()

    // Obter diploma anterior
    const diplomaAntigo = {
      id: params.id,
      status: 'rascunho',
      data_assinatura: null,
    }

    // Novo estado
    const diplomaNovo = {
      ...diplomaAntigo,
      ...alteracoes,
    }

    // Detectar campos alterados
    const camposAlterados = Object.keys(alteracoes).filter(
      (chave) => diplomaAntigo[chave as keyof typeof diplomaAntigo] !== alteracoes[chave]
    )

    // ✅ REGISTRAR AUDITORIA
    registrarAuditoriaAPI(request, {
      usuario_id: usuario.id,
      acao: 'editar',
      entidade: 'diploma',
      entidade_id: params.id,
      detalhes: {
        campos_alterados: camposAlterados,
        valores_anteriores: {
          status: diplomaAntigo.status,
        },
        valores_novos: {
          status: diplomaNovo.status,
        },
        motivo: alteracoes.motivo_edicao || 'Ajustes no diploma',
      },
    })

    return NextResponse.json({ sucesso: true, diploma: diplomaNovo })
  } catch (erro) {
    console.error('Erro ao editar diploma:', erro)
    return NextResponse.json({ erro: 'Falha ao editar diploma' }, { status: 500 })
  }
}

// ============================================================
// EXEMPLO 3: Assinar Diploma (processo crítico)
// ============================================================
/**
 * POST /api/diplomas/[id]/assinar
 * Assina digitalmente um diploma
 */
export async function exemplo_assinar_diploma(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const usuario = { id: 'uuid-usuario-logado', role: 'reitor', email: 'reitor@fic.edu.br' }
    const { servico_assinatura } = await request.json()

    // Chamar serviço de assinatura (BRy, Certisign, etc.)
    const resultadoAssinatura = {
      sucesso: true,
      hash: 'abc123def456...',
      timestamp: new Date().toISOString(),
      servico: servico_assinatura,
    }

    // ✅ REGISTRAR AUDITORIA COM DETALHES DE ASSINATURA
    registrarAuditoriaAPI(request, {
      usuario_id: usuario.id,
      acao: 'assinar',
      entidade: 'diploma',
      entidade_id: params.id,
      detalhes: {
        tipo_assinatura: 'XAdES',
        signatario_role: usuario.role,
        signatario_email: usuario.email,
        timestamp: resultadoAssinatura.timestamp,
        servico_assinatura: resultadoAssinatura.servico,
        documento_hash: resultadoAssinatura.hash,
        status_resultado: resultadoAssinatura.sucesso ? 'sucesso' : 'falha',
      },
    })

    return NextResponse.json({ sucesso: true, assinatura: resultadoAssinatura })
  } catch (erro) {
    console.error('Erro ao assinar diploma:', erro)

    // ✅ REGISTRAR TAMBÉM A FALHA
    registrarAuditoriaAPI(request, {
      usuario_id: 'uuid-usuario-logado',
      acao: 'assinar',
      entidade: 'diploma',
      entidade_id: params.id,
      detalhes: {
        tipo_assinatura: 'XAdES',
        status_resultado: 'falha',
        mensagem_erro: erro instanceof Error ? erro.message : 'Erro desconhecido',
      },
    })

    return NextResponse.json({ erro: 'Falha ao assinar diploma' }, { status: 500 })
  }
}

// ============================================================
// EXEMPLO 4: Exportar Relatório
// ============================================================
/**
 * POST /api/relatorios/exportar
 * Exporta lista de diplomas em PDF ou ZIP
 */
export async function exemplo_exportar_relatorio(request: NextRequest) {
  try {
    const usuario = { id: 'uuid-usuario-logado' }
    const { formato, filtros } = await request.json()

    // Simular geração do arquivo
    const registros = 245 // quantidade de registros exportados
    const tamanhoBytes = 1024 * 512 // 512 KB

    // ✅ REGISTRAR AUDITORIA
    registrarAuditoriaAPI(request, {
      usuario_id: usuario.id,
      acao: 'exportar',
      entidade: 'relatorio',
      entidade_id: `relatorio-${Date.now()}`,
      detalhes: {
        tipo: formato.toUpperCase(),
        registros,
        filtros,
        tamanho_bytes: tamanhoBytes,
        motivo: filtros.motivo || 'Relatório de gestão',
      },
    })

    return NextResponse.json({
      sucesso: true,
      download_url: '/downloads/relatorio.pdf',
      registros,
    })
  } catch (erro) {
    console.error('Erro ao exportar relatório:', erro)
    return NextResponse.json({ erro: 'Falha ao exportar' }, { status: 500 })
  }
}

// ============================================================
// EXEMPLO 5: Login (autenticação)
// ============================================================
/**
 * POST /api/auth/login
 * Autentica usuário e registra login
 */
export async function exemplo_login(request: NextRequest) {
  try {
    const { email, senha } = await request.json()

    // Validar credenciais
    const usuarioAutenticado = {
      id: 'uuid-usuario-encontrado',
      email,
      nome: 'João Silva',
    }

    // ✅ REGISTRAR LOGIN
    registrarAuditoriaAPI(request, {
      usuario_id: usuarioAutenticado.id,
      acao: 'login',
      entidade: 'usuario',
      entidade_id: usuarioAutenticado.id,
      detalhes: {
        metodo: 'email',
        email_acessado: email,
        sucesso: true,
      },
    })

    return NextResponse.json({
      sucesso: true,
      usuario: usuarioAutenticado,
      token: 'jwt-token-gerado',
    })
  } catch (erro) {
    // ✅ REGISTRAR FALHA DE LOGIN (para detecção de ataques)
    const { email } = await request.json().catch(() => ({ email: 'desconhecido' }))

    registrarAuditoria({
      usuario_id: 'anonimo',
      acao: 'login',
      entidade: 'usuario',
      detalhes: {
        metodo: 'email',
        email_tentativa: email,
        sucesso: false,
        motivo_falha: erro instanceof Error ? erro.message : 'Credenciais inválidas',
      },
      ip: request.headers.get('x-real-ip') || undefined,
      user_agent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({ erro: 'Login falhou' }, { status: 401 })
  }
}

// ============================================================
// EXEMPLO 6: Logout
// ============================================================
/**
 * POST /api/auth/logout
 * Logout do usuário
 */
export async function exemplo_logout(request: NextRequest) {
  try {
    const usuario = { id: 'uuid-usuario-logado' }

    // ✅ REGISTRAR LOGOUT
    registrarAuditoriaAPI(request, {
      usuario_id: usuario.id,
      acao: 'logout',
      entidade: 'usuario',
      entidade_id: usuario.id,
      detalhes: {
        timestamp: new Date().toISOString(),
      },
    })

    return NextResponse.json({ sucesso: true })
  } catch (erro) {
    console.error('Erro ao fazer logout:', erro)
    return NextResponse.json({ erro: 'Falha ao fazer logout' }, { status: 500 })
  }
}

// ============================================================
// EXEMPLO 7: Alterar Permissão de Usuário
// ============================================================
/**
 * PATCH /api/usuarios/[id]/permissoes
 * Altera permissões/roles de um usuário
 */
export async function exemplo_alterar_permissoes(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const usuarioAdmin = { id: 'uuid-admin' }
    const { novas_roles, motivo } = await request.json()

    // Obter roles antigas
    const usuarioAlterado = {
      id: params.id,
      roles_antigas: ['viewer'],
      roles_novas: novas_roles,
    }

    // ✅ REGISTRAR ALTERAÇÃO DE PERMISSÕES
    registrarAuditoriaAPI(request, {
      usuario_id: usuarioAdmin.id,
      acao: 'alterar_permissao',
      entidade: 'usuario',
      entidade_id: usuarioAlterado.id,
      detalhes: {
        roles_anteriores: usuarioAlterado.roles_antigas,
        roles_novas: usuarioAlterado.roles_novas,
        motivo: motivo || 'Ajuste de acesso',
        alterado_por: usuarioAdmin.id,
      },
    })

    return NextResponse.json({ sucesso: true })
  } catch (erro) {
    console.error('Erro ao alterar permissões:', erro)
    return NextResponse.json({ erro: 'Falha ao alterar permissões' }, { status: 500 })
  }
}

// ============================================================
// EXEMPLO 8: Consultar Auditoria (relatório)
// ============================================================
/**
 * GET /api/auditoria?usuario_id=xxx&dias=30
 * Consulta registros de auditoria
 */
export async function exemplo_consultar_auditoria(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const usuarioId = searchParams.get('usuario_id')
    const dias = parseInt(searchParams.get('dias') || '30')

    // Supabase query
    const dataInicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

    // Simulando resposta
    const registros = [
      {
        id: 'audit-1',
        usuario_id: usuarioId,
        acao: 'criar',
        entidade: 'diploma',
        entidade_id: 'dip-123',
        detalhes: { status_inicial: 'rascunho' },
        criado_em: new Date().toISOString(),
      },
      // ... mais registros
    ]

    return NextResponse.json({
      sucesso: true,
      total: registros.length,
      registros,
      periodo: {
        desde: dataInicio.toISOString(),
        ate: new Date().toISOString(),
      },
    })
  } catch (erro) {
    console.error('Erro ao consultar auditoria:', erro)
    return NextResponse.json({ erro: 'Falha ao consultar auditoria' }, { status: 500 })
  }
}

// ============================================================
// EXEMPLO 9: Middleware para Auditoria Automática
// ============================================================
/**
 * Exemplo de middleware que pode automatizar auditoria em algumas rotas
 */
export async function middlewareAuditoriaAutomatica(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  const inicio = Date.now()
  const usuario = { id: 'uuid-obtido-do-jwt' }

  try {
    const resposta = await handler(request)
    const duracao = Date.now() - inicio

    // Registrar sucesso
    if (resposta.status < 400) {
      registrarAuditoriaAPI(request, {
        usuario_id: usuario.id,
        acao: 'criar', // detectar dinamicamente do método HTTP
        entidade: 'relatorio', // detectar da URL
        detalhes: {
          status_http: resposta.status,
          duracao_ms: duracao,
        },
      })
    }

    return resposta
  } catch (erro) {
    const duracao = Date.now() - inicio

    // Registrar erro
    registrarAuditoriaAPI(request, {
      usuario_id: usuario.id,
      acao: 'criar',
      entidade: 'relatorio',
      detalhes: {
        erro: erro instanceof Error ? erro.message : 'Erro desconhecido',
        duracao_ms: duracao,
      },
    })

    throw erro
  }
}

// ============================================================
// EXEMPLO 10: Batch de Operações com Auditoria
// ============================================================
/**
 * POST /api/diplomas/batch-publicar
 * Publica múltiplos diplomas e registra cada um
 */
export async function exemplo_batch_publicar(request: NextRequest) {
  try {
    const usuario = { id: 'uuid-usuario-logado' }
    const { ids_diploma } = await request.json()

    const resultados = []

    // Processar cada diploma
    for (const id of ids_diploma) {
      try {
        // Publicar diploma
        const publicado = true

        if (publicado) {
          // ✅ REGISTRAR PUBLICAÇÃO
          registrarAuditoriaAPI(request, {
            usuario_id: usuario.id,
            acao: 'publicar',
            entidade: 'diploma',
            entidade_id: id,
            detalhes: {
              timestamp_publicacao: new Date().toISOString(),
              url_publica: `https://diploma.fic.edu.br/consulta/${id}`,
            },
          })

          resultados.push({ id, sucesso: true })
        }
      } catch (erro) {
        // ✅ REGISTRAR FALHA
        registrarAuditoriaAPI(request, {
          usuario_id: usuario.id,
          acao: 'publicar',
          entidade: 'diploma',
          entidade_id: id,
          detalhes: {
            sucesso: false,
            erro: erro instanceof Error ? erro.message : 'Erro desconhecido',
          },
        })

        resultados.push({ id, sucesso: false })
      }
    }

    return NextResponse.json({
      sucesso: true,
      publicados: resultados.filter((r) => r.sucesso).length,
      falhados: resultados.filter((r) => !r.sucesso).length,
      detalhes: resultados,
    })
  } catch (erro) {
    console.error('Erro ao publicar batch:', erro)
    return NextResponse.json({ erro: 'Falha ao publicar batch' }, { status: 500 })
  }
}
