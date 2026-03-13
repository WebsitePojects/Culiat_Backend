const express = require('express');
const router = express.Router();
const {
  createDocumentRequest,
  getAllDocumentRequests,
  getMyRequests,
  getDocumentRequest,
  updateDocumentRequest,
  updateRequestStatus,
  deleteDocumentRequest,
  getDocumentHistory,
  getDocumentStats,
  getDocumentPayments,
} = require('../controllers/documentRequestController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/fileUpload');
const ROLES = require('../config/roles');
const { rateLimiters } = require('../middleware/securityMiddleware');

// Admin-only routes (stats and history first to avoid conflict with :id)
router.get('/history', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), getDocumentHistory);
router.get('/stats', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), getDocumentStats);
router.get('/payments', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), getDocumentPayments);

router.post('/', protect, rateLimiters.upload, upload.fields([
  { name: 'photo1x1', maxCount: 1 },
  { name: 'validID', maxCount: 1 }
]), createDocumentRequest);
router.get('/', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), getAllDocumentRequests);
router.get('/my-requests', protect, getMyRequests);
router.get('/:id', protect, getDocumentRequest);
router.put('/:id', protect, updateDocumentRequest);
router.put('/:id/status', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), rateLimiters.general, updateRequestStatus);
router.patch('/:id/status', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), rateLimiters.general, updateRequestStatus);
router.delete('/:id', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), deleteDocumentRequest);

module.exports = router;
