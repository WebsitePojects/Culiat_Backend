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

// Upload middleware for report media (max 5 images + 1 video)
const reportMediaUpload = upload.fields([
  { name: 'reportImages', maxCount: 5 },
  { name: 'reportVideo', maxCount: 1 },
]);

// Anonymous report route - NO authentication required
router.post('/anonymous', reportMediaUpload, createAnonymousReport);

router.post('/', protect, reportMediaUpload, createReport); // Protected - authenticated users can report
router.get('/', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), getAllReports);
router.get('/my-reports', protect, getMyReports);
router.get('/:id', protect, getReport); // Protected - authenticated users can view
router.put('/:id/status', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), updateReportStatus);
router.post('/:id/comments', protect, addComment);
router.delete('/:id', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), deleteReport);

module.exports = router;
