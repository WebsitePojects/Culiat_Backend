const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const Settings = require("../models/Settings");
const ROLES = require("../config/roles");
const { LOGCONSTANTS } = require("../config/logConstants");
const { getRoleName, getUserDisplayNameWithWebsiteAdminTag } = require("../utils/roleHelpers");
const { logAction } = require("../utils/logHelper");
const {
  normalizeRoleCodes,
  getPrimaryRole,
  hasRole,
  isSameUser,
} = require("../utils/roleAccess");
const { getDocumentTypeLabel, isGovernmentID, isEndorsementLetter, validateDocumentCombination } = require("../config/documentTypes");
const { sendRegistrationApprovedEmail, sendRegistrationRejectedEmail } = require("../utils/emailService");

// Check if using Cloudinary
const isCloudinaryEnabled = () => {
  return process.env.CLOUDINARY_CLOUD_NAME && 
         process.env.CLOUDINARY_API_KEY && 
         process.env.CLOUDINARY_API_SECRET;
};

// Helper to get file URL from uploaded file
const getFileUrl = (file) => {
  if (!file) return null;
  // Cloudinary returns the URL in file.path
  if (isCloudinaryEnabled() && file.path && file.path.includes('cloudinary')) {
    return file.path;
  }
  // Local storage
  return file.path || file.filename;
};

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const getUserRoleCodes = (user) =>
  normalizeRoleCodes([...(Array.isArray(user?.roles) ? user.roles : []), user?.role]);

const getUserRoleNames = (user) => getUserRoleCodes(user).map((code) => getRoleName(code));

const parseRolesFromPayload = (payload, fallback = [ROLES.Resident]) => {
  const requested = Array.isArray(payload?.roles) && payload.roles.length
    ? payload.roles
    : payload?.role !== undefined
      ? [payload.role]
      : fallback;

  return normalizeRoleCodes(requested);
};

const enforceResidentDistrict = (residentType, address) => {
  if (residentType === "non_resident") return address;
  if (!address || typeof address !== "object" || Array.isArray(address)) return address;
  return {
    ...address,
    district: "District 6",
  };
};

const buildGoogleClient = () => {
  if (!process.env.GOOGLE_CLIENT_ID) return null;
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
};

