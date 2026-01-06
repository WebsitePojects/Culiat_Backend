const User = require("../models/User");
const ProfileVerification = require("../models/ProfileVerification");
const {
  sendPsaCompletionReminder,
  sendProfileVerificationApproved,
  sendProfileVerificationRejected,
} = require("../utils/emailService");
const { LOGCONSTANTS } = require("../config/logConstants");
const { logAction } = require("../utils/logHelper");

// Check if using Cloudinary
const isCloudinaryEnabled = () => {
  return (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

// Helper to get file URL from uploaded file
const getFileUrl = (file) => {
  if (!file) return null;
  if (isCloudinaryEnabled() && file.path && file.path.includes("cloudinary")) {
    return file.path;
  }
  return file.path || file.filename;
};

// @desc    Get PSA completion status for current user
// @route   GET /api/profile-verification/status
// @access  Private (Residents only)
exports.getPsaCompletionStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Only for residents
    if (user.role !== 74934) {
      return res.status(200).json({
        success: true,
        data: {
          requiresCompletion: false,
          message: "PSA completion not required for admin users",
        },
      });
    }

    const isComplete = user.isPsaProfileComplete();
    const daysLeft = user.getDaysUntilPsaDeadline();
    const isApproaching = user.isPsaDeadlineApproaching();
    const isPassed = user.isPsaDeadlinePassed();

    // Check for pending verification
    const pendingVerification = await ProfileVerification.findOne({
      user: user._id,
      status: "pending",
    });

    res.status(200).json({
      success: true,
      data: {
        requiresCompletion: !isComplete && user.psaCompletion?.deadline,
        isComplete,
        deadline: user.psaCompletion?.deadline,
        daysLeft,
        isApproaching,
        isPassed,
        verificationStatus: user.profileVerification?.status || "none",
        hasPendingVerification: !!pendingVerification,
        rejectionReason: user.profileVerification?.rejectionReason,
        birthCertificate: user.birthCertificate,
      },
    });
  } catch (error) {
    console.error("Error getting PSA completion status:", error);
    res.status(500).json({
      success: false,
      message: "Error getting PSA completion status",
      error: error.message,
    });
  }
};

// @desc    Submit PSA birth certificate for verification
// @route   POST /api/profile-verification/submit
// @access  Private (Residents only)
exports.submitPsaVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Only for residents
    if (user.role !== 74934) {
      return res.status(403).json({
        success: false,
        message: "PSA verification is only for residents",
      });
    }

    // Check if already has pending verification
    const existingPending = await ProfileVerification.findOne({
      user: user._id,
      status: "pending",
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message:
          "You already have a pending verification request. Please wait for admin review.",
      });
    }

    const {
      certificateNumber,
      registryNumber,
      dateIssued,
      placeOfRegistration,
      fatherFirstName,
      fatherMiddleName,
      fatherLastName,
      fatherNationality,
      motherFirstName,
      motherMiddleName,
      motherMaidenLastName,
      motherNationality,
    } = req.body;

    // Validate required fields
    if (
      !certificateNumber ||
      !registryNumber ||
      !dateIssued ||
      !placeOfRegistration ||
      !fatherFirstName ||
      !fatherLastName ||
      !motherFirstName ||
      !motherMaidenLastName
    ) {
      return res.status(400).json({
        success: false,
        message: "All required PSA fields must be provided",
      });
    }

    // Handle birth certificate document upload
    let documentUrl = null;
    let documentFilename = null;

    if (req.file) {
      documentUrl = getFileUrl(req.file);
      documentFilename = req.file.filename || req.file.public_id;
    } else if (req.body.documentUrl) {
      documentUrl = req.body.documentUrl;
    }

    if (!documentUrl) {
      return res.status(400).json({
        success: false,
        message: "Birth certificate document is required",
      });
    }

    // Create verification request
    const verification = await ProfileVerification.create({
      user: user._id,
      submittedData: {
        certificateNumber,
        registryNumber,
        dateIssued: new Date(dateIssued),
        placeOfRegistration,
        fatherFirstName,
        fatherMiddleName,
        fatherLastName,
        fatherNationality,
        motherFirstName,
        motherMiddleName,
        motherMaidenLastName,
        motherNationality,
        documentUrl,
        documentFilename,
      },
      userDataSnapshot: {
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        dateOfBirth: user.dateOfBirth,
        placeOfBirth: user.placeOfBirth,
      },
      status: "pending",
    });

    // Update user's birth certificate data (pending verification)
    user.birthCertificate = {
      // Certificate details
      certificateNumber,
      registryNumber,
      dateIssued: new Date(dateIssued),
      placeOfRegistration,
      // Mother's Information - nested structure matching User model
      mother: {
        maidenName: {
          firstName: motherFirstName || null,
          middleName: motherMiddleName || null,
          lastName: motherMaidenLastName || null,
        },
        citizenship: motherNationality || 'Filipino',
      },
      // Father's Information - nested structure matching User model
      father: {
        name: {
          firstName: fatherFirstName || null,
          middleName: fatherMiddleName || null,
          lastName: fatherLastName || null,
        },
        citizenship: fatherNationality || 'Filipino',
      },
      // Document upload
      documentUrl,
      documentFilename,
      documentUploadedAt: new Date(),
    };

    // Update verification status
    user.profileVerification = {
      status: "pending",
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    };

    await user.save();

    // Log action
    await logAction(
      LOGCONSTANTS.actions.user.UPDATE_USER,
      "Submitted PSA profile for verification",
      user
    );

    res.status(201).json({
      success: true,
      message:
        "PSA verification submitted successfully. Please wait for admin review.",
      data: {
        verificationId: verification._id,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("Error submitting PSA verification:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting PSA verification",
      error: error.message,
    });
  }
};

