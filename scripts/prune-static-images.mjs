// Post-processes github-pages-static/ after `vite build`. Vite's public/
// dir copy is verbatim, so this removes what the static build shouldn't
// ship: team photo folders other than ikgota-team16 (only team with real,
// publishable photos), and any stray openapi.yml/swagger/ left on disk
// from a previous `npm run dev`/`npm run build` in the same working tree
// (those are gitignored but still present as files, so Vite copies them).

import { readdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const outDir = 'github-pages-static'
const KEEP_TEAM = 'ikgota-team16'

const imagesDir = join(outDir, 'exercise_images')
if (existsSync(imagesDir)) {
  for (const team of readdirSync(imagesDir)) {
    if (team !== KEEP_TEAM) {
      rmSync(join(imagesDir, team), { recursive: true, force: true })
    }
  }
}

for (const stray of ['openapi.yml', 'swagger']) {
  rmSync(join(outDir, stray), { recursive: true, force: true })
}

console.log(`✓ pruned ${outDir} (kept ${KEEP_TEAM} only)`)