const generateUniqueUsername = async (baseSeed = "resident") => {
  const normalizedBase = String(baseSeed)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 18) || "resident";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${normalizedBase}${suffix}`;
    const exists = await User.findOne({ username: candidate }).select("_id");
    if (!exists) return candidate;
  }

  return `${normalizedBase}${Date.now().toString().slice(-6)}`;
};

const getEffectiveResidentType = (user) => {
  if (!user) return "unknown";
  if (hasRole(user, ROLES.Resident) && user.registrationStatus !== "approved") {
    return "unknown";
  }
  return user.residentType || "unknown";
};

const parseJsonField = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    // Check if registration is enabled in system settings
    const settings = await Settings.getSettings();
    if (!settings.system.registrationEnabled) {
      return res.status(403).json({
        success: false,
        message: "Registration is currently disabled. Please try again later.",
      });
    }

    // Debug: Log received files and body (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log('📁 Received files:', req.files ? Object.keys(req.files) : 'none');
      console.log('📝 Received body keys:', Object.keys(req.body));
    }
    
    const {
      // Account credentials
      username,
      email,
      password,
      // Resident type
      residentType,
      // Personal information
      firstName,
      lastName,
      middleName,
      suffix,
      salutation,
      dateOfBirth,
      placeOfBirth,
      gender,
      civilStatus,
      nationality,
      phoneNumber,
      // Additional information
      tinNumber,
      sssGsisNumber,
      precinctNumber,
      religion,
      heightWeight,
      colorOfHairEyes,
      occupation,
      // Sectoral Groups (array)
      sectoralGroups,
      womensOrganization,
      // Address (nested object) - for residents
      address,
      // Non-resident address (for non-residents)
      nonResidentAddress,
      // Spouse info (nested object)
      spouseInfo,
      // Emergency contact (nested object)
      emergencyContact,
      // Birth Certificate fields
      birthCertificate,
      // Primary ID types (document types)
      primaryID1Type,
      primaryID2Type,
    } = req.body;

    const normalizedCivilStatus =
      civilStatus && civilStatus !== "N/A" ? civilStatus : "Single";

    // Validate document combination based on resident type
    const docValidation = validateDocumentCombination(primaryID1Type, primaryID2Type, residentType);
    if (!docValidation.valid) {
      return res.status(400).json({
        success: false,
        message: docValidation.message,
      });
    }

    // Check if user already exists - handle optional email
    // Normalize email: convert empty string to null
    const normalizedEmail = email && email.trim() !== '' ? email.trim() : null;
    
    // Build query to check for existing user
    let existsQuery = { username };
    if (normalizedEmail) {
      existsQuery = { $or: [{ email: normalizedEmail }, { username }] };
    }
    
    const userExists = await User.findOne(existsQuery);
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: normalizedEmail && userExists.email === normalizedEmail 
          ? "User already exists with this email" 
          : "User already exists with this username",
      });
    }

    // Handle validID file upload (Primary ID 1)
    let validIDData = null;
    if (req.files && req.files.validID) {
      const validID = req.files.validID[0];
      
      // Cloudinary returns the full URL in file.path, but also check file.secure_url
      let fileUrl;
      if (validID.path && validID.path.includes('cloudinary')) {
        fileUrl = validID.path;
      } else if (validID.secure_url) {
        fileUrl = validID.secure_url;
      } else {
        fileUrl = `/uploads/validIDs/${validID.filename}`;
      }
      
      validIDData = {
        url: fileUrl,
        filename: validID.filename || validID.public_id,
        originalName: validID.originalname,
        mimeType: validID.mimetype,
        fileSize: validID.size,
        uploadedAt: new Date(),
        idType: primaryID1Type || 'unknown',
      };
    }

    // Handle backOfValidID file upload
    let backOfValidIDData = null;
    if (req.files && req.files.backOfValidID) {
      const backOfValidID = req.files.backOfValidID[0];
      
      let fileUrl;
      if (backOfValidID.path && backOfValidID.path.includes('cloudinary')) {
        fileUrl = backOfValidID.path;
      } else if (backOfValidID.secure_url) {
        fileUrl = backOfValidID.secure_url;
      } else {
        fileUrl = `/uploads/validIDs/${backOfValidID.filename}`;
      }
      
      backOfValidIDData = {
        url: fileUrl,
        filename: backOfValidID.filename || backOfValidID.public_id,
        originalName: backOfValidID.originalname,
        mimeType: backOfValidID.mimetype,
        fileSize: backOfValidID.size,
        uploadedAt: new Date(),
      };
    }

    // Handle Primary ID 1 file upload (use this or validID)
    let primaryID1Data = null;
    if (req.files && req.files.primaryID1) {
      const primaryID1 = req.files.primaryID1[0];
      
      let fileUrl;
      if (primaryID1.path && primaryID1.path.includes('cloudinary')) {
        fileUrl = primaryID1.path;
      } else if (primaryID1.secure_url) {
        fileUrl = primaryID1.secure_url;
      } else {
        fileUrl = `/uploads/validIDs/${primaryID1.filename}`;
      }
      
      primaryID1Data = {
        url: fileUrl,
        filename: primaryID1.filename || primaryID1.public_id,
        originalName: primaryID1.originalname,
        mimeType: primaryID1.mimetype,
        fileSize: primaryID1.size,
        uploadedAt: new Date(),
        idType: primaryID1Type || 'unknown',
      };
      
      // Also set as validID for backward compatibility
      if (!validIDData) {
        validIDData = { ...primaryID1Data };
      }
    }

    // Handle Primary ID 1 Back file upload
    let primaryID1BackData = null;
    if (req.files && req.files.primaryID1Back) {
      const primaryID1Back = req.files.primaryID1Back[0];
      
      let fileUrl;
      if (primaryID1Back.path && primaryID1Back.path.includes('cloudinary')) {
        fileUrl = primaryID1Back.path;
      } else if (primaryID1Back.secure_url) {
        fileUrl = primaryID1Back.secure_url;
      } else {
        fileUrl = `/uploads/validIDs/${primaryID1Back.filename}`;
      }
      
      primaryID1BackData = {
        url: fileUrl,
        filename: primaryID1Back.filename || primaryID1Back.public_id,
        originalName: primaryID1Back.originalname,
        mimeType: primaryID1Back.mimetype,
        fileSize: primaryID1Back.size,
        uploadedAt: new Date(),
      };
      
      // Also set as backOfValidID for backward compatibility
      if (!backOfValidIDData) {
        backOfValidIDData = { ...primaryID1BackData };
      }
    }

    // Handle Primary ID 2 file upload
    let primaryID2Data = null;
    if (req.files && req.files.primaryID2) {
      const primaryID2 = req.files.primaryID2[0];
      
      let fileUrl;
      if (primaryID2.path && primaryID2.path.includes('cloudinary')) {
        fileUrl = primaryID2.path;
      } else if (primaryID2.secure_url) {
        fileUrl = primaryID2.secure_url;
      } else {
        fileUrl = `/uploads/validIDs/${primaryID2.filename}`;
      }
      
      primaryID2Data = {
        url: fileUrl,
        filename: primaryID2.filename || primaryID2.public_id,
        originalName: primaryID2.originalname,
        mimeType: primaryID2.mimetype,
        fileSize: primaryID2.size,
        uploadedAt: new Date(),
        idType: primaryID2Type || 'unknown',
      };
    }

    // Handle Primary ID 2 Back file upload
    let primaryID2BackData = null;
    if (req.files && req.files.primaryID2Back) {
      const primaryID2Back = req.files.primaryID2Back[0];
      
      let fileUrl;
      if (primaryID2Back.path && primaryID2Back.path.includes('cloudinary')) {
        fileUrl = primaryID2Back.path;
      } else if (primaryID2Back.secure_url) {
        fileUrl = primaryID2Back.secure_url;
      } else {
        fileUrl = `/uploads/validIDs/${primaryID2Back.filename}`;
      }
      
      primaryID2BackData = {
        url: fileUrl,
        filename: primaryID2Back.filename || primaryID2Back.public_id,
        originalName: primaryID2Back.originalname,
        mimeType: primaryID2Back.mimetype,
        fileSize: primaryID2Back.size,
        uploadedAt: new Date(),
      };
    }

    // Handle birth certificate document upload
    let birthCertificateData = birthCertificate
      ? JSON.parse(birthCertificate)
      : {};
    if (req.files && req.files.birthCertificateDoc) {
      const birthCertDoc = req.files.birthCertificateDoc[0];
      
      // Check if Cloudinary URL exists
      const docUrl = birthCertDoc.path && birthCertDoc.path.includes('cloudinary')
        ? birthCertDoc.path
        : `/uploads/birthCertificates/${birthCertDoc.filename}`;
      
      birthCertificateData.documentUrl = docUrl;
      birthCertificateData.documentFilename = birthCertDoc.filename || birthCertDoc.public_id;
      birthCertificateData.documentUploadedAt = new Date();
    }

    // Create user with all fields
    // Note: normalizedEmail was already defined above when checking for existing user
    const user = await User.create({
      username,
      email: normalizedEmail, // Optional - for elderly without email
      password,
      firstName,
      lastName,
      middleName,
      salutation,
      dateOfBirth,
      placeOfBirth,
      gender,
      civilStatus: normalizedCivilStatus,
      nationality,
      phoneNumber,
      tinNumber: tinNumber || "N/A",
      sssGsisNumber: sssGsisNumber || "N/A",
      precinctNumber,
      religion,
      heightWeight,
      colorOfHairEyes,
      occupation,
      sectoralGroups: sectoralGroups ? (Array.isArray(sectoralGroups) ? sectoralGroups : JSON.parse(sectoralGroups)) : [],
      womensOrganization: womensOrganization || null,
      // Resident type
      residentType: residentType || "resident",
      // Address for residents - parse if stringified JSON
      address: residentType === "non_resident"
        ? undefined
        : (() => {
            const parsedAddress = address
              ? typeof address === "string"
                ? JSON.parse(address)
                : address
              : {};
            return {
              ...parsedAddress,
              district: parsedAddress?.district || "District 6",
            };
          })(),
      // Non-resident address
      nonResidentAddress: residentType === "non_resident"
        ? nonResidentAddress
          ? typeof nonResidentAddress === "string"
            ? JSON.parse(nonResidentAddress)
            : nonResidentAddress
          : null
        : null,
      spouseInfo: spouseInfo ? (typeof spouseInfo === 'string' ? JSON.parse(spouseInfo) : spouseInfo) : null,
      emergencyContact: emergencyContact ? (typeof emergencyContact === 'string' ? JSON.parse(emergencyContact) : emergencyContact) : null,
      birthCertificate: birthCertificateData,
      validID: validIDData,
      backOfValidID: backOfValidIDData,
      // New 2-ID system fields
      primaryID1: primaryID1Data,
      primaryID1Back: primaryID1BackData,
      primaryID1Type: primaryID1Type || null,
      primaryID2: primaryID2Data,
      primaryID2Back: primaryID2BackData,
      primaryID2Type: primaryID2Type || null,
      role: ROLES.Resident,
      roles: [ROLES.Resident],
      registrationStatus: "pending", // Pending admin approval
      // Set PSA completion deadline to 3 months from now
      psaCompletion: {
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days = ~3 months
        isComplete: false,
        firstReminderSent: false,
        secondReminderSent: false,
        finalReminderSent: false,
        warningDismissedAt: null,
        completedAt: null,
      },
      profileVerification: {
        status: 'none',
        submittedAt: null,
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null,
      },
    });

    res.status(201).json({
      success: true,
      message:
        "Registration submitted successfully. Your account is pending admin approval.",
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: getUserDisplayNameWithWebsiteAdminTag(user),
        email: user.email,
        registrationStatus: user.registrationStatus,
      },
    });

    // Create audit log for account creation
    await logAction(
      LOGCONSTANTS.actions.user.CREATE_USER,
      `New resident registration: ${user._id} (${user.email}) - Pending approval`,
      user
    );
  } catch (error) {
    console.error('❌ Registration Error:', error.message);
    console.error('📋 Full Error Stack:', error.stack);
    
    // Check for specific Mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(e => e.message);
      console.error('🔍 Validation Errors:', validationErrors);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }
    
    // Check for duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      console.error('🔑 Duplicate Key Error:', field);
      return res.status(400).json({
        success: false,
        message: `A user with this ${field} already exists`,
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Error registering user",
      error: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide username and password",
      });
    }

    // Find user by username with password field
    const user = await User.findOne({ username }).select("+password");

    // Debug logging (development only)
    if (process.env.NODE_ENV === 'development') {
      console.log("Login attempt for:", username);
      console.log("User found:", user ? "Yes" : "No");
      if (user) {
        console.log("User isActive:", user.isActive);
        console.log("User role:", user.role);
        console.log("User registrationStatus:", user.registrationStatus);
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (user.isActive === false) {
      if (hasRole(user, ROLES.Resident) && user.registrationStatus === "rejected") {
        user.isActive = true;
        await user.save();
      } else {
        return res.status(401).json({
          success: false,
          message: "Account is deactivated. Please contact administrator.",
        });
      }
    }

    // Check if account is locked due to PSA completion deadline
    if (user.isAccountLocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been locked due to incomplete profile.",
        lockReason: user.accountLockReason || "Profile completion deadline exceeded (90 days). Please complete your PSA birth certificate information and upload the document for verification.",
        requiresProfileCompletion: true,
        lockedAt: user.accountLockedAt,
        unlockRequestStatus: user.unlockRequest?.status || 'none',
      });
    }

    // Check if PSA completion deadline has passed for residents
    if (hasRole(user, ROLES.Resident) && user.psaCompletion && !user.psaCompletion.isComplete) {
      const deadline = user.psaCompletion.deadline;
      if (deadline && new Date() > new Date(deadline)) {
        // Lock the account
        user.isAccountLocked = true;
        user.accountLockReason = "Profile completion deadline exceeded (90 days). Please complete your PSA birth certificate information and upload the document for verification.";
        user.accountLockedAt = new Date();
        await user.save();

        return res.status(403).json({
          success: false,
          message: "Your account has been locked due to incomplete profile.",
          lockReason: user.accountLockReason,
          requiresProfileCompletion: true,
          lockedAt: user.accountLockedAt,
          deadline: deadline,
        });
      }
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      // Get rate limit info from headers set by middleware
      const rateLimitRemaining = res.getHeader('X-RateLimit-Remaining');
      const rateLimitLimit = res.getHeader('X-RateLimit-Limit');
      
      console.log('🔍 Rate Limit Headers:', { rateLimitLimit, rateLimitRemaining });
      
      let message = "Invalid credentials";
      
      // Add remaining attempts warning for admin logins (when limit is 3)
      // Headers can be numbers or strings depending on how they're set
      const limit = typeof rateLimitLimit === 'number' ? rateLimitLimit : parseInt(rateLimitLimit);
      const remaining = typeof rateLimitRemaining === 'number' ? rateLimitRemaining : parseInt(rateLimitRemaining);
      
      if (limit === 3 && !isNaN(remaining)) {
        console.log('⚠️ Admin login failed, remaining attempts:', remaining);
        
        if (remaining === 2) {
          message = "Invalid credentials. You have 2 attempts remaining before your account is temporarily locked.";
        } else if (remaining === 1) {
          message = "Invalid credentials. WARNING: You have only 1 attempt remaining before your account is temporarily locked for 15 minutes.";
        } else if (remaining === 0) {
          message = "Invalid credentials. This was your last attempt. Your account will be temporarily locked.";
        }
      }
      
      console.log('📤 Sending response with message:', message);
      
      return res.status(401).json({
        success: false,
        message: message,
        attemptsRemaining: remaining,
      });
    }

    const isAdminLoginRequest = (req.originalUrl || "").includes("/admin-login");
    if (isAdminLoginRequest && !hasRole(user, ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin)) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied: Only administrators can access this portal. Residents should use the resident login page.",
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: getRoleName(user.role),
        roleCode: user.role,
        roles: getUserRoleCodes(user),
        roleNames: getUserRoleNames(user),
        residentType: getEffectiveResidentType(user),
        registrationStatus: user.registrationStatus,
        rejectionReason: user.rejectionReason,
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error logging in",
      error: error.message,
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: getUserDisplayNameWithWebsiteAdminTag(user),
        middleName: user.middleName,
        suffix: user.suffix,
        email: user.email,
        role: getRoleName(user.role),
        roleCode: user.role,
        roles: getUserRoleCodes(user),
        roleNames: getUserRoleNames(user),
        residentType: getEffectiveResidentType(user),
        address: user.address,
        nonResidentAddress: user.nonResidentAddress,
        phoneNumber: user.phoneNumber,
        dateOfBirth: user.dateOfBirth,
        age: user.age, // Virtual field
        placeOfBirth: user.placeOfBirth,
        gender: user.gender,
        civilStatus: user.civilStatus,
        nationality: user.nationality,
        tinNumber: user.tinNumber,
        sssGsisNumber: user.sssGsisNumber,
        precinctNumber: user.precinctNumber,
        religion: user.religion,
        heightWeight: user.heightWeight,
        colorOfHairEyes: user.colorOfHairEyes,
        occupation: user.occupation,
        spouseInfo: user.spouseInfo,
        emergencyContact: user.emergencyContact,
        birthCertificate: user.birthCertificate,
        // Stored documents for reuse
        validID: user.validID,
        backOfValidID: user.backOfValidID,
        photo1x1: user.photo1x1,
        isActive: user.isActive,
        registrationStatus: user.registrationStatus,
        rejectionReason: user.rejectionReason,
        createdAt: user.createdAt,
        // PSA Profile completion status (for residents)
        psaCompletion: hasRole(user, ROLES.Resident) ? {
          deadline: user.psaCompletion?.deadline,
          isComplete: user.psaCompletion?.isComplete || false,
          daysLeft: user.getDaysUntilPsaDeadline ? user.getDaysUntilPsaDeadline() : null,
          isApproaching: user.isPsaDeadlineApproaching ? user.isPsaDeadlineApproaching() : false,
          isPassed: user.isPsaDeadlinePassed ? user.isPsaDeadlinePassed() : false,
          warningDismissedAt: user.psaCompletion?.warningDismissedAt,
        } : null,
        profileVerification: hasRole(user, ROLES.Resident) ? user.profileVerification : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user data",
      error: error.message,
    });
  }
};

// @desc    Login/Register user with Google ID token
// @route   POST /api/auth/google-login
// @access  Public
exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body || {};

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required",
      });
    }

    const googleClient = buildGoogleClient();
    if (!googleClient) {
      return res.status(500).json({
        success: false,
        message: "Google login is not configured on the server",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email ? String(payload.email).toLowerCase().trim() : null;

    if (!email || payload?.email_verified !== true) {
      return res.status(401).json({
        success: false,
        message: "Google account email is not verified",
      });
    }

    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      const firstName = payload?.given_name || "Google";
      const lastName = payload?.family_name || "User";
      const usernameSeed = payload?.email ? String(payload.email).split("@")[0] : "resident";
      const generatedUsername = await generateUniqueUsername(usernameSeed);
      const generatedPassword = crypto.randomBytes(24).toString("hex");

      user = await User.create({
        firstName,
        lastName,
        username: generatedUsername,
        email,
        password: generatedPassword,
        role: ROLES.Resident,
        roles: [ROLES.Resident],
        registrationStatus: "pending",
      });

      isNewUser = true;
    }

    if (user.isActive === false) {
      if (hasRole(user, ROLES.Resident) && user.registrationStatus === "rejected") {
        user.isActive = true;
        await user.save();
      } else {
        return res.status(401).json({
          success: false,
          message: "Account is deactivated. Please contact administrator.",
        });
      }
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: isNewUser
        ? "Google account registered successfully. Your account is pending admin verification."
        : "Google login successful",
      data: {
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: getRoleName(user.role),
        roleCode: user.role,
        roles: getUserRoleCodes(user),
        roleNames: getUserRoleNames(user),
        residentType: getEffectiveResidentType(user),
        registrationStatus: user.registrationStatus,
        rejectionReason: user.rejectionReason,
        isNewGoogleUser: isNewUser,
        token,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Google login failed",
      error: error.message,
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { username, firstName, lastName, address, phoneNumber, residentType } = req.body;

    const user = await User.findById(req.user._id);
    if (username) user.username = username;
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (residentType) user.residentType = residentType;
    if (address) {
      let normalizedAddress = address;
      if (typeof normalizedAddress === "string") {
        try {
          normalizedAddress = JSON.parse(normalizedAddress);
        } catch (error) {
          normalizedAddress = address;
        }
      }
      user.address = enforceResidentDistrict(user.residentType, normalizedAddress);
    }
    if (user.address) {
      user.address = enforceResidentDistrict(user.residentType, user.address);
    }
    if (phoneNumber) user.phoneNumber = phoneNumber;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating profile",
      error: error.message,
    });
  }
};

// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password",
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select("+password");

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error changing password",
      error: error.message,
    });
  }
};

exports.adminRegister = async (req, res) => {
  try {
    const {
      username,
      firstName,
      lastName,
      email,
      password,
      role,
      address,
      phoneNumber,
    } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this username",
      });
    }

    // Create user
    const user = await User.create({
      username,
      firstName,
      lastName,
      email,
      password,
      role,
      address,
      phoneNumber,
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "New Super Admin/Admin registered successfully",
      data: {
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: getRoleName(user.role),
        token,
      },
    });

    // Create audit log for admin-created account
    // Use req.user (admin creating account), otherwise use the new user
    const performer = req.user || user;
    await logAction(
      LOGCONSTANTS.actions.user.CREATE_USER,
      `Admin registration: ${user._id} (${user.email}) by ${
        req.user?._id || "system"
      }`,
      performer
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error registering user",
      error: error.message,
    });
  }
};

// @desc    Register a new resident with proof of residency
// @route   POST /api/auth/resident-register
// @access  Public
exports.residentRegister = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username,
      email,
      password,
      address,
      phoneNumber,
    } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email or username",
      });
    }

    // Check if proof of residency was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Proof of residency image is required",
      });
    }

    // Create user with pending status
    const user = await User.create({
      firstName,
      lastName,
      username,
      email,
      password,
      address,
      phoneNumber,
      role: ROLES.Resident,
      roles: [ROLES.Resident],
      registrationStatus: "pending",
      proofOfResidency: getFileUrl(req.file),
    });

    res.status(201).json({
      success: true,
      message:
        "Registration submitted successfully. Please wait for admin approval.",
      data: {
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        registrationStatus: user.registrationStatus,
      },
    });

    // Create audit log
    await logAction(
      LOGCONSTANTS.actions.user.CREATE_USER,
      `Resident registration pending: ${user._id} (${user.email})`,
      user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error registering resident",
      error: error.message,
    });
  }
};

// @desc    Get pending registrations
// @route   GET /api/auth/pending-registrations
// @access  Private/Admin
exports.getPendingRegistrations = async (req, res) => {
  try {
    const pendingUsers = await User.find({
      registrationStatus: "pending",
      role: 74934,
    })
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: pendingUsers.length,
      data: pendingUsers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching pending registrations",
      error: error.message,
    });
  }
};

// @desc    Approve resident registration
// @route   PUT /api/auth/approve-registration/:userId
// @access  Private/Admin
exports.approveRegistration = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.registrationStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "User registration is not pending",
      });
    }

    user.registrationStatus = "approved";
    user.isActive = true;
    user.approvedBy = req.user._id;
    user.approvedAt = Date.now();
    await user.save();

    // Send approval email (mandatory) - gracefully handle no email
    try {
      if (user.email) {
        await sendRegistrationApprovedEmail(user.email, user.firstName);
        console.log(`📧 Registration approval email sent to ${user.email}`);
      } else {
        console.log(`📧 No email for user ${user._id}, skipping approval email`);
      }
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: "Registration approved successfully",
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        registrationStatus: user.registrationStatus,
      },
    });

    // Create audit log
    await logAction(
      LOGCONSTANTS.actions.user.UPDATE_USER,
      `Approved resident registration: ${user._id} (${user.email || user.username})`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error approving registration",
      error: error.message,
    });
  }
};

// @desc    Reject resident registration
// @route   PUT /api/auth/reject-registration/:userId
// @access  Private/Admin
exports.rejectRegistration = async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.registrationStatus !== "pending") {
      return res.status(400).json({
        success: false,
        message: "User registration is not pending",
      });
    }

    // Rejection reason is mandatory
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    user.registrationStatus = "rejected";
    user.rejectionReason = reason;
    user.isActive = true;
    await user.save();

    // Send rejection email (mandatory) - gracefully handle no email
    try {
      if (user.email) {
        await sendRegistrationRejectedEmail(user.email, user.firstName, reason);
        console.log(`📧 Registration rejection email sent to ${user.email}`);
      } else {
        console.log(`📧 No email for user ${user._id}, skipping rejection email`);
      }
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: "Registration rejected successfully",
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        registrationStatus: user.registrationStatus,
        rejectionReason: user.rejectionReason,
      },
    });

    // Create audit log
    await logAction(
      LOGCONSTANTS.actions.user.UPDATE_USER,
      `Rejected resident registration: ${user._id} (${user.email || user.username}) - Reason: ${reason}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error rejecting registration",
      error: error.message,
    });
  }
};

