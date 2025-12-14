const Docxtemplater = require("docxtemplater");
const PizZip = require("pizzip");
const ImageModule = require("docxtemplater-image-module-free");
const sizeOf = require("image-size");
const fs = require("fs");
const path = require("path");

/**
 * Generate a document from template with data
 * @param {string} templatePath - Full path to template file
 * @param {object} data - Data to fill in template (including image paths for %image% placeholders)
 * @param {object} imageOptions - Optional image configuration
 * @returns {Buffer} - Generated document buffer
 */
async function generateDocument(templatePath, data, imageOptions = {}) {
  // Read template file
  const content = fs.readFileSync(templatePath, "binary");

  const zip = new PizZip(content);

  // Configure image module for handling image placeholders
  // In templates, use: {%photo_1x1%} for image insertion
  const imageModule = new ImageModule({
    centered: imageOptions.centered || false,
    getImage: function (tagValue) {
      // tagValue is the file path passed from the data object
      if (!tagValue) return null;

      // Handle relative paths by making them absolute
      let imagePath = tagValue;
      if (!path.isAbsolute(imagePath)) {
        imagePath = path.join(process.cwd(), imagePath);
      }

      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        console.warn(`Image not found: ${imagePath}`);
        return null;
      }

      return fs.readFileSync(imagePath);
    },
    getSize: function (img, tagValue, tagName) {
      if (!img) return [0, 0];

      try {
        const dimensions = sizeOf(img);

        // Default sizes based on tag name
        if (tagName === "photo_1x1") {
          // 1x1 inch photo = roughly 96x96 pixels at 96 DPI
          // For Word documents, use EMUs or points: 72 points = 1 inch
          return [72, 72]; // 1 inch x 1 inch in points
        }

        // For other images, scale to max 200 points width while maintaining aspect ratio
        const maxWidth = imageOptions.maxWidth || 200;
        const ratio = dimensions.width / dimensions.height;

        if (dimensions.width > maxWidth) {
          return [maxWidth, maxWidth / ratio];
        }

        return [dimensions.width * 0.75, dimensions.height * 0.75]; // Convert pixels to points (roughly)
      } catch (error) {
        console.error("Error getting image size:", error);
        return [72, 72]; // Default fallback size
      }
    },
  });

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: [imageModule],
    // Silently skip missing tags instead of throwing error
    nullGetter: function (part) {
      if (!part.module) {
        return "";
      }
      if (part.module === "rawxml") {
        return "";
      }
      return "";
    },
  });

  // Set template data
  doc.render(data);

  // Generate output buffer
  const buf = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
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
    return files.filter((file) => file.endsWith(".docx"));
  } catch (error) {
    console.error("Error reading templates directory:", error);
    return [];
  }
}

module.exports = {
  generateDocument,
  getAvailableTemplates,
};
