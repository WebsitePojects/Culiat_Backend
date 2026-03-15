const Logs = require("../models/Logs");
const { getRoleName } = require("./roleHelpers");
const { LOGCONSTANTS } = require("../config/logConstants");

/**
 * Derive the log category from the action string by checking which
 * LOGCONSTANTS group it belongs to.
 */
function deriveCategoryFromAction(action) {
  if (!action) return null;
  const upperAction = action.toUpperCase();
  const categoryMap = LOGCONSTANTS.categories || {};
  const actions = LOGCONSTANTS.actions || {};

  for (const [group, groupActions] of Object.entries(actions)) {
    const values = Object.values(groupActions);
    if (values.includes(upperAction)) {
      return categoryMap[group] || group;
    }
  }
  return null;
}

/**
 * Get the client IP from an Express request object.
 * Handles proxy forwarding headers.
 */
function getClientIp(req) {
  if (!req) return null;
  const forwarded = req.headers && req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return (
    req.ip ||
    (req.connection && req.connection.remoteAddress) ||
    null
  );
}

/**
 * Create an activity log entry.
 *
 * @param {string} action   - Log action (use LOGCONSTANTS.actions.*)
 * @param {string} description - Human-readable description
 * @param {object} user     - Mongoose user document (requires _id and role)
 * @param {object} [req]    - Express request object (for IP/userAgent extraction)
 * @param {object} [extra]  - Optional extra fields { ipAddress, userAgent, category }
 */
async function logAction(action, description, user, req = null, extra = {}) {
  try {
    const ipAddress = extra.ipAddress || getClientIp(req) || null;
    const userAgent =
      extra.userAgent ||
      (req && req.headers && req.headers["user-agent"]) ||
      null;
    const category =
      extra.category || deriveCategoryFromAction(action) || null;

    await Logs.create({
      action,
      description,
      performedBy: user?._id,
      performedByRole: user ? getRoleName(user.role) : "Unknown",
      ipAddress,
      userAgent,
      category,
    });
  } catch (logErr) {
    // Log errors should never crash the parent request
    console.error("Failed to create log:", logErr.message);
  }
}

module.exports = {
  logAction,
  getClientIp,
  deriveCategoryFromAction,
};
