const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

/**
 * Generate a document from template with data
 * @param {string} templatePath - Full path to template file
 * @param {object} data - Data to fill in template
 * @returns {Buffer} - Generated document buffer
 */
async function generateDocument(templatePath, data) {
  // Read template file
  const content = fs.readFileSync(templatePath, 'binary');
  
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // Silently skip missing tags instead of throwing error
    nullGetter: function(part) {
      if (!part.module) {
        return '';
      }
      if (part.module === 'rawxml') {
        return '';
      }
      return '';
    },
  });

  // Set template data
  doc.render(data);

  // Generate output buffer
  const buf = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  return buf;
}

/**
 * Get list of available template files
 * @param {string} templatesDir - Path to templates directory
 * @returns {Array} - List of template filenames
 */
function getAvailableTemplates(templatesDir) {
  try {
    const files = fs.readdirSync(templatesDir);
    return files.filter(file => file.endsWith('.docx'));
  } catch (error) {
    console.error('Error reading templates directory:', error);
    return [];
  }
}

module.exports = { 
  generateDocument,
  getAvailableTemplates
};
