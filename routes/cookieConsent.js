const express = require('express');
const router = express.Router();
const CookieConsent = require('../models/CookieConsent');

// Get user's IP address
router.get('/get-ip', (req, res) => {
  try {
    // Get IP from various possible headers (for proxies/load balancers)
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
               req.headers['x-real-ip'] ||
               req.connection.remoteAddress ||
               req.socket.remoteAddress ||
               req.ip;

    res.json({ 
      success: true,
      ip: ip || 'unknown' 
    });
  } catch (error) {
    console.error('Error getting IP:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to retrieve IP address',
      ip: 'unknown'
    });
  }
});

// Log cookie consent
router.post('/cookie-consent', async (req, res) => {
  try {
    const { ip, accepted, userAgent, deviceFingerprint, referrer, currentUrl } = req.body;

    if (!ip || typeof accepted !== 'boolean' || !userAgent) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: ip, accepted, userAgent'
      });
    }

    // Check if IP is blacklisted
    const existingBlacklist = await CookieConsent.findOne({ 
      ip, 
      isBlacklisted: true 
    });

    if (existingBlacklist) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: IP address is blacklisted',
        reason: existingBlacklist.blacklistReason
      });
    }

    // Create consent record with enhanced security data
    const consent = new CookieConsent({
      ip,
      accepted,
      userAgent,
      deviceFingerprint: deviceFingerprint || {},
      referrer: referrer || 'direct',
      currentUrl: currentUrl || 'unknown',
      timestamp: new Date()
    });

    await consent.save();

    res.status(201).json({
      success: true,
      message: 'Cookie consent logged successfully',
      data: {
        id: consent._id,
        timestamp: consent.timestamp
      }
    });
  } catch (error) {
    console.error('Error logging cookie consent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log cookie consent',
      error: error.message
    });
  }
});

// Get consent statistics (admin only - you can add auth middleware)
router.get('/cookie-consent/stats', async (req, res) => {
  try {
    const totalConsents = await CookieConsent.countDocuments();
    const acceptedConsents = await CookieConsent.countDocuments({ accepted: true });
    const declinedConsents = await CookieConsent.countDocuments({ accepted: false });
    const blacklistedIPs = await CookieConsent.countDocuments({ isBlacklisted: true });
    const suspiciousActivity = await CookieConsent.countDocuments({ isSuspicious: true });

    // Get recent consents
    const recentConsents = await CookieConsent.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .select('ip accepted timestamp userAgent deviceFingerprint.timezone isBlacklisted isSuspicious');

    // Get unique IPs
    const uniqueIPs = await CookieConsent.distinct('ip');

    res.json({
      success: true,
      stats: {
        total: totalConsents,
        accepted: acceptedConsents,
        declined: declinedConsents,
        blacklisted: blacklistedIPs,
        suspicious: suspiciousActivity,
        uniqueIPs: uniqueIPs.length,
        acceptanceRate: totalConsents > 0 ? ((acceptedConsents / totalConsents) * 100).toFixed(2) : 0
      },
      recent: recentConsents
    });
  } catch (error) {
    console.error('Error getting consent stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve consent statistics',
      error: error.message
    });
  }
});

// Blacklist an IP address (admin only - add auth middleware)
router.post('/cookie-consent/blacklist', async (req, res) => {
  try {
    const { ip, reason, adminId } = req.body;

    if (!ip || !reason) {
      return res.status(400).json({
        success: false,
        message: 'IP address and reason are required'
      });
    }

    // Update all records for this IP
    const result = await CookieConsent.updateMany(
      { ip },
      {
        $set: {
          isBlacklisted: true,
          blacklistReason: reason,
          blacklistedAt: new Date(),
          blacklistedBy: adminId || null
        }
      }
    );

    res.json({
      success: true,
      message: `IP ${ip} has been blacklisted`,
      data: {
        recordsUpdated: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error blacklisting IP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to blacklist IP',
      error: error.message
    });
  }
});

// Remove IP from blacklist (admin only - add auth middleware)
router.post('/cookie-consent/whitelist', async (req, res) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required'
      });
    }

    const result = await CookieConsent.updateMany(
      { ip },
      {
        $set: {
          isBlacklisted: false,
          blacklistReason: null,
          blacklistedAt: null,
          blacklistedBy: null
        }
      }
    );

    res.json({
      success: true,
      message: `IP ${ip} has been removed from blacklist`,
      data: {
        recordsUpdated: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Error whitelisting IP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to whitelist IP',
      error: error.message
    });
  }
});

// Get blacklisted IPs (admin only)
router.get('/cookie-consent/blacklist', async (req, res) => {
  try {
    const blacklistedRecords = await CookieConsent.find({ isBlacklisted: true })
      .sort({ blacklistedAt: -1 })
      .select('ip blacklistReason blacklistedAt blacklistedBy timestamp')
      .populate('blacklistedBy', 'firstName lastName email');

    // Group by IP to avoid duplicates
    const uniqueBlacklisted = [];
    const seenIPs = new Set();

    for (const record of blacklistedRecords) {
      if (!seenIPs.has(record.ip)) {
        seenIPs.add(record.ip);
        uniqueBlacklisted.push(record);
      }
    }

    res.json({
      success: true,
      count: uniqueBlacklisted.length,
      data: uniqueBlacklisted
    });
  } catch (error) {
    console.error('Error getting blacklist:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve blacklist',
      error: error.message
    });
  }
});

// Check if IP is blacklisted (public endpoint)
router.get('/cookie-consent/check-ip/:ip', async (req, res) => {
  try {
    const { ip } = req.params;

    const blacklisted = await CookieConsent.findOne({ 
      ip, 
      isBlacklisted: true 
    }).select('blacklistReason blacklistedAt');

    res.json({
      success: true,
      isBlacklisted: !!blacklisted,
      reason: blacklisted?.blacklistReason || null,
      blacklistedAt: blacklisted?.blacklistedAt || null
    });
  } catch (error) {
    console.error('Error checking IP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check IP status',
      error: error.message
    });
  }
});

module.exports = router;
