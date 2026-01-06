const User = require("../models/User");
const ProfileUpdate = require("../models/ProfileUpdate");
const { sendProfileUpdateNotification, sendProfileUpdateApprovalEmail, sendProfileUpdateRejectionEmail } = require("../utils/emailService");

/**
 * Helper function to get nested value from object using dot notation
 */
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

/**
 * Helper function to set nested value in object using dot notation
 */
const setNestedValue = (obj, path, value) => {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
};

/**
 * Helper function to compare two values and detect changes
 */
const findChangedFields = (oldData, newData, parentPath = '') => {
  const changes = [];
  
  const compare = (oldObj, newObj, path) => {
    if (newObj === null || newObj === undefined) return;
    
    if (typeof newObj !== 'object' || newObj instanceof Date) {
      // Compare primitive values or dates
      const oldVal = oldObj;
      const newVal = newObj;
      
      // Convert dates to ISO strings for comparison
      const oldCompare = oldVal instanceof Date ? oldVal.toISOString() : oldVal;
      const newCompare = newVal instanceof Date ? newVal.toISOString() : newVal;
      
      if (oldCompare !== newCompare) {
        changes.push({
          fieldName: path.split('.').pop(),
          fieldPath: path,
          oldValue: oldVal,
          newValue: newVal,
        });
      }
    } else if (Array.isArray(newObj)) {
      // Handle arrays
      if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
        changes.push({
          fieldName: path.split('.').pop(),
          fieldPath: path,
          oldValue: oldObj,
          newValue: newObj,
        });
      }
    } else {
      // Recurse into nested objects
      for (const key of Object.keys(newObj)) {
        const newPath = path ? `${path}.${key}` : key;
        compare(oldObj?.[key], newObj[key], newPath);
      }
    }
  };
  
  compare(oldData, newData, parentPath);
  return changes;
};

/**
 * @desc    Get current user's complete profile data
 * @route   GET /api/profile-update/my-profile
 * @access  Private (Resident)
 */
exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
      error: error.message,
    });
  }
};

/**
 * @desc    Submit profile update request
 * @route   POST /api/profile-update/submit
 * @access  Private (Resident)
 */
exports.submitProfileUpdate = async (req, res) => {
  try {
    let { updateType, updateData, updateReason } = req.body;
    
    // Handle form data - build updateData from form fields
    if (!updateData) {
      updateData = {};
      
      for (const [key, value] of Object.entries(req.body)) {
        if (key !== 'updateType' && key !== 'updateReason' && value) {
          // Handle nested keys (dot notation like 'address.street')
          setNestedValue(updateData, key, value);
        }
      }
      
      // Wrap in appropriate container based on update type
      if (updateType === 'birth_certificate' && !updateData.birthCertificate) {
        updateData = { birthCertificate: updateData };
      }
    }
    
    if (!updateType || !updateData) {
      return res.status(400).json({
        success: false,
        message: "Update type and data are required",
      });
    }
    
    // Get current user data
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    
    // Check for pending update of same type
    const pendingUpdate = await ProfileUpdate.findOne({
      user: req.user._id,
      updateType,
      status: 'pending',
    });
    
    if (pendingUpdate) {
      return res.status(400).json({
        success: false,
        message: `You already have a pending ${updateType.replace('_', ' ')} update request. Please wait for admin review.`,
      });
    }
    
    // Prepare old data snapshot based on update type
    let oldData = {};
    
    switch (updateType) {
      case 'personal_info':
        oldData = {
          firstName: user.firstName,
          lastName: user.lastName,
          middleName: user.middleName,
          suffix: user.suffix,
          dateOfBirth: user.dateOfBirth,
          placeOfBirth: user.placeOfBirth,
          gender: user.gender,
          civilStatus: user.civilStatus,
          nationality: user.nationality,
          religion: user.religion,
          occupation: user.occupation,
        };
        break;
        
      case 'birth_certificate':
        oldData = {
          birthCertificate: user.birthCertificate || {},
        };
        break;
        
      case 'contact_info':
      case 'account_info': // Alias for contact_info
        oldData = {
          email: user.email,
          phoneNumber: user.phoneNumber,
        };
        break;
        
      case 'address':
        oldData = {
          address: user.address || {},
        };
        break;
        
      case 'emergency_contact':
        oldData = {
          emergencyContact: user.emergencyContact || {},
        };
        break;
        
      case 'spouse_info':
        oldData = {
          spouseInfo: user.spouseInfo || {},
        };
        break;
      
      case 'additional_info':
        oldData = {
          tinNumber: user.tinNumber,
          sssGsisNumber: user.sssGsisNumber,
          precinctNumber: user.precinctNumber,
        };
        break;
        
      case 'full_profile':
        oldData = {
          firstName: user.firstName,
          lastName: user.lastName,
          middleName: user.middleName,
          suffix: user.suffix,
          dateOfBirth: user.dateOfBirth,
          placeOfBirth: user.placeOfBirth,
          gender: user.gender,
          civilStatus: user.civilStatus,
          nationality: user.nationality,
          religion: user.religion,
          occupation: user.occupation,
          email: user.email,
          phoneNumber: user.phoneNumber,
          address: user.address || {},
          birthCertificate: user.birthCertificate || {},
          emergencyContact: user.emergencyContact || {},
          spouseInfo: user.spouseInfo || {},
          tinNumber: user.tinNumber,
          sssGsisNumber: user.sssGsisNumber,
          precinctNumber: user.precinctNumber,
          heightWeight: user.heightWeight,
          colorOfHairEyes: user.colorOfHairEyes,
        };
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid update type",
        });
    }
    
    // Find changed fields
    const changedFields = findChangedFields(oldData, updateData);
    
    // Handle file uploads if any
    const documents = [];
    if (req.files) {
      // Handle multer.fields() which returns an object with arrays
      for (const [fieldName, files] of Object.entries(req.files)) {
        if (Array.isArray(files)) {
          for (const file of files) {
            documents.push({
              fieldName,
              url: file.path || file.location,
              filename: file.filename,
              originalName: file.originalname,
              uploadedAt: new Date(),
            });
          }
        }
      }
    }
    // Handle single file upload (e.g., from multer.single())
    if (req.file) {
      documents.push({
        fieldName: req.file.fieldname,
        url: req.file.path || req.file.location,
        filename: req.file.filename,
        originalName: req.file.originalname,
        uploadedAt: new Date(),
      });
    }
    
    // Parse verification config if provided
    let verificationConfig = null;
    if (req.body.verificationConfig) {
      try {
        verificationConfig = JSON.parse(req.body.verificationConfig);
      } catch (e) {
        console.error('Failed to parse verificationConfig:', e);
      }
    }
    
    // Create profile update request
    const profileUpdate = await ProfileUpdate.create({
      user: req.user._id,
      updateType,
      oldData,
      newData: updateData,
      changedFields,
      documents,
      updateReason,
      verificationConfig, // Store verification requirements for admin reference
    });
    
    // Send notification email to admins (optional)
    try {
      // You can implement admin notification here
    } catch (emailError) {
      console.error("Failed to send admin notification:", emailError);
    }
    
    res.status(201).json({
      success: true,
      message: "Profile update request submitted successfully. Please wait for admin review.",
      data: {
        _id: profileUpdate._id,
        updateType: profileUpdate.updateType,
        status: profileUpdate.status,
        changedFieldsCount: changedFields.length,
        createdAt: profileUpdate.createdAt,
      },
    });
  } catch (error) {
    console.error("Error submitting profile update:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting profile update",
      error: error.message,
    });
  }
};

