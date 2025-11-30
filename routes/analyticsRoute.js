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
} = require("../controllers/analyticsController");
const { protect, authorize } = require("../middleware/auth");

// All routes require admin authentication
router.use(protect);
router.use(authorize(74932, 74933)); // SuperAdmin and Admin only

// Analytics routes
router.get("/overview", getOverviewStats);
router.get("/document-types", getDocumentTypeDistribution);
router.get("/status-breakdown", getStatusBreakdown);
router.get("/monthly-trends", getMonthlyTrends);
router.get("/peak-hours", getPeakHours);
router.get("/popular-services", getPopularServices);
router.get("/summary", getSummary);

module.exports = router;
