/**
 * Parses a markdown file with YAML front matter.
 *
 * Supported front matter fields:
 *   title:   string
 *   emoji:   string
 *   image:   string  (path relative to /public, e.g. /exercise_images/kullerbytta.jpg)
 *   color:   string  (hex color for the card header)
 *   syfte:   string
 *   tips:
 *     - tip one
 *     - tip two
 */
export function parseCard(raw, filePath) {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmMatch) return { data: {}, body: raw.trim() }

  const yamlBlock = fmMatch[1]
  const body = raw.slice(fmMatch[0].length).trim()
  const data = {}

  let lastKey = null
  for (const line of yamlBlock.split('\n')) {
    const listMatch = line.match(/^ {2}- (.+)$/)
    if (listMatch && lastKey) {
      if (!Array.isArray(data[lastKey])) data[lastKey] = []
      data[lastKey].push(listMatch[1].trim())
      continue
    }

    // Key: value
    const kvMatch = line.match(/^(\w+):\s*(.*)$/)
    if (kvMatch) {
      const [, key, value] = kvMatch
      lastKey = key
      const trimmed = value.trim()
      if (trimmed === '') {
        data[key] = null
      } else {
        // Strip surrounding quotes
        data[key] = trimmed.replace(/^["'](.*)["']$/, '$1')
      }
    }
  }

  const id = filePath.split('/').pop().replace('.md', '')
  return { id, data, body }
}
