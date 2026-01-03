const ContactMessage = require('../models/ContactMessage');
const { LOGCONSTANTS } = require('../config/logConstants');
const { logAction } = require('../utils/logHelper');

// @desc    Submit a contact message (public or logged-in user)
// @route   POST /api/contact-messages
// @access  Public
exports.submitContactMessage = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, subject, message, rating, category } = req.body;

    // Get user ID if logged in
    const userId = req.user?._id || null;

    // Get IP address for spam prevention
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

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
      ipAddress,
      userAgent,
    });

    res.status(201).json({
      success: true,
      message: 'Your message has been submitted successfully. We will get back to you soon.',
      data: { id: contactMessage._id },
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

    // Search filter
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
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
      userId: msg.userId,
      ipAddress: msg.ipAddress,
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
