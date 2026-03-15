const ContactMessage = require('../models/ContactMessage');
const GuestProfile = require('../models/GuestProfile');
const { LOGCONSTANTS } = require('../config/logConstants');
const { logAction } = require('../utils/logHelper');
const { escapeRegex, sanitizeSortField } = require('../utils/securityUtils');
const ROLES = require('../config/roles');
const { hasRole } = require('../utils/roleAccess');

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

const extractClientIp = (req) => {
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

  return {
    ip: firstResolved?.ip || null,
    source: firstResolved?.source || 'unresolved',
    candidates: orderedCandidates.map((entry) => entry.ip).filter(Boolean),
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

// @desc    Submit a contact message (public or logged-in user)
// @route   POST /api/contact-messages
// @access  Public
exports.submitContactMessage = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, subject, message, rating, category, visitorId, clientPublicIp } = req.body;

    // Get user ID if logged in
    const userId = req.user?._id || null;

    // Get IP address for spam prevention
    const ipMeta = extractClientIp(req);
    const normalizedClientPublicIp = normalizeIp(clientPublicIp);
    const ipAddress = (ipMeta.ip && !isPrivateOrLocalIp(ipMeta.ip))
      ? ipMeta.ip
      : (normalizedClientPublicIp && !isPrivateOrLocalIp(normalizedClientPublicIp))
        ? normalizedClientPublicIp
        : ipMeta.ip;
    const userAgent = (req.headers['user-agent'] || '').slice(0, 512) || null;

    console.log('[ContactMessage] IP resolution for submitContactMessage', {
      resolvedIp: maskIp(ipAddress || ''),
      resolutionSource: (ipMeta.ip && !isPrivateOrLocalIp(ipMeta.ip))
        ? ipMeta.source
        : (normalizedClientPublicIp && !isPrivateOrLocalIp(normalizedClientPublicIp))
          ? 'clientPublicIp'
          : ipMeta.source,
      clientPublicIp: maskIp(clientPublicIp || ''),
      normalizedClientPublicIp: maskIp(normalizedClientPublicIp || ''),
      reqIp: maskIp(req.ip || ''),
      hasForwardedForHeader: Boolean(req.headers['x-forwarded-for']),
      candidateIps: ipMeta.candidates.map((item) => maskIp(item || '')),
      visitorId: visitorId || null,
    });

    if (!ipAddress) {
      console.warn('[ContactMessage] IP could not be resolved for message submission');
    }

    // Map subject to category if needed
    let mappedCategory = category;
    if (!category && subject) {
      const subjectLower = subject.toLowerCase();
      if (subjectLower.includes('document')) mappedCategory = 'document_request';
      else if (subjectLower.includes('complaint')) mappedCategory = 'complaint';
      else if (subjectLower.includes('feedback')) mappedCategory = 'feedback';
      else if (subjectLower.includes('suggestion')) mappedCategory = 'suggestion';
      else mappedCategory = 'general_inquiry';
    }

    const contactMessage = await ContactMessage.create({
      firstName,
      lastName,
      email,
      phoneNumber,
      subject,
      message,
      rating: rating || null,
      category: mappedCategory || 'general_inquiry',
      userId,
      visitorId: visitorId || null,
      ipAddress,
      userAgent,
    });

    let guestProfile = null;
    if (!userId) {
      const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
      const guestSelector = visitorId ? { visitorId } : normalizedEmail ? { email: normalizedEmail } : null;

      if (guestSelector) {
        guestProfile = await GuestProfile.findOneAndUpdate(
          guestSelector,
          {
            $set: {
              firstName: firstName || null,
              lastName: lastName || null,
              email: normalizedEmail,
              phoneNumber: phoneNumber || null,
              ipAddress,
              userAgent,
              lastSeenAt: new Date(),
            },
            $setOnInsert: {
              visitorId: visitorId || null,
              residentType: 'Unregistered',
            },
          },
          { new: true, upsert: true }
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Your message has been submitted successfully. We will get back to you soon.',
      data: {
        id: contactMessage._id,
        visitorId: visitorId || guestProfile?.visitorId || null,
        guestProfile: guestProfile
          ? {
              firstName: guestProfile.firstName,
              lastName: guestProfile.lastName,
              email: guestProfile.email,
              phoneNumber: guestProfile.phoneNumber,
              residentType: guestProfile.residentType,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error submitting contact message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit message',
      error: error.message,
    });
  }
};

// @desc    Get all contact messages with pagination and filters
// @route   GET /api/contact-messages
// @access  Private (Admin)
exports.getAllContactMessages = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 15, 
      status, 
      rating,
      category,
      search, 
      dateFrom, 
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = { isArchived: false };

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Rating filter
    if (rating && rating !== 'all') {
      filter.rating = parseInt(rating);
    }

    // Category filter
    if (category && category !== 'all') {
      filter.category = category;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDate;
      }
    }

    // Search filter - escape regex to prevent ReDoS
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { firstName: { $regex: safeSearch, $options: 'i' } },
        { lastName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { subject: { $regex: safeSearch, $options: 'i' } },
        { message: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [messages, total] = await Promise.all([
      ContactMessage.find(filter)
        .populate('userId', 'firstName lastName email')
        .populate('assignedTo', 'firstName lastName')
        .populate('response.respondedBy', 'firstName lastName')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      ContactMessage.countDocuments(filter),
    ]);

    // Transform data for frontend
    const canViewRawIp = hasRole(req.user, ROLES.SystemAdmin, ROLES.SuperAdmin);

    const transformedMessages = messages.map(msg => ({
      _id: msg._id,
      name: msg.fullName,
      firstName: msg.firstName,
      lastName: msg.lastName,
      email: msg.email,
      subject: msg.subject,
      message: msg.message,
      rating: msg.rating,
      category: msg.category,
      status: msg.status,
      priority: msg.priority,
      isRegistered: !!msg.userId,
      visitorId: msg.visitorId || null,
      residentType: msg.userId ? 'Registered' : 'Unregistered',
      userId: msg.userId,
      ipAddress: canViewRawIp ? (msg.ipAddress || null) : maskIp(msg.ipAddress || ''),
      ipAddressMasked: maskIp(msg.ipAddress || ''),
      assignedTo: msg.assignedTo,
      response: msg.response,
      isSpam: msg.isSpam,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        feedbacks: transformedMessages,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message,
    });
  }
};

// @desc    Get feedback statistics
// @route   GET /api/contact-messages/stats
// @access  Private (Admin)
exports.getMessagesStats = async (req, res) => {
  try {
    const [
      totalCount,
      newCount,
      readCount,
      resolvedCount,
      spamCount,
      ratingStats,
    ] = await Promise.all([
      ContactMessage.countDocuments({ isArchived: false }),
      ContactMessage.countDocuments({ status: 'new', isArchived: false }),
      ContactMessage.countDocuments({ status: 'read', isArchived: false }),
      ContactMessage.countDocuments({ status: 'resolved', isArchived: false }),
      ContactMessage.countDocuments({ isSpam: true }),
      ContactMessage.aggregate([
        { $match: { rating: { $ne: null }, isArchived: false } },
        { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
    ]);

    // Get unique blocked IPs (where isSpam is true)
    const blockedIPs = await ContactMessage.distinct('ipAddress', { isSpam: true });

    res.status(200).json({
      success: true,
      data: {
        total: totalCount,
        new: newCount,
        read: readCount,
        resolved: resolvedCount,
        spam: spamCount,
        blockedIPs: blockedIPs.filter(ip => ip).length,
        avgRating: ratingStats[0]?.avgRating || 0,
        ratedCount: ratingStats[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message,
    });
  }
};

// @desc    Get messages by status
// @route   GET /api/contact-messages/status/:status
// @access  Private (Admin)
exports.getMessagesByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const messages = await ContactMessage.getByStatus(status, { excludeSpam: true });

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages by status',
      error: error.message,
    });
  }
};

// @desc    Get single contact message
// @route   GET /api/contact-messages/:id
// @access  Private (Admin)
exports.getContactMessage = async (req, res) => {
  try {
    const message = await ContactMessage.findById(req.params.id)
      .populate('userId', 'firstName lastName email phoneNumber')
      .populate('assignedTo', 'firstName lastName')
      .populate('response.respondedBy', 'firstName lastName')
      .populate('readBy.user', 'firstName lastName')
      .populate('internalNotes.addedBy', 'firstName lastName');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Mark as read
    await message.markAsRead(req.user._id);

    res.status(200).json({
      success: true,
      data: message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch message',
      error: error.message,
    });
  }
};

// @desc    Update message status
// @route   PUT /api/contact-messages/:id/status
// @access  Private (Admin)
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const message = await ContactMessage.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    message.status = status;
    await message.save();

    await logAction(
      LOGCONSTANTS.actions.records.UPDATE_RECORD,
      `Contact message status updated to ${status}: ${message._id}`,
      req.user
    );

    res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      data: message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message,
    });
  }
};

