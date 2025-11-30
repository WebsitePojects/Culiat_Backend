const mongoose = require("mongoose");

// Base schema for all sectoral groups
const sectoralGroupSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sectorType: {
      type: String,
      enum: ["senior", "women_children", "solo_parent", "pwd"],
      required: true,
      index: true,
    },
    // Common fields
    dateRegistered: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "active",
    },
    // Senior Citizen specific fields
    seniorCitizenId: {
      type: String,
      trim: true,
      default: null,
    },
    osca: {
      type: String,
      trim: true,
      default: null,
    },
    // PWD specific fields
    pwdId: {
      type: String,
      trim: true,
      default: null,
    },
    disabilityType: {
      type: String,
      trim: true,
      default: null,
    },
    disabilityDetails: {
      type: String,
      trim: true,
      default: null,
    },
    // Solo Parent specific fields
    soloParentId: {
      type: String,
      trim: true,
      default: null,
    },
    numberOfChildren: {
      type: Number,
      default: null,
    },
    childrenAges: [
      {
        type: Number,
      },
    ],
    reasonForSoloParenthood: {
      type: String,
      enum: ["widowed", "separated", "unmarried", "abandoned", "other", null],
      default: null,
    },
    // Women and Children specific fields
    hasChildren: {
      type: Boolean,
      default: null,
    },
    numberOfChildrenUnder18: {
      type: Number,
      default: null,
    },
    isPregnant: {
      type: Boolean,
      default: null,
    },
    expectedDeliveryDate: {
      type: Date,
      default: null,
    },
    // Supporting documents
    supportingDocuments: [
      {
        documentType: {
          type: String,
          trim: true,
        },
        url: {
          type: String,
          trim: true,
        },
        filename: {
          type: String,
          trim: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Benefits and assistance tracking
    benefitsReceived: [
      {
        benefitType: {
          type: String,
          trim: true,
        },
        dateReceived: {
          type: Date,
        },
        amount: {
          type: Number,
        },
        description: {
          type: String,
          trim: true,
        },
      },
    ],
    // Notes and remarks
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    // Admin fields
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
sectoralGroupSchema.index({ userId: 1, sectorType: 1 }, { unique: true });
sectoralGroupSchema.index({ sectorType: 1, status: 1 });
sectoralGroupSchema.index({ dateRegistered: -1 });

// Virtual to populate user details
sectoralGroupSchema.virtual("userDetails", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

// Ensure virtuals are included in JSON
sectoralGroupSchema.set("toJSON", { virtuals: true });
sectoralGroupSchema.set("toObject", { virtuals: true });

const SectoralGroup = mongoose.model("SectoralGroup", sectoralGroupSchema);

module.exports = SectoralGroup;
