const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ROLES = require("../config/roles");
const { hasRole } = require("../utils/roleAccess");

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
    const normalizedAllowedRoles = roles
      .map((role) => {
        if (typeof role === "string") return ROLES[role];
        return Number(role);
      })
      .filter((role) => Object.values(ROLES).includes(role));

    const isAuthorized = hasRole(req.user, normalizedAllowedRoles);
    
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: `User role is not authorized to access this route`,
      });
    }
    next();
  };
};

// Check if user is Admin, SuperAdmin, or SystemAdmin
exports.isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (!hasRole(req.user, ROLES.Admin, ROLES.SuperAdmin, ROLES.SystemAdmin)) {
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

// Restrict resident-only access until registration is approved
exports.requireApprovedRegistration = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Not authorized",
    });
  }

  if (hasRole(req.user, ROLES.Resident) && req.user.registrationStatus !== "approved") {
    const status = req.user.registrationStatus || "pending";
    const baseMessage =
      status === "rejected"
        ? "Your registration is rejected. Document request services are unavailable."
        : "Your registration is pending verification. Document request services are locked until admin approval.";

    return res.status(403).json({
      success: false,
      code: "REGISTRATION_NOT_APPROVED",
      registrationStatus: status,
      message: baseMessage,
    });
  }

  return next();
};
