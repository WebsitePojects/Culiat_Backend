const Announcement = require('../models/Announcement');
const { LOGCONSTANTS } = require('../config/logConstants');
const { getRoleName } = require('../utils/roleHelpers');
const { logAction } = require('../utils/logHelper');

// @desc    Create new announcement
// @route   POST /api/announcements
// @access  Private (Admin)
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, category, priority, publishDate, expiryDate, location, eventDate, status } = req.body;
    
    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = req.file.path || req.file.location || `/uploads/announcements/${req.file.filename}`;
    }

    const announcement = await Announcement.create({
      title,
      content,
      category: category || 'General',
      priority,
      publishDate,
      expiryDate,
      location: location || 'Barangay Culiat',
      eventDate,
      status: status || 'draft',
      isPublished: status === 'published',
      image: imageUrl,
      publishedBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement,
    });

    await logAction(
      LOGCONSTANTS.actions.announcements.CREATE_ANNOUNCEMENT,
      `Announcement created: ${announcement._id}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating announcement',
      error: error.message,
    });
  }
};

// @desc    Get all announcements (for admin)
// @route   GET /api/announcements/all
// @access  Private (Admin)
exports.getAllAnnouncements = async (req, res) => {
  try {
    const { status, archived } = req.query;
    
    let query = {};
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Filter archived announcements (older than 1 year)
    if (archived === 'true') {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      query.createdAt = { $lt: oneYearAgo };
    }

    const announcements = await Announcement.find(query)
      .populate('publishedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: announcements.length,
      data: announcements,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: error.message,
    });
  }
};

// @desc    Get published announcements (for residents) - only within last year
// @route   GET /api/announcements
// @access  Public/Private
exports.getPublishedAnnouncements = async (req, res) => {
  try {
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const announcements = await Announcement.find({
      isPublished: true,
      status: 'published',
      createdAt: { $gte: oneYearAgo }, // Only announcements within the last year
      $or: [
        { expiryDate: null },
        { expiryDate: { $gte: now } }
      ]
    })
      .populate('publishedBy', 'firstName lastName')
      .sort({ priority: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: announcements.length,
      data: announcements,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching announcements',
      error: error.message,
    });
  }
};

// @desc    Get single announcement
// @route   GET /api/announcements/:id
// @access  Private
exports.getAnnouncement = async (req, res) => {
  try {
    // Check if param is slug or id
    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    
    let announcement;
    if (isObjectId) {
      announcement = await Announcement.findById(req.params.id)
        .populate('publishedBy', 'firstName lastName email');
    } else {
      // Find by slug
      announcement = await Announcement.findOne({ slug: req.params.id })
        .populate('publishedBy', 'firstName lastName email');
    }

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    // Increment views
    announcement.views = (announcement.views || 0) + 1;
    await announcement.save();

    res.status(200).json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching announcement',
      error: error.message,
    });
  }
};

// @desc    Update announcement
// @route   PUT /api/announcements/:id
// @access  Private (Admin)
exports.updateAnnouncement = async (req, res) => {
  try {
    const { title, content, category, priority, isPublished, publishDate, expiryDate, location, eventDate, status } = req.body;

    let announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    // Handle image upload
    let imageUrl = announcement.image;
    if (req.file) {
      imageUrl = req.file.path || req.file.location || `/uploads/announcements/${req.file.filename}`;
    }

    // Build update object
    const updateData = {
      title: title || announcement.title,
      content: content || announcement.content,
      category: category || announcement.category,
      priority: priority || announcement.priority,
      location: location || announcement.location,
      eventDate: eventDate || announcement.eventDate,
      publishDate,
      expiryDate,
      image: imageUrl,
    };

    // Handle status updates
    if (status) {
      updateData.status = status;
      updateData.isPublished = status === 'published';
      if (status === 'published' && !announcement.publishDate) {
        updateData.publishDate = new Date();
      }
    } else if (isPublished !== undefined) {
      updateData.isPublished = isPublished;
      updateData.status = isPublished ? 'published' : 'draft';
    }

    announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement,
    });
    
    await logAction(
      LOGCONSTANTS.actions.announcements.UPDATE_ANNOUNCEMENT,
      `Announcement updated: ${announcement._id}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating announcement',
      error: error.message,
    });
  }
};

// @desc    Publish/Unpublish announcement
// @route   PUT /api/announcements/:id/publish
// @access  Private (Admin)
exports.togglePublish = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    announcement.isPublished = !announcement.isPublished;
    announcement.status = announcement.isPublished ? 'published' : 'draft';
    if (announcement.isPublished && !announcement.publishDate) {
      announcement.publishDate = new Date();
    }

    await announcement.save();

    res.status(200).json({
      success: true,
      message: `Announcement ${announcement.isPublished ? 'published' : 'unpublished'} successfully`,
      data: announcement,
    });
    
    await logAction(
      LOGCONSTANTS.actions.announcements.TOGGLE_PUBLISH_ANNOUNCEMENT,
      `Announcement ${announcement.isPublished ? 'published' : 'unpublished'}: ${announcement._id}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error toggling announcement publish status',
      error: error.message,
    });
  }
};

// @desc    Archive/Unarchive announcement
// @route   PUT /api/announcements/:id/archive
// @access  Private (Admin)
exports.toggleArchive = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    const isCurrentlyArchived = announcement.status === 'archived';
    announcement.status = isCurrentlyArchived ? 'draft' : 'archived';
    announcement.isPublished = false;

    await announcement.save();

    res.status(200).json({
      success: true,
      message: `Announcement ${isCurrentlyArchived ? 'unarchived' : 'archived'} successfully`,
      data: announcement,
    });
    
    await logAction(
      LOGCONSTANTS.actions.announcements.ARCHIVE_ANNOUNCEMENT,
      `Announcement ${isCurrentlyArchived ? 'unarchived' : 'archived'}: ${announcement._id}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error archiving announcement',
      error: error.message,
    });
  }
};

// @desc    Delete announcement
// @route   DELETE /api/announcements/:id
// @access  Private (Admin)
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    await announcement.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully',
    });
    // create delete log
    await logAction(
      LOGCONSTANTS.actions.announcements.DELETE_ANNOUNCEMENT,
      `Announcement deleted: ${announcement._id}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting announcement',
      error: error.message,
    });
  }
};