// @desc    Get prefill data for rejected registration re-submission
// @route   GET /api/auth/reregister/:userId/prefill
// @access  Private
exports.getReregistrationPrefill = async (req, res) => {
  try {
    const { userId } = req.params;
    const isSelf = String(req.user?._id) === String(userId);
    const isPrivileged = hasRole(req.user, ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin);

    if (!isSelf && !isPrivileged) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this registration data",
      });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.registrationStatus !== "rejected") {
      return res.status(400).json({
        success: false,
        message: "Only rejected registrations can be re-submitted",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        suffix: user.suffix,
        dateOfBirth: user.dateOfBirth,
        placeOfBirth: user.placeOfBirth,
        gender: user.gender,
        civilStatus: user.civilStatus,
        salutation: user.salutation,
        nationality: user.nationality,
        phoneNumber: user.phoneNumber,
        residentType: user.residentType,
        address: user.address,
        nonResidentAddress: user.nonResidentAddress,
        precinctNumber: user.precinctNumber,
        religion: user.religion,
        heightWeight: user.heightWeight,
        colorOfHairEyes: user.colorOfHairEyes,
        occupation: user.occupation,
        spouseInfo: user.spouseInfo,
        sectoralGroups: user.sectoralGroups || [],
        womensOrganization: user.womensOrganization,
        primaryID1Type: user.primaryID1Type,
        primaryID2Type: user.primaryID2Type,
        rejectionReason: user.rejectionReason,
        validIDUrl: user.validID?.url || null,
        backOfValidIDUrl: user.backOfValidID?.url || null,
        primaryID1Url: user.primaryID1?.url || user.validID?.url || null,
        primaryID1BackUrl: user.primaryID1Back?.url || user.backOfValidID?.url || null,
        primaryID2Url: user.primaryID2?.url || null,
        primaryID2BackUrl: user.primaryID2Back?.url || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error loading re-registration data",
      error: error.message,
    });
  }
};

