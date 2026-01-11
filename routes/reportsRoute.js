const express = require('express');
const router = express.Router();
const {
  createReport,
  createAnonymousReport,
  getAllReports,
  getMyReports,
  getReport,
  updateReportStatus,
  addComment,
  deleteReport,
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');
const ROLES = require('../config/roles');
const { upload } = require('../middleware/fileUpload');

// Upload middleware for report images (max 5 images)
const reportImageUpload = upload.array('reportImages', 5);

// Anonymous report route - NO authentication required
router.post('/anonymous', reportImageUpload, createAnonymousReport);

router.post('/', protect, reportImageUpload, createReport); // Protected - authenticated users can report
router.get('/', protect, authorize(ROLES.SuperAdmin, ROLES.Admin), getAllReports);
router.get('/my-reports', protect, getMyReports);
router.get('/:id', protect, getReport); // Protected - authenticated users can view
router.put('/:id/status', protect, authorize(ROLES.SuperAdmin, ROLES.Admin), updateReportStatus);
router.post('/:id/comments', protect, addComment);
router.delete('/:id', protect, authorize(ROLES.SuperAdmin, ROLES.Admin), deleteReport);

module.exports = router;
