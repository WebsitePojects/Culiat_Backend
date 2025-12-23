const DocumentRequest = require("../models/DocumentRequest");
const Picture = require("../models/Picture");
const { LOGCONSTANTS } = require("../config/logConstants");
const { getRoleName } = require("../utils/roleHelpers");
const { logAction } = require("../utils/logHelper");

// Check if using Cloudinary
const isCloudinaryEnabled = () => {
  return (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

// Helper to get file URL from uploaded file
const getFileUrl = (file) => {
  if (!file) return null;
  // Cloudinary returns the URL in file.path
  if (isCloudinaryEnabled() && file.path && file.path.includes("cloudinary")) {
    return file.path;
  }
  // Local storage - construct URL from path
  const normalizedPath = file.path.replace(/\\/g, "/");
  return `/${normalizedPath}`;
};

// @desc    Create a new document request
// @route   POST /api/document-requests
// @access  Private (Resident/Admin)
exports.createDocumentRequest = async (req, res) => {
  try {
    const payload = req.body || {};

    // Fetch user profile to get stored files if needed
    const User = require("../models/User");
    const userProfile = await User.findById(req.user._id).select(
      "photo1x1 validID"
    );

    // Handle uploaded files - build proper file objects for the model
    let photo1x1 = null;
    if (req.files?.photo1x1) {
      const file = req.files.photo1x1[0];
      photo1x1 = {
        url: getFileUrl(file),
        filename: file.filename || file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      };
    } else if (
      payload.useStoredPhoto1x1 === "true" &&
      userProfile?.photo1x1?.url
    ) {
      // Use stored photo from user profile
      photo1x1 = {
        url: userProfile.photo1x1.url,
        filename: userProfile.photo1x1.filename,
        originalName: userProfile.photo1x1.originalName,
        mimeType: userProfile.photo1x1.mimeType,
        fileSize: userProfile.photo1x1.fileSize,
      };
    }

    let validID = null;
    if (req.files?.validID) {
      const file = req.files.validID[0];
      validID = {
        url: getFileUrl(file),
        filename: file.filename || file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      };
    } else if (
      payload.useStoredValidID === "true" &&
      userProfile?.validID?.url
    ) {
      // Use stored valid ID from user profile
      validID = {
        url: userProfile.validID.url,
        filename: userProfile.validID.filename,
        originalName: userProfile.validID.originalName,
        mimeType: userProfile.validID.mimeType,
        fileSize: userProfile.validID.fileSize,
      };
    }

    // Validate required files
    if (!validID) {
      return res.status(400).json({
        success: false,
        message:
          "Valid ID is required. Please upload a valid ID or use your stored ID from your profile.",
      });
    }

    // Prepare data for document request
    const documentData = {
      applicant: req.user?._id,
      lastName: payload.lastName,
      firstName: payload.firstName,
      middleName: payload.middleName,
      salutation: payload.salutation,
      dateOfBirth: payload.dateOfBirth,
      placeOfBirth: payload.placeOfBirth,
      gender: payload.gender?.toLowerCase(),
      civilStatus: payload.civilStatus?.toLowerCase().replace(/\s+/g, "_"),
      nationality: payload.nationality,
      address: payload.address || {},
      contactNumber: payload.contactNumber,
      emergencyContact: payload.emergencyContact || {},
      documentType: payload.documentType,
      purposeOfRequest: payload.purposeOfRequest,
      preferredPickupDate: payload.preferredPickupDate,
      remarks: payload.remarks,
      photo1x1: photo1x1,
      validID: validID,
      // Beneficiary info (for rehab certificate)
      beneficiaryInfo: payload.beneficiaryInfo || {},
      // Business info (for business permits)
      businessInfo: payload.businessInfo || {},
      // Foreign national info (for missionary certificates)
      foreignNationalInfo: payload.foreignNationalInfo || {},
      // Residency info (for residency certificates)
      residencyInfo: payload.residencyInfo || {},
      // Residency type (for barangay ID)
      residencyType: payload.residencyType,
      // Fees (for business permits)
      fees: payload.fees,
    };

    const newRequest = await DocumentRequest.create(documentData);

    // Wrap photo fields as { url }
    let responseObj = newRequest.toObject ? newRequest.toObject() : newRequest;
    if (responseObj.photo1x1) {
      responseObj.photo1x1 = { url: responseObj.photo1x1 };
    }
    if (responseObj.validID) {
      responseObj.validID = { url: responseObj.validID };
    }

    res.status(201).json({
      success: true,
      message: "Document request created successfully",
      data: responseObj,
    });

    await logAction(
      LOGCONSTANTS.actions.records.CREATE_RECORD,
      `Document request created: ${newRequest._id}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating document request",
      error: error.message,
    });
  }
};

// @desc    Get all document requests (admin)
// @route   GET /api/document-requests
// @access  Private (Admin)
exports.getAllDocumentRequests = async (req, res) => {
  try {
    const { status, documentType, applicant } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (documentType) filter.documentType = documentType;
    if (applicant) filter.applicant = applicant;

    const requests = await DocumentRequest.find(filter)
      .populate("applicant", "firstName lastName email")
      .sort({ createdAt: -1 });

    const normalized = requests.map((r) => {
      const obj = r.toObject ? r.toObject() : r;
      if (obj.photo1x1) {
        obj.photo1x1 = { url: obj.photo1x1 };
      }
      if (obj.validID) {
        obj.validID = { url: obj.validID };
      }
      return obj;
    });

    res
      .status(200)
      .json({ success: true, count: normalized.length, data: normalized });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching document requests",
      error: error.message,
    });
  }
};

// @desc    Get current user's document requests
// @route   GET /api/document-requests/my-requests
// @access  Private (Resident)
exports.getMyRequests = async (req, res) => {
  try {
    const requests = await DocumentRequest.find({
      applicant: req.user._id,
    }).sort({ createdAt: -1 });

    const normalized = requests.map((r) => {
      const obj = r.toObject ? r.toObject() : r;
      if (obj.photo1x1) {
        obj.photo1x1 = { url: obj.photo1x1 };
      }
      if (obj.validID) {
        obj.validID = { url: obj.validID };
      }
      return obj;
    });

    res
      .status(200)
      .json({ success: true, count: normalized.length, data: normalized });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching your document requests",
      error: error.message,
    });
  }
};

// @desc    Get single document request
// @route   GET /api/document-requests/:id
// @access  Private
exports.getDocumentRequest = async (req, res) => {
  try {
    const request = await DocumentRequest.findById(req.params.id).populate(
      "applicant",
      "firstName lastName email"
    );

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Document request not found" });
    }

    // Authorization: allow admin or owner
    if (
      request.applicant &&
      req.user &&
      request.applicant._id.toString() !== req.user._id.toString() &&
      req.user.role !== ROLES.Admin &&
      req.user.role !== ROLES.SuperAdmin
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this request",
      });
    }

    const obj = request.toObject ? request.toObject() : request;
    if (obj.photo1x1) {
      obj.photo1x1 = { url: obj.photo1x1 };
    }
    if (obj.validID) {
      obj.validID = { url: obj.validID };
    }

    res.status(200).json({ success: true, data: obj });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching document request",
      error: error.message,
    });
  }
};

// @desc    Update document request (applicant/updatable fields)
// @route   PUT /api/document-requests/:id
// @access  Private
exports.updateDocumentRequest = async (req, res) => {
  try {
    const request = await DocumentRequest.findById(req.params.id);

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Document request not found" });
    }

    // Only owner or admin can update
    if (
      request.applicant &&
      req.user &&
      request.applicant.toString() !== req.user._id.toString() &&
      req.user.role !== ROLES.Admin &&
      req.user.role !== ROLES.SuperAdmin
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this request",
      });
    }

    const updatable = [
      "lastName",
      "firstName",
      "middleName",
      "dateOfBirth",
      "placeOfBirth",
      "gender",
      "civilStatus",
      "nationality",
      "address",
      "contactNumber",
      "emergencyContact",
      "purposeOfRequest",
      "preferredPickupDate",
      "remarks",
      "photo1x1",
      "validID",
    ];
    updatable.forEach((field) => {
      if (req.body[field] !== undefined) {
        request[field] = req.body[field];
      }
    });

    await request.save();

    res.status(200).json({
      success: true,
      message: "Document request updated successfully",
      data: request,
    });

    await logAction(
      LOGCONSTANTS.actions.records.UPDATE_RECORD,
      `Document request updated: ${request._id}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating document request",
      error: error.message,
    });
  }
};

// @desc    Update request status (admin)
// @route   PUT /api/document-requests/:id/status
// @access  Private (Admin)
exports.updateRequestStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const request = await DocumentRequest.findById(req.params.id);

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Document request not found" });
    }

    request.status = status;
    request.processedBy = req.user?._id;
    request.processedAt = new Date();

    await request.save();

    res.status(200).json({
      success: true,
      message: "Document request status updated",
      data: request,
    });

    await logAction(
      LOGCONSTANTS.actions.records.UPDATE_RECORD,
      `Document request status updated: ${request._id} to ${status}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating request status",
      error: error.message,
    });
  }
};

// @desc    Delete document request
// @route   DELETE /api/document-requests/:id
// @access  Private (Admin or owner)
exports.deleteDocumentRequest = async (req, res) => {
  try {
    const request = await DocumentRequest.findById(req.params.id);

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Document request not found" });
    }

    // Only owner or admin can delete
    if (
      request.applicant &&
      req.user &&
      request.applicant.toString() !== req.user._id.toString() &&
      req.user.role !== ROLES.Admin &&
      req.user.role !== ROLES.SuperAdmin
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this request",
      });
    }

    await request.deleteOne();

    res.status(200).json({
      success: true,
      message: "Document request deleted successfully",
    });

    await logAction(
      LOGCONSTANTS.actions.records.DELETE_RECORD || "DELETE RECORD",
      `Document request deleted: ${request._id}`,
      req.user
    );
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting document request",
      error: error.message,
    });
  }
};

// @desc    Upload a file and create a Picture record (local filesystem)
// @route   POST /api/document-requests/upload
// @access  Private
exports.uploadPicture = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    // Check if Cloudinary URL exists
    const fileUrl =
      req.file.path && req.file.path.includes("cloudinary")
        ? req.file.path
        : `/uploads/document-requests/${req.file.filename}`;

    // create Picture document
    const pic = await Picture.create({
      filename: req.file.filename || req.file.public_id,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: fileUrl,
      uploadedBy: req.user?._id,
      isDocument: true,
    });

    res.status(201).json({ success: true, data: pic });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error uploading file",
      error: error.message,
    });
  }
};

// @desc    Get document request history with pagination and filters
// @route   GET /api/document-requests/history
// @access  Private (Admin)
exports.getDocumentHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      documentType,
      status,
      search,
      dateFrom,
      dateTo,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};

    // Document type filter
    if (documentType && documentType !== "all") {
      filter.documentType = documentType;
    }

    // Status filter
    if (status && status !== "all") {
      filter.status = status;
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

    // Search filter (by control number or applicant name)
    if (search) {
      filter.$or = [
        { controlNumber: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [requests, total] = await Promise.all([
      DocumentRequest.find(filter)
        .populate("applicant", "firstName lastName email")
        .populate("processedBy", "firstName lastName")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      DocumentRequest.countDocuments(filter),
    ]);

    // Transform data for frontend
    const transformedRequests = requests.map((req) => ({
      _id: req._id,
      referenceNumber:
        req.controlNumber ||
        `REQ-${req._id.toString().slice(-8).toUpperCase()}`,
      documentType: req.documentType,
      documentName: getDocumentLabel(req.documentType),
      applicant: {
        name: `${req.firstName} ${req.lastName}`,
        firstName: req.firstName,
        lastName: req.lastName,
      },
      status: req.status,
      paymentStatus: req.paymentStatus,
      fees: req.fees || getDocumentPrice(req.documentType),
      processedBy: req.processedBy
        ? {
            name: `${req.processedBy.firstName} ${req.processedBy.lastName}`,
          }
        : null,
      processedAt: req.processedAt,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        requests: transformedRequests,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching document history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch document history",
      error: error.message,
    });
  }
};

// @desc    Get document request stats
// @route   GET /api/document-requests/stats
// @access  Private (Admin)
exports.getDocumentStats = async (req, res) => {
  try {
    const [
      totalCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      completedCount,
    ] = await Promise.all([
      DocumentRequest.countDocuments(),
      DocumentRequest.countDocuments({ status: "pending" }),
      DocumentRequest.countDocuments({ status: "approved" }),
      DocumentRequest.countDocuments({ status: "rejected" }),
      DocumentRequest.countDocuments({ status: "completed" }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        completed: completedCount,
      },
    });
  } catch (error) {
    console.error("Error fetching document stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};

// @desc    Get payment history for documents
// @route   GET /api/document-requests/payments
// @access  Private (Admin)
exports.getDocumentPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      documentType,
      search,
      dateFrom,
      dateTo,
      sortBy = "paidAt",
      sortOrder = "desc",
    } = req.query;

    // Only get paid documents
    const filter = { paymentStatus: "paid" };

    // Document type filter
    if (documentType && documentType !== "all") {
      filter.documentType = documentType;
    }

    // Date range filter (by payment date)
    if (dateFrom || dateTo) {
      filter.paidAt = {};
      if (dateFrom) filter.paidAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filter.paidAt.$lte = endDate;
      }
    }

    // Search filter
    if (search) {
      filter.$or = [
        { controlNumber: { $regex: search, $options: "i" } },
        { paymentReference: { $regex: search, $options: "i" } },
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [payments, total, summary, breakdown] = await Promise.all([
      DocumentRequest.find(filter)
        .populate("applicant", "firstName lastName email")
        .populate("processedBy", "firstName lastName")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      DocumentRequest.countDocuments(filter),
      // Get summary stats
      DocumentRequest.aggregate([
        { $match: { paymentStatus: "paid" } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ["$fees", 0] } },
            totalTransactions: { $sum: 1 },
          },
        },
      ]),
      // Get breakdown by document type
      DocumentRequest.aggregate([
        { $match: { paymentStatus: "paid" } },
        {
          $group: {
            _id: "$documentType",
            count: { $sum: 1 },
            revenue: { $sum: { $ifNull: ["$fees", 0] } },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),
    ]);

    // Transform payments data
    const transformedPayments = payments.map((p) => ({
      _id: p._id,
      receiptNumber:
        p.paymentReference ||
        `OR-${new Date(p.paidAt).getFullYear()}-${p._id
          .toString()
          .slice(-6)
          .toUpperCase()}`,
      referenceNumber:
        p.controlNumber || `REQ-${p._id.toString().slice(-8).toUpperCase()}`,
      documentType: p.documentType,
      documentName: getDocumentLabel(p.documentType),
      amount: p.fees || getDocumentPrice(p.documentType),
      paymentMethod: p.paymentMethod || "Cash",
      payer: {
        name: `${p.firstName} ${p.lastName}`,
      },
      receivedBy: p.processedBy
        ? {
            name: `${p.processedBy.firstName} ${p.processedBy.lastName}`,
          }
        : null,
      paymentDate: p.paidAt || p.processedAt,
      createdAt: p.createdAt,
    }));

    // Transform breakdown
    const transformedBreakdown = breakdown.map((b) => ({
      type: getDocumentLabel(b._id),
      count: b.count,
      revenue: b.revenue || b.count * getDocumentPrice(b._id),
    }));

    // Calculate summary
    const summaryData = summary[0] || { totalRevenue: 0, totalTransactions: 0 };
    const avgTransaction =
      summaryData.totalTransactions > 0
        ? summaryData.totalRevenue / summaryData.totalTransactions
        : 0;

    // Find top document
    const topDoc =
      breakdown.length > 0 ? getDocumentLabel(breakdown[0]._id) : "N/A";

    res.status(200).json({
      success: true,
      data: {
        payments: transformedPayments,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        summary: {
          totalRevenue: summaryData.totalRevenue,
          totalTransactions: summaryData.totalTransactions,
          averageTransaction: avgTransaction,
          topDocument: topDoc,
        },
        breakdown: transformedBreakdown,
      },
    });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
      error: error.message,
    });
  }
};

// PayMongo commission rate for GCash (2.5%)
const PAYMONGO_COMMISSION_RATE = 0.025;
const MINIMUM_PAYMENT_AMOUNT = 50; // Minimum 50 PHP using PaymentIntents API

// Helper function to get base document price (what barangay receives)
function getDocumentPrice(documentType) {
  const DOCUMENT_PRICES = {
    indigency: 0,
    residency: 50,
    clearance: 100,
    business_permit: 500,
    business_clearance: 200,
    good_moral: 75,
    barangay_id: 150,
    liquor_permit: 300,
    missionary: 50,
    rehab: 50,
    ctc: 50,
    building_permit: 500,
  };
  return DOCUMENT_PRICES[documentType] || 0;
}

// Helper function to calculate total with commission
function calculateTotalWithCommission(basePrice) {
  if (basePrice === 0) return 0;
  let totalAmount = basePrice * (1 + PAYMONGO_COMMISSION_RATE);
  if (totalAmount < MINIMUM_PAYMENT_AMOUNT) {
    totalAmount = MINIMUM_PAYMENT_AMOUNT;
  }
  return Math.round(totalAmount * 100) / 100;
}

// Helper function to get document label
function getDocumentLabel(documentType) {
  const DOCUMENT_LABELS = {
    indigency: "Certificate of Indigency",
    residency: "Certificate of Residency",
    clearance: "Barangay Clearance",
    business_permit: "Business Permit",
    business_clearance: "Business Clearance",
    good_moral: "Good Moral Certificate",
    barangay_id: "Barangay ID",
    liquor_permit: "Liquor Permit",
    missionary: "Missionary Certificate",
    rehab: "Rehabilitation Certificate",
    ctc: "Community Tax Certificate",
    building_permit: "Building Permit",
  };
  return DOCUMENT_LABELS[documentType] || documentType;
}
