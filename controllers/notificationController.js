const DocumentRequest = require("../models/DocumentRequest");
const User = require("../models/User");
const Report = require("../models/Report");
const Announcement = require("../models/Announcement");
const CommitteeMessage = require("../models/CommitteeMessage");
const ContactMessage = require("../models/ContactMessage");

const ADMIN_NOTIFICATION_KEY_PREFIX = "admin:";

const getAdminNotificationReadKey = (notificationId) =>
  `${ADMIN_NOTIFICATION_KEY_PREFIX}${notificationId}`;

const buildAdminNotifications = async (adminUserId) => {
  const notifications = [];

  const [adminUser, recentDocRequests, recentRegistrations, recentReports, recentAnnouncements] = await Promise.all([
    User.findById(adminUserId).select("notificationReadKeys"),
    DocumentRequest.find({ status: "pending" })
      .populate("applicant", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(50),
    User.find({ registrationStatus: "pending" })
      .sort({ createdAt: -1 })
      .limit(50),
    Report.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .limit(50),
    Announcement.find()
      .sort({ createdAt: -1 })
      .limit(20),
  ]);

  recentDocRequests.forEach((requestDoc) => {
    notifications.push({
      id: `doc_${requestDoc._id}`,
      type: "document_request",
      title: "New Document Request",
      message: `${requestDoc.applicant?.firstName || "Resident"} ${requestDoc.applicant?.lastName || ""}`.trim() +
        ` requested ${requestDoc.documentType}`,
      time: getTimeAgo(requestDoc.createdAt),
      createdAt: requestDoc.createdAt,
      link: `/admin/documents`,
    });
  });

  recentRegistrations.forEach((user) => {
    notifications.push({
      id: `user_${user._id}`,
      type: "user_registration",
      title: "New User Registration",
      message: `${user.firstName} ${user.lastName} registered and pending approval`,
      time: getTimeAgo(user.createdAt),
      createdAt: user.createdAt,
      link: `/admin/pending-registrations`,
    });
  });

  recentReports.forEach((report) => {
    notifications.push({
      id: `report_${report._id}`,
      type: "report",
      title: "New Report Submitted",
      message: `${report.category} report: ${report.title}`,
      createdAt: report.createdAt,
      time: getTimeAgo(report.createdAt),
      link: `/admin/reports`,
    });
  });

  recentAnnouncements.forEach((announcement) => {
    notifications.push({
      id: `announcement_${announcement._id}`,
      type: "announcement",
      title: "Announcement Published",
      message: `${announcement.title}`,
      createdAt: announcement.createdAt,
      time: getTimeAgo(announcement.createdAt),
      link: `/admin/announcements`,
    });
  });

  const readKeySet = new Set(adminUser?.notificationReadKeys || []);

  return notifications
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((notification) => ({
      ...notification,
      unread: !readKeySet.has(getAdminNotificationReadKey(notification.id)),
    }));
};

/**
 * @route   GET /api/notifications/recent
 * @desc    Get recent notifications for admin
 * @access  Private (Admin)
 */
exports.getRecentNotifications = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const notifications = await buildAdminNotifications(req.user?._id);
    const limitedNotifications = notifications.slice(0, parseInt(limit, 10) || 10);

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
 * @route   PATCH /api/notifications/read
 * @desc    Mark a specific admin notification as read
 * @access  Private (Admin)
 */
exports.markAdminNotificationRead = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { notificationId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!notificationId || typeof notificationId !== "string") {
      return res.status(400).json({
        success: false,
        message: "notificationId is required",
      });
    }

    await User.findByIdAndUpdate(userId, {
      $addToSet: { notificationReadKeys: getAdminNotificationReadKey(notificationId) },
    });

    return res.status(200).json({
      success: true,
      message: "Admin notification marked as read",
      data: { notificationId },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error marking admin notification as read",
      error: error.message,
    });
  }
};

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all current admin notifications as read
 * @access  Private (Admin)
 */
