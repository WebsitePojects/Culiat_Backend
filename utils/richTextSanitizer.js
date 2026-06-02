const ALLOWED_TAGS = new Set(["p", "div", "br", "strong", "b", "em", "i", "span"]);
const ALLOWED_ALIGNMENTS = new Set(["left", "right", "center", "justify"]);

function sanitizeStyle(styleValue = "") {
  const match = styleValue.match(/text-align\s*:\s*(left|right|center|justify)/i);
  if (!match) return "";
  const alignment = match[1].toLowerCase();
  return ALLOWED_ALIGNMENTS.has(alignment) ? `text-align: ${alignment};` : "";
}

function normalizePlainText(value) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function sanitizeRichText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const input = String(value).trim();
  if (!input) {
    return "";
  }

  const hasHtmlTags = /<[^>]+>/.test(input);
  const baseInput = hasHtmlTags ? input : normalizePlainText(input);

  const withoutDangerousTags = baseInput
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*(javascript:|data:text|vbscript:).*?\2/gi, "");

  return withoutDangerousTags.replace(/<([^>\s\/]+)([^>]*)>/gi, (match, rawTag, rawAttrs) => {
    const tag = rawTag.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      return "";
    }

    let attrs = "";
    const styleMatch = rawAttrs.match(/style\s*=\s*(['"])(.*?)\1/i);
    if (styleMatch) {
      const safeStyle = sanitizeStyle(styleMatch[2]);
      if (safeStyle) {
        attrs += ` style="${safeStyle}"`;
      }
    }

    const alignMatch = rawAttrs.match(/align\s*=\s*(['"]?)(left|right|center|justify)\1/i);
    if (alignMatch) {
      const alignment = alignMatch[2].toLowerCase();
      if (ALLOWED_ALIGNMENTS.has(alignment) && !attrs.includes("text-align")) {
        attrs += ` style="text-align: ${alignment};"`;
      }
    }

    return `<${tag}${attrs}>`;
  });
}

module.exports = {
  sanitizeRichText,
};
