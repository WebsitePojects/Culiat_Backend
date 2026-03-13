const Committee = require('../models/Committee');
const Announcement = require('../models/Announcement');
const Achievement = require('../models/Achievement');
const Logs = require('../models/Logs');

// @desc    Get all active committees (public)
// @route   GET /api/committees
// @access  Public
const getCommittees = async (req, res) => {
  try {
    const committees = await Committee.find({ isActive: true })
      .populate('chairperson', 'firstName lastName middleName position photo')
      .populate('coChairperson', 'firstName lastName middleName position photo')
      .sort({ displayOrder: 1, name: 1 });
    
    res.status(200).json({
      success: true,
      count: committees.length,
      data: committees,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching committees',
      error: error.message,
    });
  }
};

// @desc    Get committee by slug (public)
// @route   GET /api/committees/:slug
// @access  Public
const getCommitteeBySlug = async (req, res) => {
  try {
    const committee = await Committee.findOne({ slug: req.params.slug, isActive: true })
      .populate('chairperson', 'firstName lastName middleName position committeeRole photo contactNumber email bio')
      .populate('coChairperson', 'firstName lastName middleName position committeeRole photo contactNumber email bio')
      .populate('members', 'firstName lastName middleName position committeeRole photo contactNumber email bio');
    
    if (!committee) {
      return res.status(404).json({
        success: false,
        message: 'Committee not found',
      });
    }

    res.status(200).json({
      success: true,
      data: committee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching committee',
      error: error.message,
    });
  }
};

// @desc    Create a committee
// @route   POST /api/committees
// @access  Private (Admin)
const createCommittee = async (req, res) => {
  try {
    const committee = await Committee.create(req.body);

    // Log the action
    if (req.user) {
        await Logs.create({
          action: 'CREATE',
          module: 'Committee',
          description: `Created committee: ${committee.name}`,
          performedBy: req.user._id,
        });
    }

    res.status(201).json({
      success: true,
      data: committee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating committee',
      error: error.message,
    });
  }
};

// @desc    Update a committee
// @route   PUT /api/committees/:id
// @access  Private (Admin)
const updateCommittee = async (req, res) => {
  try {
    const committee = await Committee.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!committee) {
      return res.status(404).json({
        success: false,
        message: 'Committee not found',
      });
    }

    if (req.user) {
        await Logs.create({
          action: 'UPDATE',
          module: 'Committee',
          description: `Updated committee: ${committee.name}`,
          performedBy: req.user._id,
        });
    }

    res.status(200).json({
      success: true,
      data: committee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating committee',
      error: error.message,
    });
  }
};

// @desc    Delete a committee
// @route   DELETE /api/committees/:id
// @access  Private (Admin)
const deleteCommittee = async (req, res) => {
  try {
    const committee = await Committee.findByIdAndDelete(req.params.id);

    if (!committee) {
      return res.status(404).json({
        success: false,
        message: 'Committee not found',
      });
    }

    if (req.user) {
        await Logs.create({
          action: 'DELETE',
          module: 'Committee',
          description: `Deleted committee: ${committee.name}`,
          performedBy: req.user._id,
        });
    }

    res.status(200).json({
      success: true,
      message: 'Committee deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting committee',
      error: error.message,
    });
  }
};

// @desc    Get accomplishments for a committee (from linked announcements and achievements)
// @route   GET /api/committees/:id/accomplishments
// @access  Public
const getCommitteeAccomplishments = async (req, res) => {
  try {
    const committee = await Committee.findById(req.params.id);
    if (!committee) {
      return res.status(404).json({
        success: false,
        message: 'Committee not found',
      });
    }

    // Get announcements linked to this committee
    const announcements = await Announcement.find({
      committeeRef: req.params.id,
      status: 'published',
      isPublished: true,
    })
      .select('title content images image category eventDate createdAt slug youtubeVideoUrl youtubeVideoId')
      .sort({ createdAt: -1 });

    // Get achievements linked to this committee
    const achievements = await Achievement.find({
      committeeRef: req.params.id,
    })
      .select('title description images image category date createdAt hashtags')
      .sort({ date: -1, createdAt: -1 });

    const normalizedAnnouncements = announcements.map((item) => ({
      ...item.toObject(),
      accomplishmentType: 'announcement',
      contentType: 'announcement',
      detailPath: `/announcements/${item.slug || item._id}`,
      publishedAt: item.eventDate || item.createdAt,
    }));

    const normalizedAchievements = achievements.map((item) => ({
      ...item.toObject(),
      accomplishmentType: 'achievement',
      contentType: 'achievement',
      content: item.description || '',
      eventDate: item.date || item.createdAt,
      detailPath: `/achievements/${item._id}`,
      publishedAt: item.date || item.createdAt,
    }));

    const accomplishments = [...normalizedAnnouncements, ...normalizedAchievements].sort(
      (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
    );

    res.status(200).json({
      success: true,
      count: accomplishments.length,
      data: accomplishments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching committee accomplishments',
      error: error.message,
    });
  }
};

module.exports = {
  getCommittees,
  getCommitteeBySlug,
  createCommittee,
  updateCommittee,
  deleteCommittee,
  getCommitteeAccomplishments,
};
