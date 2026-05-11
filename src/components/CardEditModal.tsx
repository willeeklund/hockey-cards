import { useEffect, useMemo, useRef, useState } from 'react'
import { useGestures } from '../hooks/useGestures'
import { useTeam } from '../context/TeamContext'
import { FALLBACK_TEAM_ID } from '../config/teams'
import ExerciseFormFields from './ExerciseFormFields'
import {
  fieldsEqual,
  fieldsFromCard,
  serializeCard,
  type ExerciseFields,
} from '../utils/cardMarkdown'
import { trackEvent } from '../utils/analytics'
import './CardEditModal.css'

const DEFAULT_XFORM = { x: 0, y: 0, scale: 1 }

function isDefault(xform) {
  return Math.abs(xform.x) < 0.001 && Math.abs(xform.y) < 0.001 && Math.abs(xform.scale - 1) < 0.001
}

function xformEqual(a, b) {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001 && Math.abs(a.scale - b.scale) < 0.001
}

type Props = {
  card: { id: string; [key: string]: any }
  transform: { x: number; y: number; scale: number }
  /** Bumped by App.tsx after every successful refresh — appended to the
   *  image URL as `?v=<n>` so a freshly uploaded photo replaces the
   *  browser-cached one. */
  imageVersion?: number
  onTransformChange: (next: { x: number; y: number; scale: number }) => void
  onClose: () => void
  /** Called after a successful save so the parent can re-fetch the card
   *  list (titles/colors/tips may have changed). */
  onSaved?: () => void | Promise<void>
}

