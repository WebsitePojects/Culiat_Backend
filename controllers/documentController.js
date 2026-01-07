const DocumentRequest = require("../models/DocumentRequest");
const Settings = require("../models/Settings");
const {
  generateDocument,
  getAvailableTemplates,
} = require("../utils/documentGenerator");
const { LOGCONSTANTS } = require("../config/logConstants");
const { logAction } = require("../utils/logHelper");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const crypto = require("crypto");

// QR Code utilities for document verification
const { generateQRCodeBuffer, generateQRCodeFile } = require("../utils/qrCodeGenerator");
const { generateVerificationToken, generateSecurityHash } = require("../utils/verificationToken");

// Ensure temp directory exists for photo downloads
const TEMP_DIR = path.join(__dirname, "..", "temp");
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Templates directory path
const TEMPLATES_DIR = path.join(
  __dirname,
  "../public/Certificates and Dashboard (Culiat)"
);

// Document type to template file mapping
const TEMPLATE_MAP = {
  indigency: "Certificate of Indigency.docx",
  residency:
    "Certificate of Residency(Quezon City Hall Requirements for QCID application).docx",
  clearance: "Barangay Certificate.docx",
  business_permit: "Certificate for Business Permit.docx",
  business_clearance: "Certificate for Business Closure.docx",
  good_moral: "Barangay Certificate.docx",
  // Additional templates
  barangay_id: "Barangay ID.docx",
  liquor_permit: "Certificate for Liquor Permit.docx",
  missionary: "Certificate for Missionary.docx",
  rehab: "Certificate for Rehab.docx",
};

// PayMongo commission rate for GCash (2.5%)
const PAYMONGO_COMMISSION_RATE = 0.025;
const MINIMUM_PAYMENT_AMOUNT = 50; // Minimum 50 PHP using PaymentIntents API

// Document prices (in PHP) - Base prices that barangay receives
const DOCUMENT_PRICES = {
  indigency: 100,
  residency: 100,
  clearance: 100,
  business_permit: 100,
  business_clearance: 100,
  good_moral: 100,
  barangay_id: 100,
  liquor_permit: 100,
  missionary: 100,
  rehab: 100,
  ctc: 100,
  building_permit: 100,
};

/**
 * Calculate total amount including PayMongo commission
 * @param {number} basePrice - Base price that barangay receives
 * @returns {number} Total amount customer pays (including commission)
 */
const calculateTotalWithCommission = (basePrice) => {
  if (basePrice === 0) return 0; // Free documents remain free

  // Calculate amount with commission added
  let totalAmount = basePrice * (1 + PAYMONGO_COMMISSION_RATE);

  // Ensure minimum payment of 50 PHP
  if (totalAmount < MINIMUM_PAYMENT_AMOUNT) {
    totalAmount = MINIMUM_PAYMENT_AMOUNT;
  }

  // Round to 2 decimal places
  return Math.round(totalAmount * 100) / 100;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date in official government format (e.g., "7th day of December 2025")
 */
const formatOfficialDate = (date) => {
  const d = new Date(date);
  const day = d.getDate();
  const month = d.toLocaleDateString("en-PH", { month: "long" });
  const year = d.getFullYear();

  // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  const ordinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return `${ordinal(day)} day of ${month} ${year}`;
};

/**
 * Format date as MM-DD-YYYY (for Barangay ID birth date)
 */
const formatShortDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  return `${month}-${day}-${year}`;
};

/**
 * Format date as MM/DD/YYYY (for Barangay ID issue/expiration dates)
 */
const formatSlashDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
};

/**
 * Get expiration date (1 year from issue date)
 */
const getExpirationDate = (issueDate) => {
  const d = new Date(issueDate || new Date());
  d.setFullYear(d.getFullYear() + 1);
  return d;
};

/**
 * Determine salutation - use explicit if provided, otherwise derive from gender/civilStatus
 */
const getSalutation = (requestData) => {
  // Use explicit salutation if provided by user
  if (requestData.salutation) return requestData.salutation;

  // Fall back to derived salutation from gender and civil status
  const { gender, civilStatus } = requestData;
  if (gender?.toLowerCase() === "male") return "Mr.";
  if (gender?.toLowerCase() === "female") {
    if (civilStatus?.toLowerCase() === "married") return "Mrs.";
    return "Ms.";
  }
  return "";
};

/**
 * Calculate age from date of birth
 */
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return "";
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age.toString();
};

/**
 * Get control number - prefer persisted, fallback to generated
 * @deprecated Control numbers are now generated on approval and stored in DB
 */
const getControlNumber = (documentRequest) => {
  // Use persisted control number if available
  if (documentRequest.controlNumber) {
    return documentRequest.controlNumber;
  }
  // Fallback for legacy documents without control number
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  const prefix =
    documentRequest.documentType?.toUpperCase().substring(0, 3) || "DOC";
  return `${prefix}-${year}-${random}`;
};

/**
 * Format civil status for display (capitalize and replace underscores)
 */
const formatCivilStatus = (status) => {
  if (!status) return "";
  return status.replace(/_/g, " ").toUpperCase();
};

/**
 * Format gender for display - UPPERCASE
 */
const formatGender = (gender) => {
  if (!gender) return "";
  return gender.toUpperCase();
};

