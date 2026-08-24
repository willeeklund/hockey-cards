// Prefixes a root-relative path with Vite's configured base path.
// BASE_URL is '/' for dev and the Azure build, but '/hockey-cards/' for
// the GitHub Pages static build (see vite.static.config.ts) — a bare
// fetch('/content/foo.md') would otherwise 404 under that subpath.
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}