// @desc    Re-submit rejected resident registration
// @route   PUT /api/auth/reregister/:userId
// @access  Private
exports.reregister = async (req, res) => {
  try {
    const { userId } = req.params;
    const isSelf = String(req.user?._id) === String(userId);
    const isPrivileged = hasRole(req.user, ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin);

    if (!isSelf && !isPrivileged) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to re-submit this registration",
      });
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.registrationStatus !== "rejected") {
      return res.status(400).json({
        success: false,
        message: "Only rejected registrations can be re-submitted",
      });
    }

    const {
      username,
      email,
      password,
      residentType,
      firstName,
      lastName,
      middleName,
      suffix,
      salutation,
      dateOfBirth,
      placeOfBirth,
      gender,
      civilStatus,
      nationality,
      phoneNumber,
      tinNumber,
      sssGsisNumber,
      precinctNumber,
      religion,
      heightWeight,
      colorOfHairEyes,
      occupation,
      sectoralGroups,
      womensOrganization,
      address,
      nonResidentAddress,
      spouseInfo,
      emergencyContact,
      birthCertificate,
      primaryID1Type,
      primaryID2Type,
    } = req.body;

    if (!username || !firstName || !lastName || !dateOfBirth || !gender || !phoneNumber || !residentType) {
      return res.status(400).json({
        success: false,
        message: "Missing required registration fields",
      });
    }

    const docValidation = validateDocumentCombination(primaryID1Type, primaryID2Type, residentType);
    if (!docValidation.valid) {
      return res.status(400).json({
        success: false,
        message: docValidation.message,
      });
    }

    const normalizedEmail = email && email.trim() !== "" ? email.trim().toLowerCase() : null;
    const duplicate = await User.findOne({
      _id: { $ne: user._id },
      $or: normalizedEmail
        ? [{ username }, { email: normalizedEmail }]
        : [{ username }],
    }).select("_id email username");

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message:
          normalizedEmail && duplicate.email === normalizedEmail
            ? "User already exists with this email"
            : "User already exists with this username",
      });
    }

    user.username = username;
    user.email = normalizedEmail;
    if (password && password.trim()) {
      user.password = password;
    }

    user.firstName = firstName;
    user.lastName = lastName;
    user.middleName = middleName || null;
    user.suffix = suffix || null;
    user.salutation = salutation || user.salutation || "";
    user.dateOfBirth = dateOfBirth;
    user.placeOfBirth = placeOfBirth || null;
    user.gender = gender;
    user.civilStatus = civilStatus && civilStatus !== "N/A" ? civilStatus : "Single";
    user.nationality = nationality || "Filipino";
    user.phoneNumber = phoneNumber;
    user.tinNumber = tinNumber || "N/A";
    user.sssGsisNumber = sssGsisNumber || "N/A";
    user.precinctNumber = precinctNumber || null;
    user.religion = religion || null;
    user.heightWeight = heightWeight || null;
    user.colorOfHairEyes = colorOfHairEyes || null;
    user.occupation = occupation || null;
    user.sectoralGroups = sectoralGroups
      ? (Array.isArray(sectoralGroups) ? sectoralGroups : parseJsonField(sectoralGroups, []))
      : [];
    user.womensOrganization = womensOrganization || null;

    user.residentType = residentType;
    if (residentType === "non_resident") {
      user.nonResidentAddress = parseJsonField(nonResidentAddress, user.nonResidentAddress || {});
      user.address = undefined;
    } else {
      const parsedAddress = parseJsonField(address, user.address || {});
      user.address = {
        ...parsedAddress,
        district: parsedAddress?.district || "District 6",
      };
      user.nonResidentAddress = null;
    }

    user.spouseInfo = parseJsonField(spouseInfo, null);
    user.emergencyContact = parseJsonField(emergencyContact, null);
    user.birthCertificate = birthCertificate
      ? parseJsonField(birthCertificate, user.birthCertificate || {})
      : user.birthCertificate;
    user.primaryID1Type = primaryID1Type || null;
    user.primaryID2Type = primaryID2Type || null;

    const getUploadedFile = (field) => (req.files && req.files[field] ? req.files[field][0] : null);
    const mapUpload = (file, fallbackFolder, idType = null) => {
      if (!file) return null;
      const fileUrl = file.path && file.path.includes("cloudinary")
        ? file.path
        : (file.secure_url || `/uploads/${fallbackFolder}/${file.filename}`);

      return {
        url: fileUrl,
        filename: file.filename || file.public_id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedAt: new Date(),
        ...(idType ? { idType } : {}),
      };
    };

    const validIDFile = getUploadedFile("validID") || getUploadedFile("primaryID1");
    const validIDBackFile = getUploadedFile("backOfValidID") || getUploadedFile("primaryID1Back");
    const primaryID2File = getUploadedFile("primaryID2");
    const primaryID2BackFile = getUploadedFile("primaryID2Back");
    const birthCertificateDocFile = getUploadedFile("birthCertificateDoc");

    if (validIDFile) {
      const mapped = mapUpload(validIDFile, "validIDs", primaryID1Type || "unknown");
      user.validID = mapped;
      user.primaryID1 = mapped;
    }

    if (validIDBackFile) {
      const mappedBack = mapUpload(validIDBackFile, "validIDs");
      user.backOfValidID = mappedBack;
      user.primaryID1Back = mappedBack;
    }

    if (primaryID2File) {
      user.primaryID2 = mapUpload(primaryID2File, "validIDs", primaryID2Type || "unknown");
    }

    if (primaryID2BackFile) {
      user.primaryID2Back = mapUpload(primaryID2BackFile, "validIDs");
    }

    if (birthCertificateDocFile) {
      const docUrl = birthCertificateDocFile.path && birthCertificateDocFile.path.includes("cloudinary")
        ? birthCertificateDocFile.path
        : `/uploads/birthCertificates/${birthCertificateDocFile.filename}`;

      user.birthCertificate = {
        ...(user.birthCertificate || {}),
        documentUrl: docUrl,
        documentFilename: birthCertificateDocFile.filename || birthCertificateDocFile.public_id,
        documentUploadedAt: new Date(),
      };
    }

    user.registrationStatus = "pending";
    user.rejectionReason = null;
    user.isActive = true;
    user.approvedBy = null;
    user.approvedAt = null;

    await user.save();

    await logAction(
      LOGCONSTANTS.actions.user.UPDATE_USER,
      `Re-submitted resident registration: ${user._id} (${user.email || user.username})`,
      req.user
    );

    return res.status(200).json({
      success: true,
      message: "Registration re-submitted successfully. Please wait for admin approval.",
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        registrationStatus: user.registrationStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error re-submitting registration",
      error: error.message,
    });
  }
};

