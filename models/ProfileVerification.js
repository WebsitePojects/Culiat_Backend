const mongoose = require("mongoose");

/**
 * ProfileVerification Model
 * Stores profile verification requests for admin review
 * When a resident submits their PSA birth certificate for verification
 */
const profileVerificationSchema = new mongoose.Schema(
  {
    // Reference to the user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Submitted PSA/Birth Certificate Data
    submittedData: {
      // Birth Certificate Fields
      certificateNumber: {
        type: String,
        trim: true,
        required: true,
      },
      registryNumber: {
        type: String,
        trim: true,
        required: true,
      },
      dateIssued: {
        type: Date,
        required: true,
      },
      placeOfRegistration: {
        type: String,
        trim: true,
        required: true,
      },
      // Father's Information
      fatherFirstName: {
        type: String,
        trim: true,
        required: true,
      },
      fatherMiddleName: {
        type: String,
        trim: true,
        default: null,
      },
      fatherLastName: {
        type: String,
        trim: true,
        required: true,
      },
      fatherNationality: {
        type: String,
        trim: true,
        default: null,
      },
      // Mother's Information
      motherFirstName: {
        type: String,
        trim: true,
        required: true,
      },
      motherMiddleName: {
        type: String,
        trim: true,
        default: null,
      },
      motherMaidenLastName: {
        type: String,
        trim: true,
        required: true,
      },
      motherNationality: {
        type: String,
        trim: true,
        default: null,
      },
      // Document URL (Cloudinary or local)
      documentUrl: {
        type: String,
        required: true,
      },
      documentFilename: {
        type: String,
        default: null,
      },
    },
    // User's personal data at time of submission (for comparison)
    userDataSnapshot: {
      firstName: String,
      lastName: String,
      middleName: String,
      dateOfBirth: Date,
      placeOfBirth: String,
    },
    // Verification Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    // Review Details
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    // Admin notes (internal)
    adminNotes: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
profileVerificationSchema.index({ user: 1, status: 1 });
profileVerificationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("ProfileVerification", profileVerificationSchema);
