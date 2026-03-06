const mongoose = require('mongoose');

const BRANCH_ENUM = [
  'Executive',
  'Legislative',
  'Administrative',
  'Lupong Tagapamayapa',
  'SK Council',
  'Barangay Public Safety Officers (BPSO)',
  'Other',
];

const officialSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
  },
  middleName: {
    type: String,
    trim: true,
  },
  position: {
    type: String,
    required: [true, 'Position is required'],
    enum: [
      'barangay_captain',
      'barangay_kagawad',
      'sk_chairman',
      'barangay_secretary',
      'barangay_treasurer',
      'administrative_officer',
      'admin_officer_internal',
      'admin_officer_external',
      'executive_officer',
      'deputy_officer',
      'other'
    ],
  },
  committee: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  contactNumber: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
  },
  photo: {
    type: String,
    trim: true,
    default: null,
  },
  bio: {
    type: String,
    trim: true,
  },
  branch: {
    type: String,
    enum: BRANCH_ENUM,
    default: 'Legislative',
  },
  branches: [{
    type: String,
    enum: BRANCH_ENUM,
  }],
  committeeRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Committee',
  },
  committeeRole: {
    type: String,
    enum: ['chairperson', 'co_chairperson', 'coordinator', 'member', ''],
    default: '',
  },
  committeeAssignments: [{
    committeeRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Committee',
      required: true,
    },
    committeeRole: {
      type: String,
      enum: ['chairperson', 'co_chairperson', 'coordinator', 'member', ''],
      default: '',
    },
  }],
  officeHours: {
    type: String,
    trim: true,
  },
  education: {
    type: String,
    trim: true,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Official', officialSchema);
