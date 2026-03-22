import { useState } from 'react'
import './ExerciseCard.css'

const FALLBACK_COLORS = ['#FF6B35', '#00B4D8', '#9B5DE5', '#F15BB5']
const TEAM_FOLDER = import.meta.env.IMAGES_FOLDER || 'ikgota-team16'

export default function ExerciseCard({ card, index = 0 }) {
  const [imgError, setImgError] = useState(false)

  const color = card.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]

  const imageSrc = `/exercise_images/${TEAM_FOLDER}/${card.id}.jpg`
  const hasImage = !imgError

  return (
    <article className="exercise-card" style={{ '--card-color': color }}>
      <header className="card-header">
        <span className="card-emoji">{card.emoji || '⭐'}</span>
        <h2 className="card-title">{card.title || 'Övning'}</h2>
        <img src="/gota-logga.png" alt="IK Göta" className="card-team-logo" />
      </header>

      <div className="card-image-area">
        {hasImage ? (
          <img
            src={imageSrc}
            alt={card.title}
            className="card-image"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="card-image-placeholder">
            <span className="placeholder-icon">📷</span>
            <p className="placeholder-text">Klistra in foto här</p>
          </div>
        )}
      </div>

      <div className="card-body">
        {card.syfte && (
          <section className="card-section">
            <h3 className="section-header">
              <span className="section-icon">🎯</span> Varför?
            </h3>
            <p className="section-text">{card.syfte}</p>
          </section>
        )}

        {card.tips && card.tips.length > 0 && (
          <section className="card-section">
            <h3 className="section-header">
              <span className="section-icon">💡</span> Tänk på!
            </h3>
            <ul className="tips-list">
              {card.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  )
}