// @desc    Get all users (admins and residents)
// @route   GET /api/auth/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    const { role, status } = req.query;
    const filter = {};

    // Filter by role if specified
    if (role) {
      filter.role = role;
    }

    // Filter by registration status if specified
    if (status) {
      filter.registrationStatus = status;
    }

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    // Add role name and age to each user for frontend display
    const usersWithRoleNames = users.map((user) => {
      const userObj = user.toObject();
      userObj.roleName = getRoleName(user.role);
      userObj.displayName = getUserDisplayNameWithWebsiteAdminTag(user);
      userObj.roles = getUserRoleCodes(user);
      userObj.roleNames = getUserRoleNames(user);
      userObj.age = user.age; // Virtual field
      return userObj;
    });

    res.status(200).json({
      success: true,
      count: usersWithRoleNames.length,
      data: usersWithRoleNames,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

// @desc    Check username availability
// @route   GET /api/auth/check-username/:username
// @access  Private/Admin
exports.checkUsernameAvailability = async (req, res) => {
  try {
    const rawUsername = req.params.username || "";
    const username = rawUsername.trim();

    if (!username || username.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters",
      });
    }

    const existingUser = await User.findOne({
      username: { $regex: `^${username.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`, $options: "i" },
    }).select("_id");

    res.status(200).json({
      success: true,
      available: !existingUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking username availability",
      error: error.message,
    });
  }
};

