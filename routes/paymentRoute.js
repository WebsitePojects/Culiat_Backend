const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');
const ROLES = require('../config/roles');

// Webhook endpoint (public - comes from PayMongo)
router.post('/webhook', paymentController.webhook);

// Protected routes - require authentication
router.use(protect);

// Get payment details for a request
router.get('/details/:requestId', paymentController.getPaymentDetails);

// Create a payment link
router.post('/create-link', paymentController.createPaymentLink);

// Verify payment status
router.get('/verify/:requestId', paymentController.verifyPayment);

// Admin-only routes
// Manually confirm payment (for walk-in payments)
router.post('/confirm/:requestId', authorize(ROLES.SuperAdmin, ROLES.Admin), paymentController.confirmPayment);

// Waive payment fee
router.post('/waive/:requestId', authorize(ROLES.SuperAdmin, ROLES.Admin), paymentController.waivePayment);

module.exports = router;
