const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary } = require("../config/cloudinary");
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

// Check if Cloudinary is configured
const isCloudinaryConfigured = () => {
  return cloudinary && 
         process.env.CLOUDINARY_CLOUD_NAME && 
         process.env.CLOUDINARY_API_KEY && 
         process.env.CLOUDINARY_API_SECRET;
};

// Ensure local upload directory exists (for fallback)
const localUploadDir = "uploads/profile-updates/";
if (!fs.existsSync(localUploadDir)) {
  fs.mkdirSync(localUploadDir, { recursive: true });
}

// Cloudinary storage configuration for profile updates
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const isPDF = file.mimetype === "application/pdf" || path.extname(file.originalname).toLowerCase() === ".pdf";
    
    return {
      folder: "culiat-barangay/profile-updates",
      ...(isPDF 
        ? { resource_type: "raw" } 
        : { format: "jpg", transformation: [{ quality: "auto" }] }
      ),
      public_id: `profile-update-${uniqueSuffix}`,
    };
  },
});

// Local disk storage (fallback when Cloudinary is not configured)
const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, localUploadDir);
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

// Choose storage based on environment configuration
let storage;
try {
  storage = isCloudinaryConfigured() ? cloudinaryStorage : diskStorage;
  if (isCloudinaryConfigured()) {
    console.log("📁 Profile Update: Using Cloudinary for file storage");
  } else {
    console.log("📁 Profile Update: Using local disk storage");
  }
} catch (error) {
  console.log("📁 Profile Update: Cloudinary init failed, using local disk storage");
  storage = diskStorage;
}

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
