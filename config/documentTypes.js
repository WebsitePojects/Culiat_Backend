/**
 * Document Type Labels Configuration
 * Maps database values to human-readable display names
 */

// Valid Government ID Types
const GOVERNMENT_ID_TYPES = {
  philippine_passport: "Philippine Passport",
  drivers_license: "Driver's License",
  umid: "UMID (Unified Multi-Purpose ID)",
  qc_id: "Quezon City ID (QC ID)",
  philhealth: "PhilHealth ID",
  sss: "SSS ID",
  prc: "PRC ID (Professional Regulation Commission)",
  voters_id: "Voter's ID / COMELEC ID",
  senior_citizen: "Senior Citizen ID",
  pwd: "PWD ID",
  philsys: "Philippine National ID (PhilSys)",
  nbi_clearance: "NBI Clearance",
  postal_id: "Postal ID",
  barangay_id: "Barangay ID",
  birth_certificate: "Birth Certificate",
};

// Non-ID Document Types (for verification)
const NON_ID_DOCUMENT_TYPES = {
  endorsement_letter_hoa: "Endorsement Letter from HOA President",
  endorsement_letter_purok: "Endorsement Letter from Purok Leader",
};

// Combined document types
const ALL_DOCUMENT_TYPES = {
  ...GOVERNMENT_ID_TYPES,
  ...NON_ID_DOCUMENT_TYPES,
};

/**
 * Get display label for a document type
 * @param {string} type - The document type code
 * @returns {string} - Human readable label
 */
const getDocumentTypeLabel = (type) => {
  if (!type) return "Unknown Document";
  return ALL_DOCUMENT_TYPES[type] || type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

/**
 * Check if document type is a valid government ID
 * @param {string} type - The document type code
 * @returns {boolean}
 */
const isGovernmentID = (type) => {
  return Object.keys(GOVERNMENT_ID_TYPES).includes(type);
};

/**
 * Check if document type is an endorsement letter
 * @param {string} type - The document type code
 * @returns {boolean}
 */
const isEndorsementLetter = (type) => {
  return type === "endorsement_letter_hoa" || type === "endorsement_letter_purok";
};

/**
 * Validate document requirements based on resident type
 * @param {string} doc1Type - First document type
 * @param {string} doc2Type - Second document type
 * @param {string} residentType - 'resident' or 'non_resident'
 * @returns {object} - { valid: boolean, message: string }
 */
const validateDocumentCombination = (doc1Type, doc2Type, residentType) => {
  if (residentType === "resident") {
    // Residents only need 1 valid government ID
    if (!doc1Type) {
      return { valid: false, message: "Please select your document type" };
    }
    if (!isGovernmentID(doc1Type)) {
      return { valid: false, message: "Residents must provide a valid government-issued ID" };
    }
    return { valid: true, message: "" };
  } else {
    // Non-residents need 1 government ID AND 1 endorsement letter
    if (!doc1Type || !doc2Type) {
      return { valid: false, message: "Non-residents must provide both a valid ID and an endorsement letter" };
    }

    const hasID = isGovernmentID(doc1Type) || isGovernmentID(doc2Type);
    const hasEndorsement = isEndorsementLetter(doc1Type) || isEndorsementLetter(doc2Type);

    if (!hasID) {
      return { valid: false, message: "At least one document must be a valid government-issued ID" };
    }
    if (!hasEndorsement) {
      return { valid: false, message: "Non-residents must also provide an endorsement letter" };
    }
    if (doc1Type === doc2Type) {
      return { valid: false, message: "Please select two different types of documents" };
    }
    return { valid: true, message: "" };
  }
};

module.exports = {
  GOVERNMENT_ID_TYPES,
  NON_ID_DOCUMENT_TYPES,
  ALL_DOCUMENT_TYPES,
  getDocumentTypeLabel,
  isGovernmentID,
  isEndorsementLetter,
  validateDocumentCombination,
};
