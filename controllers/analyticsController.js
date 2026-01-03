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

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get comprehensive dashboard statistics for admin dashboard
 * @access  Private (Admin)
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const { timeRange = "month", area = "all" } = req.query;
    const now = new Date();
    let startDate;
    let prevPeriodStart;

    switch (timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        prevPeriodStart = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        prevPeriodStart = new Date(startDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        prevPeriodStart = new Date(startDate.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case "all":
        startDate = new Date(0);
        prevPeriodStart = new Date(0);
        break;
      case "month":
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        prevPeriodStart = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build query filter for area
    const areaFilter = area !== "all" ? { "address.area": area } : {};
    const residentFilter = { role: 74934, registrationStatus: "approved", ...areaFilter };

    // === USER STATISTICS ===
    const totalResidents = await User.countDocuments(residentFilter);
    const prevResidents = await User.countDocuments({
      ...residentFilter,
      createdAt: { $gte: prevPeriodStart, $lt: startDate }
    });
    const newResidentsThisPeriod = await User.countDocuments({
      ...residentFilter,
      createdAt: { $gte: startDate }
    });
    const residentChange = prevResidents > 0 
      ? (((newResidentsThisPeriod - prevResidents) / prevResidents) * 100).toFixed(1)
      : newResidentsThisPeriod > 0 ? 100 : 0;

    // Pending registrations
    const pendingRegistrations = await User.countDocuments({
      role: 74934,
      registrationStatus: "pending",
      ...areaFilter
    });

    // === DOCUMENT REQUEST STATISTICS ===
    const totalDocRequests = await DocumentRequest.countDocuments({
      createdAt: { $gte: startDate }
    });
    const prevDocRequests = await DocumentRequest.countDocuments({
      createdAt: { $gte: prevPeriodStart, $lt: startDate }
    });
    const docRequestChange = prevDocRequests > 0
      ? (((totalDocRequests - prevDocRequests) / prevDocRequests) * 100).toFixed(1)
      : totalDocRequests > 0 ? 100 : 0;

    const pendingRequests = await DocumentRequest.countDocuments({ status: "pending" });
    const approvedRequests = await DocumentRequest.countDocuments({ status: "approved" });
    const completedRequests = await DocumentRequest.countDocuments({ 
      status: "completed",
      createdAt: { $gte: startDate }
    });
    const rejectedRequests = await DocumentRequest.countDocuments({ status: "rejected" });

    const completionRate = totalDocRequests > 0 
      ? ((completedRequests / totalDocRequests) * 100).toFixed(1) 
      : 0;

    // === REPORT STATISTICS ===
    const totalReports = await Report.countDocuments({
      createdAt: { $gte: startDate }
    });
    const prevReports = await Report.countDocuments({
      createdAt: { $gte: prevPeriodStart, $lt: startDate }
    });
    const reportChange = prevReports > 0
      ? (((totalReports - prevReports) / prevReports) * 100).toFixed(1)
      : totalReports > 0 ? 100 : 0;

    const pendingReports = await Report.countDocuments({ status: "pending" });
    const resolvedReports = await Report.countDocuments({ 
      status: "resolved",
      createdAt: { $gte: startDate }
    });

    // === TERMS ACCEPTANCE STATISTICS ===
    const totalTermsAccepted = await TermsAcceptance.countDocuments({
      createdAt: { $gte: startDate }
    });

    // === GET DISTINCT AREAS FOR DROPDOWN ===
    const areas = await User.distinct("address.area", { 
      role: 74934, 
      "address.area": { $ne: null, $ne: "" }
    });

    // === RECENT ACTIVITY ===
    const recentDocRequests = await DocumentRequest.find()
      .populate("applicant", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(5)
      .select("documentType status createdAt applicant");

    const recentReports = await Report.find()
      .populate("reportedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title status category createdAt reportedBy");

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalResidents,
          residentChange: parseFloat(residentChange),
          newResidentsThisPeriod,
          pendingRegistrations,
          totalDocRequests,
          docRequestChange: parseFloat(docRequestChange),
          pendingRequests,
          approvedRequests,
          completedRequests,
          rejectedRequests,
          completionRate: parseFloat(completionRate),
          totalReports,
          reportChange: parseFloat(reportChange),
          pendingReports,
          resolvedReports,
          totalTermsAccepted,
        },
        areas: areas.filter(a => a).sort(),
        recentActivity: {
          documentRequests: recentDocRequests.map(req => ({
            id: req._id,
            type: req.documentType,
            status: req.status,
            date: req.createdAt,
            applicant: req.applicant ? `${req.applicant.firstName} ${req.applicant.lastName}` : "Unknown"
          })),
          reports: recentReports.map(rep => ({
            id: rep._id,
            title: rep.title,
            status: rep.status,
            category: rep.category,
            date: rep.createdAt,
            reportedBy: rep.reportedBy ? `${rep.reportedBy.firstName} ${rep.reportedBy.lastName}` : "Unknown"
          }))
        }
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard statistics",
      error: error.message
    });
  }
};

/**
 * @route   GET /api/analytics/demographics
 * @desc    Get comprehensive user demographics for dashboard
 * @access  Private (Admin)
 */
