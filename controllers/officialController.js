const mongoose = require('mongoose');
const Official = require('../models/Official');
const Committee = require('../models/Committee');
const { LOGCONSTANTS } = require('../config/logConstants');
const { logAction } = require('../utils/logHelper');
const { deleteFromCloudinary, getPublicIdFromUrl } = require('../config/cloudinary');

const BRANCH_OPTIONS = [
  'Executive',
  'Legislative',
  'Administrative',
  'Lupong Tagapamayapa',
  'SK Council',
  'Barangay Public Safety Officers (BPSO)',
  'Other',
];

const BRANCH_ALIASES = {
  'sangguniang kabataan': 'SK Council',
  'sk': 'SK Council',
  'judiciary': 'Lupong Tagapamayapa',
  'bpso': 'Barangay Public Safety Officers (BPSO)',
  'barangay public safety officers': 'Barangay Public Safety Officers (BPSO)',
};

const normalizeBranchName = (branch) => {
  if (!branch || typeof branch !== 'string') return '';
  const raw = branch.trim();
  if (BRANCH_OPTIONS.includes(raw)) return raw;

  const lowered = raw.toLowerCase();
  if (BRANCH_ALIASES[lowered]) return BRANCH_ALIASES[lowered];

  const matched = BRANCH_OPTIONS.find((option) => option.toLowerCase() === lowered);
  return matched || '';
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
};

const parseNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseJsonIfString = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
};

const uniqueArray = (arr) => [...new Set(arr)];

const normalizeBranches = ({ branchesInput, branchInput, existingBranches = [] }) => {
  let normalized = [];

  const parsedBranches = parseJsonIfString(branchesInput, branchesInput);

  if (Array.isArray(parsedBranches) && parsedBranches.length > 0) {
    normalized = parsedBranches;
  } else if (
    parsedBranches &&
    typeof parsedBranches === 'object' &&
    !Array.isArray(parsedBranches)
  ) {
    normalized = Object.values(parsedBranches);
  } else if (typeof parsedBranches === 'string' && parsedBranches.includes(',')) {
    normalized = parsedBranches.split(',').map((item) => item.trim());
  } else if (typeof parsedBranches === 'string' && parsedBranches.trim()) {
    normalized = [parsedBranches.trim()];
  }

  if (branchInput && typeof branchInput === 'string') {
    normalized.push(branchInput.trim());
  }

  if (normalized.length === 0 && Array.isArray(existingBranches) && existingBranches.length > 0) {
    normalized = [...existingBranches];
  }

  normalized = uniqueArray(
    normalized
      .map((branch) => normalizeBranchName(branch))
      .filter(Boolean)
  );

  if (normalized.length === 0) normalized = ['Legislative'];

  return {
    branch: normalized[0],
    branches: normalized,
  };
};

const normalizeCommitteeAssignments = ({
  committeeAssignmentsInput,
  committeeRefInput,
  committeeRoleInput,
  existingAssignments = [],
}) => {
  const parsedAssignments = parseJsonIfString(committeeAssignmentsInput, committeeAssignmentsInput);
  let assignments = [];

  if (Array.isArray(parsedAssignments)) {
    assignments = parsedAssignments;
  }

  if (
    assignments.length === 0 &&
    committeeRefInput &&
    mongoose.Types.ObjectId.isValid(String(committeeRefInput))
  ) {
    assignments = [
      {
        committeeRef: String(committeeRefInput),
        committeeRole: committeeRoleInput || '',
      },
    ];
  }

  if (assignments.length === 0 && Array.isArray(existingAssignments)) {
    assignments = existingAssignments;
  }

  const normalized = [];
  const seen = new Set();

  assignments.forEach((assignment) => {
    const rawCommitteeId = assignment?.committeeRef?._id || assignment?.committeeRef;
    const committeeId = rawCommitteeId ? String(rawCommitteeId) : '';
    if (!committeeId || !mongoose.Types.ObjectId.isValid(committeeId)) return;

    const role = assignment?.committeeRole || '';
    const key = `${committeeId}:${role}`;
    if (seen.has(key)) return;
    seen.add(key);

    normalized.push({
      committeeRef: committeeId,
      committeeRole: role,
    });
  });

  return normalized;
};