// @desc    Create a new user (Admin creates staff/admin users)
// @route   POST /api/auth/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, username, phoneNumber, password } = req.body;
    const roles = parseRolesFromPayload(req.body, [ROLES.Resident]);

    // Validate required fields
    if (!firstName || !lastName || !email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: firstName, lastName, email, username, password",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    if (!roles.length) {
      return res.status(400).json({
        success: false,
        message: "At least one valid role is required",
      });
    }

    if (!hasRole(req.user, ROLES.SystemAdmin) && roles.includes(ROLES.SystemAdmin)) {
      return res.status(403).json({
        success: false,
        message: "Only System Admin can assign System Admin role",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email 
          ? "User with this email already exists" 
          : "Username already taken",
      });
    }

    const primaryRole = getPrimaryRole(roles);

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      username,
      phoneNumber,
      role: primaryRole,
      roles,
      password,
      registrationStatus: "approved", // Auto-approve admin-created users
      isActive: true,
    });

    // Log the action
    await logAction(
      LOGCONSTANTS.actions.user.CREATE_USER,
      req.user._id,
      `Admin created new user: ${firstName} ${lastName} (${getUserRoleNames(user).join(", ")})`,
      { targetUserId: user._id, roles: getUserRoleNames(user) }
    );

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        role: user.role,
        roleName: getRoleName(user.role),
        roles: getUserRoleCodes(user),
        roleNames: getUserRoleNames(user),
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({
      success: false,
      message: "Error creating user",
      error: error.message,
    });
  }
};