/**
 * Build full name from parts - UPPERCASE
 */
const buildFullName = (firstName, middleName, lastName, suffix) => {
  const parts = [firstName, middleName, lastName].filter(Boolean);
  if (suffix) parts.push(suffix);
  return parts.join(" ").toUpperCase();
};

/**
 * Build owner name in LASTNAME, FIRSTNAME format - UPPERCASE
 * Excludes middle initial to prevent line wrapping issues
 */
const buildOwnerName = (lastName, firstName, middleName) => {
  if (!lastName && !firstName) return "";

  let name = (lastName || "").toUpperCase();
  if (firstName) {
    name += ", " + firstName.toUpperCase();
  }
  // Don't include middle initial to prevent wrapping to new line
  return name;
};

/**
 * Build owner name without commas - UPPERCASE (LASTNAME FIRSTNAME M.)
 * Better for business permits where space is limited
 */
const buildOwnerNameCompact = (lastName, firstName, middleName) => {
  if (!lastName && !firstName) return "";

  const parts = [];
  if (lastName) parts.push(lastName.toUpperCase());
  if (firstName) parts.push(firstName.toUpperCase());
  if (middleName) parts.push(middleName.charAt(0).toUpperCase() + ".");
  
  return parts.join(" ");
};

/**
 * Convert string to Title Case (Pascal Case)
 */
const toTitleCase = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * Build user address from address object - Title Case
 * Only includes house number and street (barangay/city are fixed)
 */
const buildFullAddress = (address) => {
  if (!address) return "";
  const parts = [address.houseNumber, address.street].filter(Boolean);
  return toTitleCase(parts.join(" "));
};

/**
 * Build business address from businessAddress object - Title Case
 */
const buildBusinessAddress = (businessAddress) => {
  if (!businessAddress) return "";
  const parts = [
    businessAddress.houseNumber,
    businessAddress.street,
    businessAddress.subdivision
  ].filter(Boolean);
  return toTitleCase(parts.join(", "));
};

/**
 * Build emergency contact full address
 */
const buildEmergencyContactAddress = (emergencyContact) => {
  if (!emergencyContact || !emergencyContact.address) return "";
  const addr = emergencyContact.address;
  const parts = [
    addr.houseNumber,
    addr.street,
    addr.subdivision,
    addr.barangay ? `Barangay ${addr.barangay}` : null,
    addr.city,
  ].filter(Boolean);
  return toTitleCase(parts.join(", "));
};

/**
 * Generate Reference Number (format: RN{YEAR}-{sequence from control number})
 * Auto-generated when document is created, not user input
 */
const generateReferenceNo = (documentRequest) => {
  const year = new Date().getFullYear();
  const controlNum = documentRequest.controlNumber || "";
  // Extract sequence from control number (e.g., "RES-2025-00001" -> "00001")
  const parts = controlNum.split("-");
  const sequence =
    parts.length === 3
      ? parts[2]
      : String(Math.floor(1000 + Math.random() * 9000)).padStart(5, "0");
  return `RN${year}-${sequence}`;
};

/**
 * Generate Document File Number (format: DFN{YEAR}-{sequence from control number})
 * Auto-generated when document is created, not user input
 */
const generateDocumentFileNo = (documentRequest) => {
  const year = new Date().getFullYear();
  const controlNum = documentRequest.controlNumber || "";
  // Extract sequence from control number (e.g., "RES-2025-00001" -> "00001")
  const parts = controlNum.split("-");
  const sequence =
    parts.length === 3
      ? parts[2]
      : String(Math.floor(1000 + Math.random() * 9000)).padStart(5, "0");
  return `DFN${year}-${sequence}`;
};

// Fixed location constants for Barangay Culiat
const BARANGAY = "Culiat";
const CITY = "Quezon City";

// ============================================================================
// CONTROLLER METHODS
// ============================================================================

/**
 * @desc    Generate document from template for a document request
 * @route   POST /api/documents/generate/:requestId
 * @access  Private (Admin/Staff)
 */
