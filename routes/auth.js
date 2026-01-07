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
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const { protect, authorize } = require("../middleware/auth");
const ROLES = require("../config/roles");
const { upload } = require("../middleware/fileUpload");

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
  handleMulterUpload,
  register
);
router.post(
  "/resident-register",
  upload.single("proofOfResidency"),
  residentRegister
);
router.post("/login", login);
router.post("/forgotpassword", forgotPassword);
router.put("/resetpassword/:resetToken", resetPassword);
router.post("/adminRegister", adminRegister);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

// Admin routes for managing users
router.get(
  "/users",
  protect,
  authorize(ROLES.SuperAdmin, ROLES.Admin),
  getAllUsers
);
router.post(
  "/users",
  protect,
  authorize(ROLES.SuperAdmin, ROLES.Admin),
  createUser
);
router.put(
  "/users/:userId",
  protect,
  authorize(ROLES.SuperAdmin, ROLES.Admin),
  updateUserById
);
router.delete(
  "/users/:userId",
  protect,
  authorize(ROLES.SuperAdmin, ROLES.Admin),
  deleteUserById
);
router.get(
  "/pending-registrations",
  protect,
  authorize(ROLES.SuperAdmin, ROLES.Admin),
  getPendingRegistrations
);
router.post(
  "/approve-registration/:userId",
  protect,
  authorize(ROLES.SuperAdmin, ROLES.Admin),
  approveRegistration
);
router.post(
  "/reject-registration/:userId",
  protect,
  authorize(ROLES.SuperAdmin, ROLES.Admin),
  rejectRegistration
);

module.exports = router;
