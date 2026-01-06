const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');

// Check if Cloudinary is configured
const isCloudinaryConfigured = () => {
  return cloudinary && 
         process.env.CLOUDINARY_CLOUD_NAME && 
         process.env.CLOUDINARY_API_KEY && 
         process.env.CLOUDINARY_API_SECRET;
};

// Local upload directories (fallback when Cloudinary is not configured)
const uploadDirs = {
  proofs: 'uploads/proofs',
  validIDs: 'uploads/validIDs',
  documents: 'uploads/documents',
  photos: 'uploads/photos',
  achievements: 'uploads/achievements',
  officials: 'uploads/officials',
  barangay: 'uploads/barangay',
  reports: 'uploads/reports',
  announcements: 'uploads/announcements',
};

// Create local directories if they don't exist (for fallback)
Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Get folder name based on field name
const getFolderForField = (fieldname) => {
  switch (fieldname) {
    case 'validID':
    case 'backOfValidID':
    case 'primaryID1':
    case 'primaryID1Back':
    case 'primaryID2':
    case 'primaryID2Back':
      return 'validIDs';
    case 'photo1x1':
      return 'photos';
    case 'supportingDocuments':
      return 'documents';
    case 'proofOfResidency':
      return 'proofs';
    case 'achievementImage':
      return 'achievements';
    case 'birthCertificateDoc':
      return 'documents';
    case 'officialPhoto':
      return 'officials';
    case 'logo':
    case 'coverPhoto':
      return 'barangay';
    case 'reportImages':
      return 'reports';
    case 'announcementImage':
    case 'image':
      return 'announcements';
    default:
      return 'proofs';
  }
};

// Configure Cloudinary storage
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const folder = getFolderForField(file.fieldname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const field = file.fieldname || 'file';
    
    // Handle PDF files differently - don't force format conversion
    const isPDF = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf';
    
    return {
      folder: `culiat-barangay/${folder}`,
      // Don't set format for PDFs, let Cloudinary handle it
      ...(isPDF ? { resource_type: 'raw' } : { format: 'jpg', transformation: [{ quality: 'auto' }] }),
      public_id: `${field}-${uniqueSuffix}`
    };
  }
});

// Local disk storage configuration (fallback)
const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folder = getFolderForField(file.fieldname);
    cb(null, uploadDirs[folder] || uploadDirs.proofs);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const prefix = file.fieldname || 'file';
    cb(null, prefix + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter to accept images and PDFs (for birth certificate documents)
const fileFilter = (req, file, cb) => {
  // Allow PDFs only for birth certificate documents
  if (file.fieldname === 'birthCertificateDoc') {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype === 'application/pdf' || /jpeg|jpg|png/.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG, and PDF files are allowed for birth certificate'));
    }
  } else {
    // For ID documents, only allow images
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, and PNG files are allowed'));
    }
  }
};

// Choose storage based on environment configuration
let storage;
try {
  storage = isCloudinaryConfigured() ? cloudinaryStorage : diskStorage;
} catch (error) {
  console.log('📁 Cloudinary initialization failed, using local disk storage');
  storage = diskStorage;
}

// Log which storage is being used
if (isCloudinaryConfigured()) {
  console.log('📁 Using Cloudinary for file storage');
} else {
  console.log('📁 Using local disk storage (Cloudinary not configured)');
}

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

module.exports = { upload };
