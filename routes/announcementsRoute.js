const express = require('express');
const router = express.Router();
const {
  createAnnouncement,
  getAllAnnouncements,
  getPublishedAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  togglePublish,
  toggleArchive,
  deleteAnnouncement,
} = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/fileUpload');
const ROLES = require('../config/roles');

// Upload middleware for announcement images (max 6 images)
const announcementImageUpload = upload.array('images', 6);

// Admin routes (must come BEFORE /:id routes to avoid conflicts)
router.get('/admin/all', protect, authorize(ROLES.SuperAdmin, ROLES.Admin), getAllAnnouncements);
router.post('/', protect, authorize(ROLES.SuperAdmin, ROLES.Admin), announcementImageUpload, createAnnouncement);

// Public routes
router.get('/', getPublishedAnnouncements);
router.get('/:id', getAnnouncement);

// Protected routes with :id parameter
router.put('/:id', protect, authorize(ROLES.Admin, ROLES.SuperAdmin), announcementImageUpload, updateAnnouncement);
router.put('/:id/publish', protect, authorize(ROLES.SuperAdmin, ROLES.Admin), togglePublish);
router.put('/:id/archive', protect, authorize(ROLES.SuperAdmin, ROLES.Admin), toggleArchive);
router.delete('/:id', protect, authorize(ROLES.SuperAdmin, ROLES.Admin), deleteAnnouncement);

module.exports = router;
