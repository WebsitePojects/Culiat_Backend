const mongoose = require('mongoose');

const committeeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Committee name is required'],
    trim: true,
  },
  nameEnglish: {
    type: String,
    trim: true,
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
  },
  description: {
    type: String,
    trim: true,
  },
  description2: {
    type: String,
    trim: true,
  },
  responsibilities: [{
    type: String,
    trim: true,
  }],
  chairperson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Official',
  },
  coChairperson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Official',
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Official',
  }],
  accomplishments: [{
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    images: [{ type: String }],
    date: { type: Date },
  }],
  displayOrder: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Auto-generate slug from name before saving
committeeSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  next();
});

module.exports = mongoose.model('Committee', committeeSchema);
