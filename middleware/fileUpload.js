const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
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

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const folder = getFolderForField(file.fieldname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const field = file.fieldname || 'file';
    return {
      folder: `culiat-barangay/${folder}`,
      format: 'jpg',
      transformation: [{ quality: 'auto' }],
      public_id: `${field}-${uniqueSuffix}`
    };
  }
});

const upload = multer({ storage });

module.exports = upload;
