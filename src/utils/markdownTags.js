/**
 * Reads the tags field out of a markdown frontmatter string.
 * Returns an array of tag strings (may be empty).
 */
export function parseTagsFromMarkdown(raw) {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmMatch) return []
  const lines = fmMatch[1].split('\n')
  const tags = []
  let inTags = false
  for (const line of lines) {
    if (line === 'tags:' || line.startsWith('tags: ')) { inTags = true; continue }
    if (inTags && line.startsWith('  - ')) { tags.push(line.slice(4).trim()); continue }
    if (inTags) inTags = false
  }
  return tags
}

/**
 * Returns a new markdown string with the tags field set to `tags`.
 * Existing tags block is replaced; if `tags` is empty the block is removed.
 * All other frontmatter content is preserved exactly.
 */
export function upsertTagsInMarkdown(raw, tags) {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmMatch) return raw

  const fm = fmMatch[1]
  const rest = raw.slice(fmMatch[0].length) // everything after closing ---

  // Remove existing tags block line-by-line
  const lines = fm.split('\n')
  const filtered = []
  let skipItems = false
  for (const line of lines) {
    if (line === 'tags:' || /^tags: /.test(line)) { skipItems = true; continue }
    if (skipItems && /^  - /.test(line)) continue
    skipItems = false
    filtered.push(line)
  }

  let newFm = filtered.join('\n')
  if (tags.length > 0) {
    newFm += '\ntags:\n' + tags.map(t => `  - ${t}`).join('\n')
  }

  return `---\n${newFm}\n---${rest}`
}
