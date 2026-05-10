import { useState, useRef, useEffect } from 'react'
import { useGestures } from '../hooks/useGestures'
import { useTeam } from '../context/TeamContext'
import { FALLBACK_TEAM_ID } from '../config/teams'
import './CardEditModal.css'

const DEFAULT_XFORM = { x: 0, y: 0, scale: 1 }

function isDefault(xform) {
  return Math.abs(xform.x) < 0.001 && Math.abs(xform.y) < 0.001 && Math.abs(xform.scale - 1) < 0.001
}

function xformEqual(a, b) {
  return Math.abs(a.x - b.x) < 0.001 && Math.abs(a.y - b.y) < 0.001 && Math.abs(a.scale - b.scale) < 0.001
}

export default function CardEditModal({ card, transform, onTransformChange, onClose }) {
  const { teamId, teams, setTeamId } = useTeam()
  const displayTeamId = teamId ?? FALLBACK_TEAM_ID

  // Local-only pending edits — nothing is sent to the server until Save.
  const [pendingUpload, setPendingUpload] = useState(null) // { base64, previewUrl } | null
  const [imgError, setImgError] = useState(false)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'success' | 'error'
  const [saveError, setSaveError] = useState(null)

  // Snapshot the transform when the modal opens so we can tell if the user
  // has touched the crop since opening (otherwise the save would just
  // re-post the existing crop on every Save).
  const [initialTransform] = useState(transform)

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
  const imageSrc = pendingUpload?.previewUrl || `/exercise_images/${displayTeamId}/${card.id}.jpg`
  useEffect(() => {
    setImgError(false)
  }, [imageSrc])

  function handleBackdrop(e) { if (e.target === e.currentTarget) onClose() }

  function handleFileSelected(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setPendingUpload({ base64: e.target.result, previewUrl: URL.createObjectURL(file) })
      setImgError(false)
      setSaveStatus('idle')
      setSaveError(null)
    }
    reader.readAsDataURL(file)
  }

  function handleResetCrop() {
    onTransformChange({ ...DEFAULT_XFORM })
    setSaveStatus('idle')
    setSaveError(null)
  }

  const imageDirty = pendingUpload !== null
  const cropDirty = !xformEqual(transform, initialTransform)
  const isDirty = imageDirty || cropDirty

  // Reset a success/error status the moment the user makes another edit
  // (e.g. pans the image after a successful save).
  useEffect(() => {
    if (isDirty && (saveStatus === 'success' || saveStatus === 'error')) {
      setSaveStatus('idle')
      setSaveError(null)
    }
  }, [isDirty, saveStatus])

  async function handleSave() {
    if (!teamId || !isDirty || saveStatus === 'saving') return
    setSaveStatus('saving')
    setSaveError(null)
    try {
      if (imageDirty) {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team: teamId, filename: `${card.id}.jpg`, data: pendingUpload.base64 }),
        })
        if (!res.ok) throw new Error('Kunde inte ladda upp bilden')
      }
      if (cropDirty) {
        const res = await fetch('/api/save-crop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team: teamId, id: card.id, crop: transform }),
        })
        if (!res.ok) throw new Error('Kunde inte spara beskärningen')
      }
      setSaveStatus('success')
      // Auto-close shortly after a successful save so the user sees the
      // confirmation but doesn't have to dismiss the modal manually.
      setTimeout(() => onClose(), 800)
    } catch (e) {
      setSaveStatus('error')
      setSaveError(e.message || 'Ett fel uppstod')
    }
  }

  const cropEdited = !isDefault(transform)

  let saveLabel = '💾 Spara'
  if (saveStatus === 'saving') saveLabel = '⏳ Sparar…'
  else if (saveStatus === 'success') saveLabel = '✓ Sparat'
  else if (saveStatus === 'error') saveLabel = '✕ Försök igen'

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-panel">

        {/* Header */}
        <div className="modal-header" style={{ background: card.color || '#888' }}>
          <span className="modal-emoji">{card.emoji || '⭐'}</span>
          <h2 className="modal-title">{card.title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Image editor */}
        <div className="modal-editor">
          <div className="modal-image-area" ref={areaRef}>
            {!imgError ? (
              <div
                className="modal-image-wrapper"
                style={{ '--tx': transform.x, '--ty': transform.y, '--scale': transform.scale }}
              >
                <img
                  src={imageSrc}
                  alt={card.title}
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

        {/* Controls */}
        <div className="modal-controls">
          {/* File picker + crop reset — purely local actions, no save */}
          <div className="modal-controls-row">
            <label className="modal-btn modal-btn--upload">
              {pendingUpload ? '📷 Byt bild igen…' : '📷 Välj foto…'}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handleFileSelected(e.target.files[0])}
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

          {/* Single Save action — nothing is persisted to the server until
              this button is pressed. */}
          <div className="modal-save-row">
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

            {teamId ? (
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
            ) : (
              <label className="modal-upload-pick-team" title="Välj först vilket lag bilden ska sparas för">
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
