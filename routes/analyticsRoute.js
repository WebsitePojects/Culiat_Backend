const express = require("express");
const router = express.Router();
const {
  getOverviewStats,
  getDocumentTypeDistribution,
  getStatusBreakdown,
  getMonthlyTrends,
  getPeakHours,
  getPopularServices,
  getSummary,
  getDashboardStats,
  getUserDemographics,
  getSectoralGroupsStats,
} = require("../controllers/analyticsController");
const { protect, authorize } = require("../middleware/auth");
const ROLES = require("../config/roles");

// All routes require admin authentication
router.use(protect);
router.use(authorize(ROLES.SystemAdmin, ROLES.SuperAdmin));

// Analytics routes
router.get("/overview", getOverviewStats);
router.get("/document-types", getDocumentTypeDistribution);
router.get("/status-breakdown", getStatusBreakdown);
router.get("/monthly-trends", getMonthlyTrends);
router.get("/peak-hours", getPeakHours);
router.get("/popular-services", getPopularServices);
router.get("/summary", getSummary);

// Dashboard comprehensive stats
router.get("/dashboard", getDashboardStats);
router.get("/demographics", getUserDemographics);
router.get("/sectoral-groups", getSectoralGroupsStats);

module.exports = router;
