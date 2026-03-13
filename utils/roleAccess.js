const ROLES = require("../config/roles");

const ROLE_PRIORITY = [ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin, ROLES.Resident].filter(Boolean);

const normalizeRoleCodes = (input) => {
  const rawRoles = Array.isArray(input) ? input : [input];
  const valid = rawRoles
    .map((role) => Number(role))
    .filter((role) => Object.values(ROLES).includes(role));

  return [...new Set(valid)];
};

const getUserRoles = (user) => {
  if (!user) return [];

  const merged = normalizeRoleCodes([
    ...(Array.isArray(user.roles) ? user.roles : []),
    user.role,
    user.roleCode,
  ]);

  return merged;
};

const hasRole = (user, ...allowedRoles) => {
  const userRoles = getUserRoles(user);
  const allowed = normalizeRoleCodes(allowedRoles.flat());
  return allowed.some((role) => userRoles.includes(role));
};

const getPrimaryRole = (roles = []) => {
  const normalized = normalizeRoleCodes(roles);
  for (const role of ROLE_PRIORITY) {
    if (normalized.includes(role)) return role;
  }
  return ROLES.Resident;
};

const isSameUser = (firstId, secondId) => {
  if (!firstId || !secondId) return false;
  return String(firstId) === String(secondId);
};

module.exports = {
  normalizeRoleCodes,
  getUserRoles,
  hasRole,
  getPrimaryRole,
  isSameUser,
};
