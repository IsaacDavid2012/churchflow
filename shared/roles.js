/**
 * ServeSync RBAC Role Definitions & Permission Matrix
 */

const ROLES = {
  ADMIN: 'admin',
  PASTOR: 'pastor',
  MANAGER: 'manager',
  MEMBER: 'member',

  // Backward compatibility aliases
  LEADER: 'leader',
  VOLUNTEER: 'volunteer',
};

const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 4,
  [ROLES.PASTOR]: 3,
  [ROLES.MANAGER]: 2,
  [ROLES.LEADER]: 2,
  [ROLES.MEMBER]: 1,
  [ROLES.VOLUNTEER]: 1,
};

/**
 * Normalizes role string and maps legacy aliases
 */
function normalizeRole(role) {
  if (!role) return ROLES.MEMBER;
  const r = role.toLowerCase().trim();
  if (r === 'leader' || r === 'worship_leader') return ROLES.MANAGER;
  if (r === 'volunteer') return ROLES.MEMBER;
  return r;
}

/**
 * Checks if a user role satisfies the required roles or level.
 * @param {string} userRole 
 * @param {string|string[]} allowedRoles 
 * @returns {boolean}
 */
function hasRole(userRole, allowedRoles) {
  if (!userRole) return false;
  const normUser = normalizeRole(userRole);
  if (normUser === ROLES.ADMIN) return true; // Super-admin always has access

  const list = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map(normalizeRole);
  return list.includes(normUser);
}

/**
 * Checks if a user has at least a specific hierarchy level.
 * @param {string} userRole 
 * @param {string} minRole 
 * @returns {boolean}
 */
function hasMinimumRole(userRole, minRole) {
  const userLevel = ROLE_HIERARCHY[normalizeRole(userRole)] || 0;
  const minLevel = ROLE_HIERARCHY[normalizeRole(minRole)] || 0;
  return userLevel >= minLevel;
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  normalizeRole,
  hasRole,
  hasMinimumRole,
};