// @desc    Dismiss PSA completion warning modal
// @route   POST /api/profile-verification/dismiss-warning
// @access  Private (Residents only)
exports.dismissWarning = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update warning dismissed timestamp
    if (!user.psaCompletion) {
      user.psaCompletion = {};
    }
    user.psaCompletion.warningDismissedAt = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: "Warning dismissed",
    });
  } catch (error) {
    console.error("Error dismissing warning:", error);
    res.status(500).json({
      success: false,
      message: "Error dismissing warning",
      error: error.message,
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

// @desc    Get all pending profile verifications
// @route   GET /api/profile-verification/admin/pending
// @access  Private (Admin/SuperAdmin only)
exports.getPendingVerifications = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const verifications = await ProfileVerification.find({ status: "pending" })
      .populate("user", "firstName lastName middleName email username photo1x1")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await ProfileVerification.countDocuments({ status: "pending" });

    res.status(200).json({
      success: true,
      data: verifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error getting pending verifications:", error);
    res.status(500).json({
      success: false,
      message: "Error getting pending verifications",
      error: error.message,
    });
  }
};

// @desc    Get verification details by ID
// @route   GET /api/profile-verification/admin/:id
// @access  Private (Admin/SuperAdmin only)
exports.getVerificationById = async (req, res) => {
  try {
    const verification = await ProfileVerification.findById(req.params.id)
      .populate("user", "firstName lastName middleName email username dateOfBirth placeOfBirth photo1x1 validID")
      .populate("reviewedBy", "firstName lastName username");

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification request not found",
      });
    }

    res.status(200).json({
      success: true,
      data: verification,
    });
  } catch (error) {
    console.error("Error getting verification:", error);
    res.status(500).json({
      success: false,
      message: "Error getting verification",
      error: error.message,
    });
  }
};

// @desc    Approve profile verification
// @route   PUT /api/profile-verification/admin/:id/approve
// @access  Private (Admin/SuperAdmin only)
exports.approveVerification = async (req, res) => {
  try {
    const { adminNotes } = req.body;

    const verification = await ProfileVerification.findById(req.params.id);

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification request not found",
      });
    }

    if (verification.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "This verification has already been processed",
      });
    }

    // Update verification record
    verification.status = "approved";
    verification.reviewedBy = req.user._id;
    verification.reviewedAt = new Date();
    verification.adminNotes = adminNotes || null;
    await verification.save();

    // Update user's profile verification status
    const user = await User.findById(verification.user);

    if (user) {
      user.profileVerification = {
        status: "approved",
        submittedAt: verification.createdAt,
        reviewedAt: new Date(),
        reviewedBy: req.user._id,
        rejectionReason: null,
      };

      // Mark PSA completion as complete
      if (!user.psaCompletion) {
        user.psaCompletion = {};
      }
      user.psaCompletion.isComplete = true;
      user.psaCompletion.completedAt = new Date();

      await user.save();

      // Send approval email
      try {
        await sendProfileVerificationApproved(user.email, user.firstName);
      } catch (emailError) {
        console.error("Failed to send approval email:", emailError);
      }
    }

    // Log action
    await logAction(
      LOGCONSTANTS.actions.admin.MANAGE_USER,
      `Approved PSA profile verification for ${user?.username || "user"}`,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Profile verification approved successfully",
      data: verification,
    });
  } catch (error) {
    console.error("Error approving verification:", error);
    res.status(500).json({
      success: false,
      message: "Error approving verification",
      error: error.message,
    });
  }
};

