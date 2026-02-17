const mongoose = require('mongoose');

const committeeMessageSchema = new mongoose.Schema({
  committeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Committee',
    required: [true, 'Committee ID is required']
  },
  committeeName: {
    type: String,
    required: [true, 'Committee name is required']
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  status: {
    type: String,
    enum: ['new', 'read', 'responded', 'spam'],
    default: 'new'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  response: {
    message: String,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    respondedAt: Date
  },
  ipAddress: String,
  userAgent: String,
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for performance
committeeMessageSchema.index({ committeeId: 1 });
committeeMessageSchema.index({ status: 1 });
committeeMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CommitteeMessage', committeeMessageSchema);
