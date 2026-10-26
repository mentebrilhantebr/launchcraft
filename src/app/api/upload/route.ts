/**
 * API Route: Upload de arquivos para S3 (Etapa 8)
 *
 * POST /api/upload
 * Body: FormData com campo "file" (multipart/form-data) e campo "projectId"
 *       (string) — OBRIGATÓRIO (o único ponto de envio é a tela do projeto).
 * Auth: obrigatório (withAuth)
 * Resposta: { url, name, size, type, visibility, uploadedAt, projectId }
 *   (a chave interna do S3 NÃO é devolvida — Doc 08: "Nunca expor: ... Dados internos.")
 *
 * Validações:
 * - Tipo de arquivo permitido (MIME type) — validado pelo CONTEÚDO real (magic bytes).
 * - Tamanho máximo (MAX_FILE_SIZE_MB)
 * - Posse do projeto (quando projectId informado)
 *
 * Regra de acesso por tipo (sem ACL por objeto):
 * - Imagens (JPEG/PNG/GIF/WebP) → prefixo `public/images/`, lido via política de
 *   bucket que libera apenas s3:GetObject em `public/*` (sem listagem).
 * - Documentos (PDF/DOC/DOCX/TXT) e SVG → prefixo `private/documents/`, acesso
 *   somente por URL assinada temporária.
 *
 * Estrutura das chaves (organização por categoria):
 *   public/images/<userId>/<projectId>/<timestamp>-<uuid>.<ext>
 *   private/documents/<userId>/<projectId>/<timestamp>-<uuid>.<ext>
 * INFERÊNCIA: o Doc 08 exige organização "por categorias", mas não define
 * quais são as categorias de arquivo. "images" e "documents" foram adotadas
 * conforme aprovação do usuário. SVG fica em documents/ por ser privado.
 *
 * Prompt de Construção, item 8:
 *   "Armazenamento de arquivos (S3, upload e associação a projetos)"
 * Doc 08: "A plataforma deve manter todos os arquivos organizados por categorias."
 *
 * @module api/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { withAuth } from '@/lib/security';
import { uploadFile, getSignedUrl, getVisibility } from '@/lib/storage';
import { prisma } from '@/modules/database';
import type { UploadReference } from '@/modules/ai-engine';

export const runtime = 'nodejs';

/**
 * Tipos MIME permitidos para upload.
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
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Validade da URL assinada para arquivos privados (segundos).
 */
const SIGNED_URL_TTL_SECONDS = 3600;

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

/**
 * Detecta o MIME type REAL do arquivo lendo seus magic bytes (assinatura
 * binária nos primeiros bytes), sem depender do tipo declarado pelo browser
 * e sem bibliotecas externas.
 *
 * Assinaturas reconhecidas:
 *   - JPEG:  FF D8 FF
 *   - PNG:   89 50 4E 47 0D 0A 1A 0A
 *   - GIF:   47 49 46 38 ("GIF8")
 *   - WebP:  52 49 46 46 ("RIFF") nos bytes 0-3 E 57 45 42 50 ("WEBP") nos bytes 8-11
 *   - PDF:   25 50 44 46 ("%PDF")
 *   - DOC (OLE2):  D0 CF 11 E0 A1 B1 1A E1
 *   - DOCX (ZIP/OOXML): 50 4B 03 04
 *   - SVG:   conteúdo textual iniciando por "<svg" ou "<?xml" (após trim)
 *
 * TXT não possui assinatura confiável → retorna null (tratado à parte na rota).
 *
 * @param buffer - Conteúdo do arquivo.
 * @returns MIME type detectado, ou null se nenhuma assinatura conhecida bater.
 */
