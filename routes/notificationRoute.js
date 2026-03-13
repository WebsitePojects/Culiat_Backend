const express = require("express");
const router = express.Router();
const {
  getRecentNotifications,
  getNotificationCounts,
} = require("../controllers/notificationController");
const { protect, authorize } = require("../middleware/auth");
const ROLES = require("../config/roles");

// All routes require admin authentication
router.use(protect);
router.use(authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin));

// Notification routes
router.get("/recent", getRecentNotifications);
router.get("/counts", getNotificationCounts);

module.exports = router;
