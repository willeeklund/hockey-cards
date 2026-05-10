import express, { type Request, type Response } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Resolve paths relative to the compiled file at runtime.
// Compiled output lives at <app>/dist-server/index.js, so the Vite build at
// <app>/dist/ is one level up.
const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Future API routes go here — e.g. POST /api/uploads to push images into
// the Azure blob container. Use `@azure/storage-blob` +
// `@azure/identity`'s DefaultAzureCredential so the managed identity that
// Container Apps injects authenticates automatically (the tofu config
// grants it Storage Blob Data Contributor on the storage account).

app.use(express.static(distDir));

// SPA fallback: any unknown path serves the built index.html so the
// client-side router can handle it.
app.use((_req: Request, res: Response) => {
  res.sendFile(join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`cards server listening on :${port}`);
});
