const express = require("express");
const router = express.Router();
const termsController = require("../controllers/termsController");
const { protect, authorize } = require("../middleware/auth");
const ROLES = require("../config/roles");

// All routes require authentication
router.use(protect);

// User routes
router.post("/accept", termsController.acceptTerms);
router.get("/status", termsController.getAcceptanceStatus);
router.get("/history", termsController.getAcceptanceHistory);

// Admin routes
router.get(
	"/all-acceptances",
	authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
	termsController.getAllAcceptances
);
router.get(
	"/approved-residents",
	authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
	termsController.getApprovedResidents
);
router.get(
	"/signature/:acceptanceId",
	authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
	termsController.getSignature
);

module.exports = router;