/**
 * @desc    Get user's profile update history
 * @route   GET /api/profile-update/my-updates
 * @access  Private (Resident)
 */
exports.getMyUpdateHistory = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { user: req.user._id };
    if (status) query.status = status;
    
    const updates = await ProfileUpdate.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('reviewedBy', 'firstName lastName');
    
    const total = await ProfileUpdate.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: updates,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching update history:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching update history",
      error: error.message,
    });
  }
};

/**
 * @desc    Cancel pending profile update
 * @route   DELETE /api/profile-update/cancel/:id
 * @access  Private (Resident)
 */
exports.cancelProfileUpdate = async (req, res) => {
  try {
    const update = await ProfileUpdate.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: 'pending',
    });
    
    if (!update) {
      return res.status(404).json({
        success: false,
        message: "Pending update request not found",
      });
    }
    
    await ProfileUpdate.deleteOne({ _id: update._id });
    
    res.status(200).json({
      success: true,
      message: "Profile update request cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling profile update:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling profile update",
      error: error.message,
    });
  }
};

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * @desc    Get all profile update requests (Admin)
 * @route   GET /api/profile-update/admin/all
 * @access  Private (Admin/SuperAdmin)
 */
exports.getAllProfileUpdates = async (req, res) => {
  try {
    const { status, updateType, search, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (updateType) query.updateType = updateType;
    
    // Build aggregation pipeline for search
    let updates;
    let total;
    
    if (search) {
      updates = await ProfileUpdate.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userDetails',
          },
        },
        { $unwind: '$userDetails' },
        {
          $match: {
            ...query,
            $or: [
              { 'userDetails.firstName': { $regex: search, $options: 'i' } },
              { 'userDetails.lastName': { $regex: search, $options: 'i' } },
              { 'userDetails.email': { $regex: search, $options: 'i' } },
            ],
          },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: parseInt(limit) },
      ]);
      
      const countResult = await ProfileUpdate.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userDetails',
          },
        },
        { $unwind: '$userDetails' },
        {
          $match: {
            ...query,
            $or: [
              { 'userDetails.firstName': { $regex: search, $options: 'i' } },
              { 'userDetails.lastName': { $regex: search, $options: 'i' } },
              { 'userDetails.email': { $regex: search, $options: 'i' } },
            ],
          },
        },
        { $count: 'total' },
      ]);
      total = countResult[0]?.total || 0;
    } else {
      updates = await ProfileUpdate.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('user', 'firstName lastName middleName email username')
        .populate('reviewedBy', 'firstName lastName');
      
      total = await ProfileUpdate.countDocuments(query);
    }
    
    // Get stats
    const stats = await ProfileUpdate.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);
    
    const statsObj = {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0,
    };
    stats.forEach(s => {
      statsObj[s._id] = s.count;
      statsObj.total += s.count;
    });
    
    res.status(200).json({
      success: true,
      data: updates,
      stats: statsObj,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching profile updates:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile updates",
      error: error.message,
    });
  }
};

