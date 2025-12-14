const Achievement = require('../models/Achievement');
const fs = require('fs');
const path = require('path');
const { deleteFromCloudinary, getPublicIdFromUrl } = require('../config/cloudinary');

// Check if using Cloudinary
const isCloudinaryEnabled = () => {
  return process.env.CLOUDINARY_CLOUD_NAME && 
         process.env.CLOUDINARY_API_KEY && 
         process.env.CLOUDINARY_API_SECRET;
};

// Helper to get image URL/path from uploaded file
const getImageFromFile = (file) => {
  if (!file) return null;
  // Cloudinary returns the URL in file.path
  // Local storage returns just the filename
  return file.path || file.filename;
};

// Helper to delete old image
const deleteOldImage = async (imageUrl) => {
  if (!imageUrl || imageUrl === 'no-photo.jpg') return;
  
  if (isCloudinaryEnabled() && imageUrl.includes('cloudinary')) {
    // Delete from Cloudinary
    const publicId = getPublicIdFromUrl(imageUrl);
    if (publicId) {
      await deleteFromCloudinary(publicId);
    }
  } else {
    // Delete from local storage
    const imagePath = path.join(__dirname, '../uploads/achievements', imageUrl);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }
};

// @desc    Get all achievements
// @route   GET /api/achievements
// @access  Public
exports.getAchievements = async (req, res) => {
  try {
    const achievements = await Achievement.find().sort({ date: -1 });
    res.status(200).json({
      success: true,
      count: achievements.length,
      data: achievements
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching achievements',
      error: error.message
    });
  }
};

// @desc    Get single achievement
// @route   GET /api/achievements/:id
// @access  Public
exports.getAchievement = async (req, res) => {
  try {
    const achievement = await Achievement.findById(req.params.id);

    if (!achievement) {
      return res.status(404).json({
        success: false,
        message: 'Achievement not found'
      });
    }

    res.status(200).json({
      success: true,
      data: achievement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching achievement',
      error: error.message
    });
  }
};

// @desc    Create new achievement
// @route   POST /api/achievements
// @access  Private (Admin)
exports.createAchievement = async (req, res) => {
  try {
    const { title, category, description, date } = req.body;
    
    let image = 'no-photo.jpg';
    if (req.file) {
      // Use Cloudinary URL (file.path) or local filename
      image = getImageFromFile(req.file);
    }

    const achievement = await Achievement.create({
      title,
      category,
      description,
      date,
      image
    });

    res.status(201).json({
      success: true,
      data: achievement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating achievement',
      error: error.message
    });
  }
};

// @desc    Update achievement
// @route   PUT /api/achievements/:id
// @access  Private (Admin)
exports.updateAchievement = async (req, res) => {
  try {
    let achievement = await Achievement.findById(req.params.id);

    if (!achievement) {
      return res.status(404).json({
        success: false,
        message: 'Achievement not found'
      });
    }

    const fieldsToUpdate = {
      title: req.body.title,
      category: req.body.category,
      description: req.body.description,
      date: req.body.date
    };

    if (req.file) {
      // Delete old image if it's not the default one
      await deleteOldImage(achievement.image);
      // Use Cloudinary URL (file.path) or local filename
      fieldsToUpdate.image = getImageFromFile(req.file);
    }

    achievement = await Achievement.findByIdAndUpdate(req.params.id, fieldsToUpdate, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: achievement
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating achievement',
      error: error.message
    });
  }
};

// @desc    Delete achievement
// @route   DELETE /api/achievements/:id
// @access  Private (Admin)
exports.deleteAchievement = async (req, res) => {
  try {
    const achievement = await Achievement.findById(req.params.id);

    if (!achievement) {
      return res.status(404).json({
        success: false,
        message: 'Achievement not found'
      });
    }

    // Delete image if it's not the default one
    await deleteOldImage(achievement.image);

    await achievement.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting achievement',
      error: error.message
    });
  }
};
