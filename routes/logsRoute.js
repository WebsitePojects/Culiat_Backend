const express = require('express');
const router = express.Router();
const {
  getAllLogs,
  exportLogs,
  createLog,
  getLogById,
  deleteLog,
} = require('../controllers/logsController');

const { protect, authorize } = require('../middleware/auth');
const ROLES = require('../config/roles');

// SuperAdmin, SystemAdmin, and Admin can view logs
router.get('/', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), getAllLogs);

// Export - SuperAdmin and SystemAdmin only (sensitive bulk data)
router.get('/export', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), exportLogs);

// Create log entry
router.post('/', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), createLog);

// Get single log
router.get('/:id', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), getLogById);

// Delete log - SuperAdmin and SystemAdmin only
router.delete('/:id', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), deleteLog);

module.exports = router;