// @desc    Update user by ID (Admin)
// @route   PUT /api/auth/users/:userId
// @access  Private/Admin
exports.updateUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, phoneNumber, isActive } = req.body;
    const requestedRoles = req.body.role !== undefined || Array.isArray(req.body.roles)
      ? parseRolesFromPayload(req.body, [])
      : null;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!hasRole(req.user, ROLES.SystemAdmin) && hasRole(user, ROLES.SystemAdmin)) {
      return res.status(403).json({
        success: false,
        message: "Only System Admin can modify System Admin accounts",
      });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email, _id: { $ne: userId } });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already in use by another user",
        });
      }
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (requestedRoles !== null) {
      if (!requestedRoles.length) {
        return res.status(400).json({
          success: false,
          message: "At least one valid role is required",
        });
      }

      if (!hasRole(req.user, ROLES.SystemAdmin) && requestedRoles.includes(ROLES.SystemAdmin)) {
        return res.status(403).json({
          success: false,
          message: "Only System Admin can assign System Admin role",
        });
      }

      user.roles = requestedRoles;
      user.role = getPrimaryRole(requestedRoles);
    }
    if (typeof isActive === 'boolean') user.isActive = isActive;

    await user.save();

    // Log the action
    await logAction(
      LOGCONSTANTS.actions.user.DELETE_USER,
      req.user._id,
      `Admin updated user: ${user.firstName} ${user.lastName}`,
      { targetUserId: user._id }
    );

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        phoneNumber: user.phoneNumber,
        role: user.role,
        roleName: getRoleName(user.role),
        roles: getUserRoleCodes(user),
        roleNames: getUserRoleNames(user),
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

