const axios = require('axios');
const crypto = require('crypto');
const DocumentRequest = require('../models/DocumentRequest');
const { LOGCONSTANTS } = require('../config/logConstants');
const { logAction } = require('../utils/logHelper');

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;
const PAYMONGO_API_URL = 'https://api.paymongo.com/v1';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Document prices (in PHP) - same as documentController
const DOCUMENT_PRICES = {
    'indigency': 0,
    'residency': 50,
    'clearance': 100,
    'business_permit': 500,
    'business_clearance': 200,
    'good_moral': 75,
    'barangay_id': 150,
    'liquor_permit': 300,
    'missionary': 50,
    'rehab': 50,
    'ctc': 50,
    'building_permit': 500,
};

// Document type labels
const DOCUMENT_LABELS = {
    'indigency': 'Certificate of Indigency',
    'residency': 'Certificate of Residency',
    'clearance': 'Barangay Clearance',
    'business_permit': 'Business Permit',
    'business_clearance': 'Business Clearance',
    'good_moral': 'Certificate of Good Moral Character',
    'barangay_id': 'Barangay ID',
    'liquor_permit': 'Liquor Permit',
    'missionary': 'Missionary Certificate',
    'rehab': 'Rehabilitation Certificate',
    'ctc': 'Community Tax Certificate',
    'building_permit': 'Building Permit',
};

// Helper to create PayMongo headers
const getHeaders = () => {
    const token = Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64');
    return {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
};

/**
 * @desc    Get payment details for a document request
 * @route   GET /api/payments/details/:requestId
 * @access  Private (Owner or Admin)
 */
exports.getPaymentDetails = async (req, res) => {
    try {
        const { requestId } = req.params;
        const ROLES = require('../config/roles');

        const documentRequest = await DocumentRequest.findById(requestId)
            .populate('applicant', 'firstName lastName email phoneNumber');

        if (!documentRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Document request not found' 
            });
        }

        // Check authorization - only owner or admin can view
        const isOwner = documentRequest.applicant?._id?.toString() === req.user._id.toString();
        const isAdmin = req.user.role === ROLES.Admin || req.user.role === ROLES.SuperAdmin;

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this payment'
            });
        }

        // Calculate the price
        const price = documentRequest.fees > 0 
            ? documentRequest.fees 
            : DOCUMENT_PRICES[documentRequest.documentType] || 0;

        res.status(200).json({
            success: true,
            data: {
                requestId: documentRequest._id,
                documentType: documentRequest.documentType,
                documentLabel: DOCUMENT_LABELS[documentRequest.documentType] || documentRequest.documentType,
                status: documentRequest.status,
                paymentStatus: documentRequest.paymentStatus,
                paymentReference: documentRequest.paymentReference,
                amount: price,
                isFree: price === 0,
                applicant: {
                    firstName: documentRequest.firstName || documentRequest.applicant?.firstName,
                    lastName: documentRequest.lastName || documentRequest.applicant?.lastName,
                    email: documentRequest.emailAddress || documentRequest.applicant?.email,
                    phone: documentRequest.contactNumber || documentRequest.applicant?.phoneNumber,
                },
                address: documentRequest.address,
                purposeOfRequest: documentRequest.purposeOfRequest,
                createdAt: documentRequest.createdAt,
                processedAt: documentRequest.processedAt,
            }
        });

    } catch (error) {
        console.error('Error getting payment details:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to get payment details', 
            error: error.message 
        });
    }
};

/**
 * @desc    Create a payment link for document request
 * @route   POST /api/payments/create-link
 * @access  Private
 */
