const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Announcement title is required'],
    trim: true,
  },
  content: {
    type: String,
    required: [true, 'Announcement content is required'],
    maxlength: [10000, 'Content can not be more than 10000 characters'],
  },
  category: {
    type: String,
    enum: [
      'Health Program',
      'Community Activity', 
      'Education & Training',
      'Social Services',
      'Sports & Recreation',
      'Safety & Security',
      'General',
      'Event',
      'Emergency',
      'Update'
    ],
    default: 'General',
  },
  priority: {
    type: String,
    enum: ['normal', 'important', 'urgent'],
    default: 'normal',
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  location: {
    type: String,
    default: 'Barangay Culiat',
  },
  // Support for multiple images (up to 6)
  images: [{
    type: String,
  }],
  // Keep legacy image field for backward compatibility
  image: {
    type: String,
    default: null,
  },
  slug: {
    type: String,
    unique: true,
    sparse: true,
  },
  eventDate: {
    type: Date,
  },
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  publishDate: {
    type: Date,
  },
  expiryDate: {
    type: Date,
  },
  views: {
    type: Number,
    default: 0,
  },
  // Track unique viewers to prevent duplicate view counts
  viewedBy: [{
    visitorId: String,  // Can be session ID, fingerprint, or user ID
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Hashtags for the announcement (optional)
  hashtags: [{
    type: String,
    trim: true,
  }],
  // Link announcement to a committee (for accomplishments)
  committeeRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Committee',
    default: null,
  },
  // YouTube video URL for embedding videos
  youtubeVideoUrl: {
    type: String,
    default: null,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow null/empty
        // More lenient check to allow iframe embed codes as requested by user
        return v.includes('youtube.com') || v.includes('youtu.be') || /<iframe.*src=".*youtube\.com\/embed\/.*">/.test(v);
      },
      message: 'Invalid YouTube URL or embed code.'
    }
  },
  // Extracted YouTube video ID for easy embed generation
  youtubeVideoId: {
    type: String,
    default: null,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Generate slug from title before saving
announcementSchema.pre('save', function(next) {
  if (this.isModified('title') || !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now();
  }
  next();
});

module.exports = mongoose.model('Announcement', announcementSchema);
