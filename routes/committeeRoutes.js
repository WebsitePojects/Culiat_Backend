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
router.post('/', protect, authorize(ROLES.SuperAdmin, ROLES.Admin), createCommittee);
router.put('/:id', protect, authorize(ROLES.SuperAdmin, ROLES.Admin), updateCommittee);
router.delete('/:id', protect, authorize(ROLES.SuperAdmin, ROLES.Admin), deleteCommittee);

module.exports = router;