export default function CardEditModal({ card, transform, imageVersion = 0, onTransformChange, onClose, onSaved }: Props) {
  const { teamId, teams, setTeamId } = useTeam()
  const displayTeamId = teamId ?? FALLBACK_TEAM_ID

  // Local-only pending edits — nothing is sent to the server until Save.
  const [pendingUpload, setPendingUpload] = useState<{ base64: string; previewUrl: string } | null>(null)
  const [imgError, setImgError] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  // Snapshot the transform when the modal opens so we can tell if the user
  // has touched the crop since opening.
  const [initialTransform] = useState(transform)

  // Form fields — initialised once from the card; not re-derived on every
  // render so the user can edit freely.
  const initialFields = useMemo<ExerciseFields>(() => fieldsFromCard(card), [card.id])
  const [fields, setFields] = useState<ExerciseFields>(initialFields)

  // Text-edit is collapsed by default — the modal opens as an "edit just
  // the photo" tool. Clicking the toggle reveals the shared-content form.
  const [textEditOpen, setTextEditOpen] = useState(false)

  const areaRef = useRef(null)
  const xformRef = useRef(transform)
  xformRef.current = transform

  useGestures(areaRef, xformRef, onTransformChange)

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Release the object URL when a new file is picked or on unmount.
  useEffect(() => {
    return () => {
      if (pendingUpload?.previewUrl) URL.revokeObjectURL(pendingUpload.previewUrl)
    }
  }, [pendingUpload])

  // Reset the error flag whenever the source URL changes (team switch,
  // file selection, etc.) so the new image gets a fresh chance to load.
  // The ?v=<n> suffix mirrors what App.tsx does for the printed cards.
  const versionSuffix = imageVersion > 0 ? `?v=${imageVersion}` : ''
  const imageSrc = pendingUpload?.previewUrl || `/exercise_images/${displayTeamId}/${card.id}.jpg${versionSuffix}`
  useEffect(() => {
    setImgError(false)
  }, [imageSrc])

  function handleBackdrop(e) { if (e.target === e.currentTarget) onClose() }

  function handleFileSelected(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setPendingUpload({ base64: e.target!.result as string, previewUrl: URL.createObjectURL(file) })
      setImgError(false)
      setSaveStatus('idle')
      setSaveError('')
    }
    reader.readAsDataURL(file)
  }

  function handleResetCrop() {
    onTransformChange({ ...DEFAULT_XFORM })
    setSaveStatus('idle')
    setSaveError('')
  }

  function handleFieldsChange(next: ExerciseFields) {
    setFields(next)
    setSaveStatus('idle')
    setSaveError('')
  }

  const imageDirty = pendingUpload !== null
  const cropDirty = !xformEqual(transform, initialTransform)
  const fieldsDirty = !fieldsEqual(fields, initialFields)
  const isDirty = imageDirty || cropDirty || fieldsDirty
  const teamRequired = imageDirty || cropDirty

  // Reset success/error status when the user makes another edit.
  useEffect(() => {
    if (isDirty && (saveStatus === 'success' || saveStatus === 'error')) {
      setSaveStatus('idle')
      setSaveError('')
    }
  }, [isDirty, saveStatus])

  async function handleSave() {
    if (!isDirty || saveStatus === 'saving') return
    if (teamRequired && !teamId) return
    setSaveStatus('saving')
    setSaveError('')
    try {
      if (imageDirty && teamId) {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team: teamId, filename: `${card.id}.jpg`, data: pendingUpload!.base64 }),
        })
        if (!res.ok) throw new Error('Kunde inte ladda upp bilden')
        trackEvent('ImageUploaded', { teamId, cardId: card.id })
      }
      if (cropDirty && teamId) {
        const res = await fetch('/api/save-crop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team: teamId, id: card.id, crop: transform }),
        })
        if (!res.ok) throw new Error('Kunde inte spara beskärningen')
      }
      if (fieldsDirty) {
        const sanitised: ExerciseFields = {
          ...fields,
          title: fields.title.trim(),
          emoji: fields.emoji.trim(),
          color: fields.color.trim(),
          syfte: fields.syfte.trim(),
          tips: fields.tips.map((t) => t.trim()).filter(Boolean),
        }
        const res = await fetch(`/api/content/${card.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ markdown: serializeCard(sanitised) }),
        })
        if (!res.ok) throw new Error('Kunde inte spara övningens uppgifter')
        trackEvent('CardTextUpdated', {
          teamId: teamId ?? null,
          cardId: card.id,
        })
      }
      setSaveStatus('success')
      if (onSaved) await onSaved()
      setTimeout(() => onClose(), 800)
    } catch (e: any) {
      setSaveStatus('error')
      setSaveError(e?.message || 'Ett fel uppstod')
    }
  }

  const cropEdited = !isDefault(transform)

  let saveLabel = '💾 Spara'
  if (saveStatus === 'saving') saveLabel = '⏳ Sparar…'
  else if (saveStatus === 'success') saveLabel = '✓ Sparat'
  else if (saveStatus === 'error') saveLabel = '✕ Försök igen'

  // Use the live form values for the header so the user sees their edits
  // reflected immediately.
  const headerColor = fields.color || card.color || '#888'
  const headerEmoji = fields.emoji || card.emoji || '⭐'
  const headerTitle = fields.title || card.title || '(utan titel)'

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-panel">

        {/* Header */}
        <div className="modal-header" style={{ background: headerColor }}>
          <span className="modal-emoji">{headerEmoji}</span>
          <h2 className="modal-title">{headerTitle}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-scrollable">
          {/* Image editor */}
          <div className="modal-editor">
            <div className="modal-image-area" ref={areaRef}>
              {!imgError ? (
                <div
                  className="modal-image-wrapper"
                  style={{ '--tx': transform.x, '--ty': transform.y, '--scale': transform.scale } as any}
                >
                  <img
                    src={imageSrc}
                    alt={headerTitle}
                    className="modal-image"
                    onError={() => setImgError(true)}
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="modal-image-placeholder">
                  <span>📷</span>
                  <p>Ingen bild uppladdad</p>
                </div>
              )}
              {cropEdited && <span className="modal-edited-badge">Beskuren</span>}
            </div>
            <p className="modal-hint">Dra för att flytta · Scroll/nyp för att zooma</p>
          </div>

          {/* Image-related controls */}
          <div className="modal-controls">
            <div className="modal-controls-row">
              <label className="modal-btn modal-btn--upload">
                {pendingUpload ? '📷 Byt bild igen…' : '📷 Välj foto…'}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handleFileSelected(e.target.files?.[0])}
                />
              </label>

              <button
                className="modal-btn modal-btn--secondary"
                onClick={handleResetCrop}
                disabled={!cropEdited}
                title="Återställ beskärning"
              >
                ↺ Återställ beskärning
              </button>
            </div>
          </div>

          {/* Toggle to reveal the (shared-across-teams) text editor. */}
          <div className="modal-text-edit-toggle">
            <button
              type="button"
              className="modal-text-edit-toggle-btn"
              onClick={() => setTextEditOpen((open) => !open)}
              aria-expanded={textEditOpen}
            >
              {textEditOpen ? '↑ Stäng textredigering' : '✏️ Redigera texten'}
            </button>
          </div>

          {/* Shared-text warning + the actual form. Hidden by default so
              the modal feels like a simple photo-editor until the user
              opts in to editing the (shared) exercise info. */}
          {textEditOpen && (
            <>
              <div className="modal-shared-warning" role="note">
                <span className="modal-shared-warning-icon" aria-hidden>👥</span>
                <span>
                  <strong>Övningstexterna är gemensamma för alla lag.</strong>{' '}
                  Ändringar du gör här (titel, syfte, tips, taggar, färg) syns för alla.
                </span>
              </div>
              <div className="modal-fields">
                <ExerciseFormFields fields={fields} onChange={handleFieldsChange} />
              </div>
            </>
          )}
        </div>

        {/* Save action — sticky footer */}
        <div className="modal-save-row modal-save-row--footer">
          <div className="modal-save-status">
            {saveStatus === 'idle' && isDirty && (
              <span className="modal-save-hint">Du har osparade ändringar.</span>
            )}
            {saveStatus === 'idle' && !isDirty && (
              <span className="modal-save-hint modal-save-hint--muted">Inga ändringar att spara.</span>
            )}
            {saveStatus === 'error' && saveError && (
              <span className="modal-save-hint modal-save-hint--error">{saveError}</span>
            )}
          </div>

          {teamRequired && !teamId ? (
            <label className="modal-upload-pick-team" title="Välj först vilket lag bildändringarna ska sparas för">
              <span className="modal-upload-pick-label">💾 Spara till lag:</span>
              <select
                className="modal-upload-pick-select"
                value=""
                onChange={e => { if (e.target.value) setTeamId(e.target.value) }}
              >
                <option value="" disabled>Välj lag…</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
          ) : (
            <button
              className={`modal-btn modal-btn--primary modal-btn--save${
                saveStatus === 'success' ? ' modal-btn--success'
                : saveStatus === 'error' ? ' modal-btn--error'
                : ''
              }`}
              onClick={handleSave}
              disabled={!isDirty || saveStatus === 'saving' || saveStatus === 'success'}
            >
              {saveLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
