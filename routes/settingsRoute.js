const express = require("express");
const router = express.Router();
const {
  getSettings,
  updateSettings,
  updateSiteInfo,
  updateContactInfo,
  updateSocialMedia,
  updateFooter,
  updateTheme,
  resetSettings,
  getMaintenanceStatus,
} = require("../controllers/settingsController");
const { protect, authorize } = require("../middleware/auth");

// Protected route - get full settings for authenticated users
router.get("/", protect, getSettings);

// Public route - get maintenance status
router.get("/maintenance-status", getMaintenanceStatus);

// Protected routes - Admin only
router.put("/", protect, authorize("SystemAdmin", "SuperAdmin"), updateSettings);
router.put(
  "/site-info",
  protect,
  authorize("SystemAdmin", "SuperAdmin"),
  updateSiteInfo
);
router.put(
  "/contact-info",
  protect,
  authorize("SystemAdmin", "SuperAdmin"),
  updateContactInfo
);
router.put(
  "/social-media",
  protect,
  authorize("SystemAdmin", "SuperAdmin"),
  updateSocialMedia
);
router.put("/footer", protect, authorize("SystemAdmin", "SuperAdmin"), updateFooter);
router.put("/theme", protect, authorize("SystemAdmin", "SuperAdmin"), updateTheme);
router.put("/system", protect, authorize("SystemAdmin", "SuperAdmin"), updateSettings);

// SystemAdmin only
router.post("/reset", protect, authorize("SystemAdmin"), resetSettings);

module.exports = router;
