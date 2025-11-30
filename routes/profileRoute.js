const express = require("express");
const router = express.Router();
const {
  getAdminProfile,
  requestVerificationCode,
  verifyAndUpdateProfile,
  updateBasicProfile,
} = require("../controllers/profileController");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

router.get("/admin", getAdminProfile);
router.post("/request-verification", requestVerificationCode);
router.post("/verify-and-update", verifyAndUpdateProfile);
router.put("/basic", updateBasicProfile);

module.exports = router;
