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
router.get("/admin/all", protect, authorize("Admin", "SuperAdmin"), getAdminBanners);
router.put("/reorder", protect, authorize("Admin", "SuperAdmin"), reorderBanners);
router.post("/upload", protect, authorize("Admin", "SuperAdmin"), upload.single("file"), uploadBannerFile);
router.delete("/upload/temp", protect, authorize("Admin", "SuperAdmin"), deleteTempUpload);

// Public routes
router.get("/", getBanners);
router.get("/:id", getBanner);

// Protected routes with :id parameter
router.post("/", protect, authorize("Admin", "SuperAdmin"), createBanner);
router.put("/:id", protect, authorize("Admin", "SuperAdmin"), updateBanner);
router.patch("/:id/toggle", protect, authorize("Admin", "SuperAdmin"), toggleBannerStatus);
router.delete("/:id", protect, authorize("Admin", "SuperAdmin"), deleteBanner);

module.exports = router;
