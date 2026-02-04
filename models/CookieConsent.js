const mongoose = require('mongoose');

const cookieConsentSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
    index: true
  },
  accepted: {
    type: Boolean,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  // Enhanced security and fingerprinting data
  deviceFingerprint: {
    // Browser Info
    language: String,
    languages: String,
    platform: String,
    vendor: String,
    
    // Screen Info (VPN/Bot detection)
    screenResolution: String,
    screenColorDepth: Number,
    screenPixelRatio: Number,
    
    // Timezone (VPN detection)
    timezone: String,
    timezoneOffset: Number,
    
    // Browser Features
    cookieEnabled: Boolean,
    doNotTrack: String,
    hardwareConcurrency: mongoose.Schema.Types.Mixed,
    maxTouchPoints: Number,
    connectionType: String,
    
    // Fingerprints (unique device identification)
    canvasFingerprint: String,
    webglFingerprint: mongoose.Schema.Types.Mixed,
  },
  referrer: {
    type: String,
    default: 'direct'
  },
  currentUrl: String,
  // Optional: associate with user if logged in
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Flag for suspicious activity (set by admin/automated checks)
  isSuspicious: {
    type: Boolean,
    default: false
  },
  suspicionReason: String,
  // Blacklist flag
  isBlacklisted: {
    type: Boolean,
    default: false
  },
  blacklistReason: String,
  blacklistedAt: Date,
  blacklistedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient querying
cookieConsentSchema.index({ ip: 1, timestamp: -1 });

// Auto-delete old consent records after 2 years (GDPR compliance)
cookieConsentSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 }); // 2 years in seconds

module.exports = mongoose.model('CookieConsent', cookieConsentSchema);
