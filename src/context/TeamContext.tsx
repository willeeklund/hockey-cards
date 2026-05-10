import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { TEAMS, type Team } from '../config/teams';

const STORAGE_KEY = 'gota-off-ice:team';

type TeamContextValue = {
  team: Team | null;
  teamId: string | null;
  setTeamId: (id: string | null) => void;
  teams: readonly Team[];
};

const TeamContext = createContext<TeamContextValue | null>(null);

function readInitialTeamId(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && TEAMS.some((t) => t.id === stored)) return stored;
  return null;
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const [teamId, setTeamIdState] = useState<string | null>(readInitialTeamId);

  useEffect(() => {
    try {
      if (teamId === null) {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, teamId);
      }
    } catch {
      // localStorage may be unavailable (private mode etc.) — ignore.
    }
  }, [teamId]);

  const setTeamId = useCallback((id: string | null) => {
    if (id === null) {
      setTeamIdState(null);
    } else if (TEAMS.some((t) => t.id === id)) {
      setTeamIdState(id);
    }
  }, []);

  const team = useMemo(
    () => (teamId ? TEAMS.find((t) => t.id === teamId) ?? null : null),
    [teamId],
  );

  const value = useMemo(
    () => ({ team, teamId, setTeamId, teams: TEAMS }),
    [team, teamId, setTeamId],
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used inside <TeamProvider>');
  return ctx;
}
