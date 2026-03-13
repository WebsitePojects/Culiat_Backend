const express = require("express");
const router = express.Router();
const multer = require("multer");
const { storages } = require("../config/cloudinary");
const {
  getBanners,
  getAdminBanners,
  getBanner,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
  reorderBanners,
  uploadBannerFile,
  deleteTempUpload,
} = require("../controllers/bannerController");
const { protect, authorize } = require("../middleware/auth");

// Configure multer for banner uploads (images and videos)
const upload = multer({ storage: storages.barangay });

// Admin routes (protected) - MUST come before /:id routes
router.get("/admin/all", protect, authorize("SystemAdmin", "SuperAdmin"), getAdminBanners);
router.put("/reorder", protect, authorize("SystemAdmin", "SuperAdmin"), reorderBanners);
router.post("/upload", protect, authorize("SystemAdmin", "SuperAdmin"), upload.single("file"), uploadBannerFile);
router.delete("/upload/temp", protect, authorize("SystemAdmin", "SuperAdmin"), deleteTempUpload);

// Public routes
router.get("/", getBanners);
router.get("/:id", getBanner);

// Protected routes with :id parameter
router.post("/", protect, authorize("SystemAdmin", "SuperAdmin"), createBanner);
router.put("/:id", protect, authorize("SystemAdmin", "SuperAdmin"), updateBanner);
router.patch("/:id/toggle", protect, authorize("SystemAdmin", "SuperAdmin"), toggleBannerStatus);
router.delete("/:id", protect, authorize("SystemAdmin", "SuperAdmin"), deleteBanner);

module.exports = router;
