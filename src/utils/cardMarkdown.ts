// Helpers for going between exercise-card form data and the markdown
// representation that parseCard understands. The parser is intentionally
// simple (no real YAML library), so this serialiser mirrors that subset.

export type ExerciseFields = {
  title: string
  emoji: string
  color: string
  syfte: string
  tips: string[]
  tags: string[]
}

/**
 * Turn a Swedish exercise title into a filename-safe kebab-case id —
 * matches the existing convention (`tahavningar`, `balans-narkamp`).
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[éè]/g, 'e')
    .replace(/[üû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Serialise an exercise card into the YAML-frontmatter-only markdown
 * format that parseCard reads back. Body is intentionally empty — the
 * existing cards don't use it.
 */
export function serializeCard(fields: ExerciseFields): string {
  const lines: string[] = ['---']
  lines.push(`title: ${fields.title}`)
  if (fields.emoji) lines.push(`emoji: ${fields.emoji}`)
  if (fields.color) lines.push(`color: "${fields.color}"`)
  if (fields.syfte) lines.push(`syfte: ${fields.syfte}`)
  if (fields.tips.length > 0) {
    lines.push('tips:')
    fields.tips.forEach((tip) => lines.push(`  - ${tip}`))
  }
  if (fields.tags.length > 0) {
    lines.push('tags:')
    fields.tags.forEach((tag) => lines.push(`  - ${tag}`))
  }
  lines.push('---', '')
  return lines.join('\n')
}

/** Deep-ish equality over the form-relevant fields. */
export function fieldsEqual(a: ExerciseFields, b: ExerciseFields): boolean {
  if (a.title !== b.title) return false
  if (a.emoji !== b.emoji) return false
  if (a.color !== b.color) return false
  if (a.syfte !== b.syfte) return false
  if (a.tips.length !== b.tips.length) return false
  for (let i = 0; i < a.tips.length; i++) {
    if (a.tips[i] !== b.tips[i]) return false
  }
  if (a.tags.length !== b.tags.length) return false
  const setA = new Set(a.tags)
  for (const t of b.tags) if (!setA.has(t)) return false
  return true
}

export function fieldsFromCard(card: { [key: string]: any }): ExerciseFields {
  return {
    title: typeof card.title === 'string' ? card.title : '',
    emoji: typeof card.emoji === 'string' ? card.emoji : '',
    color: typeof card.color === 'string' ? card.color : '',
    syfte: typeof card.syfte === 'string' ? card.syfte : '',
    tips: Array.isArray(card.tips) ? card.tips.slice() : [],
    tags: Array.isArray(card.tags) ? card.tags.slice() : [],
  }
}
