/**
 * Storage module barrel export (Etapa 8)
 *
 * @module lib/storage
 */

export {
  uploadFile,
  deleteFile,
  getSignedUrl,
  getVisibility,
  type UploadResult,
} from './s3-client';
