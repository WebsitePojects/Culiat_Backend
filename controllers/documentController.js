const DocumentRequest = require('../models/DocumentRequest');
const Settings = require('../models/Settings');
const { generateDocument, getAvailableTemplates } = require('../utils/documentGenerator');
const { LOGCONSTANTS } = require('../config/logConstants');
const { logAction } = require('../utils/logHelper');
const path = require('path');
const fs = require('fs');

// Templates directory path
const TEMPLATES_DIR = path.join(__dirname, '../public/Certificates and Dashboard (Culiat)');

// Document type to template file mapping
const TEMPLATE_MAP = {
  'indigency': 'Certificate of Indigency.docx',
  'residency': 'Certificate of Residency(Quezon City Hall Requirements for QCID application).docx',
  'clearance': 'Barangay Certificate.docx',
  'business_permit': 'Certificate for Business Permit.docx',
  'business_clearance': 'Certificate for Business Closure.docx',
  'good_moral': 'Barangay Certificate.docx',
  // Additional templates
  'barangay_id': 'Barangay ID.docx',
  'liquor_permit': 'Certificate for Liquor Permit.docx',
  'missionary': 'Certificate for Missionary.docx',
  'rehab': 'Certificate for Rehab.docx',
};

// Document prices (in PHP)
const DOCUMENT_PRICES = {
  'indigency': 0, // Free for indigent residents
  'residency': 50,
  'clearance': 100,
  'business_permit': 500,
  'business_clearance': 200,
  'good_moral': 75,
  'barangay_id': 150,
  'liquor_permit': 300,
  'missionary': 50,
  'rehab': 50,
  'ctc': 50,
  'building_permit': 500,
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
  const month = d.toLocaleDateString('en-PH', { month: 'long' });
  const year = d.getFullYear();
  
  // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  
  return `${ordinal(day)} day of ${month} ${year}`;
};

/**
 * Determine salutation - use explicit if provided, otherwise derive from gender/civilStatus
 */
const getSalutation = (requestData) => {
  // Use explicit salutation if provided by user
  if (requestData.salutation) return requestData.salutation;
  
  // Fall back to derived salutation from gender and civil status
  const { gender, civilStatus } = requestData;
  if (gender?.toLowerCase() === 'male') return 'Mr.';
  if (gender?.toLowerCase() === 'female') {
    if (civilStatus?.toLowerCase() === 'married') return 'Mrs.';
    return 'Ms.';
  }
  return '';
};

/**
 * Calculate age from date of birth
 */
const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return '';
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age.toString();
};

/**
 * Generate control number for document
 */
const generateControlNumber = (documentType) => {
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  const prefix = documentType?.toUpperCase().substring(0, 3) || 'DOC';
  return `${prefix}-${year}-${random}`;
};

/**
 * Format civil status for display (capitalize and replace underscores)
 */
const formatCivilStatus = (status) => {
  if (!status) return '';
  return status
    .replace(/_/g, ' ')
    .toUpperCase();
};

/**
 * Format gender for display - UPPERCASE
 */
const formatGender = (gender) => {
  if (!gender) return '';
  return gender.toUpperCase();
};

/**
 * Build full name from parts - UPPERCASE
 */
const buildFullName = (firstName, middleName, lastName, suffix) => {
  const parts = [firstName, middleName, lastName].filter(Boolean);
  if (suffix) parts.push(suffix);
  return parts.join(' ').toUpperCase();
};

/**
 * Convert string to Title Case (Pascal Case)
 */
const toTitleCase = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Build user address from address object - Title Case
 * Only includes house number and street (barangay/city are fixed)
 */
const buildFullAddress = (address) => {
  if (!address) return '';
  const parts = [
    address.houseNumber,
    address.street
  ].filter(Boolean);
  return toTitleCase(parts.join(' '));
};

/**
 * Build business address from businessAddress object - Title Case
 */
const buildBusinessAddress = (businessAddress) => {
  if (!businessAddress) return '';
  const parts = [
    businessAddress.houseNumber,
    businessAddress.street
  ].filter(Boolean);
  return toTitleCase(parts.join(' '));
};

/**
 * Build emergency contact full address
 */
