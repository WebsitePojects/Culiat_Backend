/**
 * Verification Token Generator
 * Creates unique tokens for document verification using controlNumber
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Generate a unique verification token based on control number
 * @param {string} controlNumber - The document control number (e.g., "IND-2025-00001")
 * @returns {string} Unique verification token
 */
const generateVerificationToken = (controlNumber) => {
  // Create a unique identifier combining UUID and timestamp
  const uniqueId = uuidv4().split('-')[0]; // Short UUID segment
  const timestamp = Date.now().toString(36); // Base36 timestamp for compactness
  
  // Create verification token: PREFIX-YEAR-SEQ-UNIQUE
  // Example: IND-2025-00001 becomes VRF-IND202500001-abc123-lk9m2
  const cleanControlNumber = controlNumber.replace(/-/g, '');
  
  return `VRF-${cleanControlNumber}-${uniqueId}-${timestamp}`;
};

/**
 * Generate a secure hash for additional verification
 * @param {string} controlNumber - The document control number
 * @param {string} token - The verification token
 * @returns {string} SHA256 hash
 */
const generateSecurityHash = (controlNumber, token) => {
  const secret = process.env.JWT_SECRET || 'barangay-culiat-verification-2025';
  const data = `${controlNumber}:${token}:${secret}`;
  
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
};

/**
 * Extract control number from verification token
 * @param {string} token - The verification token
 * @returns {object} Parsed token info
 */
const parseVerificationToken = (token) => {
  try {
    // Token format: VRF-PREFYEARSEQ-uuid-timestamp
    const parts = token.split('-');
    if (parts.length < 4 || parts[0] !== 'VRF') {
      return { valid: false, error: 'Invalid token format' };
    }

    const controlPart = parts[1]; // e.g., IND202500001
    
    // Extract prefix (first 3 characters) and the rest
    const prefix = controlPart.substring(0, 3); // IND
    const yearPart = controlPart.substring(3, 7); // 2025
    const sequencePart = controlPart.substring(7); // 00001
    
    // Reconstruct control number
    const controlNumber = `${prefix}-${yearPart}-${sequencePart}`;
    
    return {
      valid: true,
      controlNumber,
      prefix,
      year: yearPart,
      sequence: sequencePart,
      uniqueId: parts[2],
      timestamp: parts[3]
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

/**
 * Validate verification token structure
 * @param {string} token - The verification token to validate
 * @returns {boolean} Whether token structure is valid
 */
const isValidTokenStructure = (token) => {
  if (!token || typeof token !== 'string') return false;
  
  // Check basic format: VRF-XXXXXXXXXXXXX-xxxxxxxx-xxxxxx
  const regex = /^VRF-[A-Z]{3}\d{9,}-[a-f0-9]{8}-[a-z0-9]+$/;
  return regex.test(token);
};

module.exports = {
  generateVerificationToken,
  generateSecurityHash,
  parseVerificationToken,
  isValidTokenStructure
};