exports.getUserDemographics = async (req, res) => {
  try {
    const { area = "all" } = req.query;
    
    // Build area filter
    const areaFilter = area !== "all" ? { "address.area": area } : {};
    const baseFilter = { role: 74934, registrationStatus: "approved", ...areaFilter };

    // === GENDER DISTRIBUTION ===
    const genderStats = await User.aggregate([
      { $match: baseFilter },
      { $group: { _id: "$gender", count: { $sum: 1 } } }
    ]);
    const genderDistribution = {
      male: genderStats.find(g => g._id === "Male")?.count || 0,
      female: genderStats.find(g => g._id === "Female")?.count || 0,
      other: genderStats.find(g => g._id === "Other")?.count || 0,
      notSpecified: genderStats.find(g => !g._id)?.count || 0
    };

    // === CIVIL STATUS DISTRIBUTION ===
    const civilStatusStats = await User.aggregate([
      { $match: baseFilter },
      { $group: { _id: "$civilStatus", count: { $sum: 1 } } }
    ]);
    const civilStatusDistribution = {
      single: civilStatusStats.find(c => c._id === "Single")?.count || 0,
      married: civilStatusStats.find(c => c._id === "Married")?.count || 0,
      widowed: civilStatusStats.find(c => c._id === "Widowed")?.count || 0,
      separated: civilStatusStats.find(c => c._id === "Separated")?.count || 0,
      divorced: civilStatusStats.find(c => c._id === "Divorced")?.count || 0,
      notSpecified: civilStatusStats.find(c => !c._id)?.count || 0
    };

    // === AGE DISTRIBUTION ===
    const now = new Date();
    const users = await User.find({ ...baseFilter, dateOfBirth: { $ne: null } })
      .select("dateOfBirth");
    
    const ageRanges = {
      "0-17": 0,
      "18-24": 0,
      "25-34": 0,
      "35-44": 0,
      "45-54": 0,
      "55-64": 0,
      "65+": 0,
      notSpecified: 0
    };

    const totalWithDOB = users.length;
    const totalWithoutDOB = await User.countDocuments({ ...baseFilter, dateOfBirth: null });
    ageRanges.notSpecified = totalWithoutDOB;

    users.forEach(user => {
      const birthDate = new Date(user.dateOfBirth);
      let age = now.getFullYear() - birthDate.getFullYear();
      const monthDiff = now.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 18) ageRanges["0-17"]++;
      else if (age <= 24) ageRanges["18-24"]++;
      else if (age <= 34) ageRanges["25-34"]++;
      else if (age <= 44) ageRanges["35-44"]++;
      else if (age <= 54) ageRanges["45-54"]++;
      else if (age <= 64) ageRanges["55-64"]++;
      else ageRanges["65+"]++;
    });

    // === VOTER STATISTICS ===
    const votersRegistered = await User.countDocuments({
      ...baseFilter,
      precinctNumber: { $ne: null, $ne: "" }
    });
    const nonVoters = await User.countDocuments({
      ...baseFilter,
      $or: [{ precinctNumber: null }, { precinctNumber: "" }]
    });

    // === AREA/PUROK DISTRIBUTION ===
    const areaStats = await User.aggregate([
      { $match: { role: 74934, registrationStatus: "approved" } },
      { $group: { _id: "$address.area", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const areaDistribution = areaStats
      .filter(a => a._id)
      .map(a => ({ area: a._id, count: a.count }));

    // === OCCUPATION STATISTICS ===
    const occupationStats = await User.aggregate([
      { $match: { ...baseFilter, occupation: { $ne: null, $ne: "" } } },
      { $group: { _id: "$occupation", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    const topOccupations = occupationStats.map(o => ({ 
      occupation: o._id, 
      count: o.count 
    }));

    // === RELIGION STATISTICS ===
    const religionStats = await User.aggregate([
      { $match: { ...baseFilter, religion: { $ne: null, $ne: "" } } },
      { $group: { _id: "$religion", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);
    const religionDistribution = religionStats.map(r => ({
      religion: r._id,
      count: r.count
    }));

    // === NATIONALITY STATISTICS ===
    const nationalityStats = await User.aggregate([
      { $match: baseFilter },
      { $group: { _id: "$nationality", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const nationalityDistribution = nationalityStats.map(n => ({
      nationality: n._id || "Not Specified",
      count: n.count
    }));

    // === REGISTRATION TRENDS (Last 6 months) ===
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const registrationTrends = await User.aggregate([
      { 
        $match: { 
          ...baseFilter, 
          createdAt: { $gte: sixMonthsAgo } 
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const trendsData = registrationTrends.map(t => ({
      month: months[t._id.month - 1],
      year: t._id.year,
      count: t.count
    }));

    // === SENIORS & PWD ESTIMATES (Age based) ===
    let seniorCitizens = 0;
    users.forEach(user => {
      const birthDate = new Date(user.dateOfBirth);
      let age = now.getFullYear() - birthDate.getFullYear();
      const monthDiff = now.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age >= 60) seniorCitizens++;
    });

    // === SUMMARY TOTALS ===
    const totalUsers = await User.countDocuments(baseFilter);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalUsers,
          totalWithDOB,
          totalWithoutDOB,
          votersRegistered,
          nonVoters,
          seniorCitizens
        },
        gender: genderDistribution,
        civilStatus: civilStatusDistribution,
        ageRanges,
        areaDistribution,
        topOccupations,
        religionDistribution,
        nationalityDistribution,
        registrationTrends: trendsData
      }
    });
  } catch (error) {
    console.error("Error fetching demographics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user demographics",
      error: error.message
    });
  }
};
