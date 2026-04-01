import { useState, useRef, useEffect } from 'react'
import { useGestures } from '../hooks/useGestures'
import './CardEditModal.css'

const TEAM_FOLDER = import.meta.env.IMAGES_FOLDER || 'ikgota-team16'
const DEFAULT_XFORM = { x: 0, y: 0, scale: 1 }
const ALL_TAGS = ['Klubbteknik', 'Parövningar', 'Individuella', 'Rörlighet']

function isDefault(xform) {
  return Math.abs(xform.x) < 0.001 && Math.abs(xform.y) < 0.001 && Math.abs(xform.scale - 1) < 0.001
}

export default function CardEditModal({ card, transform, onTransformChange, onClose }) {
  const [uploadStatus, setUploadStatus] = useState(null) // null | 'uploading' | 'success' | 'error'
  const [previewSrc, setPreviewSrc] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null)    // null | 'saving' | 'saved' | 'error'
  const [imgError, setImgError] = useState(false)
  const [tags, setTags] = useState(card.tags || [])
  const [tagSaveStatus, setTagSaveStatus] = useState(null)

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

  // Close on backdrop click
  function handleBackdrop(e) { if (e.target === e.currentTarget) onClose() }

  async function handleUpload(file) {
    if (!file) return
    setUploadStatus('uploading')
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target.result
      setPreviewSrc(URL.createObjectURL(file))
      setImgError(false)
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: `${card.id}.jpg`, data: base64 }),
        })
        const json = await res.json()
        setUploadStatus(json.ok ? 'success' : 'error')
      } catch { setUploadStatus('error') }
    }
    reader.readAsDataURL(file)
  }

  async function handleSaveCrop() {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/save-crop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: card.id, crop: transform }),
      })
      const json = await res.json()
      setSaveStatus(json.ok ? 'saved' : 'error')
    } catch { setSaveStatus('error') }
  }

  async function handleSaveTags() {
    setTagSaveStatus('saving')
    try {
      const res = await fetch('/api/save-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: card.id, tags }),
      })
      const json = await res.json()
      setTagSaveStatus(json.ok ? 'saved' : 'error')
      if (json.ok) setTimeout(() => setTagSaveStatus(null), 2000)
    } catch { setTagSaveStatus('error') }
  }

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
    setTagSaveStatus(null) // mark as unsaved
  }

  const imageSrc = previewSrc || `/exercise_images/${TEAM_FOLDER}/${card.id}.jpg`
  const edited = !isDefault(transform)

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
            {edited && <span className="modal-edited-badge">Beskuren</span>}
          </div>
          <p className="modal-hint">Dra för att flytta · Scroll/nyp för att zooma</p>
        </div>

        {/* Controls */}
        <div className="modal-controls">
          <div className="modal-controls-row">
            {/* Crop actions */}
            <div className="modal-btn-group">
              <button
                className="modal-btn modal-btn--secondary"
                onClick={() => { onTransformChange({ ...DEFAULT_XFORM }); setSaveStatus(null) }}
                disabled={!edited}
                title="Återställ beskärning"
              >
                ↺ Återställ
              </button>
              <button
                className={`modal-btn modal-btn--primary${saveStatus === 'saved' ? ' modal-btn--success' : saveStatus === 'error' ? ' modal-btn--error' : ''}`}
                onClick={handleSaveCrop}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? '…' : saveStatus === 'saved' ? '✓ Sparat' : saveStatus === 'error' ? '✕ Fel' : '💾 Spara beskärning'}
              </button>
            </div>

            {/* Upload */}
            <label className={`modal-btn modal-btn--upload${uploadStatus === 'uploading' ? ' modal-btn--loading' : uploadStatus === 'success' ? ' modal-btn--success' : uploadStatus === 'error' ? ' modal-btn--error' : ''}`}>
              {uploadStatus === 'uploading' ? '⏳ Laddar upp…' : uploadStatus === 'success' ? '✓ Uppladdad' : uploadStatus === 'error' ? '✕ Försök igen' : '📷 Byt foto'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0])} />
            </label>
          </div>

          {/* Tags */}
          <div className="modal-tags-section">
            <span className="modal-tags-label">Taggar:</span>
            <div className="modal-tags-list">
              {ALL_TAGS.map(tag => (
                <button
                  key={tag}
                  className={`modal-tag${tags.includes(tag) ? ' modal-tag--on' : ''}`}
                  style={tags.includes(tag) ? { '--tag-color': card.color || '#888' } : {}}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <button
              className={`modal-btn modal-btn--sm${tagSaveStatus === 'saved' ? ' modal-btn--success' : tagSaveStatus === 'error' ? ' modal-btn--error' : ''}`}
              onClick={handleSaveTags}
              disabled={tagSaveStatus === 'saving'}
            >
              {tagSaveStatus === 'saving' ? '…' : tagSaveStatus === 'saved' ? '✓' : tagSaveStatus === 'error' ? '✕' : 'Spara taggar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
