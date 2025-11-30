const express = require("express");
const router = express.Router();
const sectoralController = require("../controllers/sectoralController");
const { protect, isAdmin } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// Admin only routes
router.post("/register", isAdmin, sectoralController.registerToSector);
router.get("/statistics", isAdmin, sectoralController.getSectoralStatistics);
router.get("/:sectorType", isAdmin, sectoralController.getSectorMembers);
router.put("/:id", isAdmin, sectoralController.updateSectoralRegistration);
router.delete("/:id", isAdmin, sectoralController.removeSectoralRegistration);
router.post("/:id/benefit", isAdmin, sectoralController.addBenefit);

// User can view their own sectoral groups
router.get("/user/:userId", sectoralController.getUserSectoralGroups);

module.exports = router;
