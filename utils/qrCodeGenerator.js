/**
 * QR Code Generator Utility
 * Generates QR codes for document verification
 */

const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

// Ensure temp directory exists
const tempDir = path.join(__dirname, '..', 'temp', 'qrcodes');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Generate verification URL
 * @param {string} token - The verification token
 * @returns {string} Full verification URL
 */
const getVerificationUrl = (token) => {
  // Use environment variable for base URL, fallback to default
  const baseUrl = process.env.FRONTEND_URL || 'https://barangayculiat.online';
  return `${baseUrl}/verify/${token}`;
};

/**
 * Generate QR Code as Base64 Data URL
 * @param {string} token - The verification token
 * @param {object} options - QR code options
 * @returns {Promise<string>} Base64 data URL of QR code
 */
const generateQRCodeDataUrl = async (token, options = {}) => {
  try {
    const verificationUrl = getVerificationUrl(token);
    
    const qrOptions = {
      type: 'image/png',
      width: options.width || 200,
      margin: options.margin || 2,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#FFFFFF'
      },
      errorCorrectionLevel: 'H' // High error correction for durability
    };

    const dataUrl = await QRCode.toDataURL(verificationUrl, qrOptions);
    return dataUrl;
  } catch (error) {
    console.error('Error generating QR code data URL:', error);
    throw new Error('Failed to generate QR code');
  }
};

/**
 * Generate QR Code as Buffer (for embedding in documents)
 * @param {string} token - The verification token
 * @param {object} options - QR code options
 * @returns {Promise<Buffer>} QR code image buffer
 */
const generateQRCodeBuffer = async (token, options = {}) => {
  try {
    const verificationUrl = getVerificationUrl(token);
    
    const qrOptions = {
      type: 'png',
      width: options.width || 200,
      margin: options.margin || 2,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    };

    const buffer = await QRCode.toBuffer(verificationUrl, qrOptions);
    return buffer;
  } catch (error) {
    console.error('Error generating QR code buffer:', error);
    throw new Error('Failed to generate QR code buffer');
  }
};

/**
 * Generate QR Code and save to file
 * @param {string} token - The verification token
 * @param {string} filename - Output filename (without extension)
 * @param {object} options - QR code options
 * @returns {Promise<string>} Path to saved QR code file
 */
const generateQRCodeFile = async (token, filename, options = {}) => {
  try {
    const verificationUrl = getVerificationUrl(token);
    const filePath = path.join(tempDir, `${filename}.png`);
    
    const qrOptions = {
      type: 'png',
      width: options.width || 200,
      margin: options.margin || 2,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    };

    await QRCode.toFile(filePath, verificationUrl, qrOptions);
    return filePath;
  } catch (error) {
    console.error('Error generating QR code file:', error);
    throw new Error('Failed to generate QR code file');
  }
};

/**
 * Generate QR Code with embedded verification info
 * Creates a more comprehensive QR code with additional metadata
 * @param {object} documentData - Document information
 * @returns {Promise<Buffer>} QR code image buffer
 */
const generateDocumentQRCode = async (documentData) => {
  try {
    const { verificationToken, controlNumber, documentType, residentName } = documentData;
    
    // Create verification URL with the token
    const verificationUrl = getVerificationUrl(verificationToken);
    
    const qrOptions = {
      type: 'png',
      width: 200,
      margin: 2,
      color: {
        dark: '#1e3a5f', // Barangay blue color
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    };

    const buffer = await QRCode.toBuffer(verificationUrl, qrOptions);
    
    console.log(`✅ QR Code generated for document: ${controlNumber}`);
    console.log(`📱 Verification URL: ${verificationUrl}`);
    
    return buffer;
  } catch (error) {
    console.error('Error generating document QR code:', error);
    throw new Error('Failed to generate document QR code');
  }
};

/**
 * Clean up old QR code files from temp directory
 * @param {number} maxAgeHours - Maximum age in hours before deletion
 */
const cleanupOldQRCodes = async (maxAgeHours = 24) => {
  try {
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Cleaned up old QR code: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up QR codes:', error);
  }
};

module.exports = {
  getVerificationUrl,
  generateQRCodeDataUrl,
  generateQRCodeBuffer,
  generateQRCodeFile,
  generateDocumentQRCode,
  cleanupOldQRCodes
};
