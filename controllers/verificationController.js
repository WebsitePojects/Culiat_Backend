/**
 * Document Verification Controller
 * Handles public verification of documents via QR code
 */

const DocumentRequest = require('../models/DocumentRequest');
const { parseVerificationToken, isValidTokenStructure } = require('../utils/verificationToken');

/**
 * Verify a document by its verification token
 * PUBLIC ENDPOINT - No authentication required
 */
const verifyDocument = async (req, res) => {
  try {
    const { token } = req.params;

    // Validate token structure
    if (!token) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Verification token is required',
        error: 'MISSING_TOKEN'
      });
    }

    if (!isValidTokenStructure(token)) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Invalid verification token format',
        error: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Parse the token to extract control number info
    const parsedToken = parseVerificationToken(token);
    if (!parsedToken.valid) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Unable to parse verification token',
        error: 'TOKEN_PARSE_ERROR'
      });
    }

    // Find the document by verification token
    const document = await DocumentRequest.findOne({
      verificationToken: token
    })
    .populate('applicant', 'firstName middleName lastName suffix email')
    .populate('processedBy', 'firstName lastName');

    if (!document) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: 'No document found with this verification code',
        error: 'DOCUMENT_NOT_FOUND',
        hint: 'This document may not exist or the QR code may be invalid'
      });
    }

    // Check if document is completed (fully processed)
    // Allow both 'approved' and 'completed' status for verification
    if (!['approved', 'completed'].includes(document.status)) {
      return res.status(200).json({
        success: true,
        verified: false,
        message: 'Document exists but has not been fully processed',
        error: 'DOCUMENT_NOT_COMPLETED',
        documentStatus: document.status,
        controlNumber: document.controlNumber
      });
    }

    // Build resident name from document fields (not from populated applicant)
    const residentName = [
      document.firstName,
      document.middleName,
      document.lastName,
      document.suffix
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || 'Unknown';

    const processedByName = document.processedBy
      ? `${document.processedBy.firstName} ${document.processedBy.lastName}`
      : 'Barangay Culiat';

    // Format document type for display
    const documentTypeLabels = {
      'indigency': 'Certificate of Indigency',
      'residency': 'Certificate of Residency',
      'clearance': 'Barangay Clearance',
      'good_moral': 'Good Moral Certificate',
      'business_permit': 'Business Permit',
      'business_clearance': 'Business Clearance',
      'barangay_id': 'Barangay ID',
      'liquor_permit': 'Liquor Permit',
      'missionary': 'Missionary Letter',
      'rehab': 'Rehabilitation Certificate',
      'ctc': 'Community Tax Certificate',
      'building_permit': 'Building Permit'
    };

    const documentTypeLabel = documentTypeLabels[document.documentType] || document.documentType;

    // Build full address
    const fullAddress = document.address ? [
      document.address.houseNumber,
      document.address.street,
      document.address.subdivision,
      document.address.barangay,
      document.address.city
    ].filter(Boolean).join(', ') : null;

    // Return verified document information
    res.status(200).json({
      success: true,
      verified: true,
      message: 'Document successfully verified',
      document: {
        controlNumber: document.controlNumber,
        documentType: document.documentType,
        documentTypeLabel,
        residentName,
        purpose: document.purposeOfRequest || document.purpose || 'N/A',
        issuedAt: document.processedAt || document.documentGeneratedAt || document.createdAt,
        issuedBy: processedByName,
        verificationGeneratedAt: document.verificationGeneratedAt,
        documentGeneratedAt: document.documentGeneratedAt,
        status: document.status,
        validUntil: document.validUntil || null,
        // Location info (partial for privacy)
        barangay: document.address?.barangay || 'Culiat',
        city: document.address?.city || 'Quezon City',
        // For business documents, include business info
        ...(document.businessInfo?.businessName && {
          businessName: document.businessInfo.businessName,
          businessAddress: document.businessInfo.businessAddress
        })
      },
      issuer: {
        name: 'Barangay Culiat',
        location: 'Quezon City, Metro Manila',
        contact: 'barangayculiat@gmail.com',
        website: 'https://barangayculiat.online'
      },
      verificationInfo: {
        verifiedAt: new Date().toISOString(),
        tokenPrefix: parsedToken.prefix,
        year: parsedToken.year,
        securityNote: 'This document has been digitally verified through the Barangay Culiat Document Verification System.'
      }
    });

  } catch (error) {
    console.error('Document verification error:', error);
    res.status(500).json({
      success: false,
      verified: false,
      message: 'An error occurred during verification',
      error: 'SERVER_ERROR'
    });
  }
};

