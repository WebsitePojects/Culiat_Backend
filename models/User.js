const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    salutation: {
      type: String,
      enum: ["", "Mr.", "Mrs.", "Ms."],
      default: "",
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      // minlength: 6,
      select: false,
    },
    role: {
      type: Number,
      default: 74934, // Default to Resident
      enum: [74932, 74933, 74934], // Valid role codes (SuperAdmin, Admin, Resident)
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // Atomic Address Structure
    address: {
      // Fixed Barangay Culiat Location
      country: {
        type: String,
        default: "Philippines",
        immutable: true,
      },
      region: {
        type: String,
        default: "National Capital Region",
        immutable: true,
      },
      province: {
        type: String,
        default: "Metro Manila",
        immutable: true,
      },
      city: {
        type: String,
        default: "Quezon City",
        immutable: true,
      },
      barangay: {
        type: String,
        default: "Culiat",
        immutable: true,
      },
      postalCode: {
        type: String,
        default: "1128",
        immutable: true,
      },
      // User-specific address details
      subdivision: {
        type: String,
        trim: true,
        default: null,
      },
      street: {
        type: String,
        trim: true,
        default: null,
      },
      houseNumber: {
        type: String,
        trim: true,
        default: null,
      },
      // Area/Purok field
      area: {
        type: String,
        trim: true,
        default: null,
      },
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    // Additional Personal Information (from application form)
    middleName: {
      type: String,
      trim: true,
      default: null,
    },
    suffix: {
      type: String,
      trim: true,
      default: null,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    placeOfBirth: {
      type: String,
      trim: true,
      default: null,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other", null],
      default: null,
    },
    civilStatus: {
      type: String,
      enum: ["Single", "Married", "Widowed", "Separated", "Divorced", null],
      default: null,
    },
    nationality: {
      type: String,
      default: "Filipino",
      trim: true,
    },
    tinNumber: {
      type: String,
      trim: true,
      default: null,
    },
    sssGsisNumber: {
      type: String,
      trim: true,
      default: null,
    },
    precinctNumber: {
      type: String,
      trim: true,
      default: null,
    },
    religion: {
      type: String,
      trim: true,
      default: null,
    },
    heightWeight: {
      type: String,
      trim: true,
      default: null,
    },
    colorOfHairEyes: {
      type: String,
      trim: true,
      default: null,
    },
    occupation: {
      type: String,
      trim: true,
      default: null,
    },
    // Birth Certificate Fields - MATCHES PSABirthCertificateForm.jsx and Register.jsx exactly
    birthCertificate: {
      // === CERTIFICATE DETAILS ===
      certificateNumber: { type: String, trim: true, default: null },
      registryNumber: { type: String, trim: true, default: null },
      dateIssued: { type: Date, default: null },
      placeIssued: { type: String, trim: true, default: null },
      province: { type: String, trim: true, default: null },
      cityMunicipality: { type: String, trim: true, default: null },
      
      // === YOUR INFORMATION (as registered on birth certificate) ===
      yourInfo: {
        firstName: { type: String, trim: true, default: null },
        middleName: { type: String, trim: true, default: null },
        lastName: { type: String, trim: true, default: null },
        sex: { type: String, enum: ['Male', 'Female', null], default: null },
        dateOfBirth: { type: Date, default: null },
        placeOfBirth: {
          hospital: { type: String, trim: true, default: null },
          cityMunicipality: { type: String, trim: true, default: null },
          province: { type: String, trim: true, default: null },
        },
        typeOfBirth: { type: String, enum: ['Single', 'Twin', 'Triplet', null], default: 'Single' },
        birthOrder: { type: String, trim: true, default: null },
        birthWeight: { type: String, trim: true, default: null },
      },
      
      // === MOTHER'S INFORMATION ===
      mother: {
        maidenName: {
          firstName: { type: String, trim: true, default: null },
          middleName: { type: String, trim: true, default: null },
          lastName: { type: String, trim: true, default: null },
        },
        citizenship: { type: String, trim: true, default: 'Filipino' },
        religion: { type: String, trim: true, default: null },
        occupation: { type: String, trim: true, default: null },
        ageAtBirth: { type: Number, default: null },
        residence: {
          houseNo: { type: String, trim: true, default: null },
          street: { type: String, trim: true, default: null },
          barangay: { type: String, trim: true, default: null },
          cityMunicipality: { type: String, trim: true, default: null },
          province: { type: String, trim: true, default: null },
          country: { type: String, trim: true, default: 'Philippines' },
        },
        totalChildrenBornAlive: { type: Number, default: null },
        childrenStillLiving: { type: Number, default: null },
        childrenNowDead: { type: Number, default: null },
      },
      
      // === FATHER'S INFORMATION ===
      father: {
        name: {
          firstName: { type: String, trim: true, default: null },
          middleName: { type: String, trim: true, default: null },
          lastName: { type: String, trim: true, default: null },
        },
        citizenship: { type: String, trim: true, default: 'Filipino' },
        religion: { type: String, trim: true, default: null },
        occupation: { type: String, trim: true, default: null },
        ageAtBirth: { type: Number, default: null },
        residence: {
          houseNo: { type: String, trim: true, default: null },
          street: { type: String, trim: true, default: null },
          barangay: { type: String, trim: true, default: null },
          cityMunicipality: { type: String, trim: true, default: null },
          province: { type: String, trim: true, default: null },
          country: { type: String, trim: true, default: 'Philippines' },
        },
      },
      
      // === PARENTS' MARRIAGE ===
      parentsMarriage: {
        dateOfMarriage: { type: Date, default: null },
        placeOfMarriage: {
          cityMunicipality: { type: String, trim: true, default: null },
          province: { type: String, trim: true, default: null },
          country: { type: String, trim: true, default: 'Philippines' },
        },
      },
      
      // === ATTENDANT AT BIRTH ===
      attendant: {
        type: { type: String, enum: ['Physician', 'Nurse', 'Midwife', 'Hilot', 'Others', null], default: null },
        name: { type: String, trim: true, default: null },
        address: { type: String, trim: true, default: null },
        dateAttended: { type: Date, default: null },
      },
      
      // === REGISTRATION DETAILS ===
      registration: {
        dateOfRegistration: { type: Date, default: null },
        informant: {
          name: { type: String, trim: true, default: null },
          relationship: { type: String, trim: true, default: null },
          address: { type: String, trim: true, default: null },
        },
        preparedBy: { type: String, trim: true, default: null },
        preparedByPosition: { type: String, trim: true, default: null },
        receivedBy: { type: String, trim: true, default: null },
        receivedByPosition: { type: String, trim: true, default: null },
      },
      
      // === REMARKS ===
      remarks: { type: String, trim: true, default: null },
      
      // === DOCUMENT UPLOAD ===
      documentUrl: { type: String, trim: true, default: null },
      documentFilename: { type: String, trim: true, default: null },
      documentUploadedAt: { type: Date, default: null },
    },
    // Spouse Information
    spouseInfo: {
      name: {
        type: String,
        trim: true,
        default: null,
      },
      occupation: {
        type: String,
        trim: true,
        default: null,
      },
      contactNumber: {
        type: String,
        trim: true,
        default: null,
      },
    },
    // Emergency Contact Information with Atomic Address
    emergencyContact: {
      fullName: {
        type: String,
        trim: true,
        default: null,
      },
      relationship: {
        type: String,
        trim: true,
        default: null,
      },
      contactNumber: {
        type: String,
        trim: true,
        default: null,
      },
      address: {
        country: {
          type: String,
          default: "Philippines",
        },
        region: {
          type: String,
          default: "National Capital Region",
        },
        province: {
          type: String,
          default: "Metro Manila",
        },
        city: {
          type: String,
          default: "Quezon City",
        },
        barangay: {
          type: String,
          default: "Culiat",
        },
        postalCode: {
          type: String,
          default: "1128",
        },
        subdivision: {
          type: String,
          trim: true,
          default: null,
        },
        street: {
          type: String,
          trim: true,
          default: null,
        },
        houseNumber: {
          type: String,
          trim: true,
          default: null,
        },
      },
    },
    // Valid ID Upload (for registration verification)
    validID: {
      url: {
        type: String,
        trim: true,
        default: null,
      },
      filename: {
        type: String,
        trim: true,
        default: null,
      },
      originalName: {
        type: String,
        trim: true,
        default: null,
      },
      mimeType: {
        type: String,
        enum: ["image/jpeg", "image/jpg", "image/png", null],
        default: null,
      },
      fileSize: {
        type: Number,
        default: null,
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
    },
    // Back of Valid ID Upload (for registration verification)
    backOfValidID: {
      url: {
        type: String,
        trim: true,
        default: null,
      },
      filename: {
        type: String,
        trim: true,
        default: null,
      },
      originalName: {
        type: String,
        trim: true,
        default: null,
      },
      mimeType: {
        type: String,
        enum: ["image/jpeg", "image/jpg", "image/png", null],
        default: null,
      },
      fileSize: {
        type: Number,
        default: null,
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
    },
    // Primary ID 1 (new 2-ID system)
    primaryID1Type: {
      type: String,
      trim: true,
      default: null,
    },
    primaryID1: {
      url: { type: String, trim: true, default: null },
      filename: { type: String, trim: true, default: null },
      originalName: { type: String, trim: true, default: null },
      mimeType: { type: String, enum: ["image/jpeg", "image/jpg", "image/png", null], default: null },
      fileSize: { type: Number, default: null },
      uploadedAt: { type: Date, default: null },
      idType: { type: String, trim: true, default: null },
    },
    primaryID1Back: {
      url: { type: String, trim: true, default: null },
      filename: { type: String, trim: true, default: null },
      originalName: { type: String, trim: true, default: null },
      mimeType: { type: String, enum: ["image/jpeg", "image/jpg", "image/png", null], default: null },
      fileSize: { type: Number, default: null },
      uploadedAt: { type: Date, default: null },
    },
    // Primary ID 2 (new 2-ID system)
    primaryID2Type: {
      type: String,
      trim: true,
      default: null,
    },
    primaryID2: {
      url: { type: String, trim: true, default: null },
      filename: { type: String, trim: true, default: null },
      originalName: { type: String, trim: true, default: null },
      mimeType: { type: String, enum: ["image/jpeg", "image/jpg", "image/png", null], default: null },
      fileSize: { type: Number, default: null },
      uploadedAt: { type: Date, default: null },
      idType: { type: String, trim: true, default: null },
    },
    primaryID2Back: {
      url: { type: String, trim: true, default: null },
      filename: { type: String, trim: true, default: null },
      originalName: { type: String, trim: true, default: null },
      mimeType: { type: String, enum: ["image/jpeg", "image/jpg", "image/png", null], default: null },
      fileSize: { type: Number, default: null },
      uploadedAt: { type: Date, default: null },
    },
    // 1x1 Photo Upload (for document requests - persisted for reuse)
    photo1x1: {
      url: {
        type: String,
        trim: true,
        default: null,
      },
      filename: {
        type: String,
        trim: true,
        default: null,
      },
      originalName: {
        type: String,
        trim: true,
        default: null,
      },
      mimeType: {
        type: String,
        enum: ["image/jpeg", "image/jpg", "image/png", null],
        default: null,
      },
      fileSize: {
        type: Number,
        default: null,
      },
      uploadedAt: {
        type: Date,
        default: null,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Resident Registration Approval Fields
    registrationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: function () {
        // Auto-approve admins, pending for residents
        return this.role === 74934 ? "pending" : "approved";
      },
    },
    proofOfResidency: {
      type: String, // URL/path to uploaded image (deprecated - use validID instead)
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    // PSA Profile Completion Tracking
    psaCompletion: {
      // Deadline set to 3 months from registration
      deadline: {
        type: Date,
        default: null,
      },
      // Track if profile is complete
      isComplete: {
        type: Boolean,
        default: false,
      },
      // Track email reminders sent
      firstReminderSent: {
        type: Boolean,
        default: false,
      },
      secondReminderSent: {
        type: Boolean,
        default: false,
      },
      finalReminderSent: {
        type: Boolean,
        default: false,
      },
      // Track if user has dismissed the warning modal
      warningDismissedAt: {
        type: Date,
        default: null,
      },
      // Completed date
      completedAt: {
        type: Date,
        default: null,
      },
    },
    // Account Lock Status (for PSA completion deadline exceeded)
    isAccountLocked: {
      type: Boolean,
      default: false,
    },
    accountLockReason: {
      type: String,
      trim: true,
      default: null,
    },
    accountLockedAt: {
      type: Date,
      default: null,
    },
    // Track if user submitted for unlock review
    unlockRequest: {
      status: {
        type: String,
        enum: ['none', 'pending', 'approved', 'rejected'],
        default: 'none',
      },
      submittedAt: {
        type: Date,
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      rejectionReason: {
        type: String,
        trim: true,
        default: null,
      },
    },
    // Profile Verification Status (for admin review of birth certificate)
    profileVerification: {
      status: {
        type: String,
        enum: ['none', 'pending', 'approved', 'rejected'],
        default: 'none',
      },
      submittedAt: {
        type: Date,
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      rejectionReason: {
        type: String,
        trim: true,
        default: null,
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for calculating age from date of birth
userSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;

  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
});

// Virtual for full formatted address
userSchema.virtual("fullAddress").get(function () {
  const parts = [];

  if (this.address.houseNumber) parts.push(this.address.houseNumber);
  if (this.address.street) parts.push(this.address.street);
  if (this.address.subdivision) parts.push(this.address.subdivision);
  if (this.address.area) parts.push(`Purok ${this.address.area}`);
  if (this.address.barangay) parts.push(`Barangay ${this.address.barangay}`);
  if (this.address.city) parts.push(this.address.city);
  if (this.address.province) parts.push(this.address.province);
  if (this.address.postalCode) parts.push(this.address.postalCode);
  if (this.address.country) parts.push(this.address.country);

  return parts.join(", ");
});

// Method to get short address (user-specific part only)
userSchema.methods.getShortAddress = function () {
  const parts = [];

  if (this.address.houseNumber) parts.push(this.address.houseNumber);
  if (this.address.street) parts.push(this.address.street);
  if (this.address.subdivision) parts.push(this.address.subdivision);
  if (this.address.area) parts.push(`Purok ${this.address.area}`);

  return parts.length > 0 ? parts.join(", ") : "Address not provided";
};

// Profile Completion Tracking - PSA/Birth Certificate fields have 3 months to complete
userSchema.methods.isPsaProfileComplete = function () {
  const bc = this.birthCertificate;
  if (!bc) return false;
  
  // Check minimum required PSA birth certificate fields
  // Required: registry number, child's name, date of birth, mother's name, father's name
  const hasRegistryNumber = bc.registryNumber || bc.certificate?.registryNumber;
  const hasChildFirstName = bc.yourInfo?.firstName;
  const hasChildLastName = bc.yourInfo?.lastName;
  const hasDateOfBirth = bc.yourInfo?.dateOfBirth;
  const hasMotherName = bc.mother?.maidenName?.firstName || bc.motherFirstName;
  const hasFatherName = bc.father?.name?.firstName || bc.fatherFirstName;
  
  // If any of the core fields are filled, consider it complete
  // (user has filled out the PSA form during registration)
  const hasPsaData = hasRegistryNumber || 
                     (hasChildFirstName && hasChildLastName && hasDateOfBirth) ||
                     (hasMotherName && hasFatherName);
  
  return hasPsaData;
};

// Get days remaining until PSA completion deadline
userSchema.methods.getDaysUntilPsaDeadline = function () {
  if (!this.psaCompletion || !this.psaCompletion.deadline) return null;
  const now = new Date();
  const deadline = new Date(this.psaCompletion.deadline);
  const diffTime = deadline - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Check if PSA deadline is approaching (within 14 days)
userSchema.methods.isPsaDeadlineApproaching = function () {
  const daysLeft = this.getDaysUntilPsaDeadline();
  if (daysLeft === null) return false;
  return daysLeft <= 14 && daysLeft > 0;
};

// Check if PSA deadline has passed
userSchema.methods.isPsaDeadlinePassed = function () {
  const daysLeft = this.getDaysUntilPsaDeadline();
  if (daysLeft === null) return false;
  return daysLeft <= 0;
};

// Ensure virtuals are included in JSON
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("User", userSchema);
