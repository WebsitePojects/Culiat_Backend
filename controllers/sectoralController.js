const SectoralGroup = require("../models/SectoralGroup");
const User = require("../models/User");
const { logActivity } = require("../utils/logHelper");

/**
 * @route   POST /api/sectoral/register
 * @desc    Register a user to a sectoral group
 * @access  Private (Admin)
 */
exports.registerToSector = async (req, res) => {
  try {
    const {
      userId,
      sectorType,
      seniorCitizenId,
      osca,
      pwdId,
      disabilityType,
      disabilityDetails,
      soloParentId,
      numberOfChildren,
      childrenAges,
      reasonForSoloParenthood,
      hasChildren,
      numberOfChildrenUnder18,
      isPregnant,
      expectedDeliveryDate,
      supportingDocuments,
      notes,
    } = req.body;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is already registered in this sector
    const existingRegistration = await SectoralGroup.findOne({
      userId,
      sectorType,
    });

    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        message: `User is already registered in ${sectorType} sector`,
      });
    }

    // Create sectoral group registration
    const sectoralData = {
      userId,
      sectorType,
      registeredBy: req.user._id,
      approvedBy: req.user._id,
      approvedAt: new Date(),
      status: "active",
      notes,
    };

    // Add sector-specific fields
    if (sectorType === "senior") {
      sectoralData.seniorCitizenId = seniorCitizenId;
      sectoralData.osca = osca;
    } else if (sectorType === "pwd") {
      sectoralData.pwdId = pwdId;
      sectoralData.disabilityType = disabilityType;
      sectoralData.disabilityDetails = disabilityDetails;
    } else if (sectorType === "solo_parent") {
      sectoralData.soloParentId = soloParentId;
      sectoralData.numberOfChildren = numberOfChildren;
      sectoralData.childrenAges = childrenAges;
      sectoralData.reasonForSoloParenthood = reasonForSoloParenthood;
    } else if (sectorType === "women_children") {
      sectoralData.hasChildren = hasChildren;
      sectoralData.numberOfChildrenUnder18 = numberOfChildrenUnder18;
      sectoralData.isPregnant = isPregnant;
      sectoralData.expectedDeliveryDate = expectedDeliveryDate;
    }

    if (supportingDocuments) {
      sectoralData.supportingDocuments = supportingDocuments;
    }

    const sectoral = await SectoralGroup.create(sectoralData);

    // Log activity
    await logActivity({
      actionType: "sectoral_registration",
      actionBy: req.user._id,
      description: `Registered user ${user.firstName} ${user.lastName} to ${sectorType} sector`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: "User registered to sectoral group successfully",
      data: sectoral,
    });
  } catch (error) {
    console.error("Error registering to sectoral group:", error);
    res.status(500).json({
      success: false,
      message: "Failed to register to sectoral group",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/sectoral/:sectorType
 * @desc    Get all members of a specific sectoral group
 * @access  Private (Admin)
 */
exports.getSectorMembers = async (req, res) => {
  try {
    const { sectorType } = req.params;
    const { status, page = 1, limit = 50 } = req.query;

    const query = { sectorType };
    if (status) {
      query.status = status;
    }

    const members = await SectoralGroup.find(query)
      .populate(
        "userId",
        "firstName lastName middleName email phoneNumber dateOfBirth address"
      )
      .populate("registeredBy", "firstName lastName")
      .populate("approvedBy", "firstName lastName")
      .sort({ dateRegistered: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await SectoralGroup.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        members,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        total: count,
      },
    });
  } catch (error) {
    console.error("Error fetching sector members:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sector members",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/sectoral/user/:userId
 * @desc    Get all sectoral groups a user belongs to
 * @access  Private
 */
exports.getUserSectoralGroups = async (req, res) => {
  try {
    const { userId } = req.params;

    const sectoralGroups = await SectoralGroup.find({ userId })
      .populate("registeredBy", "firstName lastName")
      .populate("approvedBy", "firstName lastName")
      .sort({ dateRegistered: -1 });

    res.status(200).json({
      success: true,
      data: sectoralGroups,
    });
  } catch (error) {
    console.error("Error fetching user sectoral groups:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user sectoral groups",
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/sectoral/:id
 * @desc    Update sectoral group registration
 * @access  Private (Admin)
 */
exports.updateSectoralRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const sectoral = await SectoralGroup.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("userId", "firstName lastName email");

    if (!sectoral) {
      return res.status(404).json({
        success: false,
        message: "Sectoral registration not found",
      });
    }

    // Log activity
    await logActivity({
      actionType: "sectoral_update",
      actionBy: req.user._id,
      description: `Updated ${sectoral.sectorType} registration for user ${sectoral.userId.firstName} ${sectoral.userId.lastName}`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Sectoral registration updated successfully",
      data: sectoral,
    });
  } catch (error) {
    console.error("Error updating sectoral registration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sectoral registration",
      error: error.message,
    });
  }
};

/**
 * @route   DELETE /api/sectoral/:id
 * @desc    Remove user from sectoral group
 * @access  Private (Admin)
 */
exports.removeSectoralRegistration = async (req, res) => {
  try {
    const { id } = req.params;

    const sectoral = await SectoralGroup.findByIdAndDelete(id).populate(
      "userId",
      "firstName lastName"
    );

    if (!sectoral) {
      return res.status(404).json({
        success: false,
        message: "Sectoral registration not found",
      });
    }

    // Log activity
    await logActivity({
      actionType: "sectoral_removal",
      actionBy: req.user._id,
      description: `Removed user ${sectoral.userId.firstName} ${sectoral.userId.lastName} from ${sectoral.sectorType} sector`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "User removed from sectoral group successfully",
    });
  } catch (error) {
    console.error("Error removing sectoral registration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove sectoral registration",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/sectoral/statistics
 * @desc    Get statistics for all sectoral groups
 * @access  Private (Admin)
 */
exports.getSectoralStatistics = async (req, res) => {
  try {
    const statistics = await SectoralGroup.aggregate([
      {
        $group: {
          _id: "$sectorType",
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          inactive: {
            $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          sectorType: "$_id",
          total: 1,
          active: 1,
          inactive: 1,
          pending: 1,
          _id: 0,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error("Error fetching sectoral statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sectoral statistics",
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/sectoral/:id/benefit
 * @desc    Add benefit record to sectoral member
 * @access  Private (Admin)
 */
exports.addBenefit = async (req, res) => {
  try {
    const { id } = req.params;
    const { benefitType, dateReceived, amount, description } = req.body;

    const sectoral = await SectoralGroup.findById(id);
    if (!sectoral) {
      return res.status(404).json({
        success: false,
        message: "Sectoral registration not found",
      });
    }

    sectoral.benefitsReceived.push({
      benefitType,
      dateReceived: dateReceived || new Date(),
      amount,
      description,
    });

    await sectoral.save();

    res.status(200).json({
      success: true,
      message: "Benefit record added successfully",
      data: sectoral,
    });
  } catch (error) {
    console.error("Error adding benefit:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add benefit record",
      error: error.message,
    });
  }
};
