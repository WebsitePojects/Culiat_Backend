const express = require('express');
const router = express.Router();
const {
  getAllOfficials,
  getActiveOfficials,
  getOfficialsByPosition,
  getOfficial,
  createOfficial,
  updateOfficial,
  toggleActive,
  reorderOfficials,
  deleteOfficial,
  getOfficialsStats,
  getPersonnel,
} = require('../controllers/officialController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/fileUpload');
const ROLES = require('../config/roles');

// Public routes
router.get('/', getAllOfficials);
router.get('/active', getActiveOfficials);
router.get('/position/:position', getOfficialsByPosition);
router.get('/personnel', getPersonnel);
router.get('/:id', getOfficial);

// Admin routes - with file upload support
router.post('/', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), upload.single('officialPhoto'), createOfficial);
router.put('/reorder', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), reorderOfficials);
router.put('/:id', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), upload.single('officialPhoto'), updateOfficial);
router.put('/:id/toggle-active', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), toggleActive);
router.delete('/:id', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), deleteOfficial);
router.get('/stats/all', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), getOfficialsStats);

module.exports = router;
