const Docxtemplater = require("docxtemplater");
const PizZip = require("pizzip");
const ImageModule = require("docxtemplater-image-module-free");
const sizeOf = require("image-size");
const fs = require("fs");
const path = require("path");

/**
 * Replace images in textboxes/shapes by alt-text
 * This function searches for existing images with specific alt-text and replaces them
 * @param {PizZip} zip - The document zip
 * @param {object} imageReplacements - Object mapping alt-text names to image file paths
 * @returns {PizZip} - Modified zip
 */
function replaceImagesByAltText(zip, imageReplacements) {
  if (!imageReplacements || Object.keys(imageReplacements).length === 0) {
    return zip;
  }

  // Get document.xml content
  const documentXml = zip.file("word/document.xml");
  if (!documentXml) return zip;

  let content = documentXml.asText();

  // Get relationships to find image paths
  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (!relsFile) return zip;

  let relsContent = relsFile.asText();

  // Process each image replacement
  for (const [altTextName, imagePath] of Object.entries(imageReplacements)) {
    if (!imagePath || !fs.existsSync(imagePath)) {
      console.warn(
        `Image not found for alt-text "${altTextName}": ${imagePath}`
      );
      continue;
    }

    // Find the drawing element that contains this alt-text
    // The structure in DOCX is: <wp:docPr ... descr="photo_1x1" .../> within a <w:drawing> element
    // We need to find the a:blip r:embed reference within the SAME drawing element

    // Pattern to match wp:docPr with the specific alt text
    const altTextRegex = new RegExp(`descr="[^"]*${altTextName}[^"]*"`, "i");

    if (!altTextRegex.test(content)) {
      console.log(`ℹ️ Alt-text "${altTextName}" not found in document`);
      continue;
    }

    console.log(`📸 Found alt-text placeholder: ${altTextName}`);

    // Read the new image
    const imageBuffer = fs.readFileSync(imagePath);

    // Get image extension
    const ext = path.extname(imagePath).toLowerCase().slice(1) || "png";
    const contentType = ext === "png" ? "image/png" : "image/jpeg";

    // Find the embed rId associated with this specific alt-text
    // We need to look for <w:drawing> blocks that contain the alt-text
    // Pattern: <w:drawing>...<wp:docPr ... descr="photo_1x1"/>...<a:blip...r:embed="rIdX".../>...</w:drawing>

    // Split content by drawing elements to find the right one
    const drawingPattern = /<w:drawing>[\s\S]*?<\/w:drawing>/gi;
    const drawings = content.match(drawingPattern) || [];

    let targetRelId = null;
    let targetDrawing = null;

    for (const drawing of drawings) {
      // Check if this drawing contains our alt-text
      if (altTextRegex.test(drawing)) {
        // Find the r:embed in this specific drawing
        const embedMatch = drawing.match(/r:embed="([^"]+)"/);
        if (embedMatch) {
          targetRelId = embedMatch[1];
          targetDrawing = drawing;
          console.log(`📸 Found image relationship ID: ${targetRelId}`);
          break;
        }
      }
    }

    if (!targetRelId) {
      console.log(
        `⚠️ Could not find embed reference for alt-text "${altTextName}"`
      );
      continue;
    }

    // Find the image path from relationships
    const relPattern = new RegExp(
      `<Relationship[^>]*Id="${targetRelId}"[^>]*Target="([^"]+)"[^>]*/?>`,
      "i"
    );
    const relMatch = relsContent.match(relPattern);

    if (relMatch && relMatch[1]) {
      const targetImagePath = relMatch[1];
      console.log(`📸 Found image target path: ${targetImagePath}`);

      // Replace the image file in the zip directly
      const fullImagePath = targetImagePath.startsWith("/")
        ? `word${targetImagePath}`
        : `word/${targetImagePath}`;

      console.log(`📸 Replacing image at: ${fullImagePath}`);
      zip.file(fullImagePath, imageBuffer);

      // Update Content_Types if needed
      const contentTypesFile = zip.file("[Content_Types].xml");
      if (contentTypesFile) {
        let ctContent = contentTypesFile.asText();
        const extCheck = `Extension="${ext}"`;
        if (!ctContent.includes(extCheck)) {
          ctContent = ctContent.replace(
            "</Types>",
            `<Default Extension="${ext}" ContentType="${contentType}"/></Types>`
          );
          zip.file("[Content_Types].xml", ctContent);
        }
      }
    }
  }

  return zip;
}

/**
 * Generate a document from template with data
 * @param {string} templatePath - Full path to template file
 * @param {object} data - Data to fill in template (including image paths for %image% placeholders)
 * @param {object} imageOptions - Optional image configuration
 * @param {object} imageReplacements - Optional: images to replace by alt-text (for textbox images)
 * @returns {Buffer} - Generated document buffer
 */
async function generateDocument(
  templatePath,
  data,
  imageOptions = {},
  imageReplacements = {}
) {
  // Read template file
  const content = fs.readFileSync(templatePath, "binary");

  let zip = new PizZip(content);

  // First: Replace images by alt-text (for textbox images)
  if (imageReplacements && Object.keys(imageReplacements).length > 0) {
    zip = replaceImagesByAltText(zip, imageReplacements);
  }

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
