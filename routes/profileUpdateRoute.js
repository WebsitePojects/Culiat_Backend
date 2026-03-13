const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary } = require("../config/cloudinary");
const { protect, authorize } = require("../middleware/auth");
const ROLES = require("../config/roles");

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
router.get("/admin/all", protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), getAllProfileUpdates);

// Get single profile update detail
router.get("/admin/:id", protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), getProfileUpdateDetail);

// Approve profile update
router.put("/admin/:id/approve", protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), approveProfileUpdate);

// Reject profile update
router.put("/admin/:id/reject", protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), rejectProfileUpdate);

// Get user's complete profile with history
router.get("/admin/user/:userId", protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), getUserProfileWithHistory);

module.exports = router;
