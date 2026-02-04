/**
 * Security Middleware
 * Implements ISO 27001 and OWASP security best practices
 */

/**
 * Rate Limiter Configuration
 * Uses in-memory store for simplicity (use Redis in production for distributed systems)
 */
const rateLimitStore = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Create a rate limiter middleware
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Error message when limit exceeded
 * @param {boolean} options.skipSuccessfulRequests - Skip counting successful requests
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes default
    max = 100, // 100 requests per window default
    message = "Too many requests, please try again later.",
    keyGenerator = (req) => req.ip || req.connection.remoteAddress,
    skipSuccessfulRequests = false,
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    let record = rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
    }
    
    record.count++;
    rateLimitStore.set(key, record);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
    
    if (record.count > max) {
      return res.status(429).json({
        success: false,
        message: message,
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }
    
    next();
  };
};

// Pre-configured rate limiters
const rateLimiters = {
  // General API rate limiter - very permissive for normal usage
  general: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3000, // 3000 requests per 15 minutes (allows ~3 req/sec for normal browsing)
    message: "Too many requests from this IP, please try again after 15 minutes",
  }),
  
  // Rate limiter for regular user authentication
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 login attempts per 15 minutes for residents
    message: "Too many login attempts detected. Please wait 15 minutes before trying again. If you've forgotten your password, use the 'Forgot Password' link to reset it.",
    keyGenerator: (req) => `auth_${req.ip}_${req.body?.email || req.body?.username || 'unknown'}`,
  }),
  
  // Strict rate limiter for admin authentication - prevents brute force
  adminAuth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Only 3 admin login attempts per 15 minutes
    message: "Too many admin login attempts detected. For security purposes, admin logins are limited to 3 attempts per 15 minutes. Please wait before trying again. All attempts are being monitored and logged.",
    keyGenerator: (req) => `admin_auth_${req.ip}_${req.body?.email || req.body?.username || 'unknown'}`,
  }),
  
  // Rate limiter for registration - relaxed for legitimate users
  registration: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes (reduced from 1 hour)
    max: 50, // 50 registration attempts per 15 minutes (increased from 10/hour)
    message: "Too many registration attempts, please try again later",
  }),
  
  // Rate limiter for password reset
  passwordReset: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 password reset attempts per hour
    message: "Too many password reset attempts, please try again later",
  }),
  
  // Rate limiter for file uploads
  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
    message: "Too many file uploads, please try again later",
  }),
};

/**
 * Sanitize string input to prevent XSS attacks
 * @param {string} str - Input string to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove on* event handlers
    .replace(/\s*on\w+\s*=\s*(['"])[^'"]*\1/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: protocol for potential XSS
    .replace(/data:(?!image\/)/gi, '')
    // Encode HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

/**
 * Sanitize object recursively
 * @param {*} obj - Object to sanitize
 * @returns {*} Sanitized object
 */
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip file objects
      if (value && typeof value === 'object' && (value.buffer || value.path)) {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * Input sanitization middleware
 * Sanitizes req.body, req.query, and req.params
 */
const inputSanitizer = (req, res, next) => {
  // Don't sanitize multipart/form-data as it may corrupt files
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    // Only sanitize text fields in multipart
    if (req.body) {
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string') {
          req.body[key] = sanitizeString(value);
        }
      }
    }
  } else {
    if (req.body) req.body = sanitizeObject(req.body);
  }
  
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  
  next();
};

/**
 * NoSQL Injection Prevention
 * Prevents MongoDB operator injection
 */
const noSqlInjectionPrevention = (req, res, next) => {
  const sanitizeForNoSQL = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const result = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Block MongoDB operators in keys
      if (typeof key === 'string' && key.startsWith('$')) {
        console.warn(`Blocked potential NoSQL injection attempt: ${key}`);
        continue;
      }
      
      if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeForNoSQL(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  };
  
  if (req.body) req.body = sanitizeForNoSQL(req.body);
  if (req.query) req.query = sanitizeForNoSQL(req.query);
  
  next();
};

/**
 * Security Headers Middleware
 * Implements secure HTTP headers
 */
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter in browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict Transport Security (HSTS)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy (basic)
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https: blob:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https:; " +
    "frame-ancestors 'self';"
  );
  
  next();
};

/**
 * Request logging middleware for audit trail
 */
const auditLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log after response is sent
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id || 'anonymous',
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    };
    
    // Log security-relevant events
    if (res.statusCode >= 400) {
      console.warn('[SECURITY AUDIT]', JSON.stringify(logData));
    } else if (req.originalUrl.includes('/auth/') || req.originalUrl.includes('/login') || req.originalUrl.includes('/register')) {
      console.log('[AUTH AUDIT]', JSON.stringify(logData));
    }
  });
  
  next();
};

/**
 * CORS configuration helper
 */
const createCorsConfig = (allowedOrigins = []) => {
  const defaultOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ];
  
  const origins = [...new Set([...defaultOrigins, ...allowedOrigins])];
  
  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list or matches production patterns
      if (origins.includes(origin) || 
          origin.endsWith('.vercel.app') || 
          origin.endsWith('.netlify.app') ||
          origin.includes('barangayculiat.com')) {
        return callback(null, true);
      }
      
      // In development, allow all origins
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      console.error('[CORS] Origin not allowed:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token', 'X-Visitor-Id'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24 hours
  };
};

module.exports = {
  rateLimiters,
  createRateLimiter,
  inputSanitizer,
  noSqlInjectionPrevention,
  securityHeaders,
  auditLogger,
  createCorsConfig,
  sanitizeString,
  sanitizeObject,
};