function detectRealMimeType(buffer: Buffer): string | null {
  const len = buffer.length;

  // JPEG: FF D8 FF
  if (len >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    len >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // GIF: 47 49 46 38 ("GIF8")
  if (
    len >= 4 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif';
  }

  // WebP: "RIFF" (0-3) + "WEBP" (8-11)
  if (
    len >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // PDF: 25 50 44 46 ("%PDF")
  if (
    len >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // DOC (OLE2 Compound File): D0 CF 11 E0 A1 B1 1A E1
  if (
    len >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return 'application/msword';
  }

  // DOCX (ZIP/OOXML container): 50 4B 03 04 ("PK\x03\x04")
  if (
    len >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  // SVG: texto começando por "<svg" ou "<?xml" (após remover espaços iniciais).
  // Lê apenas o início do buffer para evitar custo em arquivos grandes.
  const head = buffer.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) {
    return 'image/svg+xml';
  }

  // Sem assinatura confiável (ex.: TXT) → null.
  return null;
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

    // ITEM 4: projectId OBRIGATÓRIO — o único ponto de envio é a tela do projeto.
    // Isso elimina uploads "sem-projeto" e garante que toda chave fica sob o
    // prefixo do usuário/projeto, permitindo validar posse na leitura/exclusão.
    const projectIdRaw = formData.get('projectId');
    if (typeof projectIdRaw !== 'string' || projectIdRaw.trim().length === 0) {
      return NextResponse.json(
        { error: "Campo 'projectId' é obrigatório." },
        { status: 400 }
      );
    }
    const projectId = projectIdRaw.trim();
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json(
        { error: 'Projeto não encontrado ou sem permissão.' },
        { status: 403 }
      );
    }

    // Validar tamanho (antes de ler o buffer completo para o S3).
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE_MB} MB.` },
        { status: 413 }
      );
    }

    // Ler arquivo como Buffer.
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ITEM 3: validação por conteúdo real (magic bytes).
    const detected = detectRealMimeType(buffer);
    let effectiveType: string;

    if (detected === null) {
      // Sem assinatura confiável: aceitar APENAS se o browser declarar text/plain.
      if (file.type === 'text/plain') {
        effectiveType = 'text/plain';
      } else {
        return NextResponse.json(
          { error: 'O conteúdo do arquivo não corresponde ao tipo declarado.' },
          { status: 400 }
        );
      }
    } else {
      // Tipo detectado: deve coincidir com o declarado pelo browser.
      if (detected !== file.type) {
        return NextResponse.json(
          { error: 'O conteúdo do arquivo não corresponde ao tipo declarado.' },
          { status: 400 }
        );
      }
      effectiveType = detected;
    }

    // Garantir que o tipo REAL está na lista de permitidos.
    if (!ALLOWED_MIME_TYPES.includes(effectiveType)) {
      return NextResponse.json(
        {
          error: `Tipo de arquivo não permitido: ${effectiveType}. Tipos aceitos: ${ALLOWED_MIME_TYPES.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    try {
      // ITEM 1: visibilidade pela regra de acesso por tipo.
      const visibility = getVisibility(effectiveType);

      // Gerar chave única com prefixo de acesso + categoria (ver cabeçalho).
      const timestamp = Date.now();
      const uuid = randomUUID();
      const ext = getExtensionFromMimeType(effectiveType);
      const prefix = visibility === 'public' ? 'public/images' : 'private/documents';
      const key = `${prefix}/${userId}/${projectId}/${timestamp}-${uuid}.${ext}`;

      // Upload sem ACL: o acesso público vem só do prefixo public/ (política de bucket).
      const result = await uploadFile(buffer, key, effectiveType);

      // Documentos privados → gerar URL assinada temporária na rota.
      const url =
        visibility === 'public'
          ? result.url
          : await getSignedUrl(result.key, SIGNED_URL_TTL_SECONDS);

      // ITEM 1 + ITEM 4: quando associado a um projeto, persistir a REFERÊNCIA
      // (só dados estáveis — sem URL) dentro de Project.outputData, no mesmo bag
      // das gerações (Opção A). A gravação é um append ATÔMICO em JSONB numa
      // única instrução SQL: `|| [ref]` concatena o elemento ao array existente
      // de forma atômica por linha, então dois uploads simultâneos no mesmo
      // projeto NUNCA se sobrescrevem. O COALESCE cobre output_data nulo ou sem
      // a chave `uploads`; o WHERE com user_id reforça o isolamento por usuário.
      const uploadedAt = new Date().toISOString();
      const ref: UploadReference = {
        key: result.key,
        name: file.name,
        type: effectiveType,
        size: file.size,
        visibility,
        uploadedAt,
      };
      await prisma.$executeRaw`
        UPDATE projects
        SET output_data = jsonb_set(
              COALESCE(output_data, '{}'::jsonb),
              '{uploads}',
              COALESCE(output_data -> 'uploads', '[]'::jsonb) || ${JSON.stringify([ref])}::jsonb,
              true
            ),
            updated_at = now()
        WHERE id = ${projectId}::uuid AND user_id = ${userId}::uuid
      `;

      return NextResponse.json(
        {
          url,
          name: file.name,
          size: file.size,
          type: effectiveType,
          visibility,
          uploadedAt,
          projectId,
        },
        { status: 200 }
      );
    } catch (error) {
      // ITEM 2: logar detalhe no servidor, retornar mensagem genérica (sem AWS).
      console.error('Erro ao fazer upload do arquivo:', error);
      return NextResponse.json(
        { error: 'Não foi possível processar o upload. Tente novamente.' },
        { status: 500 }
      );
    }
  });
}
