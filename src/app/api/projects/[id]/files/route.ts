/**
 * API Route: Arquivos de um projeto (Etapa 8)
 *
 * GET /api/projects/:id/files - lista os arquivos associados ao projeto,
 *   gerando a URL de acesso NA HORA:
 *     - privados (documentos/SVG) → URL assinada temporária, nova a cada consulta
 *     - públicos (imagens)        → URL pública
 *
 * Por que gerar a URL aqui e não guardá-la: a URL assinada expira (~1h). Se a
 * guardássemos junto da referência, o arquivo privado ficaria inacessível depois
 * de 1h. Por isso Project.outputData guarda só dados estáveis (chave, nome,
 * tipo, tamanho, visibilidade, data) e a URL é derivada a cada leitura.
 *
 * Doc 08 (Segurança): "Nunca expor: Tokens. Chaves. Dados internos. ...
 * Informações privadas." — o acesso a privados é sempre via URL assinada e
 * restrito ao dono do projeto.
 *
 * @module api/projects/[id]/files
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/modules/database';
import { withAuth } from '@/lib/security';
import { readFlowState } from '@/modules/ai-engine';
import { getSignedUrl, getPublicUrl } from '@/lib/storage';

export const runtime = 'nodejs';

/**
 * Validade da URL assinada para arquivos privados (segundos).
 */
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * GET /api/projects/:id/files
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (req) => {
    const userId = req.user?.userId;
    const { id } = await params;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { userId: true, outputData: true },
      });

      if (!project) {
        return NextResponse.json(
          { error: 'Projeto não encontrado' },
          { status: 404 }
        );
      }

      if (project.userId !== userId) {
        return NextResponse.json(
          { error: 'Você não tem acesso a este projeto' },
          { status: 403 }
        );
      }

      const { uploads } = readFlowState(project.outputData);

      // Monta a URL de cada arquivo na hora da consulta.
      const files = await Promise.all(
        uploads.map(async (upload) => {
          const url =
            upload.visibility === 'private'
              ? await getSignedUrl(upload.key, SIGNED_URL_TTL_SECONDS)
              : getPublicUrl(upload.key);
          // A chave interna do S3 NÃO é devolvida ao cliente (Doc 08:
          // "Nunca expor: ... Dados internos."). O cliente identifica cada
          // arquivo por `uploadedAt` + `name`.
          return {
            name: upload.name,
            type: upload.type,
            size: upload.size,
            visibility: upload.visibility,
            uploadedAt: upload.uploadedAt,
            url,
          };
        })
      );

      return NextResponse.json({ files });
    } catch (error) {
      // Logar detalhe no servidor; resposta genérica (sem expor credenciais/AWS).
      console.error('Erro ao listar arquivos do projeto:', error);
      return NextResponse.json(
        { error: 'Não foi possível listar os arquivos do projeto.' },
        { status: 500 }
      );
    }
  });
}
