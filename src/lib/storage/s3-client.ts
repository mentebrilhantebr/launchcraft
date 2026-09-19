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
 * Resultado de um upload bem-sucedido.
 */
export interface UploadResult {
  /** Chave (key) do objeto no bucket S3. */
  key: string;
  /** URL pública do objeto (se o bucket for público) ou URL base. */
  url: string;
  /** Nome do bucket. */
  bucket: string;
}

/**
 * Faz upload de um arquivo para o S3.
 *
 * @param file - Buffer contendo os dados do arquivo.
 * @param key - Chave (caminho) do objeto no bucket (ex: "projects/abc123/image.png").
 * @param contentType - MIME type do arquivo (ex: "image/png").
 * @returns Metadados do arquivo enviado.
 *
 * @throws Se as credenciais AWS estiverem inválidas ou o bucket não existir.
 *
 * @example
 * const result = await uploadFile(buffer, "users/user123/avatar.jpg", "image/jpeg");
 * console.log("Arquivo enviado:", result.url);
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

  // URL pública (assumindo bucket público; se privado, usar getSignedUrl).
  const url = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

  return {
    key,
    url,
    bucket: BUCKET,
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
