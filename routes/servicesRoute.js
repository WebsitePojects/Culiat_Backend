const express = require('express');
const router = express.Router();
const {
  getAllServices,
  getActiveServices,
  getServicesByCategory,
  getService,
  createService,
  updateService,
  toggleActive,
  reorderServices,
  deleteService,
  getServicesStats,
} = require('../controllers/serviceController');
const { protect, authorize } = require('../middleware/auth');
const ROLES = require('../config/roles');

const adminOnly = [protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin)];

// Admin-only routes (secured)
router.get('/', ...adminOnly, getAllServices);
router.get('/active', ...adminOnly, getActiveServices);
router.get('/category/:category', ...adminOnly, getServicesByCategory);
router.get('/stats/all', ...adminOnly, getServicesStats);
router.get('/:id', ...adminOnly, getService);

// Admin routes
router.post('/', ...adminOnly, createService);
router.put('/reorder', ...adminOnly, reorderServices);
router.put('/:id', ...adminOnly, updateService);
router.put('/:id/toggle-active', ...adminOnly, toggleActive);
router.delete('/:id', ...adminOnly, deleteService);

module.exports = router;