const clearOfficialFromAllCommittees = async (officialId) => {
  await Committee.updateMany({ members: officialId }, { $pull: { members: officialId } });
  await Committee.updateMany({ chairperson: officialId }, { $unset: { chairperson: '' } });
  await Committee.updateMany({ coChairperson: officialId }, { $unset: { coChairperson: '' } });
};

const syncOfficialCommitteeAssignments = async (officialId, assignments) => {
  await clearOfficialFromAllCommittees(officialId);

  for (const assignment of assignments) {
    const committeeId = assignment.committeeRef;
    const role = assignment.committeeRole || '';

    const updateData = {
      $addToSet: { members: officialId },
    };

    if (role === 'chairperson') {
      updateData.chairperson = officialId;
    } else if (role === 'co_chairperson') {
      updateData.coChairperson = officialId;
    }

    await Committee.findByIdAndUpdate(committeeId, updateData);
  }
};

const hydrateCommitteeSummary = async (assignments) => {
  if (!assignments.length) {
    return {
      committee: '',
      committeeRef: undefined,
      committeeRole: '',
    };
  }

  const uniqueCommitteeIds = uniqueArray(assignments.map((item) => String(item.committeeRef)));
  const committees = await Committee.find({ _id: { $in: uniqueCommitteeIds } }).select('_id name');
  const nameMap = new Map(committees.map((committee) => [String(committee._id), committee.name]));

  const names = assignments
    .map((item) => nameMap.get(String(item.committeeRef)))
    .filter(Boolean);

  return {
    committee: uniqueArray(names).join(', '),
    committeeRef: assignments[0]?.committeeRef || undefined,
    committeeRole: assignments[0]?.committeeRole || '',
  };
};

const getExistingAssignments = (official) => {
  if (Array.isArray(official.committeeAssignments) && official.committeeAssignments.length > 0) {
    return official.committeeAssignments;
  }
  if (official.committeeRef) {
    return [
      {
        committeeRef: official.committeeRef,
        committeeRole: official.committeeRole || '',
      },
    ];
  }
  return [];
};

const buildOfficialPayload = async ({ reqBody, existingOfficial = null, photoUrl = null }) => {
  const {
    firstName,
    lastName,
    middleName,
    position,
    committee,
    isActive,
    contactNumber,
    email,
    bio,
    displayOrder,
    termStart,
    termEnd,
    committeeRef,
    committeeRole,
    committeeAssignments,
    branch,
    branches,
    officeHours,
    education,
  } = reqBody;

  const existingBranches = existingOfficial?.branches?.length
    ? existingOfficial.branches
    : existingOfficial?.branch
      ? [existingOfficial.branch]
      : [];

  const normalizedBranches = normalizeBranches({
    branchesInput: branches,
    branchInput: branch,
    existingBranches,
  });

  const normalizedAssignments = normalizeCommitteeAssignments({
    committeeAssignmentsInput: committeeAssignments,
    committeeRefInput: committeeRef,
    committeeRoleInput: committeeRole,
    existingAssignments: existingOfficial ? getExistingAssignments(existingOfficial) : [],
  });

  const committeeSummary = await hydrateCommitteeSummary(normalizedAssignments);

  return {
    firstName,
    lastName,
    middleName,
    position,
    committee: committee !== undefined ? committee : committeeSummary.committee,
    isActive: parseBoolean(
      isActive,
      existingOfficial ? existingOfficial.isActive : true
    ),
    contactNumber,
    email,
    photo: photoUrl,
    bio,
    displayOrder: parseNumber(
      displayOrder,
      existingOfficial ? existingOfficial.displayOrder : 0
    ),
    termStart,
    termEnd,
    branch: normalizedBranches.branch,
    branches: normalizedBranches.branches,
    committeeRef: committeeSummary.committeeRef,
    committeeRole: committeeSummary.committeeRole,
    committeeAssignments: normalizedAssignments,
    officeHours,
    education,
  };
};

