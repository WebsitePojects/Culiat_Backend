const mongoose = require('mongoose');

const HashtagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Hashtag name is required'],
    unique: true,
    trim: true,
  },
  // Category to organize hashtags
  category: {
    type: String,
    enum: ['Branding', 'Events', 'Community', 'Services', 'Custom'],
    default: 'Custom',
  },
  // Whether this hashtag is a default/system hashtag
  isDefault: {
    type: Boolean,
    default: false,
  },
  // Usage count for popularity sorting
  usageCount: {
    type: Number,
    default: 0,
  },
  // Who created the hashtag
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster lookups (name already has unique index from schema)
HashtagSchema.index({ category: 1 });
HashtagSchema.index({ isActive: 1, usageCount: -1 });

module.exports = mongoose.model('Hashtag', HashtagSchema);