/**
 * Verify a document by control number (alternative method)
 * PUBLIC ENDPOINT - No authentication required
 */
const verifyByControlNumber = async (req, res) => {
  try {
    const { controlNumber } = req.params;

    if (!controlNumber) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Control number is required',
        error: 'MISSING_CONTROL_NUMBER'
      });
    }

    // Find the document by control number
    const document = await DocumentRequest.findOne({
      controlNumber: controlNumber.toUpperCase()
    })
    .populate('resident', 'firstName middleName lastName suffix')
    .populate('processedBy', 'firstName lastName');

    if (!document) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: 'No document found with this control number',
        error: 'DOCUMENT_NOT_FOUND'
      });
    }

    // Check if document is completed
    if (document.status !== 'completed') {
      return res.status(200).json({
        success: true,
        verified: false,
        message: 'Document exists but has not been fully processed',
        documentStatus: document.status,
        controlNumber: document.controlNumber
      });
    }

    // Return basic verified info (less detailed than token verification)
    const residentName = document.resident 
      ? `${document.resident.firstName} ${document.resident.lastName}`
      : 'Unknown';

    const documentTypeLabels = {
      'indigency': 'Certificate of Indigency',
      'residency': 'Certificate of Residency',
      'clearance': 'Barangay Clearance',
      'good_moral': 'Good Moral Certificate',
      'business_permit': 'Business Permit',
      'business_clearance': 'Business Clearance',
      'barangay_id': 'Barangay ID',
      'liquor_permit': 'Liquor Permit',
      'missionary': 'Missionary Letter',
      'rehab': 'Rehabilitation Certificate',
      'ctc': 'Community Tax Certificate',
      'building_permit': 'Building Permit'
    };

    res.status(200).json({
      success: true,
      verified: true,
      message: 'Document verified by control number',
      document: {
        controlNumber: document.controlNumber,
        documentType: document.documentType,
        documentTypeLabel: documentTypeLabels[document.documentType] || document.documentType,
        residentName,
        issuedAt: document.processedAt,
        status: document.status
      },
      issuer: {
        name: 'Barangay Culiat',
        location: 'Quezon City, Metro Manila'
      }
    });

  } catch (error) {
    console.error('Control number verification error:', error);
    res.status(500).json({
      success: false,
      verified: false,
      message: 'An error occurred during verification',
      error: 'SERVER_ERROR'
    });
  }
};

/**
 * Get verification status (simple check)
 * PUBLIC ENDPOINT
 */
const checkVerificationStatus = async (req, res) => {
  try {
    const { token } = req.params;

    const document = await DocumentRequest.findOne({
      verificationToken: token
    }).select('controlNumber status verificationToken');

    if (!document) {
      return res.json({
        exists: false,
        verified: false
      });
    }

    return res.json({
      exists: true,
      verified: document.status === 'completed',
      status: document.status,
      controlNumber: document.controlNumber
    });

  } catch (error) {
    console.error('Verification status check error:', error);
    res.status(500).json({
      exists: false,
      verified: false,
      error: 'SERVER_ERROR'
    });
  }
};

module.exports = {
  verifyDocument,
  verifyByControlNumber,
  checkVerificationStatus
};