exports.createPaymentLink = async (req, res) => {
    try {
        const { requestId } = req.body;

        if (!requestId) {
            return res.status(400).json({ 
                success: false,
                message: 'Request ID is required' 
            });
        }

        const documentRequest = await DocumentRequest.findById(requestId).populate('applicant');

        if (!documentRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Document request not found' 
            });
        }

        // Check if request is approved
        if (documentRequest.status !== 'approved') {
            return res.status(400).json({ 
                success: false,
                message: 'Only approved requests can be paid' 
            });
        }

        if (documentRequest.paymentStatus === 'paid') {
            return res.status(400).json({ 
                success: false,
                message: 'This request is already paid' 
            });
        }

        // Calculate the price
        const price = documentRequest.fees > 0 
            ? documentRequest.fees 
            : DOCUMENT_PRICES[documentRequest.documentType] || 0;

        // If free, mark as waived
        if (price === 0) {
            documentRequest.paymentStatus = 'waived';
            await documentRequest.save();
            
            return res.status(200).json({
                success: true,
                message: 'Document is free of charge',
                isFree: true,
                paymentStatus: 'waived'
            });
        }

        const amount = price * 100; // Convert to centavos
        const documentLabel = DOCUMENT_LABELS[documentRequest.documentType] || documentRequest.documentType;
        const description = `Payment for ${documentLabel} - Request #${documentRequest._id}`;

        const payload = {
            data: {
                attributes: {
                    amount: amount,
                    description: description,
                    remarks: `Document Request ID: ${documentRequest._id}`,
                }
            }
        };

        const response = await axios.post(`${PAYMONGO_API_URL}/links`, payload, {
            headers: getHeaders()
        });

        const paymentLink = response.data.data.attributes.checkout_url;
        const referenceNumber = response.data.data.id;

        // Save the reference number to the document request
        documentRequest.paymentReference = referenceNumber;
        await documentRequest.save();

        await logAction(
            LOGCONSTANTS.actions.records?.PAYMENT_INITIATED || 'PAYMENT_INITIATED',
            `Payment link created for request: ${requestId}`,
            req.user
        );

        res.status(200).json({
            success: true,
            paymentLink: paymentLink,
            referenceNumber: referenceNumber,
            amount: price
        });

    } catch (error) {
        console.error('PayMongo Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ 
            success: false,
            message: 'Failed to create payment link', 
            error: error.response ? error.response.data : error.message 
        });
    }
};

/**
 * @desc    Verify payment status with PayMongo
 * @route   GET /api/payments/verify/:requestId
 * @access  Private
 */
exports.verifyPayment = async (req, res) => {
    try {
        const { requestId } = req.params;

        const documentRequest = await DocumentRequest.findById(requestId);

        if (!documentRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Document request not found' 
            });
        }

        // If already paid or waived, return success
        if (documentRequest.paymentStatus === 'paid' || documentRequest.paymentStatus === 'waived') {
            return res.status(200).json({
                success: true,
                paid: true,
                paymentStatus: documentRequest.paymentStatus
            });
        }

        // If there's a payment reference, check with PayMongo
        if (documentRequest.paymentReference) {
            try {
                const response = await axios.get(
                    `${PAYMONGO_API_URL}/links/${documentRequest.paymentReference}`,
                    { headers: getHeaders() }
                );

                const linkStatus = response.data.data.attributes.status;
                
                // PayMongo link statuses: unpaid, paid, archived
                if (linkStatus === 'paid') {
                    documentRequest.paymentStatus = 'paid';
                    documentRequest.paidAt = new Date();
                    await documentRequest.save();

                    await logAction(
                        LOGCONSTANTS.actions.records?.PAYMENT_COMPLETED || 'PAYMENT_COMPLETED',
                        `Payment verified for request: ${requestId}`,
                        req.user
                    );

                    return res.status(200).json({
                        success: true,
                        paid: true,
                        paymentStatus: 'paid'
                    });
                }
            } catch (paymongoError) {
                console.error('PayMongo verification error:', paymongoError.message);
            }
        }

        res.status(200).json({
            success: true,
            paid: false,
            paymentStatus: documentRequest.paymentStatus
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to verify payment', 
            error: error.message 
        });
    }
};

/**
 * @desc    Manual payment confirmation (for walk-in payments)
 * @route   POST /api/payments/confirm/:requestId
 * @access  Private (Admin only)
 */
