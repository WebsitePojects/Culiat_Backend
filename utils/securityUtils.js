/**
 * Security Utilities
 * Centralized security helpers for input validation, sanitization, and safe operations.
 * Implements OWASP best practices for Node.js/Express/MongoDB applications.
 */

const crypto = require("crypto");

/**
 * Escape special regex characters to prevent ReDoS attacks
 * @param {string} str - Raw user input string
 * @returns {string} Escaped string safe for use in RegExp / MongoDB $regex
 */
const escapeRegex = (str) => {
  if (typeof str !== "string") return "";
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Generate a cryptographically secure random password
 * @param {number} length - Password length (default: 16)
 * @returns {string} Secure random password
 */
const generateSecurePassword = (length = 16) => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*()_+-=";
  const allChars = uppercase + lowercase + numbers + special;

  // Ensure at least one of each type
  let password = "";
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];

  // Fill the rest
  for (let i = 4; i < length; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => crypto.randomInt(3) - 1)
    .join("");
};

/**
 * Generate a cryptographically secure 6-digit verification code
 * @returns {string} 6-digit code
 */
const generateSecureVerificationCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Validate password complexity
 * @param {string} password - Password to validate
 * @returns {{ valid: boolean, message: string }} Validation result
 */
const validatePasswordComplexity = (password) => {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Password is required" };
  }
  if (password.length < 8) {
    return {
      valid: false,
      message: "Password must be at least 8 characters long",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one uppercase letter",
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one lowercase letter",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one number",
    };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain at least one special character",
    };
  }
  return { valid: true, message: "Password meets complexity requirements" };
};

/**
 * Whitelist-based sort field validator
 * @param {string} sortBy - Requested sort field
 * @param {string[]} allowedFields - Array of allowed field names
 * @param {string} defaultField - Default sort field if invalid
 * @returns {string} Safe sort field
 */
const sanitizeSortField = (
  sortBy,
  allowedFields = ["createdAt", "updatedAt"],
  defaultField = "createdAt"
) => {
  if (!sortBy || typeof sortBy !== "string") return defaultField;
  return allowedFields.includes(sortBy) ? sortBy : defaultField;
};

/**
 * Strip dangerous keys from objects to prevent prototype pollution
 * @param {object} obj - Input object
 * @returns {object} Sanitized object
 */
const stripDangerousKeys = (obj) => {
  if (typeof obj !== "object" || obj === null) return obj;
  const dangerous = ["__proto__", "constructor", "prototype"];
  const result = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (dangerous.includes(key)) continue;
    if (typeof value === "object" && value !== null) {
      result[key] = stripDangerousKeys(value);
    } else {
      result[key] = value;
    }
  }
  return result;
};

/**
 * Sanitize error messages for client responses (hide internal details in production)
 * @param {Error|string} error - Error object or message
 * @param {string} fallback - Generic fallback message
 * @returns {string} Safe error message
 */
const safeErrorMessage = (error, fallback = "An unexpected error occurred") => {
  if (process.env.NODE_ENV === "development") {
    return typeof error === "string" ? error : error?.message || fallback;
  }
  return fallback;
};

/**
 * Sanitize a filename to prevent path traversal
 * @param {string} filename - Original filename
 * @returns {string} Safe filename (basename only)
 */
const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== "string") return "unknown";
  // Extract only the basename, remove any directory traversal
  const path = require("path");
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
};

module.exports = {
  escapeRegex,
  generateSecurePassword,
  generateSecureVerificationCode,
  validatePasswordComplexity,
  sanitizeSortField,
  stripDangerousKeys,
  safeErrorMessage,
  sanitizeFilename,
};
