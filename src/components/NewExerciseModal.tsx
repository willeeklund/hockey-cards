import { useEffect, useMemo, useState } from 'react'
import ExerciseFormFields from './ExerciseFormFields'
import {
  fieldsEqual,
  serializeCard,
  slugify,
  type ExerciseFields,
} from '../utils/cardMarkdown'
import { trackEvent } from '../utils/analytics'
import { useTeam } from '../context/TeamContext'
import './NewExerciseModal.css'

const EMPTY: ExerciseFields = {
  title: '',
  emoji: '',
  color: '#3b82f6',
  syfte: '',
  tips: [''],
  tags: [],
}

type Props = {
  /** IDs already in use — used to detect duplicates before the POST. */
  existingIds: ReadonlySet<string>
  onClose: () => void
  /** Called with the new exercise's id once it's been saved. */
  onCreated: (id: string) => void | Promise<void>
}

export default function NewExerciseModal({ existingIds, onClose, onCreated }: Props) {
  const { teamId } = useTeam()
  const [fields, setFields] = useState<ExerciseFields>(EMPTY)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  const derivedId = useMemo(() => slugify(fields.title), [fields.title])
  const idCollision = derivedId.length > 0 && existingIds.has(derivedId)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  const isDirty = !fieldsEqual(fields, EMPTY)
  const canSave =
    derivedId.length > 0 &&
    !idCollision &&
    fields.title.trim().length > 0 &&
    fields.tips.every((t) => t.trim().length > 0) &&
    saveStatus !== 'saving'

  async function handleSave() {
    if (!canSave) return
    setSaveStatus('saving')
    setSaveError('')
    try {
      // Strip any trailing blank tip the user left from the "Add" button.
      const sanitised: ExerciseFields = {
        ...fields,
        title: fields.title.trim(),
        emoji: fields.emoji.trim(),
        color: fields.color.trim(),
        syfte: fields.syfte.trim(),
        tips: fields.tips.map((t) => t.trim()).filter(Boolean),
        tags: fields.tags,
      }
      const markdown = serializeCard(sanitised)
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: derivedId, markdown }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      trackEvent('ExerciseCreated', {
        teamId: teamId ?? null,
        exerciseId: derivedId,
      })
      await onCreated(derivedId)
      onClose()
    } catch (e: any) {
      setSaveError(e?.message ?? 'Något gick fel')
      setSaveStatus('error')
    }
  }

  return (
    <div className="new-exercise-backdrop" onClick={handleBackdrop} role="dialog" aria-modal="true">
      <div className="new-exercise-panel">
        <div className="new-exercise-header">
          <h2 className="new-exercise-title">✨ Ny övning</h2>
          <button
            type="button"
            className="new-exercise-close"
            onClick={onClose}
            aria-label="Stäng"
          >
            ✕
          </button>
        </div>

        <div className="new-exercise-body">
          <ExerciseFormFields fields={fields} onChange={setFields} derivedId={derivedId} />
          {idCollision && (
            <p className="new-exercise-error">
              En övning med filnamnet <code>{derivedId}</code> finns redan. Välj en annan titel.
            </p>
          )}
          {saveStatus === 'error' && saveError && (
            <p className="new-exercise-error">{saveError}</p>
          )}
        </div>

        <div className="new-exercise-footer">
          <button
            type="button"
            className="new-exercise-btn new-exercise-btn--secondary"
            onClick={onClose}
            disabled={saveStatus === 'saving'}
          >
            Avbryt
          </button>
          <button
            type="button"
            className="new-exercise-btn new-exercise-btn--primary"
            onClick={handleSave}
            disabled={!canSave || !isDirty}
          >
            {saveStatus === 'saving' ? '⏳ Skapar…' : '✨ Skapa övning'}
          </button>
        </div>
      </div>
    </div>
  )
}
