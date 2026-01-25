const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ROLES = require("../config/roles");

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);

    if (!req.user || !req.user.isActive) {
      return res.status(401).json({
        success: false,
        message: "User not found or inactive",
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
};

// Role-based authorization
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Get user's role (could be role code or role name)
    const userRole = req.user.role;
    const userRoleName = req.user.roleName;
    
    // Check if user's role matches any of the allowed roles
    // Support both role codes (74932, 74933, 74934) and role names ('Admin', 'SuperAdmin', 'Resident')
    const isAuthorized = roles.some(role => {
      // If role is a string name, check against both roleName and ROLES mapping
      if (typeof role === 'string') {
        // Check if roleName matches
        if (userRoleName === role) return true;
        // Check if role code matches the ROLES mapping
        if (ROLES[role] && userRole === ROLES[role]) return true;
      }
      // If role is a number (role code), check directly
      if (typeof role === 'number' && userRole === role) return true;
      return false;
    });
    
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: `User role is not authorized to access this route`,
      });
    }
    next();
  };
};

// Check if user is Admin or SuperAdmin
exports.isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    // Check if user role is Admin (74933) or SuperAdmin (74932)
    if (req.user.role !== ROLES.Admin && req.user.role !== ROLES.SuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error checking admin status",
    });
  }
};