/**
 * @desc    Get single profile update detail (Admin)
 * @route   GET /api/profile-update/admin/:id
 * @access  Private (Admin/SuperAdmin)
 */
exports.getProfileUpdateDetail = async (req, res) => {
  try {
    const update = await ProfileUpdate.findById(req.params.id)
      .populate('user', 'firstName lastName middleName email username phoneNumber address validID photo1x1')
      .populate('reviewedBy', 'firstName lastName');
    
    if (!update) {
      return res.status(404).json({
        success: false,
        message: "Profile update request not found",
      });
    }
    
    res.status(200).json({
      success: true,
      data: update,
    });
  } catch (error) {
    console.error("Error fetching profile update detail:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile update detail",
      error: error.message,
    });
  }
};

/**
 * @desc    Approve profile update request (Admin)
 * @route   PUT /api/profile-update/admin/:id/approve
 * @access  Private (Admin/SuperAdmin)
 */
exports.approveProfileUpdate = async (req, res) => {
  try {
    const { reviewNotes } = req.body;
    
    const update = await ProfileUpdate.findById(req.params.id)
      .populate('user', 'firstName lastName email');
    
    if (!update) {
      return res.status(404).json({
        success: false,
        message: "Profile update request not found",
      });
    }
    
    if (update.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${update.status}`,
      });
    }
    
    // Apply changes to user profile
    const user = await User.findById(update.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    
    // Apply the new data to user
    const newData = update.newData;
    for (const [key, value] of Object.entries(newData)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          // Merge nested objects
          user[key] = { ...user[key]?.toObject?.() || user[key] || {}, ...value };
        } else {
          user[key] = value;
        }
      }
    }
    
    await user.save();
    
    // Update the profile update record
    update.status = 'approved';
    update.reviewedBy = req.user._id;
    update.reviewedAt = new Date();
    update.reviewNotes = reviewNotes;
    update.appliedAt = new Date();
    await update.save();
    
    // Send approval email
    try {
      if (user.email) {
        await sendProfileUpdateApprovalEmail(user.email, {
          firstName: user.firstName,
          updateType: update.updateType,
        });
      }
    } catch (emailError) {
      console.error("Failed to send approval email:", emailError);
    }
    
    res.status(200).json({
      success: true,
      message: "Profile update approved and applied successfully",
      data: update,
    });
  } catch (error) {
    console.error("Error approving profile update:", error);
    res.status(500).json({
      success: false,
      message: "Error approving profile update",
      error: error.message,
    });
  }
};

/**
 * @desc    Reject profile update request (Admin)
 * @route   PUT /api/profile-update/admin/:id/reject
 * @access  Private (Admin/SuperAdmin)
 */
exports.rejectProfileUpdate = async (req, res) => {
  try {
    const { rejectionReason, reviewNotes } = req.body;
    
    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }
    
    const update = await ProfileUpdate.findById(req.params.id)
      .populate('user', 'firstName lastName email');
    
    if (!update) {
      return res.status(404).json({
        success: false,
        message: "Profile update request not found",
      });
    }
    
    if (update.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${update.status}`,
      });
    }
    
    // Update the profile update record
    update.status = 'rejected';
    update.reviewedBy = req.user._id;
    update.reviewedAt = new Date();
    update.reviewNotes = reviewNotes;
    update.rejectionReason = rejectionReason;
    await update.save();
    
    // Send rejection email
    try {
      if (update.user.email) {
        await sendProfileUpdateRejectionEmail(update.user.email, {
          firstName: update.user.firstName,
          updateType: update.updateType,
          rejectionReason,
        });
      }
    } catch (emailError) {
      console.error("Failed to send rejection email:", emailError);
    }
    
    res.status(200).json({
      success: true,
      message: "Profile update rejected",
      data: update,
    });
  } catch (error) {
    console.error("Error rejecting profile update:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting profile update",
      error: error.message,
    });
  }
};

/**
 * @desc    Get user's complete profile with update history (Admin)
 * @route   GET /api/profile-update/admin/user/:userId
 * @access  Private (Admin/SuperAdmin)
 */
exports.getUserProfileWithHistory = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    
    const updateHistory = await ProfileUpdate.find({ user: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('reviewedBy', 'firstName lastName');
    
    res.status(200).json({
      success: true,
      data: {
        user,
        updateHistory,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user profile",
      error: error.message,
    });
  }
};
