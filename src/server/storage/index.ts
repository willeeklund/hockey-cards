import { join } from 'node:path';
import { LocalStorage } from './local.js';
import { BlobStorage } from './blob.js';
import type { Backend, ImageStorage } from './types.js';

export type { Backend, ImageStorage };
export { mimeFromName } from './types.js';

export function getStorage(): ImageStorage {
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
    const rootDir =
      process.env.LOCAL_STORAGE_DIR ??
      join(process.cwd(), 'public', 'exercise_images');
    return new LocalStorage(rootDir);
  }

  throw new Error(`Unknown STORAGE_BACKEND: ${backend}`);
}
