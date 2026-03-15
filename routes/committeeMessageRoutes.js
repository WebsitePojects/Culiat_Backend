const express = require('express');
const router = express.Router();
const {
  submitMessage,
  getMessages,
  getMessageStats,
  getMessage,
  getGuestMessage,
  updateStatus,
  respondToMessage,
  deleteMessage
} = require('../controllers/committeeMessageController');
const { protect, authorize } = require('../middleware/auth');

// Public route to submit a message
// Optional: Use protect middleware but make it optional if we want to allow guest messages
// For now, let's keep it public but check for req.user in controller if available
router.post('/', submitMessage);
router.get('/guest/:id', getGuestMessage); // Guest can view their message + response

// Protected routes (Admin only)
router.use(protect);
router.use(authorize('SystemAdmin', 'SuperAdmin', 'Admin'));

router.get('/', getMessages);
router.get('/stats', getMessageStats);
router.get('/:id', getMessage);
router.put('/:id/status', updateStatus);
router.post('/:id/response', respondToMessage);
router.delete('/:id', deleteMessage);

module.exports = router;
