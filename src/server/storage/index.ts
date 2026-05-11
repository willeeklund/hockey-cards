import { LocalStorage } from './local.js';
import { BlobStorage } from './blob.js';
import type { Backend, FileStorage } from './types.js';

export type { Backend, FileStorage };
export { mimeFromName } from './types.js';

// Stable prefixes for the two namespaces this app uses. The storage backend
// is generic (key/value), but callers can use these helpers to build keys
// that match the on-disk layout under public/.
export const IMAGES_PREFIX = 'public/exercise_images';
export const CONTENT_PREFIX = 'public/content';

export function imageKey(team: string, filename: string) {
  return `${IMAGES_PREFIX}/${team}/${filename}`;
}

export function contentKey(id: string) {
  return `${CONTENT_PREFIX}/${id}.md`;
}

export function getStorage(): FileStorage {
  const backend = (process.env.STORAGE_BACKEND ?? 'local') as Backend;

  if (backend === 'blob') {
    const account = process.env.STORAGE_ACCOUNT;
    const container = process.env.STORAGE_CONTAINER;
    if (!account || !container) {
      throw new Error(
        'STORAGE_BACKEND=blob requires STORAGE_ACCOUNT and STORAGE_CONTAINER env vars',
      );
    }
    return new BlobStorage(account, container);
  }

  if (backend === 'local') {
    // Local backend writes under the project root. With keys like
    // `public/content/foo.md`, files land at `<cwd>/public/content/foo.md`,
    // which is exactly what Vite serves as `/content/foo.md`.
    const rootDir = process.env.LOCAL_STORAGE_DIR ?? process.cwd();
    return new LocalStorage(rootDir);
  }

  throw new Error(`Unknown STORAGE_BACKEND: ${backend}`);
}
