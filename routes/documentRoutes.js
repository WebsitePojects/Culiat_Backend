const express = require('express');
const router = express.Router();
const {
  generateDocumentFile,
  downloadDocument,
  getDocumentStatus,
  getTemplates,
} = require('../controllers/documentController');
const { protect } = require('../middleware/auth');
const staffOrAdmin = require('../middleware/staffOrAdmin');

// Public route - get available templates
router.get('/templates', getTemplates);

// Protected routes - require authentication
router.use(protect);

// Get document status (any authenticated user)
router.get('/status/:requestId', getDocumentStatus);

// Download document (owner or admin, after payment)
router.get('/download/:requestId', downloadDocument);

// Admin-only routes
// Generate document for a service request
router.post('/generate/:requestId', staffOrAdmin, generateDocumentFile);

module.exports = router;
