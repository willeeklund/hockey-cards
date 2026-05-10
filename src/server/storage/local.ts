import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { ImageStorage } from './types.js';

export class LocalStorage implements ImageStorage {
  readonly backend = 'local' as const;

  constructor(private readonly rootDir: string) {}

  async save(team: string, filename: string, data: Buffer) {
    const dir = join(this.rootDir, team);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, filename), data);
    return { path: `/exercise_images/${team}/${filename}` };
  }

  async read(team: string, filename: string) {
    try {
      return await fs.readFile(join(this.rootDir, team, filename));
    } catch (e: any) {
      if (e?.code === 'ENOENT') return null;
      throw e;
    }
  }
}
