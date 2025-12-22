const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CloudinaryStorage } = require('multer-storage-cloudinary').default;
const { cloudinary } = require('../config/cloudinary');

// Check if Cloudinary is configured
const isCloudinaryConfigured = () => {
  return process.env.CLOUDINARY_CLOUD_NAME && 
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
    default:
      return 'proofs';
  }
};

// Cloudinary storage configuration (v2.x API)
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const folder = getFolderForField(file.fieldname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fieldname = file.fieldname || 'file';
    return {
      folder: `culiat-barangay/${folder}`,
      format: ['jpg', 'jpeg', 'png'],
      transformation: [{ quality: 'auto' }],
      public_id: `${fieldname}-${uniqueSuffix}`
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

// File filter to accept only images (JPG, JPEG, PNG only for strict validation)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPG, JPEG, and PNG files are allowed'));
  }
};

// Choose storage based on environment configuration
const storage = isCloudinaryConfigured() ? cloudinaryStorage : diskStorage;

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

module.exports = upload;
