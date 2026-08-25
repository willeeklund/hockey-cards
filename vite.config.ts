import { defineConfig, type Connect } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { upsertTagsInMarkdown } from './src/utils/markdownTags';
import {
  CONTENT_PREFIX,
  contentKey,
  getStorage,
  imageKey,
  mimeFromName,
} from './src/server/storage/index.js';

const port = 3000;

// Validation patterns shared with the production Express server.
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
    const contentDir = path.join(process.cwd(), 'public', 'content');
    const swaggerIndex = path.join(process.cwd(), 'public', 'swagger', 'index.html');
    const storage = getStorage();

    // GET /health — mirror the production Express endpoint so probes (and
    // curl from the developer) get the same JSON. Without this, Vite's SPA
    // fallback ships the React index.html instead.
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.method === 'GET' && (req.url ?? '').split('?')[0] === '/health') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ status: 'ok', storage: storage.backend }));
        return;
      }
      next();
    });

    // GET /swagger/ — serve the Swagger UI page directly. Vite serves the
    // file at /swagger/index.html out of public/, but the bare directory
    // URL falls through to the SPA fallback. Serving the bytes here
    // preserves the /swagger/ URL in the browser.
    server.middlewares.use((req: any, res: any, next: any) => {
      const urlPath = (req.url ?? '').split('?')[0];
      if (req.method === 'GET' && (urlPath === '/swagger' || urlPath === '/swagger/')) {
        try {
          const html = fs.readFileSync(swaggerIndex, 'utf8');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
          return;
        } catch {
          // public/swagger/index.html is committed — but be defensive.
        }
      }
      next();
    });

    // GET /api/config — runtime config bag for the SPA. In dev there's
    // typically no telemetry connection string, so the SPA initialises
    // App Insights as a no-op.
    server.middlewares.use('/api/config', (req: any, res: any, next: any) => {
      if (req.method !== 'GET') return next();
      const trailing = (req.url ?? '/').split('?')[0];
      if (trailing !== '/' && trailing !== '') return next();
      res.setHeader('Cache-Control', 'no-store');
      sendJson(res, 200, {
        appInsightsConnectionString: process.env.APPINSIGHTS_CONNECTION_STRING ?? '',
      });
    });

    // POST /api/save-tags — dev-only, edits public/content/<id>.md in place
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

    // POST /api/save-crop — writes ikgota-team16/<id>.json via the storage backend
    server.middlewares.use('/api/save-crop', async (req: any, res: any) => {
      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed' });
      }
      try {
        const { id, crop } = await readJsonBody(req);
        if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
          return sendJson(res, 400, { error: 'Invalid id' });
        }
        const buffer = Buffer.from(JSON.stringify(crop, null, 2), 'utf8');
        await storage.save(imageKey(`${id}.json`), buffer, 'application/json');
        sendJson(res, 200, { ok: true });
      } catch (e: any) {
        sendJson(res, 500, { error: e?.message ?? 'save-crop failed' });
      }
    });

    // POST /api/upload — writes ikgota-team16/<filename> via the storage backend
    server.middlewares.use('/api/upload', async (req: any, res: any) => {
      if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed' });
      }
      try {
        const { filename, data } = await readJsonBody(req);
        if (typeof filename !== 'string' || !IMAGE_FILENAME.test(filename)) {
          return sendJson(res, 400, { error: 'Ogiltigt filnamn' });
        }
        const base64 = String(data).replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');
        await storage.save(imageKey(filename), buffer, mimeFromName(filename));
        sendJson(res, 200, { ok: true, path: `/exercise_images/ikgota-team16/${filename}` });
      } catch (e: any) {
        sendJson(res, 500, { error: e?.message ?? 'upload failed' });
      }
    });

    // /api/content — GET list, POST create, PUT /api/content/<id> update
    server.middlewares.use('/api/content', async (req: any, res: any) => {
      // Connect strips the mount prefix from req.url, so the path here is
      // either '/' (collection) or '/<id>' (single resource).
      const trailing = (req.url ?? '/').split('?')[0];
      const idMatch = trailing.match(/^\/([\w-]+)$/);
      const idFromUrl = idMatch?.[1];

      if (req.method === 'GET' && !idFromUrl) {
        try {
          const keys = await storage.list(CONTENT_PREFIX);
          const ids = keys
            .map((k: string) => k.replace(`${CONTENT_PREFIX}/`, ''))
            .filter((name: string) => name.endsWith('.md'))
            .map((name: string) => name.replace(/\.md$/, ''))
            .sort();
          return sendJson(res, 200, { ids });
        } catch (e: any) {
          return sendJson(res, 500, { error: e?.message ?? 'content list failed' });
        }
      }

      if (req.method === 'POST' && !idFromUrl) {
        try {
          const { id, markdown } = await readJsonBody(req);
          if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
            return sendJson(res, 400, { error: 'Invalid id' });
          }
          if (typeof markdown !== 'string' || !markdown.trim()) {
            return sendJson(res, 400, { error: 'Missing markdown body' });
          }
          const existing = await storage.read(contentKey(id));
          if (existing) {
            return sendJson(res, 409, { error: 'Exercise already exists' });
          }
          await storage.save(
            contentKey(id),
            Buffer.from(markdown, 'utf8'),
            'text/markdown; charset=utf-8',
          );
          return sendJson(res, 200, { ok: true, id, path: `/content/${id}.md` });
        } catch (e: any) {
          return sendJson(res, 500, { error: e?.message ?? 'content create failed' });
        }
      }

      if (req.method === 'PUT' && idFromUrl) {
        try {
          const { markdown } = await readJsonBody(req);
          if (typeof markdown !== 'string' || !markdown.trim()) {
            return sendJson(res, 400, { error: 'Missing markdown body' });
          }
          const existing = await storage.read(contentKey(idFromUrl));
          if (!existing) {
            return sendJson(res, 404, { error: 'Exercise not found' });
          }
          await storage.save(
            contentKey(idFromUrl),
            Buffer.from(markdown, 'utf8'),
            'text/markdown; charset=utf-8',
          );
          return sendJson(res, 200, { ok: true, id: idFromUrl, path: `/content/${idFromUrl}.md` });
        } catch (e: any) {
          return sendJson(res, 500, { error: e?.message ?? 'content update failed' });
        }
      }

      return sendJson(res, 405, { error: 'Method not allowed' });
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