// @desc    Get all officials
// @route   GET /api/officials
// @access  Public
exports.getAllOfficials = async (req, res) => {
  try {
    const { isActive, position } = req.query;
    const filter = {};

    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (position) filter.position = position;

    const officials = await Official.find(filter)
      .populate('committeeRef', 'name slug')
      .populate('committeeAssignments.committeeRef', 'name slug')
      .sort({ displayOrder: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: officials.length,
      data: officials,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching officials',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// @desc    Get active officials only
// @route   GET /api/officials/active
// @access  Public
exports.getActiveOfficials = async (req, res) => {
  try {
    const officials = await Official.find({ isActive: true })
      .populate('committeeRef', 'name slug')
      .populate('committeeAssignments.committeeRef', 'name slug')
      .sort({ displayOrder: 1 });

    res.status(200).json({
      success: true,
      count: officials.length,
      data: officials,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching active officials',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// @desc    Get all active officials for the personnel page (public)
// @route   GET /api/officials/personnel
// @access  Public
exports.getPersonnel = async (req, res) => {
  try {
    const officials = await Official.find({ isActive: true })
      .populate('committeeRef', 'name nameEnglish slug')
      .populate('committeeAssignments.committeeRef', 'name nameEnglish slug')
      .sort({ displayOrder: 1, lastName: 1 });

    res.status(200).json({
      success: true,
      count: officials.length,
      data: officials,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching personnel',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// @desc    Get officials by position
// @route   GET /api/officials/position/:position
// @access  Public
exports.getOfficialsByPosition = async (req, res) => {
  try {
    const { position } = req.params;

    const officials = await Official.find({
      position,
      isActive: true,
    })
      .populate('committeeRef', 'name slug')
      .populate('committeeAssignments.committeeRef', 'name slug')
      .sort({ displayOrder: 1 });

    res.status(200).json({
      success: true,
      count: officials.length,
      data: officials,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching officials by position',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// @desc    Get single official
// @route   GET /api/officials/:id
// @access  Public
exports.getOfficial = async (req, res) => {
  try {
    const official = await Official.findById(req.params.id)
      .populate('committeeRef', 'name slug')
      .populate('committeeAssignments.committeeRef', 'name slug');

    if (!official) {
      return res.status(404).json({
        success: false,
        message: 'Official not found',
      });
    }

    res.status(200).json({
      success: true,
      data: official,
    });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Official not found',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error fetching official',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// @desc    Create new official
// @route   POST /api/officials
// @access  Private (Admin)
exports.createOfficial = async (req, res) => {
  try {
    const { firstName, lastName, position } = req.body;

    if (!firstName || !lastName || !position) {
      return res.status(400).json({
        success: false,
        message: 'Please provide firstName, lastName, and position',
      });
    }

    let photoUrl = req.body.photo || null;
    if (req.file) {
      photoUrl = req.file.path || req.file.secure_url || req.file.url;
    }

    const payload = await buildOfficialPayload({
      reqBody: req.body,
      photoUrl,
    });

    const official = await Official.create(payload);

    await syncOfficialCommitteeAssignments(official._id, payload.committeeAssignments || []);

    res.status(201).json({
      success: true,
      message: 'Official created successfully',
      data: official,
    });

    await logAction(
      LOGCONSTANTS.actions.officials.CREATE_OFFICIAL,
      `Official created: ${official.firstName} ${official.lastName} - ${official.position}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating official',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// @desc    Update official
// @route   PUT /api/officials/:id
// @access  Private (Admin)
exports.updateOfficial = async (req, res) => {
  try {
    let official = await Official.findById(req.params.id);

    if (!official) {
      return res.status(404).json({
        success: false,
        message: 'Official not found',
      });
    }

    let photoUrl = official.photo;
    if (req.file) {
      if (official.photo) {
        const oldPublicId = getPublicIdFromUrl(official.photo);
        if (oldPublicId) {
          await deleteFromCloudinary(oldPublicId).catch((err) =>
            console.error('Error deleting old photo:', err)
          );
        }
      }
      photoUrl = req.file.path || req.file.secure_url || req.file.url;
    } else if (req.body.photo !== undefined) {
      photoUrl = req.body.photo;
    }

    const payload = await buildOfficialPayload({
      reqBody: req.body,
      existingOfficial: official,
      photoUrl,
    });

    const updateData = { ...payload };

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    official = await Official.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    await syncOfficialCommitteeAssignments(official._id, updateData.committeeAssignments || []);

    res.status(200).json({
      success: true,
      message: 'Official updated successfully',
      data: official,
    });

    await logAction(
      LOGCONSTANTS.actions.officials.UPDATE_OFFICIAL,
      `Official updated: ${official.firstName} ${official.lastName}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating official',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// @desc    Toggle official active status
// @route   PUT /api/officials/:id/toggle-active
// @access  Private (Admin)
exports.toggleActive = async (req, res) => {
  try {
    const official = await Official.findById(req.params.id);

    if (!official) {
      return res.status(404).json({
        success: false,
        message: 'Official not found',
      });
    }

    official.isActive = !official.isActive;
    await official.save();

    res.status(200).json({
      success: true,
      message: `Official ${official.isActive ? 'activated' : 'deactivated'} successfully`,
      data: official,
    });

    await logAction(
      LOGCONSTANTS.actions.officials.TOGGLE_OFFICIAL_STATUS,
      `Official ${official.isActive ? 'activated' : 'deactivated'}: ${official.firstName} ${official.lastName}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error toggling official status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// @desc    Bulk update officials display order
// @route   PUT /api/officials/reorder
// @access  Private (Admin)
exports.reorderOfficials = async (req, res) => {
  try {
    const { officials } = req.body;

    if (!Array.isArray(officials) || officials.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid officials array',
      });
    }

    const updatePromises = officials.map(({ id, displayOrder }) =>
      Official.findByIdAndUpdate(id, { displayOrder }, { new: true, runValidators: true })
    );

    await Promise.all(updatePromises);

    res.status(200).json({
      success: true,
      message: 'Officials reordered successfully',
    });

    await logAction(
      LOGCONSTANTS.actions.officials.REORDER_OFFICIALS,
      `${officials.length} officials reordered`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error reordering officials',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// @desc    Delete official
// @route   DELETE /api/officials/:id
// @access  Private (Admin)
exports.deleteOfficial = async (req, res) => {
  try {
    const official = await Official.findById(req.params.id);

    if (!official) {
      return res.status(404).json({
        success: false,
        message: 'Official not found',
      });
    }

    const officialName = `${official.firstName} ${official.lastName}`;
    const officialPosition = official.position;

    await clearOfficialFromAllCommittees(official._id);

    if (official.photo) {
      const publicId = getPublicIdFromUrl(official.photo);
      if (publicId) {
        await deleteFromCloudinary(publicId).catch((err) =>
          console.error('Error deleting photo from Cloudinary:', err)
        );
      }
    }

    await official.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Official deleted successfully',
    });

    await logAction(
      LOGCONSTANTS.actions.officials.DELETE_OFFICIAL,
      `Official deleted: ${officialName} - ${officialPosition}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting official',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

// @desc    Get officials statistics
// @route   GET /api/officials/stats/all
// @access  Private (Admin)
exports.getOfficialsStats = async (req, res) => {
  try {
    const totalOfficials = await Official.countDocuments();
    const activeOfficials = await Official.countDocuments({ isActive: true });
    const inactiveOfficials = await Official.countDocuments({ isActive: false });

    const positionCounts = await Official.aggregate([
      {
        $group: {
          _id: '$position',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalOfficials,
        active: activeOfficials,
        inactive: inactiveOfficials,
        byPosition: positionCounts,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching officials statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};
