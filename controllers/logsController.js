const Logs = require('../models/Logs');
const { getRoleName } = require('../utils/roleHelpers');
const { logAction } = require('../utils/logHelper');
const { LOGCONSTANTS } = require('../config/logConstants');

// @desc  Get all logs with pagination, filtering, and search
// @route GET /api/logs
// @access Private (Admin/SuperAdmin/SystemAdmin)
exports.getAllLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      action,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const filter = {};

    // Category filter
    if (category && category !== 'all') {
      filter.category = category;
    }

    // Action keyword filter (case-insensitive partial match)
    if (action && action !== 'all') {
      filter.action = { $regex: action, $options: 'i' };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.timestamp = {};
      if (dateFrom) filter.timestamp.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    // Search filter – match description or action or performedByRole
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { performedByRole: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageLimit = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * pageLimit;

    const [logs, total] = await Promise.all([
      Logs.find(filter)
        .populate('performedBy', 'firstName lastName email username')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pageLimit),
      Logs.countDocuments(filter),
    ]);

    // Shape logs to match frontend expectations
    const shapedLogs = logs.map((log) => ({
      _id: log._id,
      action: log.action,
      category: log.category,
      description: log.description,
      performedByRole: log.performedByRole,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      timestamp: log.timestamp,
      createdAt: log.timestamp,
      user: log.performedBy
        ? {
            _id: log.performedBy._id,
            name: `${log.performedBy.firstName || ''} ${log.performedBy.lastName || ''}`.trim(),
            email: log.performedBy.email,
            username: log.performedBy.username,
          }
        : null,
    }));

    res.status(200).json({
      success: true,
      data: {
        logs: shapedLogs,
        total,
        totalPages: Math.ceil(total / pageLimit),
        currentPage: pageNum,
        limit: pageLimit,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching logs', error: error.message });
  }
};

// @desc  Export logs as CSV
// @route GET /api/logs/export
// @access Private (SuperAdmin/SystemAdmin)
exports.exportLogs = async (req, res) => {
  try {
    const { category, action, dateFrom, dateTo, search } = req.query;

    const filter = {};
    if (category && category !== 'all') filter.category = category;
    if (action && action !== 'all') filter.action = { $regex: action, $options: 'i' };
    if (dateFrom || dateTo) {
      filter.timestamp = {};
      if (dateFrom) filter.timestamp.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { performedByRole: { $regex: search, $options: 'i' } },
      ];
    }

    const logs = await Logs.find(filter)
      .populate('performedBy', 'firstName lastName email username')
      .sort({ timestamp: -1 })
      .limit(10000); // safety cap

    // Build CSV
    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    };

    const headers = ['Timestamp', 'User', 'Username', 'Role', 'Action', 'Category', 'Description', 'IP Address'];
    const rows = logs.map((log) => {
      const performer = log.performedBy;
      return [
        escape(log.timestamp ? new Date(log.timestamp).toISOString() : ''),
        escape(performer ? `${performer.firstName || ''} ${performer.lastName || ''}`.trim() : 'Unknown'),
        escape(performer ? performer.username : ''),
        escape(log.performedByRole || ''),
        escape(log.action || ''),
        escape(log.category || ''),
        escape(log.description || ''),
        escape(log.ipAddress || ''),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const dateStr = new Date().toISOString().split('T')[0];

    // Log the export action
    await logAction(
      LOGCONSTANTS.actions.activityLogs.EXPORT_ACTIVITY_LOGS,
      `Exported ${logs.length} activity log(s) to CSV`,
      req.user,
      req
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="activity-logs-${dateStr}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error exporting logs', error: error.message });
  }
};

// @desc  Create a log entry (internal use or admin manual entry)
// @route POST /api/logs
// @access Private (Admin/SuperAdmin/SystemAdmin)
exports.createLog = async (req, res) => {
  try {
    const { action, description } = req.body;
    const performerId = req.user ? req.user._id : req.body.performedBy;
    const performerRoleCode = req.user ? req.user.role : undefined;
    const performerRoleName = performerRoleCode ? getRoleName(performerRoleCode) : undefined;

    const log = await Logs.create({
      action,
      description,
      performedBy: performerId,
      performedByRole: performerRoleName,
      ipAddress: req.ip || (req.connection && req.connection.remoteAddress) || null,
      userAgent: req.headers['user-agent'] || null,
    });

    const populated = await Logs.findById(log._id).populate('performedBy', 'firstName lastName email username');
    res.status(201).json({ success: true, message: 'Log created', data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Error creating log', error: error.message });
  }
};

// @desc  Get single log by id
// @route GET /api/logs/:id
// @access Private (Admin/SuperAdmin/SystemAdmin)
exports.getLogById = async (req, res) => {
  try {
    const log = await Logs.findById(req.params.id).populate('performedBy', 'firstName lastName email username');
    if (!log) return res.status(404).json({ success: false, message: 'Log not found' });
    res.status(200).json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching log', error: error.message });
  }
};

// @desc  Delete a log
// @route DELETE /api/logs/:id
// @access Private (SuperAdmin/SystemAdmin)
exports.deleteLog = async (req, res) => {
  try {
    const log = await Logs.findByIdAndDelete(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Log not found' });

    // Log the deletion
    await logAction(
      LOGCONSTANTS.actions.activityLogs.DELETE_LOG,
      `Deleted log entry: ${log.action} - ${log.description?.substring(0, 60)}`,
      req.user,
      req
    );

    res.status(200).json({ success: true, message: 'Log deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting log', error: error.message });
  }
};
