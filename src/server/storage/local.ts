import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import type { FileStorage } from './types.js';

/**
 * Stores files under `rootDir` using the storage key as a relative path.
 * A key like `public/content/cykla.md` becomes
 * `<rootDir>/public/content/cykla.md` on disk.
 */
export class LocalStorage implements FileStorage {
  readonly backend = 'local' as const;

  constructor(private readonly rootDir: string) {}

  private fullPath(key: string) {
    return join(this.rootDir, key);
  }

  async save(key: string, data: Buffer) {
    const fullPath = this.fullPath(key);
    await fs.mkdir(dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
  }

  async read(key: string) {
    try {
      return await fs.readFile(this.fullPath(key));
    } catch (e: any) {
      if (e?.code === 'ENOENT') return null;
      throw e;
    }
  }

  async list(prefix: string) {
    const dir = this.fullPath(prefix);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile())
        .map((e) => `${prefix.endsWith('/') ? prefix : prefix + '/'}${e.name}`);
    } catch (e: any) {
      if (e?.code === 'ENOENT') return [];
      throw e;
    }
  }
}
