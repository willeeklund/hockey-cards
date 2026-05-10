export type Backend = 'local' | 'blob';

export interface ImageStorage {
  backend: Backend;
  save(team: string, filename: string, data: Buffer): Promise<{ path: string }>;
  read(team: string, filename: string): Promise<Buffer | null>;
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
    default:
      return 'application/octet-stream';
  }
}
