const mongoose = require("mongoose");

/**
 * ProfileUpdate Model
 * Tracks all profile update requests from residents for admin review
 * Stores complete snapshot of old and new data
 */
const profileUpdateSchema = new mongoose.Schema(
  {
    // User who submitted the update
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    // Type of update
    updateType: {
      type: String,
      enum: ['personal_info', 'birth_certificate', 'contact_info', 'account_info', 'address', 'emergency_contact', 'spouse_info', 'additional_info', 'full_profile'],
      required: true,
    },
    
    // Status of the update request
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    
    // Complete snapshot of old data (before update)
    oldData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    
    // Complete snapshot of new/requested data
    newData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    
    // List of fields that were changed
    changedFields: [{
      fieldName: String,
      fieldPath: String, // Dot notation path e.g., "birthCertificate.motherMaidenName.firstName"
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
    }],
    
    // Documents uploaded with the update
    documents: [{
      fieldName: String, // e.g., "birthCertificateDocument", "validID"
      url: String,
      filename: String,
      originalName: String,
      uploadedAt: Date,
    }],
    
    // Reason for update (optional, provided by resident)
    updateReason: {
      type: String,
      trim: true,
      default: null,
    },
    
    // Verification configuration (from frontend - for admin reference)
    verificationConfig: {
      sectionTitle: String,
      documentsRequired: String,
      adminNote: String,
    },
    
    // Admin review information
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNotes: {
      type: String,
      trim: true,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    
    // Track when data was applied to user profile
    appliedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
profileUpdateSchema.index({ user: 1, createdAt: -1 });
profileUpdateSchema.index({ status: 1, createdAt: -1 });
profileUpdateSchema.index({ updateType: 1, status: 1 });

// Virtual for user details
profileUpdateSchema.virtual('userDetails', {
  ref: 'User',
  localField: 'user',
  foreignField: '_id',
  justOne: true,
});

// Virtual for reviewer details
profileUpdateSchema.virtual('reviewerDetails', {
  ref: 'User',
  localField: 'reviewedBy',
  foreignField: '_id',
  justOne: true,
});

// Enable virtuals in JSON
profileUpdateSchema.set('toJSON', { virtuals: true });
profileUpdateSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("ProfileUpdate", profileUpdateSchema);
