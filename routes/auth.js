const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  adminRegister,
  residentRegister,
  getPendingRegistrations,
  approveRegistration,
  rejectRegistration,
  getAllUsers,
  createUser,
  updateUserById,
  deleteUserById,
  bulkUpdateUsers,
  bulkDeleteUsers,
  adminResetPassword,
  checkUsernameAvailability,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { protect, authorize } = require("../middleware/auth");
const ROLES = require("../config/roles");
const { upload } = require("../middleware/fileUpload");
const { rateLimiters } = require("../middleware/securityMiddleware");

// Multer error handler wrapper
const handleMulterUpload = (req, res, next) => {
  const uploadMiddleware = upload.fields([
    { name: "validID", maxCount: 1 },
    { name: "backOfValidID", maxCount: 1 },
    { name: "primaryID1", maxCount: 1 },
    { name: "primaryID1Back", maxCount: 1 },
    { name: "primaryID2", maxCount: 1 },
    { name: "primaryID2Back", maxCount: 1 },
    { name: "birthCertificateDoc", maxCount: 1 }
  ]);
  
  uploadMiddleware(req, res, (err) => {
    if (err) {
      console.error('❌ Multer error:', err.message);
      console.error('❌ Multer error field:', err.field);
      return res.status(400).json({
        success: false,
        message: `File upload error: ${err.message}`,
        field: err.field
      });
    }
    next();
  });
};

router.post(
  "/register",
  rateLimiters.registration,  // Strict rate limiting for registration
  handleMulterUpload,
  register
);
router.post(
  "/resident-register",
  rateLimiters.registration,  // Strict rate limiting for registration
  upload.single("proofOfResidency"),
  residentRegister
);
router.post("/login", rateLimiters.auth, login);  // Rate limiting for resident login
router.post("/admin-login", rateLimiters.adminAuth, login);  // Strict rate limiting (3 attempts) for admin login
router.post("/forgotpassword", rateLimiters.passwordReset, forgotPassword);  // Rate limit password reset
router.put("/resetpassword/:resetToken", rateLimiters.passwordReset, resetPassword);
router.post("/adminRegister", protect, authorize(ROLES.SystemAdmin), rateLimiters.adminAuth, adminRegister);
router.get("/me", protect, getMe);
router.put("/profile", protect, rateLimiters.general, updateProfile);
router.put("/change-password", protect, rateLimiters.auth, changePassword);

// Admin routes for managing users
router.get(
  "/users",
  protect,
  authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
  rateLimiters.general,
  getAllUsers
);
router.get(
  "/check-username/:username",
  protect,
  authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
  rateLimiters.general,
  checkUsernameAvailability
);
router.post(
  "/users",
  protect,
  authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
  rateLimiters.general,
  createUser
);
router.patch(
  "/users/bulk-update",
  protect,
  authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
  rateLimiters.general,
  bulkUpdateUsers
);
router.delete(
  "/users/bulk-delete",
  protect,
  authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
  rateLimiters.general,
  bulkDeleteUsers
);
router.put(
  "/users/:userId",
  protect,
  authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
  rateLimiters.general,
  updateUserById
);
router.delete(
  "/users/:userId",
  protect,
  authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
  rateLimiters.general,
  deleteUserById
);
router.put(
  "/users/:userId/reset-password",
  protect,
  authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
  rateLimiters.general,
  adminResetPassword
);
router.get(
  "/pending-registrations",
  protect,
  authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
  getPendingRegistrations
);
router.post(
  "/approve-registration/:userId",
  protect,
  authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
  rateLimiters.general,
  approveRegistration
);
router.post(
  "/reject-registration/:userId",
  protect,
  authorize(ROLES.SystemAdmin, ROLES.SuperAdmin),
  rateLimiters.general,
  rejectRegistration
);

module.exports = router;
