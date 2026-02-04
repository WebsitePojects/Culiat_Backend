const Banner = require("../models/Banner");

// @desc    Get all banners (public - for carousel)
// @route   GET /api/banners
// @access  Public
const getBanners = async (req, res) => {
  try {
    const { active } = req.query;

    let query = {};
    
    // For public access, only show active banners
    if (active === "true" || !req.user) {
      query.isActive = true;
    }

    const banners = await Banner.find(query)
      .sort({ displayOrder: 1, createdAt: -1 })
      .populate("createdBy", "firstName lastName")
      .populate("lastUpdatedBy", "firstName lastName");

    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners,
    });
  } catch (error) {
    console.error("Error fetching banners:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching banners",
      error: error.message,
    });
  }
};

// @desc    Get all banners for admin
// @route   GET /api/banners/admin
// @access  Private (Admin)
const getAdminBanners = async (req, res) => {
  try {
    const banners = await Banner.find()
      .sort({ displayOrder: 1, createdAt: -1 })
      .populate("createdBy", "firstName lastName")
      .populate("lastUpdatedBy", "firstName lastName");

    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners,
    });
  } catch (error) {
    console.error("Error fetching banners:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching banners",
      error: error.message,
    });
  }
};

// @desc    Get single banner
// @route   GET /api/banners/:id
// @access  Public
const getBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id)
      .populate("createdBy", "firstName lastName")
      .populate("lastUpdatedBy", "firstName lastName");

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    res.status(200).json({
      success: true,
      data: banner,
    });
  } catch (error) {
    console.error("Error fetching banner:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching banner",
      error: error.message,
    });
  }
};

// @desc    Create new banner
// @route   POST /api/banners
// @access  Private (Admin)
const createBanner = async (req, res) => {
  try {
    const {
      title,
      description,
      mediaType,
      mediaUrl,
      thumbnailUrl,
      ctaButton,
      displayOrder,
      isActive,
      textPosition,
    } = req.body;

    // Validate required fields
    if (!mediaType || !mediaUrl) {
      return res.status(400).json({
        success: false,
        message: "Please provide mediaType and mediaUrl",
      });
    }

    // Get the highest display order if not provided
    let order = displayOrder;
    if (order === undefined || order === null) {
      const lastBanner = await Banner.findOne().sort({ displayOrder: -1 });
      order = lastBanner ? lastBanner.displayOrder + 1 : 0;
    }

    const banner = await Banner.create({
      title: title || "",
      description: description || "",
      mediaType,
      mediaUrl,
      thumbnailUrl,
      ctaButton,
      displayOrder: order,
      isActive: isActive !== undefined ? isActive : true,
      textPosition: textPosition || "center",
      createdBy: req.user._id,
    });

    const populatedBanner = await Banner.findById(banner._id)
      .populate("createdBy", "firstName lastName");

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: populatedBanner,
    });
  } catch (error) {
    console.error("Error creating banner:", error);
    res.status(500).json({
      success: false,
      message: "Error creating banner",
      error: error.message,
    });
  }
};

// @desc    Update banner
// @route   PUT /api/banners/:id
// @access  Private (Admin)
const updateBanner = async (req, res) => {
  try {
    const {
      title,
      description,
      mediaType,
      mediaUrl,
      thumbnailUrl,
      ctaButton,
      displayOrder,
      isActive,
      textPosition,
    } = req.body;

    let banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    // Update fields
    banner.title = title || banner.title;
    banner.description = description !== undefined ? description : banner.description;
    banner.mediaType = mediaType || banner.mediaType;
    banner.mediaUrl = mediaUrl || banner.mediaUrl;
    banner.thumbnailUrl = thumbnailUrl !== undefined ? thumbnailUrl : banner.thumbnailUrl;
    banner.ctaButton = ctaButton || banner.ctaButton;
    banner.displayOrder = displayOrder !== undefined ? displayOrder : banner.displayOrder;
    banner.isActive = isActive !== undefined ? isActive : banner.isActive;
    banner.textPosition = textPosition || banner.textPosition;
    banner.lastUpdatedBy = req.user._id;

    await banner.save();

    const populatedBanner = await Banner.findById(banner._id)
      .populate("createdBy", "firstName lastName")
      .populate("lastUpdatedBy", "firstName lastName");

    res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      data: populatedBanner,
    });
  } catch (error) {
    console.error("Error updating banner:", error);
    res.status(500).json({
      success: false,
      message: "Error updating banner",
      error: error.message,
    });
  }
};

// @desc    Delete banner
// @route   DELETE /api/banners/:id
// @access  Private (Admin)
const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    await Banner.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting banner:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting banner",
      error: error.message,
    });
  }
};

// @desc    Toggle banner active status
// @route   PATCH /api/banners/:id/toggle
// @access  Private (Admin)
const toggleBannerStatus = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    banner.isActive = !banner.isActive;
    banner.lastUpdatedBy = req.user._id;
    await banner.save();

    res.status(200).json({
      success: true,
      message: `Banner ${banner.isActive ? "activated" : "deactivated"} successfully`,
      data: banner,
    });
  } catch (error) {
    console.error("Error toggling banner status:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling banner status",
      error: error.message,
    });
  }
};

// @desc    Reorder banners
// @route   PUT /api/banners/reorder
// @access  Private (Admin)
const reorderBanners = async (req, res) => {
  try {
    const { bannerIds } = req.body;

    if (!bannerIds || !Array.isArray(bannerIds)) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of banner IDs",
      });
    }

    // Update display order for each banner
    const updatePromises = bannerIds.map((id, index) =>
      Banner.findByIdAndUpdate(
        id,
        { displayOrder: index, lastUpdatedBy: req.user._id },
        { new: true }
      )
    );

    await Promise.all(updatePromises);

    const banners = await Banner.find()
      .sort({ displayOrder: 1 })
      .populate("createdBy", "firstName lastName")
      .populate("lastUpdatedBy", "firstName lastName");

    res.status(200).json({
      success: true,
      message: "Banners reordered successfully",
      data: banners,
    });
  } catch (error) {
    console.error("Error reordering banners:", error);
    res.status(500).json({
      success: false,
      message: "Error reordering banners",
      error: error.message,
    });
  }
};

// @desc    Upload banner media file
// @route   POST /api/banners/upload
// @access  Private (Admin)
const uploadBannerFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file provided",
      });
    }

    // Return the Cloudinary URL
    const url = req.file.path; // Cloudinary URL from multer-storage-cloudinary

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      url: url,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading file",
      error: error.message,
    });
  }
};

// @desc    Delete temporary uploaded file (for abandoned uploads)
// @route   DELETE /api/banners/upload/temp
// @access  Private (Admin)
const deleteTempUpload = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: "No URL provided",
      });
    }

    // Extract public_id from Cloudinary URL
    const { getPublicIdFromUrl, deleteFromCloudinary } = require('../config/cloudinary');
    const publicId = getPublicIdFromUrl(url);
    
    if (publicId) {
      await deleteFromCloudinary(publicId);
    }

    res.status(200).json({
      success: true,
      message: "Temporary file deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting temporary upload:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting temporary file",
      error: error.message,
    });
  }
};

module.exports = {
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
};
