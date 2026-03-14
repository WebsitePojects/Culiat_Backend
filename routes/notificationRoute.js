const express = require("express");
const router = express.Router();
const {
  getRecentNotifications,
  getNotificationCounts,
  getUserNotifications,
  getUserNotificationCounts,
  markUserNotificationRead,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
} = require("../controllers/notificationController");
const { protect, authorize } = require("../middleware/auth");
const ROLES = require("../config/roles");

// All notification routes require authentication
router.use(protect);

// User-facing notification routes
router.get("/user/recent", getUserNotifications);
router.get("/user/counts", getUserNotificationCounts);
router.patch("/user/read", markUserNotificationRead);

// Admin notification routes
router.use(authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin));

// Notification routes
router.get("/recent", getRecentNotifications);
router.get("/counts", getNotificationCounts);
router.patch("/read", markAdminNotificationRead);
router.patch("/read-all", markAllAdminNotificationsRead);

module.exports = router;
