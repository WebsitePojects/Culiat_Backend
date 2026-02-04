const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

// Security Middleware
const {
  rateLimiters,
  inputSanitizer,
  noSqlInjectionPrevention,
  securityHeaders,
  auditLogger,
  createCorsConfig,
} = require("./middleware/securityMiddleware");

// Maintenance Mode Middleware
const maintenanceMode = require("./middleware/maintenanceMiddleware");

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

const path = require("path");

// Security Middleware - Apply before routes
// 1. Security headers (XSS protection, clickjacking prevention, etc.)
app.use(securityHeaders);

// 2. CORS configuration
const corsConfig = createCorsConfig([
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
].filter(Boolean));
app.use(cors(corsConfig));

// 3. General rate limiting
app.use(rateLimiters.general);

// 4. Audit logging for security events
app.use(auditLogger);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Input sanitization (after body parsing)
app.use(inputSanitizer);

// 6. NoSQL injection prevention
app.use(noSqlInjectionPrevention);

// 7. Maintenance mode check (after body parsing, before routes)
app.use(maintenanceMode);

// serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/profile", require("./routes/profileRoute"));
app.use("/api/reports", require("./routes/reportsRoute"));
app.use("/api/announcements", require("./routes/announcementsRoute"));
app.use("/api/logs", require("./routes/logsRoute"));
app.use("/api/document-requests", require("./routes/documentRequestRoute"));
// V2 routes with atomic address and file validation
app.use(
  "/api/v2/document-requests",
  require("./routes/documentRequestRoute_v2")
);
app.use("/api/terms", require("./routes/termsRoute"));
app.use("/api/analytics", require("./routes/analyticsRoute"));
app.use("/api/notifications", require("./routes/notificationRoute"));
app.use("/api/settings", require("./routes/settingsRoute"));
app.use("/api/achievements", require("./routes/achievementsRoute"));
app.use("/api/payments", require("./routes/paymentRoute"));
app.use("/api/sectoral", require("./routes/sectoralRoute"));
app.use("/api/hashtags", require("./routes/hashtagRoute"));

// New model routes
app.use("/api/officials", require("./routes/officialsRoute"));
app.use("/api/barangay-info", require("./routes/barangayInfoRoute"));
app.use("/api/services", require("./routes/servicesRoute"));
app.use("/api/faqs", require("./routes/faqsRoute"));
app.use("/api/banners", require("./routes/bannerRoute"));

// Document generation routes
app.use("/api/documents", require("./routes/documentRoutes"));

// Contact messages/feedback routes
app.use("/api/contact-messages", require("./routes/contactMessagesRoute"));
app.use("/api/feedback", require("./routes/contactMessagesRoute")); // Alias for frontend

// Profile verification routes (PSA birth certificate verification)
app.use("/api/profile-verification", require("./routes/profileVerificationRoute"));

// Profile update routes (for residents to update their profile)
app.use("/api/profile-update", require("./routes/profileUpdateRoute"));

// Cookie consent and IP logging routes
app.use("/api", require("./routes/cookieConsent"));

// PUBLIC: Document QR Code verification routes (no auth required)
app.use("/api/verify", require("./routes/verificationRoute"));


// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Barangay Culiat API is running",
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server Error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `Server running in ${
      process.env.NODE_ENV || "development"
    } mode on port ${PORT}`
  );
});
