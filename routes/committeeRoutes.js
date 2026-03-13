const express = require('express');
const router = express.Router();
const {
  getCommittees,
  getCommitteeBySlug,
  createCommittee,
  updateCommittee,
  deleteCommittee,
  getCommitteeAccomplishments,
} = require('../controllers/committeeController');
const { protect, authorize } = require('../middleware/auth');
const ROLES = require('../config/roles');

// Public routes
router.get('/', getCommittees);
router.get('/:slug', getCommitteeBySlug);
router.get('/:id/accomplishments', getCommitteeAccomplishments);

// Protected routes (Admin/SuperAdmin only)
router.post('/', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), createCommittee);
router.put('/:id', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), updateCommittee);
router.delete('/:id', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), deleteCommittee);

module.exports = router;
