const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { protect, isAdmin } = require("../middleware/auth");

const {
  getMyProfile,
  submitProfileUpdate,
  getMyUpdateHistory,
  cancelProfileUpdate,
  getAllProfileUpdates,
  getProfileUpdateDetail,
  approveProfileUpdate,
  rejectProfileUpdate,
  getUserProfileWithHistory,
} = require("../controllers/profileUpdateController");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/profile-updates/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `profile-update-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, and PDF files are allowed."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Local isSuperAdmin middleware
const isSuperAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 74932 || req.user.roleCode === 74932)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: "SuperAdmin access required",
  });
};

// Middleware to check if user is admin or superadmin
const isAdminOrSuperAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 74932 || req.user.role === 74933 || 
      req.user.roleCode === 74932 || req.user.roleCode === 74933)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: "Admin access required",
  });
};

// ============================================
// RESIDENT ROUTES
// ============================================

// Get current user's complete profile
router.get("/my-profile", protect, getMyProfile);

// Submit profile update request
router.post(
  "/submit",
  protect,
  upload.fields([
    { name: "birthCertificate", maxCount: 1 },
    { name: "birthCertificateDocument", maxCount: 1 },
    { name: "validIDDocument", maxCount: 1 },
    { name: "supportingDocument", maxCount: 3 },
    { name: "proofDocument", maxCount: 1 },
    { name: "proofDocuments", maxCount: 3 }, // Multiple proof documents
  ]),
  submitProfileUpdate
);

// Get user's profile update history
router.get("/my-updates", protect, getMyUpdateHistory);

// Cancel pending profile update (supports both PUT and DELETE)
router.put("/cancel/:id", protect, cancelProfileUpdate);
router.delete("/cancel/:id", protect, cancelProfileUpdate);

// ============================================
// ADMIN ROUTES
// ============================================

// Get all profile update requests
router.get("/admin/all", protect, isAdminOrSuperAdmin, getAllProfileUpdates);

// Get single profile update detail
router.get("/admin/:id", protect, isAdminOrSuperAdmin, getProfileUpdateDetail);

// Approve profile update
router.put("/admin/:id/approve", protect, isAdminOrSuperAdmin, approveProfileUpdate);

// Reject profile update
router.put("/admin/:id/reject", protect, isAdminOrSuperAdmin, rejectProfileUpdate);

// Get user's complete profile with history
router.get("/admin/user/:userId", protect, isAdminOrSuperAdmin, getUserProfileWithHistory);

module.exports = router;
