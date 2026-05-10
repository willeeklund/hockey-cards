import { useTeam } from '../context/TeamContext';
import './TeamSelector.css';

export default function TeamSelector() {
  const { teamId, setTeamId, teams } = useTeam();

  if (teams.length <= 1) {
    return (
      <span className="team-selector team-selector--single" title="Aktivt lag">
        🏆 {teams[0]?.label ?? teamId ?? 'Inget lag'}
      </span>
    );
  }

  const hasSelection = teamId !== null;

  return (
    <label
      className={`team-selector${hasSelection ? '' : ' team-selector--placeholder'}`}
      title={hasSelection ? 'Byt lag' : 'Välj lag'}
    >
      <span className="team-selector-icon" aria-hidden>
        🏆
      </span>
      <select
        className="team-selector-select"
        value={teamId ?? ''}
        onChange={(e) => {
          if (e.target.value) setTeamId(e.target.value);
        }}
      >
        {!hasSelection && (
          <option value="" disabled>
            Välj lag…
          </option>
        )}
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}
