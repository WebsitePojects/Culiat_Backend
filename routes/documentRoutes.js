const express = require('express');
const router = express.Router();
const {
  generateDocumentFile,
  downloadDocument,
  getDocumentStatus,
  getDocumentPreview,
  getTemplates,
} = require('../controllers/documentController');
const {
  exportDocumentHistory,
  exportDocumentPayments,
} = require('../controllers/documentRequestController');
const { protect } = require('../middleware/auth');
const staffOrAdmin = require('../middleware/staffOrAdmin');

// Public route - get available templates
router.get('/templates', getTemplates);

// Protected routes - require authentication
router.use(protect);

// Get document status (any authenticated user)
router.get('/status/:requestId', getDocumentStatus);

// Export routes (admin/staff only) - MUST be before dynamic routes
router.get('/history/export', staffOrAdmin, exportDocumentHistory);
router.get('/payments/export', staffOrAdmin, exportDocumentPayments);

// Get document preview data (admin/staff only)
router.get('/preview/:requestId', staffOrAdmin, getDocumentPreview);

// Download document (owner or admin, after payment)
router.get('/download/:requestId', downloadDocument);

// Admin-only routes
// Generate document for a service request
router.post('/generate/:requestId', staffOrAdmin, generateDocumentFile);

module.exports = router;
