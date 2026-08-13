import { getSelectedTeamIdSnapshot, getTeamNameById } from '../services/permissions/teamSelectionStore';

export const DEFAULT_SESSION_TEAM_ID = 'u17-women-alula';
export const DEFAULT_SESSION_TEAM_NAME = 'U17 Women Al Ula';

export function resolveTeamForSessionWrite(session: { teamId?: string; teamName?: string | null }): { teamId: string | null; teamName: string } {
  const explicitTeamId = (session.teamId || '').trim();
  const selectedTeamId = (getSelectedTeamIdSnapshot() || '').trim();
  const resolvedTeamId = explicitTeamId || selectedTeamId || DEFAULT_SESSION_TEAM_ID;

  const explicitName = (session.teamName || '').trim();
  const catalogName = resolvedTeamId ? (getTeamNameById(resolvedTeamId) || '') : '';
  const resolvedTeamName = explicitName || catalogName || DEFAULT_SESSION_TEAM_NAME;

  return {
    teamId: resolvedTeamId,
    teamName: resolvedTeamName
  };
}