// @desc    Update message priority
// @route   PUT /api/contact-messages/:id/priority
// @access  Private (Admin)
exports.updatePriority = async (req, res) => {
  try {
    const { priority } = req.body;
    const message = await ContactMessage.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    message.priority = priority;
    await message.save();

    res.status(200).json({
      success: true,
      message: 'Priority updated successfully',
      data: message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update priority',
      error: error.message,
    });
  }
};

// @desc    Assign message to admin
// @route   PUT /api/contact-messages/:id/assign
// @access  Private (Admin)
exports.assignMessage = async (req, res) => {
  try {
    const { adminId } = req.body;
    const message = await ContactMessage.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    await message.assignTo(adminId);

    res.status(200).json({
      success: true,
      message: 'Message assigned successfully',
      data: message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to assign message',
      error: error.message,
    });
  }
};

// @desc    Add response to message
// @route   POST /api/contact-messages/:id/response
// @access  Private (Admin)
exports.addResponse = async (req, res) => {
  try {
    const { responseMessage } = req.body;
    const message = await ContactMessage.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    await message.addResponse(responseMessage, req.user._id);

    await logAction(
      LOGCONSTANTS.actions.records.UPDATE_RECORD,
      `Response added to contact message: ${message._id}`,
      req.user
    );

    res.status(200).json({
      success: true,
      message: 'Response added successfully',
      data: message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add response',
      error: error.message,
    });
  }
};

