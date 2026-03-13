const ROLES = require('../config/roles');

/**
 * Get role name from role code
 * @param {number} roleCode - The numeric role code
 * @returns {string} - The role name (e.g., 'Admin', 'Resident') or 'Unknown'
 */
const getRoleName = (roleCode) => {
  const roleEntry = Object.entries(ROLES).find(([name, code]) => code === roleCode);
  return roleEntry ? roleEntry[0] : 'Unknown';
};

const WEBSITE_ADMIN_ROLE_CODES = [ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin].filter(Boolean);

const toDisplayName = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const getRoleCodesFromUser = (user) => {
  if (!user) return [];
  const merged = [
    ...(Array.isArray(user.roles) ? user.roles : []),
    user.role,
    user.roleCode,
  ]
    .map((role) => Number(role))
    .filter((role) => Number.isFinite(role));

  return [...new Set(merged)];
};

const hasWebsiteAdminRole = (user) => {
  const roleCodes = getRoleCodesFromUser(user);
  return roleCodes.some((role) => WEBSITE_ADMIN_ROLE_CODES.includes(role));
};

const getWebsiteAdminTagSuffix = (user) => {
  return hasWebsiteAdminRole(user) ? ' - Website Admin' : '';
};

const getUserDisplayNameWithWebsiteAdminTag = (user) => {
  if (!user) return '';
  const firstName = toDisplayName(user.firstName);
  const lastName = toDisplayName(user.lastName);
  const baseName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const fallback = toDisplayName(user.username || user.name || '');
  const displayName = baseName || fallback;
  if (!displayName) return '';
  return `${displayName}${getWebsiteAdminTagSuffix(user)}`;
};

module.exports = {
  getRoleName,
  hasWebsiteAdminRole,
  getWebsiteAdminTagSuffix,
  getUserDisplayNameWithWebsiteAdminTag,
};
