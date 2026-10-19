export const ROLES = {
  ADMIN: 'admin',
  PASTOR: 'pastor',
  MANAGER: 'manager',
  MEMBER: 'member',
  LEADER: 'leader',
  VOLUNTEER: 'volunteer',
};

export const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 4,
  [ROLES.PASTOR]: 3,
  [ROLES.MANAGER]: 2,
  [ROLES.LEADER]: 2,
  [ROLES.MEMBER]: 1,
  [ROLES.VOLUNTEER]: 1,
};

export function normalizeRole(role) {
  if (!role) return ROLES.MEMBER;
  const r = role.toLowerCase().trim();
  if (r === 'leader' || r === 'worship_leader') return ROLES.MANAGER;
  if (r === 'volunteer') return ROLES.MEMBER;
  return r;
}

export function hasRole(userRole, allowedRoles) {
  if (!userRole) return false;
  const normUser = normalizeRole(userRole);
  if (normUser === ROLES.ADMIN) return true;
  const list = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map(normalizeRole);
  return list.includes(normUser);
}

export function hasMinimumRole(userRole, minRole) {
  const userLevel = ROLE_HIERARCHY[normalizeRole(userRole)] || 0;
  const minLevel = ROLE_HIERARCHY[normalizeRole(minRole)] || 0;
  return userLevel >= minLevel;
}
