const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
  officials: 'uploads/officials',
  barangay: 'uploads/barangay',
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
    default:
      return 'proofs';
  }
};


// Dynamic import for multer-storage-cloudinary (ESM-only)
async function getCloudinaryStorage(fieldname) {
  const { CloudinaryStorage } = await import('multer-storage-cloudinary');
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const folder = getFolderForField(file.fieldname);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const field = file.fieldname || 'file';
      return {
        folder: `culiat-barangay/${folder}`,
        format: ['jpg', 'jpeg', 'png'],
        transformation: [{ quality: 'auto' }],
        public_id: `${field}-${uniqueSuffix}`
      };
    }
  });
}

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


// Export an async function to get the upload middleware
async function getUploadMiddleware() {
  let storage;
  if (isCloudinaryConfigured()) {
    storage = await getCloudinaryStorage();
    console.log('📁 Using Cloudinary for file storage');
  } else {
    storage = diskStorage;
    console.log('📁 Using local disk storage (Cloudinary not configured)');
  }
  return multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: fileFilter
  });
}

module.exports = { getUploadMiddleware };
