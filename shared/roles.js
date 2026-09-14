/**
 * ServeSync RBAC Role Definitions & Permission Matrix
 */

const ROLES = {
  ADMIN: 'admin',
  PASTOR: 'pastor',
  LEADER: 'leader',
  VOLUNTEER: 'volunteer',
};

const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: 4,
  [ROLES.PASTOR]: 3,
  [ROLES.LEADER]: 2,
  [ROLES.VOLUNTEER]: 1,
};

/**
 * Checks if a user role satisfies the required roles or level.
 * @param {string} userRole 
 * @param {string|string[]} allowedRoles 
 * @returns {boolean}
 */
function hasRole(userRole, allowedRoles) {
  if (!userRole) return false;
  if (userRole === ROLES.ADMIN) return true; // Super-admin always has access

  if (Array.isArray(allowedRoles)) {
    return allowedRoles.includes(userRole);
  }
  return userRole === allowedRoles;
}

/**
 * Checks if a user has at least a specific hierarchy level.
 * @param {string} userRole 
 * @param {string} minRole 
 * @returns {boolean}
 */
function hasMinimumRole(userRole, minRole) {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const minLevel = ROLE_HIERARCHY[minRole] || 0;
  return userLevel >= minLevel;
}

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  hasRole,
  hasMinimumRole,
};