// @desc    Delete user by ID (Admin)
// @route   DELETE /api/auth/users/:userId
// @access  Private/Admin
exports.deleteUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deleting yourself
    if (isSameUser(user._id, req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    if (!hasRole(req.user, ROLES.SystemAdmin) && hasRole(user, ROLES.SystemAdmin)) {
      return res.status(403).json({
        success: false,
        message: "Only System Admin can delete System Admin accounts",
      });
    }

    const userName = `${user.firstName} ${user.lastName}`;
    const userRole = getRoleName(user.role);

    await User.findByIdAndDelete(userId);

    // Log the action
    await logAction(
      LOGCONSTANTS.actions.user.DELETE_USER,
      req.user._id,
      `Admin deleted user: ${userName} (${userRole})`,
      { targetUserId: userId }
    );

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message,
    });
  }
};

// @desc    Bulk update users (Admin)
// @route   PATCH /api/auth/users/bulk-update
// @access  Private/Admin
exports.bulkUpdateUsers = async (req, res) => {
  try {
    const { userIds, role, roles, isActive } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "userIds must be a non-empty array",
      });
    }

    if (userIds.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Cannot update more than 200 users at once",
      });
    }

    const shouldUpdateRoles = role !== undefined || Array.isArray(roles);
    const requestedRoles = shouldUpdateRoles ? parseRolesFromPayload({ role, roles }, []) : null;

    if (shouldUpdateRoles && !requestedRoles.length) {
      return res.status(400).json({
        success: false,
        message: "At least one valid role is required",
      });
    }

    if (shouldUpdateRoles && !hasRole(req.user, ROLES.SystemAdmin) && requestedRoles.includes(ROLES.SystemAdmin)) {
      return res.status(403).json({
        success: false,
        message: "Only System Admin can assign System Admin role",
      });
    }

    const targetUsers = await User.find({ _id: { $in: userIds } });

    if (!targetUsers.length) {
      return res.status(404).json({ success: false, message: "No users found" });
    }

    if (!hasRole(req.user, ROLES.SystemAdmin) && targetUsers.some((user) => hasRole(user, ROLES.SystemAdmin))) {
      return res.status(403).json({
        success: false,
        message: "Only System Admin can modify System Admin accounts",
      });
    }

    for (const targetUser of targetUsers) {
      if (shouldUpdateRoles) {
        targetUser.roles = requestedRoles;
        targetUser.role = getPrimaryRole(requestedRoles);
      }
      if (typeof isActive === "boolean") {
        targetUser.isActive = isActive;
      }
      await targetUser.save();
    }

    await logAction(
      LOGCONSTANTS.actions.user.UPDATE_USER,
      req.user._id,
      `Bulk updated ${targetUsers.length} users`,
      { targetUserIds: userIds }
    );

    res.status(200).json({
      success: true,
      message: `Updated ${targetUsers.length} users successfully`,
      data: {
        updatedCount: targetUsers.length,
      },
    });
  } catch (error) {
    console.error("Error bulk updating users:", error);
    res.status(500).json({
      success: false,
      message: "Error bulk updating users",
      error: error.message,
    });
  }
};

// @desc    Bulk delete users (Admin)
// @route   DELETE /api/auth/users/bulk-delete
// @access  Private/Admin
exports.bulkDeleteUsers = async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "userIds must be a non-empty array",
      });
    }

    if (userIds.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete more than 200 users at once",
      });
    }

    if (userIds.some((userId) => isSameUser(userId, req.user._id))) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const targetUsers = await User.find({ _id: { $in: userIds } });

    if (!targetUsers.length) {
      return res.status(404).json({ success: false, message: "No users found" });
    }

    if (!hasRole(req.user, ROLES.SystemAdmin) && targetUsers.some((user) => hasRole(user, ROLES.SystemAdmin))) {
      return res.status(403).json({
        success: false,
        message: "Only System Admin can delete System Admin accounts",
      });
    }

    await User.deleteMany({ _id: { $in: targetUsers.map((user) => user._id) } });

    await logAction(
      LOGCONSTANTS.actions.user.DELETE_USER,
      req.user._id,
      `Bulk deleted ${targetUsers.length} users`,
      { targetUserIds: targetUsers.map((user) => user._id) }
    );

    res.status(200).json({
      success: true,
      message: `Deleted ${targetUsers.length} users successfully`,
      data: {
        deletedCount: targetUsers.length,
      },
    });
  } catch (error) {
    console.error("Error bulk deleting users:", error);
    res.status(500).json({
      success: false,
      message: "Error bulk deleting users",
      error: error.message,
    });
  }
};

// @desc    Admin Reset User Password
// @route   PUT /api/auth/users/:userId/reset-password
// @access  Private/Admin
exports.adminResetPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    const { validatePasswordComplexity } = require("../utils/securityUtils");
    const validation = validatePasswordComplexity(newPassword);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    
    // Set new password (pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Password reset successfully for ${user.firstName} ${user.lastName}.`,
    });
  } catch (error) {
    console.error("Error resetting user password:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting user password",
      error: error.message,
    });
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Email could not be sent" });
    }

    // Generate Reset Token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Hash token (private key) and save to database
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set expire (10 minutes)
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save();

    // Create reset url to email - use FRONTEND_URL from environment
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

    // Message
    const message = `
      <h1>You have requested a password reset</h1>
      <p>Please make a PUT request to the following link:</p>
      <a href=${resetUrl} clicktracking=off>${resetUrl}</a>
    `;

    try {
      // await sendEmail({
      //   to: user.email,
      //   subject: 'Password Reset Request',
      //   text: message,
      // });

      // Send password reset email (token is sent via email only, never in API response)
      res
        .status(200)
        .json({ success: true, data: "If the email exists, a password reset link has been sent." });
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save();

      return res
        .status(500)
        .json({ success: false, message: "Email could not be sent" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset Password
// @route   PUT /api/auth/resetpassword/:resetToken
// @access  Public
exports.resetPassword = async (req, res) => {
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.resetToken)
    .digest("hex");

  try {
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid Token" });
    }

    // Set new password (pre-save hook will hash it)
    user.password = req.body.password;

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(201).json({
      success: true,
      data: "Password Reset Success",
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
