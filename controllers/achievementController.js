const Achievement = require('../models/Achievement');
const fs = require('fs');
const path = require('path');
const { deleteFromCloudinary, getPublicIdFromUrl } = require('../config/cloudinary');
const { sanitizeRichText } = require('../utils/richTextSanitizer');

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
    const achievements = await Achievement.find()
      .populate('committeeRef', 'name slug')
      .sort({ date: -1 });
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
    const achievement = await Achievement.findById(req.params.id)
      .populate('committeeRef', 'name slug');

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
    const { title, category, description, date, hashtags, committeeRef } = req.body;
    
    let image = 'no-photo.jpg';
    let images = [];
    
    // Handle single image upload (legacy support)
    if (req.file) {
      image = getImageFromFile(req.file);
    }
    
    // Handle multiple images upload
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => getImageFromFile(file));
      // Set first image as the main image if not already set
      if (image === 'no-photo.jpg' && images.length > 0) {
        image = images[0];
      }
    }

    // Parse hashtags if it's a JSON string
    let parsedHashtags = [];
    if (hashtags) {
      try {
        parsedHashtags = typeof hashtags === 'string' ? JSON.parse(hashtags) : hashtags;
      } catch (e) {
        parsedHashtags = typeof hashtags === 'string' ? hashtags.split(',').map(h => h.trim()).filter(Boolean) : [];
      }
    }

    const achievement = await Achievement.create({
      title,
      category,
      description: sanitizeRichText(description),
      date,
      image,
      images,
      committeeRef: committeeRef || null,
      hashtags: parsedHashtags
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
      description: req.body.description !== undefined ? sanitizeRichText(req.body.description) : achievement.description,
      date: req.body.date,
      committeeRef: req.body.committeeRef || null,
    };

    // Handle hashtags
    if (req.body.hashtags !== undefined) {
      let parsedHashtags = [];
      if (req.body.hashtags) {
        try {
          parsedHashtags = typeof req.body.hashtags === 'string' ? JSON.parse(req.body.hashtags) : req.body.hashtags;
        } catch (e) {
          parsedHashtags = typeof req.body.hashtags === 'string' ? req.body.hashtags.split(',').map(h => h.trim()).filter(Boolean) : [];
        }
      }
      fieldsToUpdate.hashtags = parsedHashtags;
    }

    // Handle single image upload (legacy support)
    if (req.file) {
      // Delete old main image if it's not the default one
      await deleteOldImage(achievement.image);
      fieldsToUpdate.image = getImageFromFile(req.file);
    }
    
    // Handle multiple images upload
    if (req.files && req.files.length > 0) {
      // Delete old images
      if (achievement.images && achievement.images.length > 0) {
        for (const img of achievement.images) {
          await deleteOldImage(img);
        }
      }
      
      fieldsToUpdate.images = req.files.map(file => getImageFromFile(file));
      
      // Set first image as main image if not already set
      if (!fieldsToUpdate.image && fieldsToUpdate.images.length > 0) {
        fieldsToUpdate.image = fieldsToUpdate.images[0];
      }
    }
    
    // Handle existing images passed from frontend (JSON string)
    if (req.body.existingImages) {
      try {
        const existingImages = JSON.parse(req.body.existingImages);
        
        // Delete removed images
        if (achievement.images && achievement.images.length > 0) {
          for (const img of achievement.images) {
            if (!existingImages.includes(img)) {
              await deleteOldImage(img);
            }
          }
        }
        
        // If new files uploaded, combine with existing
        if (fieldsToUpdate.images) {
          fieldsToUpdate.images = [...existingImages, ...fieldsToUpdate.images];
        } else {
          fieldsToUpdate.images = existingImages;
        }
      } catch (e) {
        console.error('Error parsing existingImages:', e);
      }
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

    // Delete main image if it's not the default one
    await deleteOldImage(achievement.image);
    
    // Delete all additional images
    if (achievement.images && achievement.images.length > 0) {
      for (const img of achievement.images) {
        await deleteOldImage(img);
      }
    }

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
