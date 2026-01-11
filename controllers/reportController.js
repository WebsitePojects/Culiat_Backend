const Report = require("../models/Report");
const { LOGCONSTANTS } = require("../config/logConstants");
const { getRoleName } = require('../utils/roleHelpers');
const { logAction } = require('../utils/logHelper');
const ROLES = require('../config/roles');
const { deleteFromCloudinary, getPublicIdFromUrl } = require('../config/cloudinary');

// Check if using Cloudinary
const isCloudinaryEnabled = () => {
  return process.env.CLOUDINARY_CLOUD_NAME && 
         process.env.CLOUDINARY_API_KEY && 
         process.env.CLOUDINARY_API_SECRET;
};

// Helper to get image URL from uploaded file
const getImageUrl = (file) => {
  if (!file) return null;
  // Cloudinary returns the URL in file.path
  return isCloudinaryEnabled() ? file.path : file.filename;
};

// @desc    Create a new report
// @route   POST /api/reports
// @access  Private (Resident/Admin)
exports.createReport = async (req, res) => {
  try {
    const { title, description, category, location, priority } = req.body;

    // Handle image uploads
    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const imageUrl = getImageUrl(file);
        if (imageUrl) images.push(imageUrl);
      });
    }

    const report = await Report.create({
      title,
      description,
      category,
      location,
      priority,
      images,
      reportedBy: req.user?._id,
      isAnonymous: false,
    });

    res.status(201).json({
      success: true,
      message: "Report created successfully",
      data: report,
    });
    
    await logAction(
      LOGCONSTANTS.actions.reports.CREATE_REPORT,
      `Report created: ${report._id}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating report",
      error: error.message,
    });
  }
};

// @desc    Create an anonymous report (no auth required)
// @route   POST /api/reports/anonymous
// @access  Public
exports.createAnonymousReport = async (req, res) => {
  try {
    const { title, description, category, location, priority, anonymousContact } = req.body;

    // Handle image uploads
    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        const imageUrl = getImageUrl(file);
        if (imageUrl) images.push(imageUrl);
      });
    }

    const report = await Report.create({
      title,
      description,
      category,
      location,
      priority,
      images,
      isAnonymous: true,
      anonymousContact: anonymousContact || null,
    });

    res.status(201).json({
      success: true,
      message: "Anonymous report submitted successfully",
      data: {
        _id: report._id,
        title: report.title,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
    
    await logAction(
      LOGCONSTANTS.actions.reports.CREATE_REPORT,
      `Anonymous report created: ${report._id}`,
      null
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating anonymous report",
      error: error.message,
    });
  }
};

// @desc    Get all reports
// @route   GET /api/reports
// @access  Private (Admin)
exports.getAllReports = async (req, res) => {
  try {
    const { status, category, priority } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    const reports = await Report.find(filter)
      .populate("reportedBy", "firstName lastName email")
      .populate("assignedTo", "firstName lastName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching reports",
      error: error.message,
    });
  }
};

// @desc    Get user's own reports
// @route   GET /api/reports/my-reports
// @access  Private (Resident)
exports.getMyReports = async (req, res) => {
  try {
    const reports = await Report.find({ reportedBy: req.user._id })
      .populate("assignedTo", "firstName lastName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching your reports",
      error: error.message,
    });
  }
};

// @desc    Get single report
// @route   GET /api/reports/:id
// @access  Private
exports.getReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate("reportedBy", "firstName lastName email phoneNumber")
      .populate("assignedTo", "firstName lastName")
      .populate("comments.user", "firstName lastName");

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Check privacy - only admin or report owner can view
    if (
      report.isPrivate &&
      req.user.role !== ROLES.Admin &&
      req.user.role !== ROLES.SuperAdmin &&
      report.reportedBy._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this report",
      });
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching report",
      error: error.message,
    });
  }
};

// @desc    Update report status
// @route   PUT /api/reports/:id/status
// @access  Private (Admin)
exports.updateReportStatus = async (req, res) => {
  try {
    const { status, assignedTo } = req.body;

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    if (status) report.status = status;
    if (assignedTo) report.assignedTo = assignedTo;

    await report.save();

    res.status(200).json({
      success: true,
      message: "Report updated successfully",
      data: report,
    });
    
    await logAction(
      LOGCONSTANTS.actions.reports.UPDATE_STATUS,
      `Report status updated: ${report._id} to ${status}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating report",
      error: error.message,
    });
  }
};

// @desc    Add comment to report
// @route   POST /api/reports/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Check if user has access to this report
    if (
      req.user.role !== ROLES.Admin &&
      req.user.role !== ROLES.SuperAdmin &&
      report.reportedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to comment on this report",
      });
    }

    report.comments.push({
      user: req.user._id,
      text,
    });

    await report.save();

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: report,
    });
    
    await logAction(
      LOGCONSTANTS.actions.reports.ADD_COMMENTS,
      `Comment added to report: ${report._id}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding comment",
      error: error.message,
    });
  }
};

// @desc    Delete report
// @route   DELETE /api/reports/:id
// @access  Private (Admin)
exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    await report.deleteOne();

    res.status(200).json({
      success: true,
      message: "Report deleted successfully",
    });
    
    await logAction(
      LOGCONSTANTS.actions.reports.DELETE_REPORT,
      `Report deleted: ${report._id}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting report",
      error: error.message,
    });
  }
};
