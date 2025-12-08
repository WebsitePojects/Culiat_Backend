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
      enum: ['', 'Mr.', 'Mrs.', 'Ms.'],
      default: '',
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
    // Birth Certificate Fields
    birthCertificate: {
      certificateNumber: {
        type: String,
        trim: true,
        default: null,
      },
      registryNumber: {
        type: String,
        trim: true,
        default: null,
      },
      dateIssued: {
        type: Date,
        default: null,
      },
      placeOfRegistration: {
        type: String,
        trim: true,
        default: null,
      },
      // Father's Information
      fatherFirstName: {
        type: String,
        trim: true,
        default: null,
      },
      fatherMiddleName: {
        type: String,
        trim: true,
        default: null,
      },
      fatherLastName: {
        type: String,
        trim: true,
        default: null,
      },
      fatherNationality: {
        type: String,
        trim: true,
        default: null,
      },
      // Mother's Information
      motherFirstName: {
        type: String,
        trim: true,
        default: null,
      },
      motherMiddleName: {
        type: String,
        trim: true,
        default: null,
      },
      motherMaidenLastName: {
        type: String,
        trim: true,
        default: null,
      },
      motherNationality: {
        type: String,
        trim: true,
        default: null,
      },
      // Birth Certificate Document Upload
      documentUrl: {
        type: String,
        trim: true,
        default: null,
      },
      documentFilename: {
        type: String,
        trim: true,
        default: null,
      },
      documentUploadedAt: {
        type: Date,
        default: null,
      },
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

// Ensure virtuals are included in JSON
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("User", userSchema);
