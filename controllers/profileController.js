const crypto = require("crypto");
const User = require("../models/User");
const { sendVerificationCode } = require("../utils/emailService");
const { LOGCONSTANTS } = require("../config/logConstants");
const { logAction } = require("../utils/logHelper");

// Store verification codes in memory (in production, use Redis)
const verificationCodes = new Map();

// Generate 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Get admin profile
// @route   GET /api/profile/admin
// @access  Private
exports.getAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
      error: error.message,
    });
  }
};

// @desc    Request verification code for profile changes
// @route   POST /api/profile/request-verification
// @access  Private
exports.requestVerificationCode = async (req, res) => {
  try {
    const { purpose, newValue } = req.body; // purpose: 'password', 'email', 'username', 'phone', 'name'

    if (!purpose) {
      return res.status(400).json({
        success: false,
        message: "Purpose is required",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // For email change, send to new email
    // For other changes, send to current email
    const targetEmail = purpose === "email" && newValue ? newValue : user.email;

    // Check if new email already exists (for email change)
    if (purpose === "email" && newValue) {
      const emailExists = await User.findOne({ email: newValue });
      if (emailExists && emailExists._id.toString() !== user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: "Email already in use by another account",
        });
      }
    }

    // Check if new username already exists (for username change)
    if (purpose === "username" && newValue) {
      const usernameExists = await User.findOne({ username: newValue });
      if (
        usernameExists &&
        usernameExists._id.toString() !== user._id.toString()
      ) {
        return res.status(400).json({
          success: false,
          message: "Username already taken",
        });
      }
    }

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store verification code
    const key = `${user._id}_${purpose}`;
    verificationCodes.set(key, {
      code,
      expiresAt,
      purpose,
      newValue,
      attempts: 0,
    });

    // Send email
    try {
      await sendVerificationCode(targetEmail, code, purpose);

      res.status(200).json({
        success: true,
        message: `Verification code sent to ${targetEmail}`,
        expiresIn: 600, // seconds
      });

      // Log action
      await logAction(
        LOGCONSTANTS.actions.user.UPDATE_USER,
        `Verification code requested for ${purpose} change`,
        user
      );
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      // Clean up verification code if email fails
      verificationCodes.delete(key);

      return res.status(500).json({
        success: false,
        message:
          "Failed to send verification code. Please check email configuration.",
        error:
          process.env.NODE_ENV === "development"
            ? emailError.message
            : undefined,
      });
    }
  } catch (error) {
    console.error("Error requesting verification code:", error);
    res.status(500).json({
      success: false,
      message: "Error requesting verification code",
      error: error.message,
    });
  }
};

// @desc    Verify code and update profile
// @route   POST /api/profile/verify-and-update
// @access  Private
exports.verifyAndUpdateProfile = async (req, res) => {
  try {
    const { purpose, code, newValue, currentPassword } = req.body;

    if (!purpose || !code) {
      return res.status(400).json({
        success: false,
        message: "Purpose and verification code are required",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get verification code from storage
    const key = `${user._id}_${purpose}`;
    const storedData = verificationCodes.get(key);

    if (!storedData) {
      return res.status(400).json({
        success: false,
        message: "No verification code found. Please request a new code.",
      });
    }

    // Check if code expired
    if (Date.now() > storedData.expiresAt) {
      verificationCodes.delete(key);
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new code.",
      });
    }

    // Check attempts
    if (storedData.attempts >= 3) {
      verificationCodes.delete(key);
      return res.status(400).json({
        success: false,
        message: "Too many failed attempts. Please request a new code.",
      });
    }

    // Verify code
    if (storedData.code !== code) {
      storedData.attempts += 1;
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
        attemptsLeft: 3 - storedData.attempts,
      });
    }

    // Code is valid, proceed with update based on purpose
    let updateMessage = "";

    switch (purpose) {
      case "password":
        if (!newValue || !currentPassword) {
          return res.status(400).json({
            success: false,
            message: "Current password and new password are required",
          });
        }

        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
          return res.status(401).json({
            success: false,
            message: "Current password is incorrect",
          });
        }

        user.password = newValue;
        updateMessage = "Password updated successfully";
        break;

      case "email":
        if (!newValue) {
          return res.status(400).json({
            success: false,
            message: "New email is required",
          });
        }
        user.email = newValue;
        updateMessage = "Email updated successfully";
        break;

      case "username":
        if (!newValue) {
          return res.status(400).json({
            success: false,
            message: "New username is required",
          });
        }
        user.username = newValue;
        updateMessage = "Username updated successfully";
        break;

      case "phone":
        if (!newValue) {
          return res.status(400).json({
            success: false,
            message: "New phone number is required",
          });
        }
        user.phoneNumber = newValue;
        updateMessage = "Phone number updated successfully";
        break;

      case "name":
        if (!newValue || !newValue.firstName || !newValue.lastName) {
          return res.status(400).json({
            success: false,
            message: "First name and last name are required",
          });
        }
        user.firstName = newValue.firstName;
        user.lastName = newValue.lastName;
        if (newValue.middleName !== undefined)
          user.middleName = newValue.middleName;
        updateMessage = "Name updated successfully";
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid purpose",
        });
    }

    await user.save();

    // Delete verification code after successful update
    verificationCodes.delete(key);

    res.status(200).json({
      success: true,
      message: updateMessage,
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        phoneNumber: user.phoneNumber,
      },
    });

    // Log action
    await logAction(
      LOGCONSTANTS.actions.user.UPDATE_USER,
      `${purpose} updated successfully`,
      user
    );
  } catch (error) {
    console.error("Error verifying and updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

// @desc    Update basic profile info (no verification needed)
// @route   PUT /api/profile/basic
// @access  Private
exports.updateBasicProfile = async (req, res) => {
  try {
    const allowedFields = [
      "address",
      "dateOfBirth",
      "placeOfBirth",
      "gender",
      "civilStatus",
    ];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });

    // Log action
    await logAction(
      LOGCONSTANTS.actions.user.UPDATE_USER,
      "Basic profile information updated",
      user
    );
  } catch (error) {
    console.error("Error updating basic profile:", error);
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};