// @desc    Reject profile verification
// @route   PUT /api/profile-verification/admin/:id/reject
// @access  Private (Admin/SuperAdmin only)
exports.rejectVerification = async (req, res) => {
  try {
    const { rejectionReason, adminNotes } = req.body;

    if (!rejectionReason || rejectionReason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const verification = await ProfileVerification.findById(req.params.id);

    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification request not found",
      });
    }

    if (verification.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "This verification has already been processed",
      });
    }

    // Update verification record
    verification.status = "rejected";
    verification.reviewedBy = req.user._id;
    verification.reviewedAt = new Date();
    verification.rejectionReason = rejectionReason;
    verification.adminNotes = adminNotes || null;
    await verification.save();

    // Update user's profile verification status
    const user = await User.findById(verification.user);

    if (user) {
      user.profileVerification = {
        status: "rejected",
        submittedAt: verification.createdAt,
        reviewedAt: new Date(),
        reviewedBy: req.user._id,
        rejectionReason: rejectionReason,
      };

      // Clear the birth certificate data so user can resubmit
      user.birthCertificate = {
        certificateNumber: null,
        registryNumber: null,
        dateIssued: null,
        placeOfRegistration: null,
        fatherFirstName: null,
        fatherMiddleName: null,
        fatherLastName: null,
        fatherNationality: null,
        motherFirstName: null,
        motherMiddleName: null,
        motherMaidenLastName: null,
        motherNationality: null,
        documentUrl: null,
        documentFilename: null,
        documentUploadedAt: null,
      };

      await user.save();

      // Send rejection email
      try {
        await sendProfileVerificationRejected(
          user.email,
          user.firstName,
          rejectionReason
        );
      } catch (emailError) {
        console.error("Failed to send rejection email:", emailError);
      }
    }

    // Log action
    await logAction(
      LOGCONSTANTS.actions.admin.MANAGE_USER,
      `Rejected PSA profile verification for ${user?.username || "user"}: ${rejectionReason}`,
      req.user
    );

    res.status(200).json({
      success: true,
      message: "Profile verification rejected",
      data: verification,
    });
  } catch (error) {
    console.error("Error rejecting verification:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting verification",
      error: error.message,
    });
  }
};

// @desc    Get verification history (all statuses)
// @route   GET /api/profile-verification/admin/history
// @access  Private (Admin/SuperAdmin only)
exports.getVerificationHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    const verifications = await ProfileVerification.find(query)
      .populate("user", "firstName lastName middleName email username")
      .populate("reviewedBy", "firstName lastName username")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await ProfileVerification.countDocuments(query);

    res.status(200).json({
      success: true,
      data: verifications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error getting verification history:", error);
    res.status(500).json({
      success: false,
      message: "Error getting verification history",
      error: error.message,
    });
  }
};

// @desc    Get pending verification count (for sidebar badge)
// @route   GET /api/profile-verification/admin/count
// @access  Private (Admin/SuperAdmin only)
exports.getPendingCount = async (req, res) => {
  try {
    const count = await ProfileVerification.countDocuments({ status: "pending" });

    res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error("Error getting pending count:", error);
    res.status(500).json({
      success: false,
      message: "Error getting pending count",
      error: error.message,
    });
  }
};

// @desc    Run PSA deadline reminder job (can be called by cron)
// @route   POST /api/profile-verification/admin/send-reminders
// @access  Private (SuperAdmin only) or Internal
exports.sendDeadlineReminders = async (req, res) => {
  try {
    const now = new Date();

    // Find users with incomplete PSA who need reminders
    const users = await User.find({
      role: 74934, // Residents only
      "psaCompletion.isComplete": { $ne: true },
      "psaCompletion.deadline": { $exists: true, $ne: null },
      "profileVerification.status": { $ne: "pending" },
    });

    let remindersSent = 0;

    for (const user of users) {
      if (!user.psaCompletion?.deadline) continue;

      const daysLeft = user.getDaysUntilPsaDeadline();

      // Skip if deadline passed or no deadline
      if (daysLeft === null || daysLeft <= 0) continue;

      let shouldSend = false;
      let reminderType = "";

      // First reminder: 30 days before deadline
      if (daysLeft <= 30 && daysLeft > 14 && !user.psaCompletion.firstReminderSent) {
        shouldSend = true;
        reminderType = "first";
        user.psaCompletion.firstReminderSent = true;
      }
      // Second reminder: 14 days before deadline
      else if (daysLeft <= 14 && daysLeft > 7 && !user.psaCompletion.secondReminderSent) {
        shouldSend = true;
        reminderType = "second";
        user.psaCompletion.secondReminderSent = true;
      }
      // Final reminder: 7 days before deadline
      else if (daysLeft <= 7 && !user.psaCompletion.finalReminderSent) {
        shouldSend = true;
        reminderType = "final";
        user.psaCompletion.finalReminderSent = true;
      }

      if (shouldSend) {
        try {
          await sendPsaCompletionReminder(
            user.email,
            user.firstName,
            daysLeft,
            reminderType
          );
          await user.save();
          remindersSent++;
          console.log(`Sent ${reminderType} reminder to ${user.email}`);
        } catch (emailError) {
          console.error(`Failed to send reminder to ${user.email}:`, emailError);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Sent ${remindersSent} reminder emails`,
      data: { remindersSent },
    });
  } catch (error) {
    console.error("Error sending deadline reminders:", error);
    res.status(500).json({
      success: false,
      message: "Error sending deadline reminders",
      error: error.message,
    });
  }
};
