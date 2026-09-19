/**
 * API Route: Upload de arquivos para S3 (Etapa 8)
 *
 * POST /api/upload
 * Body: FormData com campo "file" (multipart/form-data)
 * Auth: obrigatório (withAuth)
 * Resposta: { url: string, key: string }
 *
 * Validações:
 * - Tipo de arquivo permitido (MIME type)
 * - Tamanho máximo (MAX_FILE_SIZE_MB)
 *
 * Prompt de Construção, item 8:
 *   "Armazenamento de arquivos (S3, upload e associação a projetos)"
 *
 * @module api/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { withAuth } from '@/lib/security';
import { uploadFile } from '@/lib/storage';

export const runtime = 'nodejs';

/**
 * Tipos MIME permitidos para upload.
 * Configurável via env (futuramente); por ora, lista fixa.
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

/**
 * Tamanho máximo de arquivo em MB (configurável via env).
 */
const MAX_FILE_SIZE_MB =
  parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Extrai extensão do arquivo a partir do MIME type.
 */
function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'text/plain': 'txt',
  };
  return map[mimeType] || 'bin';
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req) => {
    const userId = req.user?.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: 'Corpo da requisição deve ser multipart/form-data.' },
        { status: 400 }
      );
    }

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Campo 'file' é obrigatório e deve ser um arquivo." },
        { status: 400 }
      );
    }

    // Validar MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Tipo de arquivo não permitido: ${file.type}. Tipos aceitos: ${ALLOWED_MIME_TYPES.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    // Validar tamanho
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE_MB} MB.`,
        },
        { status: 413 }
      );
    }

    try {
      // Ler arquivo como Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Gerar chave única: users/<userId>/<timestamp>-<uuid>.<ext>
      const timestamp = Date.now();
      const uuid = randomUUID();
      const ext = getExtensionFromMimeType(file.type);
      const key = `users/${userId}/${timestamp}-${uuid}.${ext}`;

      // Upload para S3
      const result = await uploadFile(buffer, key, file.type);

      return NextResponse.json(
        {
          url: result.url,
          key: result.key,
          size: file.size,
          type: file.type,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error('Erro ao fazer upload do arquivo:', error);
      return NextResponse.json(
        {
          error:
            'Não foi possível fazer upload do arquivo. Verifique se as credenciais AWS estão configuradas.',
        },
        { status: 500 }
      );
    }
  });
}
