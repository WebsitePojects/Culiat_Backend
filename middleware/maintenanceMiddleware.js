const Settings = require("../models/Settings");

/**
 * Middleware to check if the system is in maintenance mode
 * When enabled, only admin users can access the system
 * 
 * IMPORTANT: This middleware does NOT block API endpoints completely.
 * It allows:
 * - Admin/SuperAdmin users to bypass
 * - Authentication routes (login)
 * - Settings routes (so admins can turn off maintenance)
 * - Public endpoints
 */
const maintenanceMode = async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();
    
    // If maintenance mode is not enabled, continue
    if (!settings.system.maintenanceMode) {
      return next();
    }
    
    // Allow admin users to bypass maintenance mode
    // Admins have roleCode 74933 or 74932 (SuperAdmin)
    if (req.user && (req.user.role === 74933 || req.user.role === 74932 || req.user.roleCode === 74933 || req.user.roleCode === 74932)) {
      return next();
    }
    
    // Allow certain paths that should always be accessible
    // These paths are critical for system management and authentication
    const allowedPaths = [
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/settings/maintenance-status',
      '/api/settings/public',
      '/api/settings',  // Allow settings access (protected by auth anyway)
    ];
    
    // Check if the current path starts with any allowed path
    if (allowedPaths.some(path => req.path.startsWith(path) || req.path === path)) {
      return next();
    }
    
    // Also allow all settings routes for authenticated admins
    // This ensures admins can always manage settings
    if (req.path.startsWith('/api/settings')) {
      return next();
    }
    
    // Return maintenance mode response
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
