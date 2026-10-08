export interface HealthResponse {
  status: 'ok';
  message: string;
}

export interface ApiErrorResponse {
  error: { code: string; message: string; requestId: string; fields?: Record<string, string> };
}

export const roleCodes = ['ADMINISTRATOR', 'OWNER', 'TEAM_LEADER', 'ENGINEER', 'INSPECTOR'] as const;
export type RoleCode = typeof roleCodes[number];
export const roleLabels: Record<RoleCode, string> = {
  ADMINISTRATOR: 'Administrator', OWNER: 'Owner', TEAM_LEADER: 'Team Leader', ENGINEER: 'Engineer', INSPECTOR: 'Inspector',
};
export interface SessionUser { id: string; name: string; email: string; role: RoleCode }
export interface ManagedUser extends SessionUser { isActive: boolean; createdAt: string }
