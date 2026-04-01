import { describe, it, expect } from 'vitest'
import { parseTagsFromMarkdown, upsertTagsInMarkdown } from './markdownTags.js'

// ── parseTagsFromMarkdown ──────────────────────────────────────────────

describe('parseTagsFromMarkdown', () => {
  it('returns empty array when no tags field', () => {
    const md = `---\ntitle: Foo\nsynfte: Bar\n---\n`
    expect(parseTagsFromMarkdown(md)).toEqual([])
  })

  it('parses a single tag', () => {
    const md = `---\ntitle: Foo\ntags:\n  - Individuella\n---\n`
    expect(parseTagsFromMarkdown(md)).toEqual(['Individuella'])
  })

  it('parses multiple tags', () => {
    const md = `---\ntitle: Foo\ntags:\n  - Klubbteknik\n  - Parövningar\n---\n`
    expect(parseTagsFromMarkdown(md)).toEqual(['Klubbteknik', 'Parövningar'])
  })

  it('returns empty array when no frontmatter', () => {
    expect(parseTagsFromMarkdown('just some text')).toEqual([])
  })
})

// ── upsertTagsInMarkdown ───────────────────────────────────────────────

const BASE = `---
title: Axel mot axel
emoji: 💪
color: "#d97706"
syfte: Lång text här.
tips:
  - Tip ett
  - Tip två
---
`

describe('upsertTagsInMarkdown', () => {
  it('adds tags when none exist', () => {
    const result = upsertTagsInMarkdown(BASE, ['Parövningar'])
    expect(result).toContain('tags:\n  - Parövningar')
    // Existing fields preserved
    expect(result).toContain('title: Axel mot axel')
    expect(result).toContain('  - Tip ett')
  })

  it('replaces existing tags', () => {
    const withTags = upsertTagsInMarkdown(BASE, ['Rörlighet'])
    const replaced = upsertTagsInMarkdown(withTags, ['Klubbteknik', 'Individuella'])
    expect(replaced).toContain('tags:\n  - Klubbteknik\n  - Individuella')
    // Old tag must not appear
    expect(replaced).not.toContain('Rörlighet')
  })

  it('removes tags when passed empty array', () => {
    const withTags = upsertTagsInMarkdown(BASE, ['Parövningar'])
    const removed = upsertTagsInMarkdown(withTags, [])
    expect(removed).not.toContain('tags:')
    // Remaining content still intact
    expect(removed).toContain('title: Axel mot axel')
  })

  it('is idempotent — applying same tags twice gives same result', () => {
    const once = upsertTagsInMarkdown(BASE, ['Individuella', 'Rörlighet'])
    const twice = upsertTagsInMarkdown(once, ['Individuella', 'Rörlighet'])
    expect(twice).toBe(once)
  })

  it('preserves body content after closing ---', () => {
    const mdWithBody = BASE + '\nSome body text here.\n'
    const result = upsertTagsInMarkdown(mdWithBody, ['Klubbteknik'])
    expect(result).toContain('Some body text here.')
  })

  it('preserves the rest of the frontmatter when replacing tags mid-file', () => {
    const md = `---\ntitle: Test\ntags:\n  - OldTag\ncolor: "#ff0000"\n---\n`
    const result = upsertTagsInMarkdown(md, ['NewTag'])
    expect(result).toContain('color: "#ff0000"')
    expect(result).toContain('NewTag')
    expect(result).not.toContain('OldTag')
  })

  it('round-trips through parseTagsFromMarkdown', () => {
    const tags = ['Klubbteknik', 'Parövningar', 'Rörlighet']
    const result = upsertTagsInMarkdown(BASE, tags)
    expect(parseTagsFromMarkdown(result)).toEqual(tags)
  })
})
