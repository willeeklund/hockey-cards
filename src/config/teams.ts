// List of teams the user can choose between. Add entries here as needed.
// `id` must match the folder name under public/exercise_images/ (local mode)
// or the blob name prefix in Azure (blob mode).
export type Team = {
  id: string;
  label: string;
};

export const TEAMS: readonly Team[] = [
  { id: 'ikgota-alag', label: 'IK Göta — A-lag' },
  { id: 'ikgota-j20', label: 'IK Göta — J20' },
  { id: 'ikgota-j18', label: 'IK Göta — J18' },
  { id: 'ikgota-team11', label: 'IK Göta — Team 11' },
  { id: 'ikgota-team12', label: 'IK Göta — Team 12' },
  { id: 'ikgota-team13', label: 'IK Göta — Team 13' },
  { id: 'ikgota-team14', label: 'IK Göta — Team 14' },
  { id: 'ikgota-team15', label: 'IK Göta — Team 15' },
  { id: 'ikgota-team16', label: 'IK Göta — Team 16' },
  { id: 'ikgota-team17', label: 'IK Göta — Team 17' },
  { id: 'ikgota-team-f12-f10', label: 'IK Göta — Team F12-F10' },
  { id: 'ikgota-team-f14', label: 'IK Göta — Team F14' },
  { id: 'ikgota-team-f16', label: 'IK Göta — Team F16' },
] as const;

export const DEFAULT_TEAM_ID = TEAMS[0].id;

// Used to *display* exercise images when no team has been picked yet.
// Team 16 is the most fleshed-out team folder (most exercises have images),
// so it's the friendliest fallback for browsing. Uploads still require an
// explicit team selection — this is a display-only fallback.
export const FALLBACK_TEAM_ID = 'ikgota-team16';
