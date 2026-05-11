import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { basicAuth } from './auth.js';
import {
  CONTENT_PREFIX,
  contentKey,
  getStorage,
  imageKey,
  mimeFromName,
} from './storage/index.js';

// Compiled output lives at <app>/dist/server/index.js. The Vite build is
// the sibling at <app>/dist/client/.
const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'client');

const app = express();
const port = Number(process.env.PORT) || 3000;
const storage = getStorage();

// ── Health (unauthenticated, mounted before auth) ────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', storage: storage.backend });
});

// ── Basic auth — applies to everything below ─────────────────────────
app.use(basicAuth());

// JSON bodies up to 10 MiB (image uploads come in as base64 data URLs).
app.use(express.json({ limit: '10mb' }));

const TEAM_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const IMAGE_FILENAME = /^[\w-]+\.(jpg|jpeg|png|webp|gif)$/i;
const META_FILENAME = /^[\w-]+\.json$/i;
const CONTENT_FILENAME = /^[\w-]+\.md$/i;
const ID_PATTERN = /^[\w-]+$/;

// ── API: upload image ────────────────────────────────────────────────
app.post('/api/upload', async (req: Request, res: Response) => {
  try {
    const { team, filename, data } = req.body ?? {};
    if (typeof team !== 'string' || !TEAM_PATTERN.test(team)) {
      return res.status(400).json({ error: 'Invalid or missing team' });
    }
    if (typeof filename !== 'string' || !IMAGE_FILENAME.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    if (typeof data !== 'string') {
      return res.status(400).json({ error: 'Missing data' });
    }
    const base64 = data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    await storage.save(imageKey(team, filename), buffer, mimeFromName(filename));
    res.json({ ok: true, path: `/exercise_images/${team}/${filename}` });
  } catch (e: any) {
    console.error('upload error', e);
    res.status(500).json({ error: e?.message ?? 'upload failed' });
  }
});

// ── API: save crop metadata JSON ─────────────────────────────────────
app.post('/api/save-crop', async (req: Request, res: Response) => {
  try {
    const { team, id, crop } = req.body ?? {};
    if (typeof team !== 'string' || !TEAM_PATTERN.test(team)) {
      return res.status(400).json({ error: 'Invalid or missing team' });
    }
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const buffer = Buffer.from(JSON.stringify(crop, null, 2), 'utf8');
    await storage.save(imageKey(team, `${id}.json`), buffer, 'application/json');
    res.json({ ok: true });
  } catch (e: any) {
    console.error('save-crop error', e);
    res.status(500).json({ error: e?.message ?? 'save-crop failed' });
  }
});

// ── API: list exercise content (markdown files) ──────────────────────
app.get('/api/content', async (_req: Request, res: Response) => {
  try {
    const keys = await storage.list(CONTENT_PREFIX);
    const ids = keys
      .map((k) => k.replace(`${CONTENT_PREFIX}/`, ''))
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.replace(/\.md$/, ''))
      .sort();
    res.json({ ids });
  } catch (e: any) {
    console.error('content list error', e);
    res.status(500).json({ error: e?.message ?? 'content list failed' });
  }
});

// ── API: create new exercise (writes a markdown file) ────────────────
app.post('/api/content', async (req: Request, res: Response) => {
  try {
    const { id, markdown } = req.body ?? {};
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (typeof markdown !== 'string' || !markdown.trim()) {
      return res.status(400).json({ error: 'Missing markdown body' });
    }
    const existing = await storage.read(contentKey(id));
    if (existing) {
      return res.status(409).json({ error: 'Exercise already exists' });
    }
    await storage.save(contentKey(id), Buffer.from(markdown, 'utf8'), 'text/markdown; charset=utf-8');
    res.json({ ok: true, id, path: `/content/${id}.md` });
  } catch (e: any) {
    console.error('content create error', e);
    res.status(500).json({ error: e?.message ?? 'content create failed' });
  }
});

// ── Bundled static SPA + previously-committed exercise images ────────
// `express.static` falls through to the next middleware when a file isn't
// found, so missing images / content get a chance to be served from the
// storage backend below.
app.use(express.static(distDir, { fallthrough: true }));

// ── Serve uploaded images from the storage backend ───────────────────
app.get(
  '/exercise_images/:team/:filename',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { team, filename } = req.params;
      if (!TEAM_PATTERN.test(team)) return next();
      if (!IMAGE_FILENAME.test(filename) && !META_FILENAME.test(filename)) {
        return next();
      }
      const buffer = await storage.read(imageKey(team, filename));
      if (!buffer) return next();
      res.setHeader('Content-Type', mimeFromName(filename));
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.send(buffer);
    } catch (e) {
      next(e);
    }
  },
);

// ── Serve markdown content from the storage backend ──────────────────
app.get(
  '/content/:filename',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { filename } = req.params;
      if (!CONTENT_FILENAME.test(filename)) return next();
      const id = filename.replace(/\.md$/, '');
      const buffer = await storage.read(contentKey(id));
      if (!buffer) return next();
      res.setHeader('Content-Type', mimeFromName(filename));
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.send(buffer);
    } catch (e) {
      next(e);
    }
  },
);

// ── SPA fallback ─────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.sendFile(join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(
    `cards server listening on :${port} (storage=${storage.backend})`,
  );
});
