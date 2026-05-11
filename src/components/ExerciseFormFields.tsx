import type { ExerciseFields } from '../utils/cardMarkdown'
import './ExerciseFormFields.css'

const ALL_TAGS = ['Klubbteknik', 'Rörlighet', 'Parövningar', 'Individuella'] as const

const MAX_TIPS = 4

type Props = {
  fields: ExerciseFields
  onChange: (next: ExerciseFields) => void
  /** Optionally show a derived id read-only (used in the new-exercise modal). */
  derivedId?: string
}

export default function ExerciseFormFields({ fields, onChange, derivedId }: Props) {
  function patch<K extends keyof ExerciseFields>(key: K, value: ExerciseFields[K]) {
    onChange({ ...fields, [key]: value })
  }

  function setTip(i: number, value: string) {
    const next = fields.tips.slice()
    next[i] = value
    patch('tips', next)
  }

  function addTip() {
    if (fields.tips.length >= MAX_TIPS) return
    patch('tips', [...fields.tips, ''])
  }

  function removeTip(i: number) {
    const next = fields.tips.slice()
    next.splice(i, 1)
    patch('tips', next)
  }

  function toggleTag(tag: string) {
    const has = fields.tags.includes(tag)
    patch('tags', has ? fields.tags.filter(t => t !== tag) : [...fields.tags, tag])
  }

  return (
    <div className="exercise-form">
      <label className="exercise-form-row exercise-form-row--full">
        <span className="exercise-form-label">Titel</span>
        <input
          type="text"
          className="exercise-form-input"
          value={fields.title}
          onChange={(e) => patch('title', e.target.value)}
          placeholder="Tåhävningar"
        />
      </label>

      {derivedId !== undefined && (
        <div className="exercise-form-row exercise-form-row--full">
          <span className="exercise-form-label">Filnamn</span>
          <code className="exercise-form-id">{derivedId || '—'}</code>
        </div>
      )}

      <div className="exercise-form-row-pair">
        <label className="exercise-form-row">
          <span className="exercise-form-label">Emoji</span>
          <input
            type="text"
            className="exercise-form-input exercise-form-input--narrow"
            value={fields.emoji}
            onChange={(e) => patch('emoji', e.target.value)}
            placeholder="🦶"
            maxLength={4}
          />
        </label>

        <label className="exercise-form-row">
          <span className="exercise-form-label">Färg</span>
          <span className="exercise-form-color-wrap">
            <input
              type="color"
              className="exercise-form-color-swatch"
              value={normaliseColor(fields.color)}
              onChange={(e) => patch('color', e.target.value)}
            />
            <input
              type="text"
              className="exercise-form-input exercise-form-input--mono"
              value={fields.color}
              onChange={(e) => patch('color', e.target.value)}
              placeholder="#0d9488"
            />
          </span>
        </label>
      </div>

      <label className="exercise-form-row exercise-form-row--full">
        <span className="exercise-form-label">Syfte</span>
        <textarea
          className="exercise-form-input exercise-form-textarea"
          value={fields.syfte}
          onChange={(e) => patch('syfte', e.target.value)}
          placeholder="Varför övningen är bra"
          rows={2}
        />
      </label>

      <div className="exercise-form-row exercise-form-row--full">
        <span className="exercise-form-label">
          Tips <span className="exercise-form-hint">({fields.tips.length}/{MAX_TIPS})</span>
        </span>
        <div className="exercise-form-tips">
          {fields.tips.map((tip, i) => (
            <div key={i} className="exercise-form-tip-row">
              <input
                type="text"
                className="exercise-form-input"
                value={tip}
                onChange={(e) => setTip(i, e.target.value)}
                placeholder={`Tips ${i + 1}`}
              />
              <button
                type="button"
                className="exercise-form-tip-remove"
                onClick={() => removeTip(i)}
                aria-label="Ta bort tips"
                title="Ta bort tips"
              >
                ✕
              </button>
            </div>
          ))}
          {fields.tips.length < MAX_TIPS && (
            <button
              type="button"
              className="exercise-form-tip-add"
              onClick={addTip}
            >
              + Lägg till tips
            </button>
          )}
        </div>
      </div>

      <div className="exercise-form-row exercise-form-row--full">
        <span className="exercise-form-label">Taggar</span>
        <div className="exercise-form-tags">
          {ALL_TAGS.map((tag) => {
            const on = fields.tags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                className={`exercise-form-tag${on ? ' exercise-form-tag--on' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function normaliseColor(value: string): string {
  // <input type="color"> rejects anything that isn't a 7-char #rrggbb.
  // Pad/truncate so the swatch always shows something sensible.
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const v = value.slice(1)
    return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`.toLowerCase()
  }
  return '#888888'
}
