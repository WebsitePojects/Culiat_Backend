const express = require("express");
const router = express.Router();
const {
  getPsaCompletionStatus,
  submitPsaVerification,
  dismissWarning,
  getPendingVerifications,
  getVerificationById,
  approveVerification,
  rejectVerification,
  getVerificationHistory,
  getPendingCount,
  sendDeadlineReminders,
} = require("../controllers/profileVerificationController");
const { protect, isAdmin } = require("../middleware/auth");
const ROLES = require("../config/roles");

// Middleware to check if user is SuperAdmin
const isSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== ROLES.SuperAdmin) {
    return res.status(403).json({
      success: false,
      message: "Access denied. SuperAdmin privileges required.",
    });
  }
  next();
};

// Configure multer for birth certificate uploads
const multer = require("multer");
const path = require("path");

// Check if Cloudinary is configured
const isCloudinaryEnabled = () => {
  return (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

let upload;

if (isCloudinaryEnabled()) {
  // Use Cloudinary storage
  const cloudinary = require("cloudinary").v2;
  const { CloudinaryStorage } = require("multer-storage-cloudinary");

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: "birth-certificates",
      allowed_formats: ["jpg", "jpeg", "png", "pdf"],
      transformation: [{ quality: "auto:good" }],
    },
  });

  upload = multer({ storage: storage });
} else {
  // Use local storage
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.join(__dirname, "../uploads/documents"));
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, "bc-" + uniqueSuffix + path.extname(file.originalname));
    },
  });

  upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
      const allowedTypes = /jpeg|jpg|png|pdf/;
      const extname = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
      );
      const mimetype = allowedTypes.test(file.mimetype);

      if (extname && mimetype) {
        return cb(null, true);
      }
      cb(new Error("Only image files (jpg, jpeg, png) and PDF are allowed"));
    },
  });
}

// ==================== RESIDENT ROUTES ====================

// All routes require authentication
router.use(protect);

// Get PSA completion status
router.get("/status", getPsaCompletionStatus);

// Submit PSA verification
router.post("/submit", upload.single("birthCertificate"), submitPsaVerification);

// Dismiss warning modal
router.post("/dismiss-warning", dismissWarning);

// ==================== ADMIN ROUTES ====================

// Get pending verification count (for sidebar badge)
router.get("/admin/count", isAdmin, getPendingCount);

// Get all pending verifications
router.get("/admin/pending", isAdmin, getPendingVerifications);

// Get verification history
router.get("/admin/history", isAdmin, getVerificationHistory);

// Get verification by ID
router.get("/admin/:id", isAdmin, getVerificationById);

// Approve verification
router.put("/admin/:id/approve", isAdmin, approveVerification);

// Reject verification
router.put("/admin/:id/reject", isAdmin, rejectVerification);

// Send deadline reminders (for cron job or manual trigger)
router.post("/admin/send-reminders", isSuperAdmin, sendDeadlineReminders);

module.exports = router;
