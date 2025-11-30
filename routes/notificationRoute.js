const express = require("express");
const router = express.Router();
const {
  getRecentNotifications,
  getNotificationCounts,
} = require("../controllers/notificationController");
const { protect, authorize } = require("../middleware/auth");

// All routes require admin authentication
router.use(protect);
router.use(authorize(74932, 74933)); // SuperAdmin and Admin only

// Notification routes
router.get("/recent", getRecentNotifications);
router.get("/counts", getNotificationCounts);

module.exports = router;
