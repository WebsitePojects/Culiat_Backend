const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getHashtags,
  getAllHashtagsAdmin,
  createHashtag,
  updateHashtag,
  deleteHashtag,
  incrementUsage,
  seedDefaultHashtags,
} = require('../controllers/hashtagController');

// Public routes
router.get('/', getHashtags);

// Admin routes
router.get('/admin/all', protect, authorize('Admin', 'SuperAdmin'), getAllHashtagsAdmin);
router.post('/', protect, authorize('Admin', 'SuperAdmin'), createHashtag);
router.post('/seed', protect, authorize('Admin', 'SuperAdmin'), seedDefaultHashtags);
router.post('/increment-usage', protect, authorize('Admin', 'SuperAdmin'), incrementUsage);
router.put('/:id', protect, authorize('Admin', 'SuperAdmin'), updateHashtag);
router.delete('/:id', protect, authorize('Admin', 'SuperAdmin'), deleteHashtag);

module.exports = router;
