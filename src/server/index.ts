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
/**
 * @openapi
 * /health:
 *   get:
 *     summary: Liveness probe
 *     description: Used by Container Apps readiness/liveness probes. Always unauthenticated.
 *     security: []
 *     responses:
 *       200:
 *         description: Service is up
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 storage: { type: string, enum: [local, blob] }
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', storage: storage.backend });
});

// ── Basic auth — applies to everything below ─────────────────────────
app.use(basicAuth());

// JSON bodies up to 10 MiB (image uploads come in as base64 data URLs).
app.use(express.json({ limit: '10mb' }));

// ── API: runtime config bag exposed to the SPA ───────────────────────
/**
 * @openapi
 * /api/config:
 *   get:
 *     summary: Runtime config bag for the SPA
 *     description: Non-sensitive runtime values the frontend needs at startup. Currently only the Application Insights connection string used for client-side telemetry — empty string when telemetry is not configured (e.g. local dev with APPINSIGHTS_CONNECTION_STRING unset).
 *     responses:
 *       200:
 *         description: Config bag
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 appInsightsConnectionString: { type: string }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
app.get('/api/config', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    appInsightsConnectionString: process.env.APPINSIGHTS_CONNECTION_STRING ?? '',
  });
});

const TEAM_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const IMAGE_FILENAME = /^[\w-]+\.(jpg|jpeg|png|webp|gif)$/i;
const META_FILENAME = /^[\w-]+\.json$/i;
const CONTENT_FILENAME = /^[\w-]+\.md$/i;
const ID_PATTERN = /^[\w-]+$/;

// ── API: upload image ────────────────────────────────────────────────
/**
 * @openapi
 * /api/upload:
 *   post:
 *     summary: Upload an exercise image
 *     description: Saves a base64-encoded image at `public/exercise_images/<team>/<filename>` in the storage backend.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team, filename, data]
 *             properties:
 *               team: { type: string, example: ikgota-team16 }
 *               filename: { type: string, example: cykla.jpg, description: 'Must match `<name>.<jpg|jpeg|png|webp|gif>`.' }
 *               data: { type: string, description: 'Base64 data URL or raw base64 string.' }
 *     responses:
 *       200:
 *         description: Image stored
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 path: { type: string, example: /exercise_images/ikgota-team16/cykla.jpg }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
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
/**
 * @openapi
 * /api/save-crop:
 *   post:
 *     summary: Save per-card image crop metadata
 *     description: Persists the user's crop (pan + zoom) for one exercise card at `public/exercise_images/<team>/<id>.json`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team, id, crop]
 *             properties:
 *               team: { type: string, example: ikgota-team16 }
 *               id: { type: string, example: cykla }
 *               crop: { $ref: '#/components/schemas/Crop' }
 *     responses:
 *       200:
 *         description: Crop stored
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Ok' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
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
/**
 * @openapi
 * /api/content:
 *   get:
 *     summary: List exercise IDs
 *     description: Returns every exercise id currently in `public/content/`. Cache-Control is `no-store` so the list always reflects the storage backend.
 *     responses:
 *       200:
 *         description: List of exercise IDs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ids:
 *                   type: array
 *                   items: { type: string }
 *                   example: [axel-mot-axel, balans-narkamp, cykla]
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
app.get('/api/content', async (_req: Request, res: Response) => {
  try {
    const keys = await storage.list(CONTENT_PREFIX);
    const ids = keys
      .map((k) => k.replace(`${CONTENT_PREFIX}/`, ''))
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.replace(/\.md$/, ''))
      .sort();
    // Don't cache — the list changes the moment a user creates or
    // deletes an exercise.
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ids });
  } catch (e: any) {
    console.error('content list error', e);
    res.status(500).json({ error: e?.message ?? 'content list failed' });
  }
});

// ── API: create new exercise (writes a markdown file) ────────────────
/**
 * @openapi
 * /api/content:
 *   post:
 *     summary: Create a new exercise
 *     description: Writes a new markdown file at `public/content/<id>.md`. Refuses to overwrite an existing exercise.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, markdown]
 *             properties:
 *               id: { type: string, example: tahavningar, description: 'Kebab-case id derived from the title.' }
 *               markdown: { type: string, description: 'Full markdown including YAML frontmatter (parsed by parseCard).' }
 *     responses:
 *       200:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: string }
 *                 path: { type: string, example: /content/tahavningar.md }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
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

// ── API: update an existing exercise ─────────────────────────────────
/**
 * @openapi
 * /api/content/{id}:
 *   put:
 *     summary: Update an existing exercise
 *     description: Overwrites `public/content/<id>.md`. Refuses to create new exercises this way — use POST /api/content for that.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         example: cykla
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [markdown]
 *             properties:
 *               markdown: { type: string, description: 'Full markdown including YAML frontmatter.' }
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, enum: [true] }
 *                 id: { type: string }
 *                 path: { type: string }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
app.put('/api/content/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { markdown } = req.body ?? {};
    if (!ID_PATTERN.test(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    if (typeof markdown !== 'string' || !markdown.trim()) {
      return res.status(400).json({ error: 'Missing markdown body' });
    }
    const existing = await storage.read(contentKey(id));
    if (!existing) {
      return res.status(404).json({ error: 'Exercise not found' });
    }
    await storage.save(contentKey(id), Buffer.from(markdown, 'utf8'), 'text/markdown; charset=utf-8');
    res.json({ ok: true, id, path: `/content/${id}.md` });
  } catch (e: any) {
    console.error('content update error', e);
    res.status(500).json({ error: e?.message ?? 'content update failed' });
  }
});

// ── Serve uploaded images from the storage backend ───────────────────
// The storage backend is the source of truth for images and content the
// user can edit at runtime — bundled copies are only a fallback for files
// that nobody has touched yet. So storage-backed routes go BEFORE
// `express.static`, otherwise edits would be permanently shadowed by the
// version baked into the image at build time.
/**
 * @openapi
 * /exercise_images/{team}/{filename}:
 *   get:
 *     summary: Serve an uploaded exercise image or crop JSON
 *     description: Reads from the storage backend (blob in prod) first; falls through to bundled static files if nothing is in storage.
 *     parameters:
 *       - name: team
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: filename
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: Either `<name>.<jpg|jpeg|png|webp|gif>` (image) or `<id>.json` (crop metadata).
 *     responses:
 *       200:
 *         description: Image or JSON bytes
 *         content:
 *           image/*:
 *             schema: { type: string, format: binary }
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Crop' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
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
/**
 * @openapi
 * /content/{filename}:
 *   get:
 *     summary: Fetch an exercise markdown file
 *     description: Reads `public/content/<filename>` from the storage backend (blob in prod) first; falls through to bundled static files if nothing is in storage. Cache-Control no-store, so edits show up on the next request.
 *     parameters:
 *       - name: filename
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         example: cykla.md
 *     responses:
 *       200:
 *         description: Markdown bytes
 *         content:
 *           text/markdown:
 *             schema: { type: string }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
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
      // The file's content changes on every edit — never cache.
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (e) {
      next(e);
    }
  },
);

// ── Bundled static SPA + previously-committed exercise images ────────
// Runs AFTER the storage-backed routes above so that edited blobs always
// win over the bundled copy. `fallthrough: true` lets non-matching
// requests reach the SPA fallback below.
app.use(express.static(distDir, { fallthrough: true }));

// ── SPA fallback ─────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.sendFile(join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(
    `cards server listening on :${port} (storage=${storage.backend})`,
  );
});