exports.markAllAdminNotificationsRead = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const notifications = await buildAdminNotifications(userId);
    const notificationKeys = notifications.map((notification) =>
      getAdminNotificationReadKey(notification.id)
    );

    if (notificationKeys.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $addToSet: { notificationReadKeys: { $each: notificationKeys } },
      });
    }

    return res.status(200).json({
      success: true,
      message: "All admin notifications marked as read",
      data: { totalMarked: notificationKeys.length },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error marking all admin notifications as read",
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

const buildUserNotifications = async (userId, userEmail) => {
  const notifications = [];

  const [currentUser, rejectedDocuments, committeeResponses, feedbackResponses] = await Promise.all([
    User.findById(userId).select("registrationStatus rejectionReason updatedAt notificationReadKeys"),
    DocumentRequest.find({ applicant: userId, status: "rejected" })
      .sort({ updatedAt: -1 })
      .limit(200),
    CommitteeMessage.find({
      $or: [
        { userId },
        ...(userEmail ? [{ email: userEmail }] : []),
      ],
      "response.respondedAt": { $ne: null },
      isArchived: false,
    })
      .sort({ "response.respondedAt": -1 })
      .limit(200),
    ContactMessage.find({
      $or: [
        { userId },
        ...(userEmail ? [{ email: userEmail }] : []),
      ],
      "response.respondedAt": { $ne: null },
      isArchived: false,
    })
      .sort({ "response.respondedAt": -1 })
      .limit(200),
  ]);

  if (currentUser?.registrationStatus === "rejected") {
    notifications.push({
      id: `registration_${currentUser._id}`,
      type: "registration_rejected",
      title: "Registration Rejected",
      message: currentUser.rejectionReason || "Your registration was not approved.",
      time: getTimeAgo(currentUser.updatedAt),
      createdAt: currentUser.updatedAt,
      link: "/registration-pending",
    });
  }

  rejectedDocuments.forEach((doc) => {
    notifications.push({
      id: `document_${doc._id}`,
      type: "document_rejected",
      title: "Document Request Rejected",
      message: `${doc.documentType} request rejected${doc.remarks ? `: ${doc.remarks}` : "."}`,
      time: getTimeAgo(doc.updatedAt || doc.createdAt),
      createdAt: doc.updatedAt || doc.createdAt,
      link: "/services",
    });
  });

  committeeResponses.forEach((entry) => {
    notifications.push({
      id: `committee_${entry._id}`,
      type: "committee_response",
      title: "Committee Reply",
      message: entry.response?.message || "An admin replied to your committee question.",
      time: getTimeAgo(entry.response?.respondedAt || entry.updatedAt),
      createdAt: entry.response?.respondedAt || entry.updatedAt,
      link: "/committee",
    });
  });

  feedbackResponses.forEach((entry) => {
    notifications.push({
      id: `feedback_${entry._id}`,
      type: "feedback_response",
      title: "Feedback Reply",
      message: entry.response?.message || "An admin replied to your feedback.",
      time: getTimeAgo(entry.response?.respondedAt || entry.updatedAt),
      createdAt: entry.response?.respondedAt || entry.updatedAt,
      link: "/",
    });
  });

  const readKeySet = new Set(currentUser?.notificationReadKeys || []);
  const withReadState = notifications
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((notification) => ({
      ...notification,
      unread: !readKeySet.has(notification.id),
    }));

  return withReadState;
};

/**
 * @route   GET /api/notifications/user/recent
 * @desc    Get recent notifications for logged-in resident/user
 * @access  Private
 */
exports.getUserNotifications = async (req, res) => {
  try {
    const { limit = 20, page = 1, type = "all" } = req.query;
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const userId = req.user?._id;
    const userEmail = req.user?.email;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const notifications = await buildUserNotifications(userId, userEmail);

    const filteredNotifications =
      type && type !== "all"
        ? notifications.filter((notification) => notification.type === type)
        : notifications;

    const total = filteredNotifications.length;
    const totalPages = Math.max(1, Math.ceil(total / limitNum));
    const safePage = Math.min(pageNum, totalPages);
    const startIndex = (safePage - 1) * limitNum;
    const paginatedNotifications = filteredNotifications.slice(startIndex, startIndex + limitNum);
    const unreadTotal = notifications.filter((n) => n.unread).length;

    res.status(200).json({
      success: true,
      data: {
        notifications: paginatedNotifications,
        unreadCount: unreadTotal,
        pagination: {
          page: safePage,
          limit: limitNum,
          total,
          totalPages,
          hasPrevPage: safePage > 1,
          hasNextPage: safePage < totalPages,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user notifications",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/notifications/user/counts
 * @desc    Get user notification counts by type
 * @access  Private
 */
exports.getUserNotificationCounts = async (req, res) => {
  try {
    const userId = req.user?._id;
    const userEmail = req.user?.email;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const notifications = await buildUserNotifications(userId, userEmail);
    const byType = (targetType) => notifications.filter((n) => n.type === targetType);

    const registrationRejections = byType("registration_rejected").length;
    const documentRejections = byType("document_rejected").length;
    const committeeResponses = byType("committee_response").length;
    const feedbackResponses = byType("feedback_response").length;
    const total = notifications.length;

    const unreadRegistrationRejections = byType("registration_rejected").filter((n) => n.unread).length;
    const unreadDocumentRejections = byType("document_rejected").filter((n) => n.unread).length;
    const unreadCommitteeResponses = byType("committee_response").filter((n) => n.unread).length;
    const unreadFeedbackResponses = byType("feedback_response").filter((n) => n.unread).length;
    const unreadTotal = notifications.filter((n) => n.unread).length;

    res.status(200).json({
      success: true,
      data: {
        registrationRejections,
        documentRejections,
        committeeResponses,
        feedbackResponses,
        total,
        unreadRegistrationRejections,
        unreadDocumentRejections,
        unreadCommitteeResponses,
        unreadFeedbackResponses,
        unreadTotal,
      },
    });
  } catch (error) {
    console.error("Error fetching user notification counts:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user notification counts",
      error: error.message,
    });
  }
};

/**
 * @route   PATCH /api/notifications/user/read
 * @desc    Mark a specific user notification as read
 * @access  Private
 */
exports.markUserNotificationRead = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { notificationId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!notificationId || typeof notificationId !== "string") {
      return res.status(400).json({
        success: false,
        message: "notificationId is required",
      });
    }

    await User.findByIdAndUpdate(userId, {
      $addToSet: { notificationReadKeys: notificationId },
    });

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: { notificationId },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error marking notification as read",
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
