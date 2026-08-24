// Scans public/content/*.md and writes public/content-index.json, the
// static-build replacement for the dev/Azure `GET /api/content` route
// (which lists exercise ids off the storage backend at request time).
// Only used by `npm run build:static` — regular dev/build never touch it.

import { writeFileSync, readdirSync } from 'node:fs'

const contentDir = 'public/content'
const ids = readdirSync(contentDir)
  .filter((name) => name.endsWith('.md'))
  .map((name) => name.replace(/\.md$/, ''))
  .sort()

const outPath = 'public/content-index.json'
writeFileSync(outPath, JSON.stringify({ ids }, null, 2), 'utf8')

console.log(`✓ ${outPath} (${ids.length} ids)`)
