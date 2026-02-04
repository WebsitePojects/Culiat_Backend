const Settings = require("../models/Settings");
const jwt = require("jsonwebtoken");

/**
 * Middleware to check if the system is in maintenance mode
 * Returns maintenance status without blocking APIs
 * The frontend should check this status and display maintenance page
 * Backend APIs remain functional for admins
 */
const maintenanceMode = async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();
    
    // If maintenance mode is not enabled, continue
    if (!settings.system.maintenanceMode) {
      return next();
    }
    
    // Check if user has a valid admin token
    let isAdmin = false;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Admin role codes: 74933 (Admin) or 74932 (SuperAdmin)
        if (decoded.role === 74933 || decoded.role === 74932) {
          isAdmin = true;
        }
      } catch (err) {
        // Invalid token, continue as non-admin
      }
    }
    
    // Allow admin users to bypass maintenance mode
    if (isAdmin) {
      return next();
    }
    
    // Allow certain paths that should always be accessible
    const allowedPaths = [
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/settings/maintenance-status',
      '/api/settings',  // For checking maintenance status
    ];
    
    // Check if the current path is allowed
    if (allowedPaths.some(path => req.path === path || req.path.startsWith(path))) {
      return next();
    }
    
    // Return maintenance mode response (frontend should handle this)
    return res.status(503).json({
      success: false,
      message: settings.system.maintenanceMessage || "System is currently under maintenance. Please try again later.",
      maintenanceMode: true,
    });
  } catch (error) {
    console.error("Error checking maintenance mode:", error);
    // On error, allow request to continue to prevent total lockout
    next();
  }
};

module.exports = maintenanceMode;
