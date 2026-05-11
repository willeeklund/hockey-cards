export type Backend = 'local' | 'blob';

/**
 * Generic key/value file storage. Keys are full paths like
 * `public/exercise_images/<team>/<file>.jpg` or `public/content/<id>.md`.
 * The local backend writes them under the project root; the blob backend
 * uses them as blob names directly.
 */
export interface FileStorage {
  backend: Backend;
  save(key: string, data: Buffer, contentType?: string): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  list(prefix: string): Promise<string[]>;
}

export function mimeFromName(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'json':
      return 'application/json';
    case 'md':
      return 'text/markdown; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}
