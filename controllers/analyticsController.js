const DocumentRequest = require("../models/DocumentRequest");
const User = require("../models/User");
const Report = require("../models/Report");
const TermsAcceptance = require("../models/TermsAcceptance");
const { logAction } = require("../utils/logHelper");
const { LOGCONSTANTS } = require("../config/logConstants");

/**
 * @route   GET /api/analytics/overview
 * @desc    Get overview statistics for analytics dashboard
 * @access  Private (Admin)
 */
exports.getOverviewStats = async (req, res) => {
  try {
    const { timeRange = "month" } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "month":
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get total residents
    const totalResidents = await User.countDocuments({
      role: 74934,
      registrationStatus: "approved",
    });

    // Get previous period count for comparison
    const prevPeriodStart = new Date(
      startDate.getTime() - (now.getTime() - startDate.getTime())
    );
    const prevResidents = await User.countDocuments({
      role: 74934,
      registrationStatus: "approved",
      createdAt: { $gte: prevPeriodStart, $lt: startDate },
    });
    const newResidents = await User.countDocuments({
      role: 74934,
      registrationStatus: "approved",
      createdAt: { $gte: startDate },
    });
    const residentChange =
      prevResidents > 0
        ? ((newResidents / prevResidents) * 100).toFixed(1)
        : 100;

    // Get document requests statistics
    const totalDocRequests = await DocumentRequest.countDocuments({
      createdAt: { $gte: startDate },
    });
    const prevDocRequests = await DocumentRequest.countDocuments({
      createdAt: { $gte: prevPeriodStart, $lt: startDate },
    });
    const docRequestChange =
      prevDocRequests > 0
        ? (
            ((totalDocRequests - prevDocRequests) / prevDocRequests) *
            100
          ).toFixed(1)
        : 100;

    // Get pending requests
    const pendingRequests = await DocumentRequest.countDocuments({
      status: "pending",
    });
    const prevPending = await DocumentRequest.countDocuments({
      status: "pending",
      createdAt: { $gte: prevPeriodStart, $lt: startDate },
    });
    const pendingChange =
      prevPending > 0
        ? (((pendingRequests - prevPending) / prevPending) * 100).toFixed(1)
        : 0;

    // Calculate completion rate
    const completedRequests = await DocumentRequest.countDocuments({
      status: "completed",
      createdAt: { $gte: startDate },
    });
    const completionRate =
      totalDocRequests > 0
        ? ((completedRequests / totalDocRequests) * 100).toFixed(1)
        : 0;
    const prevCompleted = await DocumentRequest.countDocuments({
      status: "completed",
      createdAt: { $gte: prevPeriodStart, $lt: startDate },
    });
    const prevCompletionRate =
      prevDocRequests > 0
        ? ((prevCompleted / prevDocRequests) * 100).toFixed(1)
        : 0;
    const completionRateChange = (completionRate - prevCompletionRate).toFixed(
      1
    );

    res.status(200).json({
      success: true,
      data: {
        stats: [
          {
            name: "Total Residents",
            value: totalResidents.toString(),
            change: `+${residentChange}%`,
            trend: "up",
            icon: "Users",
            color: "blue",
          },
          {
            name: "Document Requests",
            value: totalDocRequests.toString(),
            change: `+${docRequestChange}%`,
            trend: docRequestChange >= 0 ? "up" : "down",
            icon: "FileText",
            color: "green",
          },
          {
            name: "Pending Requests",
            value: pendingRequests.toString(),
            change: `${pendingChange >= 0 ? "+" : ""}${pendingChange}%`,
            trend: pendingChange < 0 ? "down" : "up",
            icon: "Clock",
            color: "yellow",
          },
          {
            name: "Completion Rate",
            value: `${completionRate}%`,
            change: `${
              completionRateChange >= 0 ? "+" : ""
            }${completionRateChange}%`,
            trend: completionRateChange >= 0 ? "up" : "down",
            icon: "CheckCircle",
            color: "purple",
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error fetching overview stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching analytics overview",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/analytics/document-types
 * @desc    Get document request distribution by type
 * @access  Private (Admin)
 */
exports.getDocumentTypeDistribution = async (req, res) => {
  try {
    const { timeRange = "month" } = req.query;
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "month":
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const distribution = await DocumentRequest.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: "$documentType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const documentTypeLabels = {
      clearance: "Barangay Clearance",
      residency: "Certificate of Residency",
      business_permit: "Business Permit",
      indigency: "Indigency Certificate",
      ctc: "Community Tax Certificate",
      good_moral: "Certificate of Good Moral",
      business_clearance: "Business Closure",
      building_permit: "Building Permit",
      rehab: "Rehabilitation Certificate",
      barangay_id: "Barangay ID",
      liquor_permit: "Liquor Permit",
      missionary: "Missionary Certificate",
    };

    const series = distribution.map((d) => d.count);
    const labels = distribution.map((d) => documentTypeLabels[d._id] || d._id);

    res.status(200).json({
      success: true,
      data: { series, labels },
    });
  } catch (error) {
    console.error("Error fetching document type distribution:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching document type distribution",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/analytics/status-breakdown
 * @desc    Get request status breakdown
 * @access  Private (Admin)
 */
exports.getStatusBreakdown = async (req, res) => {
  try {
    const { timeRange = "month" } = req.query;
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "month":
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const breakdown = await DocumentRequest.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const statusMap = {
      pending: "Pending",
      approved: "Approved",
      completed: "Completed",
      rejected: "Rejected",
      cancelled: "Cancelled",
    };

    const categories = [
      "Pending",
      "Approved",
      "Completed",
      "Rejected",
      "Cancelled",
    ];
    const data = categories.map((cat) => {
      const statusKey = cat.toLowerCase();
      const found = breakdown.find((b) => b._id === statusKey);
      return found ? found.count : 0;
    });

    res.status(200).json({
      success: true,
      data: {
        series: [{ name: "Requests", data }],
        categories,
      },
    });
  } catch (error) {
    console.error("Error fetching status breakdown:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching status breakdown",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/analytics/monthly-trends
 * @desc    Get monthly trends for document requests
 * @access  Private (Admin)
 */
exports.getMonthlyTrends = async (req, res) => {
  try {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1); // Start of current year

    const trends = await DocumentRequest.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { month: { $month: "$createdAt" } },
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]);

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const totalData = new Array(12).fill(0);
    const completedData = new Array(12).fill(0);

    trends.forEach((t) => {
      const monthIndex = t._id.month - 1;
      totalData[monthIndex] = t.total;
      completedData[monthIndex] = t.completed;
    });

    res.status(200).json({
      success: true,
      data: {
        series: [
          { name: "Document Requests", data: totalData },
          { name: "Completed", data: completedData },
        ],
        categories: months,
      },
    });
  } catch (error) {
    console.error("Error fetching monthly trends:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching monthly trends",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/analytics/peak-hours
 * @desc    Get peak hours activity data
 * @access  Private (Admin)
 */
exports.getPeakHours = async (req, res) => {
  try {
    const { timeRange = "month" } = req.query;
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "month":
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const hourlyData = await DocumentRequest.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { hour: { $hour: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.hour": 1 } },
    ]);

    const data = new Array(24).fill(0);
    hourlyData.forEach((h) => {
      data[h._id.hour] = h.count;
    });

    res.status(200).json({
      success: true,
      data: {
        series: [{ name: "Requests", data }],
      },
    });
  } catch (error) {
    console.error("Error fetching peak hours:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching peak hours data",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/analytics/popular-services
 * @desc    Get most popular services
 * @access  Private (Admin)
 */
exports.getPopularServices = async (req, res) => {
  try {
    const { timeRange = "month", limit = 5 } = req.query;
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "month":
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const services = await DocumentRequest.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: "$documentType", requests: { $sum: 1 } } },
      { $sort: { requests: -1 } },
      { $limit: parseInt(limit) },
    ]);

    const total = services.reduce((sum, s) => sum + s.requests, 0);

    const documentTypeLabels = {
      clearance: "Barangay Clearance",
      residency: "Certificate of Residency",
      business_permit: "Business Permit",
      indigency: "Indigency Certificate",
      ctc: "Community Tax Certificate",
      good_moral: "Certificate of Good Moral",
      business_clearance: "Business Closure",
      building_permit: "Building Permit",
      rehab: "Rehabilitation Certificate",
      barangay_id: "Barangay ID",
      liquor_permit: "Liquor Permit",
      missionary: "Missionary Certificate",
    };

    const popularServices = services.map((s) => ({
      name: documentTypeLabels[s._id] || s._id,
      requests: s.requests,
      percentage: Math.round((s.requests / total) * 100),
    }));

    res.status(200).json({
      success: true,
      data: popularServices,
    });
  } catch (error) {
    console.error("Error fetching popular services:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching popular services",
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/analytics/summary
 * @desc    Get summary statistics
 * @access  Private (Admin)
 */
exports.getSummary = async (req, res) => {
  try {
    const { timeRange = "month" } = req.query;
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "month":
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Calculate average processing time
    const completedRequests = await DocumentRequest.find({
      status: "completed",
      processedAt: { $exists: true },
      createdAt: { $gte: startDate },
    }).select("createdAt processedAt");

    let avgProcessingTime = 0;
    if (completedRequests.length > 0) {
      const totalTime = completedRequests.reduce((sum, req) => {
        const diff = req.processedAt - req.createdAt;
        return sum + diff;
      }, 0);
      avgProcessingTime =
        totalTime / completedRequests.length / (1000 * 60 * 60 * 24); // Convert to days
    }

    // Active users today
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const activeUsersToday = await DocumentRequest.distinct("applicant", {
      createdAt: { $gte: todayStart },
    });

    // Find peak hour
    const hourlyActivity = await DocumentRequest.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { hour: { $hour: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);

    const peakHour =
      hourlyActivity.length > 0 ? hourlyActivity[0]._id.hour : 14;
    const peakHourFormatted = `${peakHour}:00 - ${peakHour + 1}:00`;

    res.status(200).json({
      success: true,
      data: {
        avgProcessingTime: avgProcessingTime.toFixed(1),
        activeUsersToday: activeUsersToday.length,
        peakHour: peakHourFormatted,
        satisfactionRate: "4.8", // This would come from a feedback system
      },
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching summary statistics",
      error: error.message,
    });
  }
};
