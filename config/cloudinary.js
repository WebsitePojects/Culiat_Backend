const cloudinary = require('cloudinary').v2;
const MulterStorageCloudinary = require('multer-storage-cloudinary');
const CloudinaryStorage = MulterStorageCloudinary.CloudinaryStorage;

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Create storage configurations for different upload types

const createCloudinaryStorage = (folder) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
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
};

// Pre-configured storages for different upload directories
const storages = {
  proofs: createCloudinaryStorage('proofs'),
  validIDs: createCloudinaryStorage('validIDs'),
  documents: createCloudinaryStorage('documents'),
  photos: createCloudinaryStorage('photos'),
  achievements: createCloudinaryStorage('achievements')
};

// Helper function to delete an image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return null;
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

// Helper function to extract public_id from Cloudinary URL
const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  try {
    // Cloudinary URLs format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{format}
    const urlParts = url.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    if (uploadIndex === -1) return null;
    
    // Get everything after 'upload/v{version}/' and remove the file extension
    const publicIdParts = urlParts.slice(uploadIndex + 2);
    const publicIdWithExtension = publicIdParts.join('/');
    const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, ''); // Remove extension
    return publicId;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
};

module.exports = {
  cloudinary,
  storages,
  createCloudinaryStorage,
  deleteFromCloudinary,
  getPublicIdFromUrl
};
