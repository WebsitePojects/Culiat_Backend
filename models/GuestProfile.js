const mongoose = require("mongoose");

const guestProfileSchema = new mongoose.Schema(
  {
    visitorId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    firstName: {
      type: String,
      trim: true,
      default: null,
    },
    lastName: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: null,
    },
    residentType: {
      type: String,
      default: "Unregistered",
      immutable: true,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    notificationReadKeys: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

guestProfileSchema.index({ email: 1, updatedAt: -1 });

module.exports = mongoose.model("GuestProfile", guestProfileSchema);
