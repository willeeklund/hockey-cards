import { useEffect, useState } from 'react'
import { TEAM_ID } from '../config/teams'
import { assetUrl } from '../utils/assetUrl'
import './ExerciseCard.css'

const FALLBACK_COLORS = ['#FF6B35', '#00B4D8', '#9B5DE5', '#F15BB5']

function isEdited(xform) {
  return Math.abs(xform.x) > 0.001 || Math.abs(xform.y) > 0.001 || Math.abs(xform.scale - 1) > 0.001
}

export default function ExerciseCard({ card, index = 0, transform = { x: 0, y: 0, scale: 1 }, imageVersion = 0, onEdit }) {
  const [imgError, setImgError] = useState(false)

  const color = card.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
  // ?v=<n> busts <img> caches after an upload — bumped by App.tsx every
  // time refreshCards runs in response to a user save.
  const versionSuffix = imageVersion > 0 ? `?v=${imageVersion}` : ''
  const imageSrc = assetUrl(`/exercise_images/${TEAM_ID}/${card.id}.jpg${versionSuffix}`)
  const hasImage = !imgError
  const edited = isEdited(transform)

  // Reset the error flag whenever the image URL changes (new upload, crop
  // reset, etc.) so it gets a fresh chance to load.
  useEffect(() => {
    setImgError(false)
  }, [imageSrc])

  return (
    <article className="exercise-card" style={{ '--card-color': color }}>
      <header className="card-header">
        <span className="card-emoji">{card.emoji || '⭐'}</span>
        <h2 className="card-title">{card.title || 'Övning'}</h2>
        <img src={assetUrl('/gota-logga.png')} alt="IK Göta" className="card-team-logo" />
      </header>

      {/* Image area — click to open edit modal */}
      <div className="card-image-area" onClick={onEdit}>
        {hasImage ? (
          <div
            className="card-image-wrapper"
            style={{ '--tx': transform.x, '--ty': transform.y, '--scale': transform.scale }}
          >
            <img
              src={imageSrc}
              alt={card.title}
              className="card-image"
              onError={() => setImgError(true)}
              draggable={false}
            />
          </div>
        ) : (
          <div className="card-image-placeholder">
            <span className="placeholder-icon">📷</span>
            <p className="placeholder-text">Klicka för att ladda upp</p>
          </div>
        )}
        {/* Hover overlay — screen only */}
        <div className="card-edit-overlay no-print">✏️</div>
        {/* Crop-set indicator */}
        {edited && <span className="card-crop-dot no-print" title="Beskärning inställd" />}
      </div>

      <div className="card-body">
        {card.syfte && (
          <section className="card-section">
            <h3 className="section-header"><span className="section-icon">🎯</span> Varför?</h3>
            <p className="section-text">{card.syfte}</p>
          </section>
        )}
        {card.tips && card.tips.length > 0 && (
          <section className="card-section">
            <h3 className="section-header"><span className="section-icon">💡</span> Tänk på!</h3>
            <ul className="tips-list">
              {card.tips.map((tip, i) => <li key={i}>{tip}</li>)}
            </ul>
          </section>
        )}
      </div>
    </article>
  )
}
