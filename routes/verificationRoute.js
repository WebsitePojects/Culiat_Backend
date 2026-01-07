/**
 * Document Verification Routes
 * PUBLIC routes for verifying documents via QR code
 * No authentication required
 */

const express = require('express');
const router = express.Router();
const {
  verifyDocument,
  verifyByControlNumber,
  checkVerificationStatus
} = require('../controllers/verificationController');

/**
 * @route   GET /api/verify/:token
 * @desc    Verify a document by its QR code token
 * @access  Public (No authentication required)
 */
router.get('/:token', verifyDocument);

/**
 * @route   GET /api/verify/control/:controlNumber
 * @desc    Verify a document by its control number
 * @access  Public (No authentication required)
 */
router.get('/control/:controlNumber', verifyByControlNumber);

/**
 * @route   GET /api/verify/status/:token
 * @desc    Quick check if a verification token exists and is valid
 * @access  Public (No authentication required)
 */
router.get('/status/:token', checkVerificationStatus);

module.exports = router;
