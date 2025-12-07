const ROLES = require('../config/roles');

/**
 * Middleware to restrict access to Staff, Admin, or SuperAdmin roles
 * Note: Currently only Admin and SuperAdmin exist in the system
 */
const staffOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized',
    });
  }

  // Check if user has admin privileges
  // Currently the system has: SuperAdmin (74932), Admin (74933), Resident (74934)
  const authorizedRoles = [ROLES.SuperAdmin, ROLES.Admin];
  
  if (!authorizedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Staff or Admin privileges required.',
    });
  }

  next();
};

module.exports = staffOrAdmin;
