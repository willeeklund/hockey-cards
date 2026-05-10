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
          Välj vilket lag du tillhör för att kunna ladda upp bilder på dina egna spelare.
        </p>
        <p className="team-picker-intro team-picker-intro--muted">
          Vill du bara se exempel? Välj <strong>Team 16</strong> — där har de flesta korten uppladdade bilder.
        </p>

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