// @desc    Add internal note
// @route   POST /api/contact-messages/:id/note
// @access  Private (Admin)
exports.addInternalNote = async (req, res) => {
  try {
    const { note } = req.body;
    const message = await ContactMessage.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    await message.addInternalNote(note, req.user._id);

    res.status(200).json({
      success: true,
      message: 'Note added successfully',
      data: message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add note',
      error: error.message,
    });
  }
};

// @desc    Mark message as spam
// @route   PUT /api/contact-messages/:id/spam
// @access  Private (Admin)
exports.markAsSpam = async (req, res) => {
  try {
    const { isSpam } = req.body;
    const message = await ContactMessage.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    message.isSpam = isSpam !== undefined ? isSpam : true;
    message.status = 'spam';
    await message.save();

    await logAction(
      LOGCONSTANTS.actions.records.UPDATE_RECORD,
      `Contact message marked as ${isSpam ? 'spam' : 'not spam'}: ${message._id}`,
      req.user
    );

    res.status(200).json({
      success: true,
      message: `Message ${isSpam ? 'marked as spam' : 'unmarked from spam'}`,
      data: message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update spam status',
      error: error.message,
    });
  }
};

// @desc    Block IP address (mark all messages from IP as spam)
// @route   PUT /api/contact-messages/block-ip
// @access  Private (Admin)
exports.blockIP = async (req, res) => {
  try {
    const { ipAddress } = req.body;

    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required',
      });
    }

    const result = await ContactMessage.updateMany(
      { ipAddress },
      { $set: { isSpam: true, status: 'spam' } }
    );

    await logAction(
      LOGCONSTANTS.actions.records.UPDATE_RECORD,
      `IP address blocked: ${ipAddress} (${result.modifiedCount} messages affected)`,
      req.user
    );

    res.status(200).json({
      success: true,
      message: `IP ${ipAddress} blocked. ${result.modifiedCount} messages marked as spam.`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to block IP',
      error: error.message,
    });
  }
};

// @desc    Toggle archive status
// @route   PUT /api/contact-messages/:id/archive
// @access  Private (Admin)
exports.toggleArchive = async (req, res) => {
  try {
    const message = await ContactMessage.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    message.isArchived = !message.isArchived;
    message.archivedAt = message.isArchived ? new Date() : null;
    await message.save();

    res.status(200).json({
      success: true,
      message: `Message ${message.isArchived ? 'archived' : 'unarchived'}`,
      data: message,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle archive status',
      error: error.message,
    });
  }
};

// @desc    Delete contact message
// @route   DELETE /api/contact-messages/:id
// @access  Private (Admin)
exports.deleteContactMessage = async (req, res) => {
  try {
    const message = await ContactMessage.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    await message.deleteOne();

    await logAction(
      LOGCONSTANTS.actions.records.DELETE_RECORD,
      `Contact message deleted: ${req.params.id}`,
      req.user
    );

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message,
    });
  }
};

// @desc    Get message for guest (public - shows message + response only)
// @route   GET /api/contact-messages/guest/:id
// @access  Public
exports.getGuestMessage = async (req, res) => {
  try {
    const message = await ContactMessage.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Return only the necessary fields for the guest
    res.status(200).json({
      success: true,
      data: {
        _id: message._id,
        firstName: message.firstName,
        lastName: message.lastName,
        email: message.email,
        message: message.message,
        rating: message.rating,
        subject: message.subject,
        createdAt: message.createdAt,
        response: message.response,
        status: message.status,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching message',
      error: error.message,
    });
  }
};
