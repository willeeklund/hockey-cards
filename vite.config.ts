import { defineConfig, type Connect } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { upsertTagsInMarkdown } from './src/utils/markdownTags';
import { getStorage } from './src/server/storage/index.js';

const port = 3000;

// Validation patterns shared with the production Express server.
const TEAM_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const IMAGE_FILENAME = /^[\w-]+\.(jpg|jpeg|png|webp|gif)$/i;
const ID_PATTERN = /^[\w-]+$/;

function readJsonBody(req: Connect.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: any, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

const apiPlugin = {
  name: 'cards-dev-api',
  configureServer(server: any) {
    const contentDir = path.join(process.cwd(), 'src', 'content');
    const storage = getStorage();

    // POST /api/save-tags — dev-only, edits src/content/<id>.md
    server.middlewares.use(
      '/api/save-tags',
      async (req: any, res: any) => {
        if (req.method !== 'POST') {
          return sendJson(res, 405, { error: 'Method not allowed' });
        }
        try {
          const { id, tags } = await readJsonBody(req);
          if (typeof id !== 'string' || !ID_PATTERN.test(id) || !Array.isArray(tags)) {
            return sendJson(res, 400, { error: 'Invalid payload' });
          }
          const filePath = path.join(contentDir, `${id}.md`);
          if (!fs.existsSync(filePath)) {
            return sendJson(res, 404, { error: 'File not found' });
          }
          const raw = fs.readFileSync(filePath, 'utf8');
          fs.writeFileSync(filePath, upsertTagsInMarkdown(raw, tags), 'utf8');
          sendJson(res, 200, { ok: true });
        } catch (e: any) {
          sendJson(res, 500, { error: e?.message ?? 'save-tags failed' });
        }
      },
    );

    // POST /api/save-crop — writes <team>/<id>.json via the storage backend
    server.middlewares.use('/api/save-crop', async (req: any, res: any) => {
      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed' });
      }
      try {
        const { team, id, crop } = await readJsonBody(req);
        if (typeof team !== 'string' || !TEAM_PATTERN.test(team)) {
          return sendJson(res, 400, { error: 'Invalid or missing team' });
        }
        if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
          return sendJson(res, 400, { error: 'Invalid id' });
        }
        const buffer = Buffer.from(JSON.stringify(crop, null, 2), 'utf8');
        await storage.save(team, `${id}.json`, buffer);
        sendJson(res, 200, { ok: true });
      } catch (e: any) {
        sendJson(res, 500, { error: e?.message ?? 'save-crop failed' });
      }
    });

    // POST /api/upload — writes <team>/<filename> via the storage backend
    server.middlewares.use('/api/upload', async (req: any, res: any) => {
      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed' });
      }
      try {
        const { team, filename, data } = await readJsonBody(req);
        if (typeof team !== 'string' || !TEAM_PATTERN.test(team)) {
          return sendJson(res, 400, { error: 'Invalid or missing team' });
        }
        if (typeof filename !== 'string' || !IMAGE_FILENAME.test(filename)) {
          return sendJson(res, 400, { error: 'Ogiltigt filnamn' });
        }
        const base64 = String(data).replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');
        const result = await storage.save(team, filename, buffer);
        sendJson(res, 200, { ok: true, ...result });
      } catch (e: any) {
        sendJson(res, 500, { error: e?.message ?? 'upload failed' });
      }
    });
  },
};

export default defineConfig({
  plugins: [react(), apiPlugin],
  build: {
    // Frontend bundle lives in dist/client/. The server build (tsc -p
    // tsconfig.server.json) puts its output in dist/server/. Keeping them
    // in distinct subdirectories means express.static('dist/client') can
    // never accidentally expose the compiled server code.
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port,
  },
});