const buildEmergencyContactAddress = (emergencyContact) => {
  if (!emergencyContact || !emergencyContact.address) return '';
  const addr = emergencyContact.address;
  const parts = [
    addr.houseNumber,
    addr.street,
    addr.subdivision,
    addr.barangay ? `Barangay ${addr.barangay}` : null,
    addr.city
  ].filter(Boolean);
  return toTitleCase(parts.join(', '));
};

// Fixed location constants for Barangay Culiat
const BARANGAY = 'Culiat';
const CITY = 'Quezon City';


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
    const documentRequest = await DocumentRequest.findById(requestId)
      .populate('applicant', 'firstName lastName email phoneNumber');
    
    if (!documentRequest) {
      return res.status(404).json({ 
        success: false,
        message: 'Document request not found' 
      });
    }

    // Check if request is approved
    if (documentRequest.status !== 'approved' && documentRequest.status !== 'completed') {
      return res.status(400).json({ 
        success: false,
        message: 'Document can only be generated for approved requests' 
      });
    }

    // Get the template file
    const templateFile = TEMPLATE_MAP[documentRequest.documentType];
    if (!templateFile) {
      return res.status(400).json({
        success: false,
        message: `No template available for document type: ${documentRequest.documentType}`
      });
    }

    const templatePath = path.join(TEMPLATES_DIR, templateFile);
    
    // Check if template file exists
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({
        success: false,
        message: `Template file not found: ${templateFile}`
      });
    }

    // Get barangay settings for officials
    let barangayCaptain = 'HON. BARANGAY CAPTAIN';
    let barangaySecretary = 'BARANGAY SECRETARY';
    
    try {
      const settings = await Settings.getSettings();
      // If settings has officials info, use it (you may need to add this to Settings model)
      if (settings.officials) {
        barangayCaptain = settings.officials.captain || barangayCaptain;
        barangaySecretary = settings.officials.secretary || barangaySecretary;
      }
    } catch (err) {
      console.log('Using default officials names');
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
      first_name: (documentRequest.firstName || '').toUpperCase(),
      middle_name: (documentRequest.middleName || '').toUpperCase(),
      last_name: (documentRequest.lastName || '').toUpperCase(),
      suffix: (documentRequest.suffix || '').toUpperCase(),
      
      // ========== ADDRESS INFORMATION ==========
      full_address: buildFullAddress(documentRequest.address),
      house_number: toTitleCase(documentRequest.address?.houseNumber || ''),
      street: toTitleCase(documentRequest.address?.street || ''),
      subdivision: toTitleCase(documentRequest.address?.subdivision || ''),
      barangay: BARANGAY,
      city: CITY,
      
      // ========== DEMOGRAPHICS ==========
      date_of_birth: documentRequest.dateOfBirth 
        ? formatOfficialDate(documentRequest.dateOfBirth) 
        : '',
      age: calculateAge(documentRequest.dateOfBirth),
      gender: formatGender(documentRequest.gender),
      civil_status: formatCivilStatus(documentRequest.civilStatus),
      nationality: (documentRequest.nationality || 'Filipino').toUpperCase(),
      contact_number: documentRequest.contactNumber || '',
      place_of_birth: (documentRequest.placeOfBirth || '').toUpperCase(),
      
      // ========== ADDITIONAL PERSONAL FIELDS ==========
      tin_number: documentRequest.tinNumber || '',
      sss_gsis_number: documentRequest.sssGsisNumber || '',
      precinct_number: documentRequest.precinctNumber || '',
      religion: (documentRequest.religion || '').toUpperCase(),
      height_weight: documentRequest.heightWeight || '',
      color_of_hair_eyes: documentRequest.colorOfHairEyes || '',
      occupation: (documentRequest.occupation || '').toUpperCase(),
      email_address: documentRequest.emailAddress || '',
      request_for: (documentRequest.requestFor || '').toUpperCase(),
      
      // ========== SPOUSE INFORMATION ==========
      spouse_name: (documentRequest.spouseInfo?.name || '').toUpperCase(),
      spouse_occupation: (documentRequest.spouseInfo?.occupation || '').toUpperCase(),
      spouse_contact_number: documentRequest.spouseInfo?.contactNumber || '',
      
      // ========== EMERGENCY CONTACT ==========
      emergency_contact_name: (documentRequest.emergencyContact?.fullName || '').toUpperCase(),
      emergency_contact_relationship: (documentRequest.emergencyContact?.relationship || '').toUpperCase(),
      emergency_contact_number: documentRequest.emergencyContact?.contactNumber || '',
      emergency_contact_address: buildEmergencyContactAddress(documentRequest.emergencyContact),
      
      // ========== REQUEST INFORMATION ==========
      purpose_of_request: (documentRequest.purposeOfRequest || '').toUpperCase(),
      remarks: documentRequest.remarks || '',
      preferred_pickup_date: documentRequest.preferredPickupDate 
        ? formatOfficialDate(documentRequest.preferredPickupDate) 
        : '',
      
      // ========== DOCUMENT METADATA ==========
      issue_date: formatOfficialDate(new Date()),
      control_number: generateControlNumber(documentRequest.documentType),
      
      // ========== BARANGAY OFFICIALS ==========
      barangay_captain: barangayCaptain.toUpperCase(),
      barangay_secretary: barangaySecretary.toUpperCase(),
      
      // ========== BUSINESS INFORMATION (for business_permit, business_clearance) ==========
      business_name: (documentRequest.businessInfo?.businessName || '').toUpperCase(),
      nature_of_business: (documentRequest.businessInfo?.natureOfBusiness || '').toUpperCase(),
      application_type: (documentRequest.businessInfo?.applicationType || '').toUpperCase(),
      
      // Business Address
      business_full_address: buildBusinessAddress(documentRequest.businessInfo?.businessAddress),
      business_house_number: toTitleCase(documentRequest.businessInfo?.businessAddress?.houseNumber || ''),
      business_street: toTitleCase(documentRequest.businessInfo?.businessAddress?.street || ''),
      business_subdivision: toTitleCase(documentRequest.businessInfo?.businessAddress?.subdivision || ''),
      business_barangay: BARANGAY,
      business_city: CITY,
      
      // Owner/Representative
      owner_representative: (documentRequest.businessInfo?.ownerRepresentative || '').toUpperCase(),
      owner_contact_number: documentRequest.businessInfo?.ownerContactNumber || '',
      representative_contact_number: documentRequest.businessInfo?.representativeContactNumber || '',
    };


    // Generate document
    const docBuffer = await generateDocument(templatePath, templateData);

    // Set response headers for file download
    const safeLastName = (documentRequest.lastName || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
    const safeFirstName = (documentRequest.firstName || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${documentRequest.documentType}_${safeLastName}_${safeFirstName}.docx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', docBuffer.length);
    
    // Log the action
    await logAction(
      LOGCONSTANTS.actions.records?.GENERATE_DOCUMENT || 'GENERATE_DOCUMENT',
      `Document generated for request: ${requestId}`,
      req.user
    );

    return res.send(docBuffer);

  } catch (error) {
    console.error('Document generation error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to generate document',
      error: error.message 
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

    const documentRequest = await DocumentRequest.findById(requestId)
      .select('documentType status paymentStatus fees createdAt processedAt');
    
    if (!documentRequest) {
      return res.status(404).json({ 
        success: false,
        message: 'Document request not found' 
      });
    }

    // Determine if download is allowed
    const canDownload = 
      (documentRequest.status === 'approved' || documentRequest.status === 'completed') &&
      (documentRequest.paymentStatus === 'paid' || documentRequest.paymentStatus === 'waived');

    res.status(200).json({
      success: true,
      data: {
        requestId: documentRequest._id,
        documentType: documentRequest.documentType,
        status: documentRequest.status,
        paymentStatus: documentRequest.paymentStatus,
        canDownload,
        amount: documentRequest.fees || DOCUMENT_PRICES[documentRequest.documentType] || 0,
        createdAt: documentRequest.createdAt,
        processedAt: documentRequest.processedAt,
      }
    });

  } catch (error) {
    console.error('Error getting document status:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to get document status',
      error: error.message 
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
    const ROLES = require('../config/roles');

    const documentRequest = await DocumentRequest.findById(requestId);
    
    if (!documentRequest) {
      return res.status(404).json({ 
        success: false,
        message: 'Document request not found' 
      });
    }

    // Check authorization - only owner or admin can download
    const isOwner = documentRequest.applicant?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.Admin || req.user.role === ROLES.SuperAdmin;
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to download this document'
      });
    }

    // Check payment status (skip for admins or free documents)
    const isFree = DOCUMENT_PRICES[documentRequest.documentType] === 0;
    const isPaid = documentRequest.paymentStatus === 'paid' || documentRequest.paymentStatus === 'waived';
    
    if (!isAdmin && !isFree && !isPaid) {
      return res.status(402).json({
        success: false,
        message: 'Payment required. Please complete payment before downloading.',
        amount: documentRequest.fees || DOCUMENT_PRICES[documentRequest.documentType] || 0
      });
    }

    // Check if request is approved
    if (documentRequest.status !== 'approved' && documentRequest.status !== 'completed') {
      return res.status(400).json({ 
        success: false,
        message: 'Document can only be downloaded for approved requests' 
      });
    }

    // Use the generate function to create and send the document
    req.params.requestId = requestId;
    return exports.generateDocumentFile(req, res);

  } catch (error) {
    console.error('Document download error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to download document',
      error: error.message 
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
        id: 'indigency',
        name: 'Certificate of Indigency',
        description: 'Certificate confirming resident\'s indigent status for financial assistance',
        price: DOCUMENT_PRICES.indigency,
        templateFile: TEMPLATE_MAP.indigency,
      },
      {
        id: 'residency',
        name: 'Certificate of Residency',
        description: 'Certificate confirming resident\'s address for official purposes',
        price: DOCUMENT_PRICES.residency,
        templateFile: TEMPLATE_MAP.residency,
      },
      {
        id: 'clearance',
        name: 'Barangay Clearance',
        description: 'General purpose barangay clearance certificate',
        price: DOCUMENT_PRICES.clearance,
        templateFile: TEMPLATE_MAP.clearance,
      },
      {
        id: 'business_permit',
        name: 'Business Permit Certificate',
        description: 'Certificate for business permit application',
        price: DOCUMENT_PRICES.business_permit,
        templateFile: TEMPLATE_MAP.business_permit,
      },
      {
        id: 'business_clearance',
        name: 'Business Closure Certificate',
        description: 'Certificate for business closure or transfer',
        price: DOCUMENT_PRICES.business_clearance,
        templateFile: TEMPLATE_MAP.business_clearance,
      },
      {
        id: 'good_moral',
        name: 'Certificate of Good Moral Character',
        description: 'Certificate attesting to good moral character',
        price: DOCUMENT_PRICES.good_moral,
        templateFile: TEMPLATE_MAP.good_moral,
      },
      {
        id: 'barangay_id',
        name: 'Barangay ID',
        description: 'Official barangay identification card',
        price: DOCUMENT_PRICES.barangay_id,
        templateFile: TEMPLATE_MAP.barangay_id,
      },
      {
        id: 'liquor_permit',
        name: 'Liquor Permit Certificate',
        description: 'Certificate for liquor permit application',
        price: DOCUMENT_PRICES.liquor_permit,
        templateFile: TEMPLATE_MAP.liquor_permit,
      },
      {
        id: 'missionary',
        name: 'Missionary Certificate',
        description: 'Certificate for missionary purposes',
        price: DOCUMENT_PRICES.missionary,
        templateFile: TEMPLATE_MAP.missionary,
      },
      {
        id: 'rehab',
        name: 'Rehabilitation Certificate',
        description: 'Certificate for rehabilitation completion',
        price: DOCUMENT_PRICES.rehab,
        templateFile: TEMPLATE_MAP.rehab,
      },
    ];

    // Check which templates actually exist
    const availableTemplates = templates.map(template => ({
      ...template,
      available: fs.existsSync(path.join(TEMPLATES_DIR, template.templateFile || '')),
    }));

    res.status(200).json({
      success: true,
      data: {
        templates: availableTemplates,
        templatesDirectory: TEMPLATES_DIR,
      }
    });

  } catch (error) {
    console.error('Error getting templates:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to get templates',
      error: error.message 
    });
  }
};
