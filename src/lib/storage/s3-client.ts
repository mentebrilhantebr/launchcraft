/**
 * Cliente S3 para upload e gerenciamento de assets (Etapa 8)
 *
 * Prompt de Construção, tabela Stack, linha "Arquivos e mídia":
 *   "Armazenamento de objetos (S3 ou equivalente) — Imagens, vídeos,
 *    documentos, templates"
 *
 * Doc 08: "A plataforma deve manter todos os arquivos organizados por categorias."
 *
 * Usa AWS SDK v3 modular (@aws-sdk/client-s3 + @aws-sdk/s3-request-presigner).
 * Configuração via variáveis de ambiente:
 *   - AWS_REGION
 *   - AWS_S3_BUCKET
 *   - AWS_ACCESS_KEY_ID
 *   - AWS_SECRET_ACCESS_KEY
 *
 * @module lib/storage/s3-client
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';

const REGION = process.env.AWS_REGION ?? 'us-east-1';
const BUCKET = process.env.AWS_S3_BUCKET ?? '';

if (!BUCKET) {
  console.warn(
    '[storage] AWS_S3_BUCKET não configurado. Upload de arquivos falhará.'
  );
}

/**
 * Cliente S3 singleton — reutilizado em todas as operações.
 */
const s3Client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
});

/**
 * Constrói a URL pública (não assinada) de um objeto no S3.
 *
 * Só é acessível de fato para chaves sob o prefixo `public/`, que a política
 * de bucket libera para leitura (s3:GetObject, sem listagem). ACLs por objeto
 * não são usadas. Para objetos privados, use `getSignedUrl`.
 *
 * @param key - Chave (caminho) do objeto no bucket.
 * @returns URL pública base do objeto.
 */
export function getPublicUrl(key: string): string {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

/**
 * Prefixos de chave permitidos para um dado usuário/projeto (Etapa 8).
 * Espelham o formato gerado em POST /api/upload:
 *   public/images/<userId>/<projectId>/...
 *   private/documents/<userId>/<projectId>/...
 */
function ownedKeyPrefixes(userId: string, projectId: string): string[] {
  return [
    `public/images/${userId}/${projectId}/`,
    `private/documents/${userId}/${projectId}/`,
  ];
}

/**
 * Valida que uma chave de objeto S3 pertence ao prefixo do PRÓPRIO usuário e
 * projeto antes de qualquer acesso (gerar URL assinada) ou exclusão.
 *
 * Defesa em profundidade: embora as chaves sejam sempre geradas no servidor, uma
 * referência corrompida ou adulterada (ex.: outputData manipulado) não pode
 * resultar em leitura/remoção de arquivo de outro usuário. Rejeita também chaves
 * com "../" para evitar travessia de caminho.
 *
 * @returns true somente se a chave começa com um prefixo próprio e não contém "..".
 */
export function isKeyOwnedByUserProject(
  key: string,
  userId: string,
  projectId: string
): boolean {
  if (!key || !userId || !projectId) return false;
  if (key.includes('..')) return false;
  return ownedKeyPrefixes(userId, projectId).some((prefix) =>
    key.startsWith(prefix)
  );
}

/**
 * Resultado de um upload bem-sucedido.
 */
export interface UploadResult {
  /** Chave (key) do objeto no bucket S3. */
  key: string;
  /** URL pública do objeto (se o bucket for público) ou URL base. */
  url: string;
  /** Nome do bucket. */
  bucket: string;
  /**
   * Visibilidade do objeto conforme regra de acesso por tipo (Etapa 8).
   * 'public'  → imagens (JPEG/PNG/GIF/WebP), gravadas sob o prefixo `public/`
   *             (leitura liberada pela política de bucket; sem ACL por objeto).
   * 'private' → documentos (PDF/DOC/DOCX/TXT/SVG), sob `private/`, acessíveis
   *             apenas via URL assinada.
   */
  visibility: 'public' | 'private';
}

/**
 * Determina a visibilidade de um arquivo a partir do seu MIME type.
 *
 * Regra de acesso por tipo (Doc 08: "A plataforma deve manter todos os
 * arquivos organizados por categorias."):
 *   - JPEG, PNG, GIF, WebP → 'public'  (prefixo public/, política de bucket)
 *   - PDF, DOC, DOCX, TXT, SVG → 'private' (URL assinada temporária)
 *
 * SVG é tratado como privado por ser um formato capaz de carregar scripts;
 * servi-lo via URL assinada evita exposição pública direta.
 *
 * @param mimeType - MIME type (preferencialmente o tipo REAL detectado).
 * @returns 'public' para imagens de bitmap suportadas; 'private' caso contrário.
 */
export function getVisibility(mimeType: string): 'public' | 'private' {
  const PUBLIC_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  return PUBLIC_TYPES.includes(mimeType) ? 'public' : 'private';
}

/**
 * Faz upload de um arquivo para o S3.
 *
 * Nenhuma ACL é aplicada ao objeto. A visibilidade é derivada do MIME type via
 * `getVisibility` e o acesso público depende exclusivamente de a chave estar
 * sob o prefixo `public/` (liberado pela política de bucket).
 *
 * @param file - Buffer contendo os dados do arquivo.
 * @param key - Chave (caminho) do objeto no bucket.
 * @param contentType - MIME type REAL do arquivo (ex: "image/png").
 * @returns Metadados do arquivo enviado, incluindo a visibilidade.
 *
 * @throws Se as credenciais AWS estiverem inválidas ou o bucket não existir.
 */
export async function uploadFile(
  file: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  await s3Client.send(command);

  return {
    key,
    url: getPublicUrl(key),
    bucket: BUCKET,
    visibility: getVisibility(contentType),
  };
}

/**
 * Remove um arquivo do S3.
 *
 * @param key - Chave (caminho) do objeto no bucket.
 *
 * @throws Se as credenciais AWS estiverem inválidas ou o objeto não existir.
 *
 * @example
 * await deleteFile("users/user123/avatar.jpg");
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Gera uma URL assinada temporária para acesso privado a um objeto no S3.
 *
 * @param key - Chave (caminho) do objeto no bucket.
 * @param expiresIn - Tempo de validade da URL em segundos (padrão: 1 hora).
 * @returns URL assinada válida pelo período especificado.
 *
 * @example
 * const url = await getSignedUrl("projects/abc123/private-doc.pdf", 3600);
 * console.log("Acesse em:", url);
 */
export async function getSignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return awsGetSignedUrl(s3Client, command, { expiresIn });
}
