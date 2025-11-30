const DocumentRequest = require("../models/DocumentRequest");
const User = require("../models/User");
const Report = require("../models/Report");
const Announcement = require("../models/Announcement");

/**
 * @route   GET /api/notifications/recent
 * @desc    Get recent notifications for admin
 * @access  Private (Admin)
 */
exports.getRecentNotifications = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const notifications = [];

    // Get recent pending document requests
    const recentDocRequests = await DocumentRequest.find({ status: "pending" })
      .populate("applicant", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(5);

    recentDocRequests.forEach((req) => {
      notifications.push({
        id: `doc_${req._id}`,
        type: "document_request",
        title: "New Document Request",
        message: `${req.applicant?.firstName} ${req.applicant?.lastName} requested ${req.documentType}`,
        time: getTimeAgo(req.createdAt),
        unread: true,
        createdAt: req.createdAt,
        link: `/admin/documents`,
      });
    });

    // Get recent pending user registrations
    const recentRegistrations = await User.find({
      registrationStatus: "pending",
    })
      .sort({ createdAt: -1 })
      .limit(5);

    recentRegistrations.forEach((user) => {
      notifications.push({
        id: `user_${user._id}`,
        type: "user_registration",
        title: "New User Registration",
        message: `${user.firstName} ${user.lastName} registered and pending approval`,
        time: getTimeAgo(user.createdAt),
        unread: true,
        createdAt: user.createdAt,
        link: `/admin/pending-registrations`,
      });
    });

    // Get recent reports
    const recentReports = await Report.find().sort({ createdAt: -1 }).limit(3);

    recentReports.forEach((report) => {
      notifications.push({
        id: `report_${report._id}`,
        type: "report",
        title: "New Report Submitted",
        message: `${report.category} report: ${report.title}`,
        time: getTimeAgo(report.createdAt),
        unread: false,
        createdAt: report.createdAt,
        link: `/admin/reports`,
      });
    });

    // Get recent announcements
    const recentAnnouncements = await Announcement.find()
      .sort({ createdAt: -1 })
      .limit(2);

    recentAnnouncements.forEach((announcement) => {
      notifications.push({
        id: `announcement_${announcement._id}`,
        type: "announcement",
        title: "Announcement Published",
        message: `${announcement.title}`,
        time: getTimeAgo(announcement.createdAt),
        unread: false,
        createdAt: announcement.createdAt,
        link: `/admin/announcements`,
      });
    });

    // Sort by creation date and limit
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const limitedNotifications = notifications.slice(0, parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        notifications: limitedNotifications,
        unreadCount: limitedNotifications.filter((n) => n.unread).length,
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/notifications/counts
 * @desc    Get notification counts by type
 * @access  Private (Admin)
 */
exports.getNotificationCounts = async (req, res) => {
  try {
    const pendingDocuments = await DocumentRequest.countDocuments({
      status: "pending",
    });
    const pendingRegistrations = await User.countDocuments({
      registrationStatus: "pending",
    });
    const pendingReports = await Report.countDocuments({ status: "pending" });

    res.status(200).json({
      success: true,
      data: {
        pendingDocuments,
        pendingRegistrations,
        pendingReports,
        total: pendingDocuments + pendingRegistrations + pendingReports,
      },
    });
  } catch (error) {
    console.error("Error fetching notification counts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notification counts",
      error: error.message,
    });
  }
};

// Helper function to calculate time ago
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1)
    return (
      Math.floor(interval) +
      " year" +
      (Math.floor(interval) > 1 ? "s" : "") +
      " ago"
    );

  interval = seconds / 2592000;
  if (interval > 1)
    return (
      Math.floor(interval) +
      " month" +
      (Math.floor(interval) > 1 ? "s" : "") +
      " ago"
    );

  interval = seconds / 86400;
  if (interval > 1)
    return (
      Math.floor(interval) +
      " day" +
      (Math.floor(interval) > 1 ? "s" : "") +
      " ago"
    );

  interval = seconds / 3600;
  if (interval > 1)
    return (
      Math.floor(interval) +
      " hour" +
      (Math.floor(interval) > 1 ? "s" : "") +
      " ago"
    );

  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " min ago";

  return Math.floor(seconds) + " sec ago";
}

module.exports = exports;
