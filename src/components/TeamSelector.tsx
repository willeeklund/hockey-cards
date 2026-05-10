import { useTeam } from '../context/TeamContext'
import './TeamSelector.css'

type Props = {
  onSwitch: () => void
}

/**
 * Toolbar pill that shows the current team and opens the big team-picker
 * modal when clicked. Used to be a dropdown — switched to a button so the
 * selection action is more prominent and goes through the same modal flow
 * as first-time selection.
 */
export default function TeamSelector({ onSwitch }: Props) {
  const { team, teamId } = useTeam()

  if (!teamId) {
    return (
      <button
        type="button"
        className="team-selector team-selector--placeholder"
        onClick={onSwitch}
      >
        <span className="team-selector-icon" aria-hidden>🏆</span>
        <span className="team-selector-name">Välj lag</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      className="team-selector"
      onClick={onSwitch}
      title="Byt lag"
    >
      <span className="team-selector-icon" aria-hidden>🏆</span>
      <span className="team-selector-name">{team?.label ?? teamId}</span>
      <span className="team-selector-action">Byt lag</span>
    </button>
  )
}