exports.generateDocumentFile = async (req, res) => {
  try {
    const { requestId } = req.params;

    // Fetch the document request with all data
    const documentRequest = await DocumentRequest.findById(requestId).populate(
      "applicant",
      "firstName lastName email phoneNumber"
    );

    if (!documentRequest) {
      return res.status(404).json({
        success: false,
        message: "Document request not found",
      });
    }

    // Check if request is approved
    if (
      documentRequest.status !== "approved" &&
      documentRequest.status !== "completed"
    ) {
      return res.status(400).json({
        success: false,
        message: "Document can only be generated for approved requests",
      });
    }

    // Get the template file
    const templateFile = TEMPLATE_MAP[documentRequest.documentType];
    if (!templateFile) {
      return res.status(400).json({
        success: false,
        message: `No template available for document type: ${documentRequest.documentType}`,
      });
    }

    const templatePath = path.join(TEMPLATES_DIR, templateFile);

    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        success: false,
        message: `Template file not found: ${templateFile}`,
      });
    }

    // Get barangay settings for officials
    let barangayCaptain = "HON. BARANGAY CAPTAIN";
    let barangaySecretary = "BARANGAY SECRETARY";

    try {
      const settings = await Settings.getSettings();
      // If settings has officials info, use it (you may need to add this to Settings model)
      if (settings.officials) {
        barangayCaptain = settings.officials.captain || barangayCaptain;
        barangaySecretary = settings.officials.secretary || barangaySecretary;
      }
    } catch (err) {
      // Using default officials names
    }

    // Build template data with ALL available placeholders
    // All dynamic data is UPPERCASE for official documents
    const templateData = {
      // ========== PERSONAL INFORMATION ==========
      salutation: getSalutation(documentRequest).toUpperCase(),
      full_name: buildFullName(
        documentRequest.firstName,
        documentRequest.middleName,
        documentRequest.lastName,
        documentRequest.suffix
      ),
      first_name: (documentRequest.firstName || "").toUpperCase(),
      middle_name: (documentRequest.middleName || "").toUpperCase(),
      last_name: (documentRequest.lastName || "").toUpperCase(),
      suffix: (documentRequest.suffix || "").toUpperCase(),

      // ========== ADDRESS INFORMATION ==========
      full_address: buildFullAddress(documentRequest.address),
      house_number: toTitleCase(documentRequest.address?.houseNumber || ""),
      street: toTitleCase(documentRequest.address?.street || ""),
      subdivision: toTitleCase(documentRequest.address?.subdivision || ""),
      barangay: BARANGAY,
      city: CITY,

      // ========== DEMOGRAPHICS ==========
      date_of_birth: documentRequest.dateOfBirth
        ? formatOfficialDate(documentRequest.dateOfBirth)
        : "",
      age: calculateAge(documentRequest.dateOfBirth),
      gender: formatGender(documentRequest.gender),
      civil_status: formatCivilStatus(documentRequest.civilStatus),
      nationality: (documentRequest.nationality || "Filipino").toUpperCase(),
      contact_number: documentRequest.contactNumber || "",
      place_of_birth: (documentRequest.placeOfBirth || "").toUpperCase(),

      // ========== ADDITIONAL PERSONAL FIELDS ==========
      tin_number: documentRequest.tinNumber || "",
      sss_gsis_number: documentRequest.sssGsisNumber || "",
      precinct_number: documentRequest.precinctNumber || "",
      religion: (documentRequest.religion || "").toUpperCase(),
      height_weight: documentRequest.heightWeight || "",
      color_of_hair_eyes: documentRequest.colorOfHairEyes || "",
      occupation: (documentRequest.occupation || "").toUpperCase(),
      email_address: documentRequest.emailAddress || "",
      request_for: (documentRequest.requestFor || "").toUpperCase(),

      // ========== SPOUSE INFORMATION ==========
      spouse_name: (documentRequest.spouseInfo?.name || "").toUpperCase(),
      spouse_occupation: (
        documentRequest.spouseInfo?.occupation || ""
      ).toUpperCase(),
      spouse_contact_number: documentRequest.spouseInfo?.contactNumber || "",

      // ========== EMERGENCY CONTACT ==========
      emergency_contact_name: (
        documentRequest.emergencyContact?.fullName || ""
      ).toUpperCase(),
      emergency_contact_relationship: (
        documentRequest.emergencyContact?.relationship || ""
      ).toUpperCase(),
      emergency_contact_number:
        documentRequest.emergencyContact?.contactNumber || "",
      emergency_contact_address: buildEmergencyContactAddress(
        documentRequest.emergencyContact
      ),

      // ========== REQUEST INFORMATION ==========
      purpose_of_request: (
        documentRequest.purposeOfRequest || ""
      ).toUpperCase(),
      remarks: documentRequest.remarks || "",
      preferred_pickup_date: documentRequest.preferredPickupDate
        ? formatOfficialDate(documentRequest.preferredPickupDate)
        : "",

      // ========== DOCUMENT METADATA ==========
      issue_date: formatOfficialDate(new Date()),
      control_number: getControlNumber(documentRequest),

      // ========== BARANGAY OFFICIALS ==========
      barangay_captain: barangayCaptain.toUpperCase(),
      barangay_secretary: barangaySecretary.toUpperCase(),

      // ========== BUSINESS INFORMATION (for business_permit, business_clearance) ==========
      business_name: (
        documentRequest.businessInfo?.businessName || ""
      ).toUpperCase(),
      nature_of_business: (
        documentRequest.businessInfo?.natureOfBusiness || ""
      ).toUpperCase(),
      application_type: (
        documentRequest.businessInfo?.applicationType || ""
      ).toUpperCase(),

      // Closure date (for business_clearance)
      closure_date: documentRequest.businessInfo?.closureDate
        ? formatOfficialDate(documentRequest.businessInfo.closureDate)
        : "",

      // Business Address
      business_full_address: buildBusinessAddress(
        documentRequest.businessInfo?.businessAddress
      ),
      business_house_number: toTitleCase(
        documentRequest.businessInfo?.businessAddress?.houseNumber || ""
      ),
      business_street: toTitleCase(
        documentRequest.businessInfo?.businessAddress?.street || ""
      ),
      business_subdivision: toTitleCase(
        documentRequest.businessInfo?.businessAddress?.subdivision || ""
      ),
      business_barangay: BARANGAY,
      business_city: CITY,

      // Owner/Representative
      owner_representative: (
        documentRequest.businessInfo?.ownerRepresentative || ""
      ).toUpperCase(),
      owner_contact_number:
        documentRequest.businessInfo?.ownerContactNumber || "",
      representative_contact_number:
        documentRequest.businessInfo?.representativeContactNumber || "",

      // OR Number and Amount Paid (for business permits)
      // Default OR Number to "PANGKABUHAYAN" if not set
      or_number: documentRequest.businessInfo?.orNumber || "PANGKABUHAYAN",
      // Default Amount Paid to "0.00"
      amount_paid: documentRequest.fees && documentRequest.fees > 0 
        ? documentRequest.fees.toFixed(2) 
        : "0.00",
      fees: documentRequest.fees && documentRequest.fees > 0 
        ? documentRequest.fees.toFixed(2) 
        : "0.00",

      // Owner name in LASTNAME, FIRSTNAME M. format
      owner_name: buildOwnerName(
        documentRequest.lastName,
        documentRequest.firstName,
        documentRequest.middleName
      ),
      
      // Owner name compact format (LASTNAME FIRSTNAME M.) - no comma, better for tight spaces
      owner_name_compact: buildOwnerNameCompact(
        documentRequest.lastName,
        documentRequest.firstName,
        documentRequest.middleName
      ),

      // ========== BENEFICIARY INFORMATION (for rehab certificate) ==========
      beneficiary_name: (
        documentRequest.beneficiaryInfo?.fullName || ""
      ).toUpperCase(),
      beneficiary_age: documentRequest.beneficiaryInfo?.age?.toString() || "",
      beneficiary_date_of_birth: documentRequest.beneficiaryInfo?.dateOfBirth
        ? formatOfficialDate(documentRequest.beneficiaryInfo.dateOfBirth)
        : "",
      beneficiary_relationship: (
        documentRequest.beneficiaryInfo?.relationship || ""
      ).toUpperCase(),

      // ========== BARANGAY ID SPECIFIC FIELDS ==========
      // Short date formats for Barangay ID
      birth_date_short: formatShortDate(documentRequest.dateOfBirth),
      issue_date_short: formatSlashDate(new Date()),
      expiration_date: formatSlashDate(getExpirationDate(new Date())),

      // Residency type
      residency_type: (documentRequest.residencyType || "").toUpperCase(),

      // ID numbers
      id_number: getControlNumber(documentRequest), // Same as control_number
      precinct_no: documentRequest.precinctNumber || "None",
      sss_gsis_no: documentRequest.sssGsisNumber || "None",
      tin_no: documentRequest.tinNumber || "None",

      // ========== FOREIGN NATIONAL INFO (for missionary certificate) ==========
      acr_number: documentRequest.foreignNationalInfo?.acrNumber || "",
      acr_valid_until: documentRequest.foreignNationalInfo?.acrValidUntil
        ? formatSlashDate(
            new Date(documentRequest.foreignNationalInfo.acrValidUntil)
          )
        : "",
      passport_number:
        documentRequest.foreignNationalInfo?.passportNumber || "",

      // ========== CERTIFICATE OF RESIDENCY SPECIFIC FIELDS ==========
      residency_since: documentRequest.residencyInfo?.residencySince || "",
      // prepared_by uses only the admin's first name in Pascal case
      prepared_by: req.user?.firstName
        ? req.user.firstName.charAt(0).toUpperCase() +
          req.user.firstName.slice(1).toLowerCase()
        : "",
      // reference_no and document_file_no are auto-generated
      reference_no: generateReferenceNo(documentRequest),
      document_file_no: generateDocumentFileNo(documentRequest),

      // Short date formats for residency certificate
      issued_on: formatSlashDate(new Date()),
      valid_until: formatSlashDate(getExpirationDate(new Date())),
      issued_on_text: formatOfficialDate(new Date()).replace(
        /(\d+)(st|nd|rd|th) day of /,
        ""
      ),

      // ========== DIGITAL SIGNATURE FIELDS ==========
      // Signature date with full timestamp
      signature_date: new Date().toLocaleString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      // Unique signature ID (hash-based)
      signature_id: crypto
        .createHash("sha256")
        .update(
          `${documentRequest._id}${documentRequest.controlNumber || ""}${Date.now()}`
        )
        .digest("hex")
        .substring(0, 12)
        .toUpperCase(),
      // Document ID (same as control number)
      document_id: documentRequest.controlNumber || getControlNumber(documentRequest),
      // Verification URL
      verification_url: `${process.env.FRONTEND_URL || "https://barangayculiat.com"}/verify`,
    };

    // ========== PHOTO FOR RESIDENCY DOCUMENTS ==========
    // Add photo path for documents that require photos
    if (
      documentRequest.documentType === "residency" &&
      documentRequest.photo1x1?.url
    ) {
      const photoUrl = documentRequest.photo1x1.url;
      let photoPath = null;

      // Check if it's a Cloudinary URL (web URL)
      if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
        try {
          // Download the image from Cloudinary temporarily

          // Generate a unique temp filename
          const tempFileName = `temp_photo_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}.jpg`;
          const tempPath = path.join(TEMP_DIR, tempFileName);

          // Download the image
          const response = await axios({
            method: "GET",
            url: photoUrl,
            responseType: "stream",
          });

          // Save to temp file
          const writer = fs.createWriteStream(tempPath);
          response.data.pipe(writer);

          // Wait for download to complete
          await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
          });

          photoPath = tempPath;

          // Clean up temp file after some time (optional cleanup in background)
          setTimeout(() => {
            try {
              if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
              }
            } catch (cleanupError) {
              // Silent cleanup failure
            }
          }, 60000); // Clean up after 1 minute
        } catch (downloadError) {
          // Will proceed without photo
        }
      } else {
        // Handle local file paths (legacy support)
        photoPath = photoUrl;
        if (photoPath.startsWith("/uploads")) {
          photoPath = path.join(__dirname, "..", photoPath);
        } else if (photoPath.startsWith("uploads")) {
          photoPath = path.join(__dirname, "..", photoPath);
        } else if (!path.isAbsolute(photoPath)) {
          photoPath = path.join(__dirname, "..", photoPath);
        }
      }

      if (photoPath && fs.existsSync(photoPath)) {
        templateData.photo_1x1 = photoPath;
      }
    }

    // Prepare image replacements for textbox images (by alt-text)
    // In your Word template, insert a placeholder image in a textbox
    // and set its alt-text to "photo_1x1"
    const imageReplacements = {};
    if (templateData.photo_1x1) {
      imageReplacements.photo_1x1 = templateData.photo_1x1;
    }

    // ========== QR CODE GENERATION FOR DOCUMENT VERIFICATION ==========
    console.log(`🔐 Verification token status: ${documentRequest.verificationToken ? 'EXISTS' : 'NOT SET'}`);
    console.log(`🔐 Control number: ${documentRequest.controlNumber || 'NOT SET'}`);
    
    // Generate QR code if document has a verification token
    if (documentRequest.verificationToken) {
      try {
        // Generate QR code image and save temporarily
        const qrCodeFileName = `qr_${documentRequest.controlNumber.replace(/-/g, '_')}_${Date.now()}`;
        console.log(`📱 Generating QR code: ${qrCodeFileName}`);
        const qrCodePath = await generateQRCodeFile(documentRequest.verificationToken, qrCodeFileName, {
          width: 150,
          margin: 1
        });
        
        console.log(`📱 QR code path: ${qrCodePath}`);
        console.log(`📱 QR code exists: ${qrCodePath && fs.existsSync(qrCodePath)}`);
        
        if (qrCodePath && fs.existsSync(qrCodePath)) {
          // Add QR code for template placeholder {%qr_code%}
          templateData.qr_code = qrCodePath;
          // Also add for alt-text replacement (if template has image with alt-text "qr_code")
          imageReplacements.qr_code = qrCodePath;
          
          // Add verification URL as text placeholder
          templateData.verification_url = documentRequest.qrCodeUrl || '';
          templateData.verification_token = documentRequest.verificationToken;
          
          console.log(`📱 QR Code generated for document: ${documentRequest.controlNumber}`);
          
          // Clean up QR code file after document generation (delayed cleanup)
          setTimeout(() => {
            try {
              if (fs.existsSync(qrCodePath)) {
                fs.unlinkSync(qrCodePath);
              }
            } catch (cleanupError) {
              // Silent cleanup failure
            }
          }, 60000); // Clean up after 1 minute
        }
      } catch (qrError) {
        console.error('QR Code generation error:', qrError);
        // Continue without QR code - don't fail the document generation
      }
    } else {
      console.log(`🔐 No verification token, attempting to generate new one...`);
      
      // First, ensure we have a control number
      if (!documentRequest.controlNumber) {
        console.log(`🔐 No control number found, generating one...`);
        try {
          documentRequest.controlNumber = await DocumentRequest.generateControlNumber(
            documentRequest.documentType
          );
          console.log(`🔐 Generated control number: ${documentRequest.controlNumber}`);
        } catch (cnError) {
          console.error('Error generating control number:', cnError);
        }
      }
      
      // Now generate verification token if we have a control number
      if (documentRequest.controlNumber && !documentRequest.verificationToken) {
        try {
          console.log(`🔐 Generating new verification token for control number: ${documentRequest.controlNumber}`);
          const verificationToken = generateVerificationToken(documentRequest.controlNumber);
          const securityHash = generateSecurityHash(documentRequest.controlNumber, verificationToken);
          const { getVerificationUrl } = require("../utils/qrCodeGenerator");
          
          documentRequest.verificationToken = verificationToken;
          documentRequest.verificationSecurityHash = securityHash;
          documentRequest.verificationGeneratedAt = new Date();
          documentRequest.documentGeneratedAt = new Date();
          documentRequest.qrCodeUrl = getVerificationUrl(verificationToken);
          
          await documentRequest.save();
          console.log(`🔐 Token saved: ${verificationToken.slice(0, 20)}...`);
          console.log(`🔐 QR URL: ${documentRequest.qrCodeUrl}`);
          
          // Generate QR code with new token
          const qrCodeFileName = `qr_${documentRequest.controlNumber.replace(/-/g, '_')}_${Date.now()}`;
          console.log(`📱 Generating QR code file: ${qrCodeFileName}`);
          const qrCodePath = await generateQRCodeFile(verificationToken, qrCodeFileName, {
            width: 150,
            margin: 1
          });
          
          console.log(`📱 QR code generated at: ${qrCodePath}`);
          console.log(`📱 QR code file exists: ${qrCodePath && fs.existsSync(qrCodePath)}`);
          
          if (qrCodePath && fs.existsSync(qrCodePath)) {
            templateData.qr_code = qrCodePath;
            imageReplacements.qr_code = qrCodePath;
            templateData.verification_url = documentRequest.qrCodeUrl || '';
            templateData.verification_token = verificationToken;
            
            // Update document_id with the new control number
            templateData.document_id = documentRequest.controlNumber;
            templateData.control_number = documentRequest.controlNumber;
            
            console.log(`📱 QR Code added to imageReplacements. Keys: ${Object.keys(imageReplacements).join(', ')}`);
            
            setTimeout(() => {
              try {
                if (fs.existsSync(qrCodePath)) {
                  fs.unlinkSync(qrCodePath);
                }
              } catch (cleanupError) {
                // Silent cleanup failure
              }
            }, 60000);
          }
        } catch (qrError) {
          console.error('Error generating verification token:', qrError);
        }
      } else {
        console.log(`🔐 Cannot generate token: controlNumber=${documentRequest.controlNumber ? 'YES' : 'NO'}, verificationToken=${documentRequest.verificationToken ? 'YES' : 'NO'}`);
      }
    }

    console.log(`📄 Image replacements to process: ${JSON.stringify(Object.keys(imageReplacements))}`);
    
    // Mark document as generated
    if (!documentRequest.documentGeneratedAt) {
      documentRequest.documentGeneratedAt = new Date();
      await documentRequest.save();
    }

    // Generate document with both text placeholders and alt-text image replacements
    const docBuffer = await generateDocument(
      templatePath,
      templateData,
      {},
      imageReplacements
    );

    // Set response headers for file download
    const safeLastName = (documentRequest.lastName || "Unknown").replace(
      /[^a-zA-Z0-9]/g,
      "_"
    );
    const safeFirstName = (documentRequest.firstName || "Unknown").replace(
      /[^a-zA-Z0-9]/g,
      "_"
    );
    const fileName = `${documentRequest.documentType}_${safeLastName}_${safeFirstName}.docx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Length", docBuffer.length);

    // Log the action
    await logAction(
      LOGCONSTANTS.actions.records?.GENERATE_DOCUMENT || "GENERATE_DOCUMENT",
      `Document generated for request: ${requestId}`,
      req.user
    );

    return res.send(docBuffer);
  } catch (error) {
    console.error("Document generation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate document",
      error: error.message,
    });
  }
};

/**
 * @desc    Get document status for a request
 * @route   GET /api/documents/status/:requestId
 * @access  Private
 */
exports.getDocumentStatus = async (req, res) => {
  try {
    const { requestId } = req.params;

    const documentRequest = await DocumentRequest.findById(requestId).select(
      "documentType status paymentStatus fees createdAt processedAt"
    );

    if (!documentRequest) {
      return res.status(404).json({
        success: false,
        message: "Document request not found",
      });
    }

    // Determine if download is allowed
    const canDownload =
      (documentRequest.status === "approved" ||
        documentRequest.status === "completed") &&
      (documentRequest.paymentStatus === "paid" ||
        documentRequest.paymentStatus === "waived");

    res.status(200).json({
      success: true,
      data: {
        requestId: documentRequest._id,
        documentType: documentRequest.documentType,
        status: documentRequest.status,
        paymentStatus: documentRequest.paymentStatus,
        canDownload,
        amount:
          documentRequest.fees ||
          DOCUMENT_PRICES[documentRequest.documentType] ||
          0,
        createdAt: documentRequest.createdAt,
        processedAt: documentRequest.processedAt,
      },
    });
  } catch (error) {
    console.error("Error getting document status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get document status",
      error: error.message,
    });
  }
};

/**
 * @desc    Get document preview data (all template fields populated, images as URLs)
 * @route   GET /api/documents/preview/:requestId
 * @access  Private (Admin/Staff)
 */
exports.getDocumentPreview = async (req, res) => {
  try {
    const { requestId } = req.params;

    // Fetch the document request with all data
    const documentRequest = await DocumentRequest.findById(requestId).populate(
      "applicant",
      "firstName lastName email phoneNumber photo1x1"
    );

    if (!documentRequest) {
      return res.status(404).json({
        success: false,
        message: "Document request not found",
      });
    }

    // Get barangay settings for officials' names
    let barangayCaptain = "HON. MALOU G. KATIPUNAN SIOCO";
    let barangaySecretary = "JENNY B. ENRIQUEZ";

    try {
      const settings = await Settings.findOne({});
      if (settings?.barangayInfo?.captain) {
        barangayCaptain = settings.barangayInfo.captain.toUpperCase();
      }
      if (settings?.barangayInfo?.secretary) {
        barangaySecretary = settings.barangayInfo.secretary.toUpperCase();
      }
    } catch (settingsError) {
      console.log("Using default barangay officials names");
    }

    // Build preview data object
    const previewData = {
      // Document Info
      documentType: documentRequest.documentType,
      controlNumber: documentRequest.controlNumber || getControlNumber(documentRequest),
      referenceNo: generateReferenceNo(documentRequest),
      documentFileNo: generateDocumentFileNo(documentRequest),
      issueDate: formatOfficialDate(new Date()),
      issueDateShort: formatSlashDate(new Date()),
      validUntil: formatSlashDate(getExpirationDate(new Date())),
      
      // Personal Information
      fullName: buildFullName(
        documentRequest.firstName,
        documentRequest.middleName,
        documentRequest.lastName,
        documentRequest.suffix
      ),
      firstName: (documentRequest.firstName || "").toUpperCase(),
      middleName: (documentRequest.middleName || "").toUpperCase(),
      lastName: (documentRequest.lastName || "").toUpperCase(),
      suffix: (documentRequest.suffix || "").toUpperCase(),
      
      // Address
      fullAddress: buildFullAddress(documentRequest.address),
      houseNumber: toTitleCase(documentRequest.address?.houseNumber || ""),
      street: toTitleCase(documentRequest.address?.street || ""),
      subdivision: toTitleCase(documentRequest.address?.subdivision || ""),
      barangay: BARANGAY,
      city: CITY,
      
      // Demographics
      dateOfBirth: documentRequest.dateOfBirth
        ? formatOfficialDate(documentRequest.dateOfBirth)
        : "",
      dateOfBirthShort: formatShortDate(documentRequest.dateOfBirth),
      age: calculateAge(documentRequest.dateOfBirth),
      gender: formatGender(documentRequest.gender),
      civilStatus: formatCivilStatus(documentRequest.civilStatus),
      nationality: (documentRequest.nationality || "Filipino").toUpperCase(),
      contactNumber: documentRequest.contactNumber || "",
      placeOfBirth: (documentRequest.placeOfBirth || "").toUpperCase(),
      
      // Additional Personal Fields
      tinNumber: documentRequest.tinNumber || "None",
      sssGsisNumber: documentRequest.sssGsisNumber || "None",
      precinctNumber: documentRequest.precinctNumber || "None",
      religion: (documentRequest.religion || "").toUpperCase(),
      heightWeight: documentRequest.heightWeight || "",
      colorOfHairEyes: documentRequest.colorOfHairEyes || "",
      occupation: (documentRequest.occupation || "").toUpperCase(),
      emailAddress: documentRequest.emailAddress || "",
      
      // Spouse Information
      spouseName: (documentRequest.spouseInfo?.name || "").toUpperCase(),
      spouseOccupation: (documentRequest.spouseInfo?.occupation || "").toUpperCase(),
      spouseContactNumber: documentRequest.spouseInfo?.contactNumber || "",
      
      // Emergency Contact
      emergencyContactName: (documentRequest.emergencyContact?.fullName || "").toUpperCase(),
      emergencyContactRelationship: (documentRequest.emergencyContact?.relationship || "").toUpperCase(),
      emergencyContactNumber: documentRequest.emergencyContact?.contactNumber || "",
      emergencyContactAddress: buildEmergencyContactAddress(documentRequest.emergencyContact),
      
      // Request Information
      purposeOfRequest: (documentRequest.purposeOfRequest || "").toUpperCase(),
      remarks: documentRequest.remarks || "",
      
      // Officials
      barangayCaptain,
      barangaySecretary,
      preparedBy: req.user?.firstName
        ? req.user.firstName.charAt(0).toUpperCase() + req.user.firstName.slice(1).toLowerCase()
        : "",
      
      // Business Information
      businessName: (documentRequest.businessInfo?.businessName || "").toUpperCase(),
      natureOfBusiness: (documentRequest.businessInfo?.natureOfBusiness || "").toUpperCase(),
      applicationType: (documentRequest.businessInfo?.applicationType || "").toUpperCase(),
      businessFullAddress: buildBusinessAddress(documentRequest.businessInfo?.businessAddress),
      
      // Beneficiary Information (for rehab)
      beneficiaryName: (documentRequest.beneficiaryInfo?.fullName || "").toUpperCase(),
      beneficiaryAge: documentRequest.beneficiaryInfo?.age?.toString() || "",
      beneficiaryRelationship: (documentRequest.beneficiaryInfo?.relationship || "").toUpperCase(),
      
      // Images (URLs for preview)
      photo1x1: documentRequest.photo1x1?.url || documentRequest.photo1x1 || null,
      
      // QR Code - Generate data URL for preview
      qrCodeDataUrl: null,
      verificationToken: documentRequest.verificationToken || null,
      verificationUrl: documentRequest.qrCodeUrl || null,
      
      // Status
      status: documentRequest.status,
      paymentStatus: documentRequest.paymentStatus,
    };

    // Generate QR code data URL for preview
    if (documentRequest.verificationToken) {
      try {
        const { generateQRCodeDataUrl } = require("../utils/qrCodeGenerator");
        previewData.qrCodeDataUrl = await generateQRCodeDataUrl(documentRequest.verificationToken, {
          width: 150,
          margin: 1
        });
      } catch (qrError) {
        console.error("QR Code preview generation error:", qrError);
      }
    } else if (documentRequest.controlNumber) {
      // Generate token if not exists and create QR
      try {
        const verificationToken = generateVerificationToken(documentRequest.controlNumber);
        const { generateQRCodeDataUrl } = require("../utils/qrCodeGenerator");
        previewData.qrCodeDataUrl = await generateQRCodeDataUrl(verificationToken, {
          width: 150,
          margin: 1
        });
        previewData.verificationToken = verificationToken;
      } catch (qrError) {
        console.error("QR Code preview generation error:", qrError);
      }
    }

    res.status(200).json({
      success: true,
      data: previewData,
    });
  } catch (error) {
    console.error("Error getting document preview:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get document preview",
      error: error.message,
    });
  }
};

/**
 * @desc    Download document (after payment verification)
 * @route   GET /api/documents/download/:requestId
 * @access  Private (Owner or Admin)
 */
exports.downloadDocument = async (req, res) => {
  try {
    const { requestId } = req.params;
    const ROLES = require("../config/roles");

    const documentRequest = await DocumentRequest.findById(requestId);

    if (!documentRequest) {
      return res.status(404).json({
        success: false,
        message: "Document request not found",
      });
    }

    // Check authorization - only owner or admin can download
    const isOwner =
      documentRequest.applicant?.toString() === req.user._id.toString();
    const isAdmin =
      req.user.role === ROLES.Admin || req.user.role === ROLES.SuperAdmin;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to download this document",
      });
    }

    // Check payment status (skip for admins or free documents)
    const isFree = DOCUMENT_PRICES[documentRequest.documentType] === 0;
    const isPaid =
      documentRequest.paymentStatus === "paid" ||
      documentRequest.paymentStatus === "waived";

    if (!isAdmin && !isFree && !isPaid) {
      return res.status(402).json({
        success: false,
        message:
          "Payment required. Please complete payment before downloading.",
        amount:
          documentRequest.fees ||
          DOCUMENT_PRICES[documentRequest.documentType] ||
          0,
      });
    }

    // Check if request is approved
    if (
      documentRequest.status !== "approved" &&
      documentRequest.status !== "completed"
    ) {
      return res.status(400).json({
        success: false,
        message: "Document can only be downloaded for approved requests",
      });
    }

    // Use the generate function to create and send the document
    req.params.requestId = requestId;
    return exports.generateDocumentFile(req, res);
  } catch (error) {
    console.error("Document download error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to download document",
      error: error.message,
    });
  }
};

/**
 * @desc    Get available document templates with prices
 * @route   GET /api/documents/templates
 * @access  Public
 */
exports.getTemplates = async (req, res) => {
  try {
    const templates = [
      {
        id: "indigency",
        name: "Certificate of Indigency",
        description:
          "Certificate confirming resident's indigent status for financial assistance",
        price: DOCUMENT_PRICES.indigency,
        templateFile: TEMPLATE_MAP.indigency,
      },
      {
        id: "residency",
        name: "Certificate of Residency",
        description:
          "Certificate confirming resident's address for official purposes",
        price: DOCUMENT_PRICES.residency,
        templateFile: TEMPLATE_MAP.residency,
      },
      {
        id: "clearance",
        name: "Barangay Clearance",
        description: "General purpose barangay clearance certificate",
        price: DOCUMENT_PRICES.clearance,
        templateFile: TEMPLATE_MAP.clearance,
      },
      {
        id: "business_permit",
        name: "Business Permit Certificate",
        description: "Certificate for business permit application",
        price: DOCUMENT_PRICES.business_permit,
        templateFile: TEMPLATE_MAP.business_permit,
      },
      {
        id: "business_clearance",
        name: "Business Closure Certificate",
        description: "Certificate for business closure or transfer",
        price: DOCUMENT_PRICES.business_clearance,
        templateFile: TEMPLATE_MAP.business_clearance,
      },
      {
        id: "good_moral",
        name: "Certificate of Good Moral Character",
        description: "Certificate attesting to good moral character",
        price: DOCUMENT_PRICES.good_moral,
        templateFile: TEMPLATE_MAP.good_moral,
      },
      {
        id: "barangay_id",
        name: "Barangay ID",
        description: "Official barangay identification card",
        price: DOCUMENT_PRICES.barangay_id,
        templateFile: TEMPLATE_MAP.barangay_id,
      },
      {
        id: "liquor_permit",
        name: "Liquor Permit Certificate",
        description: "Certificate for liquor permit application",
        price: DOCUMENT_PRICES.liquor_permit,
        templateFile: TEMPLATE_MAP.liquor_permit,
      },
      {
        id: "missionary",
        name: "Missionary Certificate",
        description: "Certificate for missionary purposes",
        price: DOCUMENT_PRICES.missionary,
        templateFile: TEMPLATE_MAP.missionary,
      },
      {
        id: "rehab",
        name: "Rehabilitation Certificate",
        description: "Certificate for rehabilitation completion",
        price: DOCUMENT_PRICES.rehab,
        templateFile: TEMPLATE_MAP.rehab,
      },
    ];

    // Check which templates actually exist
    const availableTemplates = templates.map((template) => ({
      ...template,
      available: fs.existsSync(
        path.join(TEMPLATES_DIR, template.templateFile || "")
      ),
    }));

    res.status(200).json({
      success: true,
      data: {
        templates: availableTemplates,
        templatesDirectory: TEMPLATES_DIR,
      },
    });
  } catch (error) {
    console.error("Error getting templates:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get templates",
      error: error.message,
    });
  }
};
