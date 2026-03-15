const CommitteeMessage = require('../models/CommitteeMessage');
const Committee = require('../models/Committee');
const GuestProfile = require('../models/GuestProfile');
const Logs = require('../models/Logs');
const { escapeRegex } = require('../utils/securityUtils');

// @desc    Submit a new committee message
// @route   POST /api/committee-messages
// @access  Public
exports.submitMessage = async (req, res) => {
  try {
    const { committeeId, firstName, lastName, email, phoneNumber, subject, message, visitorId } = req.body;

    // Validate committee existence
    const committee = await Committee.findById(committeeId);
    if (!committee) {
      return res.status(404).json({
        success: false,
        message: 'Committee not found'
      });
    }

    const newMessage = await CommitteeMessage.create({
      committeeId,
      committeeName: committee.name,
      firstName,
      lastName,
      email,
      phoneNumber,
      subject,
      message,
      userId: req.user ? req.user._id : null,
      visitorId: visitorId || null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    if (!req.user?._id) {
      const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
      const guestSelector = visitorId ? { visitorId } : normalizedEmail ? { email: normalizedEmail } : null;

      if (guestSelector) {
        await GuestProfile.findOneAndUpdate(
          guestSelector,
          {
            $set: {
              firstName: firstName || null,
              lastName: lastName || null,
              email: normalizedEmail,
              phoneNumber: phoneNumber || null,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'] || null,
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
      data: newMessage,
      message: 'Your message has been sent to the committee.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error submitting message',
      error: error.message
    });
  }
};

// @desc    Get all committee messages (admin)
// @route   GET /api/committee-messages
// @access  Private/Admin
exports.getMessages = async (req, res) => {
  try {
    const { status, committeeId, search, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
    const queryObject = { isArchived: false };

    if (status) queryObject.status = status;
    if (committeeId) queryObject.committeeId = committeeId;
    if (search) {
      const safeSearch = escapeRegex(search);
      queryObject.$or = [
        { firstName: { $regex: safeSearch, $options: 'i' } },
        { lastName: { $regex: safeSearch, $options: 'i' } },
        { subject: { $regex: safeSearch, $options: 'i' } },
        { message: { $regex: safeSearch, $options: 'i' } }
      ];
    }
    if (dateFrom || dateTo) {
      queryObject.createdAt = {};
      if (dateFrom) queryObject.createdAt.$gte = new Date(dateFrom);
      if (dateTo) queryObject.createdAt.$lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const messages = await CommitteeMessage.find(queryObject)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await CommitteeMessage.countDocuments(queryObject);

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      pages: Math.ceil(total / limit),
      data: messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
};

// @desc    Get messages stats (admin)
// @route   GET /api/committee-messages/stats
// @access  Private/Admin
exports.getMessageStats = async (req, res) => {
  try {
    const total = await CommitteeMessage.countDocuments({ isArchived: false });
    const newCount = await CommitteeMessage.countDocuments({ status: 'new', isArchived: false });
    
    // Stats per committee
    const statsByCommittee = await CommitteeMessage.aggregate([
      { $match: { isArchived: false } },
      {
        $group: {
          _id: '$committeeId',
          committeeName: { $first: '$committeeName' },
          count: { $sum: 1 },
          newCount: {
            $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        newCount,
        statsByCommittee
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching stats',
      error: error.message
    });
  }
};

// @desc    Get single message (admin)
// @route   GET /api/committee-messages/:id
// @access  Private/Admin
exports.getMessage = async (req, res) => {
  try {
    const message = await CommitteeMessage.findById(req.params.id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.status(200).json({
      success: true,
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching message',
      error: error.message
    });
  }
};

// @desc    Update message status (admin)
// @route   PUT /api/committee-messages/:id/status
// @access  Private/Admin
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const message = await CommitteeMessage.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.status(200).json({
      success: true,
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating status',
      error: error.message
    });
  }
};

// @desc    Add admin response (admin)
// @route   POST /api/committee-messages/:id/response
// @access  Private/Admin
exports.respondToMessage = async (req, res) => {
  try {
    const { response } = req.body;
    const message = await CommitteeMessage.findByIdAndUpdate(
      req.params.id,
      {
        status: 'responded',
        response: {
          message: response,
          respondedBy: req.user._id,
          respondedAt: Date.now()
        }
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Log the response
    await Logs.create({
      action: 'RESPOND',
      module: 'CommitteeMessage',
      description: `Responded to message from ${message.firstName} ${message.lastName}`,
      performedBy: req.user._id
    });

    res.status(200).json({
      success: true,
      data: message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error responding to message',
      error: error.message
    });
  }
};

// @desc    Delete message (admin)
// @route   DELETE /api/committee-messages/:id
// @access  Private/Admin
exports.deleteMessage = async (req, res) => {
  try {
    const message = await CommitteeMessage.findByIdAndDelete(req.params.id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting message',
      error: error.message
    });
  }
};

// @desc    Get message for guest (public - shows message + response only)
// @route   GET /api/committee-messages/guest/:id
// @access  Public
exports.getGuestMessage = async (req, res) => {
  try {
    const message = await CommitteeMessage.findById(req.params.id);

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
        subject: message.subject,
        committeeName: message.committeeName,
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
