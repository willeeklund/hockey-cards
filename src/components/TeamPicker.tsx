import { useEffect } from 'react'
import { useTeam } from '../context/TeamContext'
import { FALLBACK_TEAM_ID } from '../config/teams'
import './TeamPicker.css'

type Props = {
  /** When provided, the picker is dismissible (close button, Escape key,
   *  backdrop click). When omitted, the user MUST pick a team. */
  onClose?: () => void
}

export default function TeamPicker({ onClose }: Props) {
  const { teams, setTeamId } = useTeam()
  const dismissible = onClose !== undefined

  // Escape closes the picker when it's dismissible.
  useEffect(() => {
    if (!dismissible) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose!()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismissible, onClose])

  // Lock body scroll while the modal is mounted. Without this iOS Safari
  // will happily scroll the page underneath when the user tries to scroll
  // inside the modal, especially in landscape where the modal is taller
  // than the viewport.
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (dismissible && e.target === e.currentTarget) onClose!()
  }

  function pick(id: string) {
    setTeamId(id)
    onClose?.()
  }

  return (
    <div
      className="team-picker-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-picker-title"
      onClick={handleBackdrop}
    >
      <div className="team-picker-card">
        {dismissible && (
          <button
            type="button"
            className="team-picker-close"
            onClick={onClose}
            aria-label="Stäng"
          >
            ✕
          </button>
        )}

        <h1 id="team-picker-title" className="team-picker-title">
          <span aria-hidden>🏒</span> Välj ditt lag
        </h1>
        <p className="team-picker-intro">
          En kortlek med övningar för hockey-träning utanför isen. Välj de övningar ni vill göra på er träning, skriv ut korten och laminera dem.
        </p>

        <p className="team-picker-feature">
          <span className="team-picker-feature-icon" aria-hidden>📸</span>
          <span>
            <strong>Egna foton.</strong> När du valt ditt lag kan du ladda upp bilder på era spelare som visar hur övningarna går till — det är roligare för barnen att se sina lagkamrater på korten.
          </span>
        </p>

        <p className="team-picker-feature">
          <span className="team-picker-feature-icon" aria-hidden>✏️</span>
          <span>
            <strong>Gemensamma texter.</strong> Övningstexterna delas mellan alla lag. När du ändrar en text påverkar det alla lag.
          </span>
        </p>

        <p className="team-picker-intro team-picker-intro--muted">
          Vill du bara se exempel? Välj <strong>Team 16</strong> — där har de flesta korten uppladdade bilder.
        </p>

        <aside className="team-picker-signoff">
          <p>
            Vi hoppas att ni får glädje av appen! Maila gärna feedback och förslag på förbättringar.
          </p>
          <p>
            Hälsningar <strong>Wille</strong>, lagledare i Team 16
          </p>
          <p className="team-picker-contact">
            <a href="mailto:wille.eklund@gmail.com">wille.eklund@gmail.com</a>
            <span aria-hidden> · </span>
            <a href="tel:+46705400425">070-540 04 25</a>
          </p>
        </aside>

        <div className="team-picker-options">
          {teams.map((t) => {
            const isExample = t.id === FALLBACK_TEAM_ID
            return (
              <button
                key={t.id}
                type="button"
                className={`team-picker-option${isExample ? ' team-picker-option--example' : ''}`}
                onClick={() => pick(t.id)}
              >
                <span className="team-picker-option-label">{t.label}</span>
                {isExample && (
                  <span className="team-picker-option-marker" aria-hidden>
                    📸
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
