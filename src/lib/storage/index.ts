/**
 * Storage module barrel export (Etapa 8)
 *
 * @module lib/storage
 */

export {
  uploadFile,
  deleteFile,
  getSignedUrl,
  getPublicUrl,
  isKeyOwnedByUserProject,
  getVisibility,
  type UploadResult,
} from './s3-client';
