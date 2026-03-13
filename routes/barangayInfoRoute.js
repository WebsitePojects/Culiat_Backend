const express = require('express');
const router = express.Router();
const {
  getBarangayInfo,
  createBarangayInfo,
  updateBarangayInfo,
  updateDemographics,
  updateContactInfo,
  updateAddress,
  updateSocialMedia,
  deleteBarangayInfo,
} = require('../controllers/barangayInfoController');
const { protect, authorize } = require('../middleware/auth');
const ROLES = require('../config/roles');

// Public routes
router.get('/', getBarangayInfo);

// Admin routes
router.post('/', protect, authorize(ROLES.SystemAdmin), createBarangayInfo);
router.put('/', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), updateBarangayInfo);
router.put('/demographics', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), updateDemographics);
router.put('/contact', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), updateContactInfo);
router.put('/address', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), updateAddress);
router.put('/social-media', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), updateSocialMedia);
router.delete('/', protect, authorize(ROLES.SystemAdmin), deleteBarangayInfo);

module.exports = router;
