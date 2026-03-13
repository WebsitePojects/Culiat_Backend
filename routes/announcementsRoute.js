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

// Upload middleware for announcement images (max 15 images)
const announcementImageUpload = upload.array('images', 15);

// Admin routes (must come BEFORE /:id routes to avoid conflicts)
router.get('/admin/all', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), getAllAnnouncements);
router.post('/', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), announcementImageUpload, createAnnouncement);

// Public routes
router.get('/', getPublishedAnnouncements);
router.get('/:id', getAnnouncement);

// Protected routes with :id parameter
router.put('/:id', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), announcementImageUpload, updateAnnouncement);
router.put('/:id/publish', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), togglePublish);
router.put('/:id/archive', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), toggleArchive);
router.delete('/:id', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), deleteAnnouncement);

module.exports = router;
