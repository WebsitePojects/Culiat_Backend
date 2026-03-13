const express = require('express');
const router = express.Router();
const {
  getAchievements,
  getAchievement,
  createAchievement,
  updateAchievement,
  deleteAchievement
} = require('../controllers/achievementController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/fileUpload');
const ROLES = require('../config/roles');

router.get('/', getAchievements);
router.get('/:id', getAchievement);

// Support multiple image uploads (up to 15 images)
router.post('/', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), upload.array('achievementImages', 15), createAchievement);
router.put('/:id', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), upload.array('achievementImages', 15), updateAchievement);
router.delete('/:id', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin), deleteAchievement);

module.exports = router;