exports.confirmPayment = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { paymentMethod, referenceNumber } = req.body;
        const ROLES = require('../config/roles');

        // Only admin can manually confirm payments
        if (req.user.role !== ROLES.Admin && req.user.role !== ROLES.SuperAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can manually confirm payments'
            });
        }

        const documentRequest = await DocumentRequest.findById(requestId);

        if (!documentRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Document request not found' 
            });
        }

        if (documentRequest.paymentStatus === 'paid') {
            return res.status(400).json({ 
                success: false,
                message: 'This request is already paid' 
            });
        }

        documentRequest.paymentStatus = 'paid';
        documentRequest.paidAt = new Date();
        documentRequest.paymentMethod = paymentMethod || 'walk-in';
        if (referenceNumber) {
            documentRequest.paymentReference = referenceNumber;
        }
        await documentRequest.save();

        await logAction(
            LOGCONSTANTS.actions.records?.PAYMENT_CONFIRMED || 'PAYMENT_CONFIRMED',
            `Payment manually confirmed for request: ${requestId} by admin`,
            req.user
        );

        res.status(200).json({
            success: true,
            message: 'Payment confirmed successfully',
            paymentStatus: 'paid'
        });

    } catch (error) {
        console.error('Payment confirmation error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to confirm payment', 
            error: error.message 
        });
    }
};

/**
 * @desc    Waive payment fee (for indigency certificates, etc.)
 * @route   POST /api/payments/waive/:requestId
 * @access  Private (Admin only)
 */
exports.waivePayment = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { reason } = req.body;
        const ROLES = require('../config/roles');

        // Only admin can waive payments
        if (req.user.role !== ROLES.Admin && req.user.role !== ROLES.SuperAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can waive payments'
            });
        }

        const documentRequest = await DocumentRequest.findById(requestId);

        if (!documentRequest) {
            return res.status(404).json({ 
                success: false,
                message: 'Document request not found' 
            });
        }

        documentRequest.paymentStatus = 'waived';
        documentRequest.paymentWaivedReason = reason || 'Fee waived by admin';
        await documentRequest.save();

        await logAction(
            LOGCONSTANTS.actions.records?.PAYMENT_WAIVED || 'PAYMENT_WAIVED',
            `Payment waived for request: ${requestId}. Reason: ${reason || 'Not specified'}`,
            req.user
        );

        res.status(200).json({
            success: true,
            message: 'Payment fee waived successfully',
            paymentStatus: 'waived'
        });

    } catch (error) {
        console.error('Payment waive error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to waive payment', 
            error: error.message 
        });
    }
};

/**
 * @desc    PayMongo Webhook handler
 * @route   POST /api/payments/webhook
 * @access  Public (with signature verification)
 */
exports.webhook = async (req, res) => {
    try {
        const signature = req.headers['paymongo-signature'];
        const payload = JSON.stringify(req.body);

        // Verify webhook signature if secret is configured
        if (PAYMONGO_WEBHOOK_SECRET && signature) {
            const [timestamp, testSignature, liveSignature] = signature.split(',').map(s => s.split('=')[1]);
            const signaturePayload = `${timestamp}.${payload}`;
            const expectedSignature = crypto
                .createHmac('sha256', PAYMONGO_WEBHOOK_SECRET)
                .update(signaturePayload)
                .digest('hex');

            if (expectedSignature !== testSignature && expectedSignature !== liveSignature) {
                console.warn('Invalid webhook signature');
                return res.status(400).json({ message: 'Invalid signature' });
            }
        }

        const event = req.body;
        console.log('PayMongo Webhook received:', event.data?.attributes?.type);

        // Handle payment events
        if (event.data?.attributes?.type === 'link.payment.paid') {
            const linkData = event.data?.attributes?.data;
            const linkId = linkData?.id;

            if (linkId) {
                // Find the document request with this payment reference
                const documentRequest = await DocumentRequest.findOne({ 
                    paymentReference: linkId 
                });

                if (documentRequest) {
                    documentRequest.paymentStatus = 'paid';
                    documentRequest.paidAt = new Date();
                    await documentRequest.save();
                    console.log(`Payment confirmed via webhook for request: ${documentRequest._id}`);
                }
            }
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
};
