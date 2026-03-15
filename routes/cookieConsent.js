const express = require('express');
const router = express.Router();
const CookieConsent = require('../models/CookieConsent');
const { protect, authorize } = require('../middleware/auth');
const ROLES = require('../config/roles');

const normalizeIp = (rawIp) => {
  if (!rawIp || typeof rawIp !== 'string') return null;

  let value = rawIp.trim();
  if (!value) return null;

  if (value.startsWith('::ffff:')) {
    value = value.replace('::ffff:', '');
  }

  if (value === '::1') {
    value = '127.0.0.1';
  }

  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(value)) {
    value = value.split(':')[0];
  }

  return value;
};

const getClientIpMeta = (req) => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  const orderedCandidates = [
    {
      source: 'x-forwarded-for',
      ip: normalizeIp(Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor?.split(',')[0]),
    },
    { source: 'x-real-ip', ip: normalizeIp(req.headers['x-real-ip']) },
    { source: 'cf-connecting-ip', ip: normalizeIp(req.headers['cf-connecting-ip']) },
    { source: 'x-client-ip', ip: normalizeIp(req.headers['x-client-ip']) },
    { source: 'req.ip', ip: normalizeIp(req.ip) },
    { source: 'req.socket.remoteAddress', ip: normalizeIp(req.socket?.remoteAddress) },
    { source: 'req.connection.remoteAddress', ip: normalizeIp(req.connection?.remoteAddress) },
  ];

  const firstResolved = orderedCandidates.find((entry) => Boolean(entry.ip));
  const selected = firstResolved?.ip || null;
  const source = firstResolved?.source || 'unresolved';
  const candidates = orderedCandidates.map((entry) => entry.ip).filter(Boolean);

  return {
    ip: selected,
    source,
    candidates,
  };
};

const isPrivateOrLocalIp = (ip) => {
  if (!ip || typeof ip !== 'string') return true;
  const value = ip.trim().toLowerCase();
  if (!value) return true;

  if (
    value === '::1' ||
    value === '127.0.0.1' ||
    value.startsWith('127.') ||
    value.startsWith('10.') ||
    value.startsWith('192.168.') ||
    value.startsWith('172.16.') ||
    value.startsWith('172.17.') ||
    value.startsWith('172.18.') ||
    value.startsWith('172.19.') ||
    value.startsWith('172.2') ||
    value.startsWith('169.254.') ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe80:')
  ) {
    return true;
  }

  return false;
};

const maskIp = (ip) => {
  if (!ip || typeof ip !== 'string') return 'unknown';

  const value = ip.trim();
  if (!value) return 'unknown';

  if (value.includes(':')) {
    const parts = value.split(':').filter(Boolean);
    if (parts.length <= 2) return 'xxxx:xxxx';
    return `${parts[0]}:${parts[1]}:xxxx:xxxx`;
  }

  const octets = value.split('.');
  if (octets.length !== 4) return 'xxx.xxx.xxx.xxx';
  return `${octets[0]}.${octets[1]}.xxx.xxx`;
};

// Get user's IP address
router.get('/get-ip', (req, res) => {
  try {
    const ipMeta = getClientIpMeta(req);

    console.log('[CookieConsent][GET /get-ip] IP resolution', {
      resolvedIp: maskIp(ipMeta.ip),
      source: ipMeta.source,
      reqIp: maskIp(req.ip),
      hasForwardedForHeader: Boolean(req.headers['x-forwarded-for']),
    });

    res.json({ 
      success: true,
      ip: ipMeta.ip || 'unknown' 
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
    const ipMeta = getClientIpMeta(req);
    const bodyIp = normalizeIp(ip);
    const reqIp = ipMeta.ip;

    const shouldUseRequestIp = reqIp && !isPrivateOrLocalIp(reqIp);
    const shouldUseBodyIp = bodyIp && bodyIp !== 'unknown' && !isPrivateOrLocalIp(bodyIp);

    const resolvedIp = shouldUseRequestIp
      ? reqIp
      : shouldUseBodyIp
        ? bodyIp
        : (reqIp || bodyIp || null);

    const resolutionSource = shouldUseRequestIp
      ? ipMeta.source
      : shouldUseBodyIp
        ? 'request-body-public-fallback'
        : (reqIp ? ipMeta.source : bodyIp ? 'request-body' : 'unresolved');

    console.log('[CookieConsent][POST /cookie-consent] Incoming consent payload', {
      accepted,
      bodyIp: maskIp(ip || ''),
      normalizedBodyIp: maskIp(bodyIp || ''),
      resolvedIp: maskIp(resolvedIp || ''),
      resolutionSource,
      reqIp: maskIp(req.ip),
      hasForwardedForHeader: Boolean(req.headers['x-forwarded-for']),
    });

    if (!resolvedIp || typeof accepted !== 'boolean' || !userAgent) {
      console.warn('[CookieConsent] Missing required fields for consent logging', {
        hasResolvedIp: !!resolvedIp,
        hasAcceptedBoolean: typeof accepted === 'boolean',
        hasUserAgent: !!userAgent,
      });

      return res.status(400).json({
        success: false,
        message: 'Missing required fields: ip, accepted, userAgent'
      });
    }

    // Check if IP is blacklisted
    const existingBlacklist = await CookieConsent.findOne({ 
      ip: resolvedIp,
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
      ip: resolvedIp,
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

// Get consent statistics (admin only)
router.get('/cookie-consent/stats', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), async (req, res) => {
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
      .select('ip accepted timestamp deviceFingerprint.timezone isBlacklisted isSuspicious');

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
      recent: recentConsents.map((entry) => ({
        ...entry.toObject(),
        ip: maskIp(entry.ip),
      }))
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

// Blacklist an IP address (admin only)
router.post('/cookie-consent/blacklist', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), async (req, res) => {
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

// Remove IP from blacklist (admin only)
router.post('/cookie-consent/whitelist', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), async (req, res) => {
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
router.get('/cookie-consent/blacklist', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), async (req, res) => {
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

// Check if IP is blacklisted (admin only)
router.get('/cookie-consent/check-ip/:ip', protect, authorize(ROLES.SystemAdmin, ROLES.SuperAdmin, ROLES.Admin), async (req, res) => {
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
