const ROLES = require('../config/roles');

/**
 * Middleware to restrict access to Staff, Admin, SuperAdmin, or SystemAdmin roles
 */
const staffOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  // Check if user has admin privileges
  const authorizedRoles = [ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin];
  const userRole = Number(req.user.roleCode || req.user.role);

  if (!authorizedRoles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff or Admin privileges required.',
    });
  }

  next();
};

module.exports = staffOrAdmin;
