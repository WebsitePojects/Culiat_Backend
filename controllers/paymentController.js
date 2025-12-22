const axios = require('axios');
const crypto = require('crypto');
const DocumentRequest = require('../models/DocumentRequest');
const { LOGCONSTANTS } = require('../config/logConstants');
const { logAction } = require('../utils/logHelper');

const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET;
const PAYMONGO_API_URL = 'https://api.paymongo.com/v1';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// PayMongo commission rate for GCash (2.5%)
const PAYMONGO_COMMISSION_RATE = 0.025;
const MINIMUM_PAYMENT_AMOUNT = 50; // Minimum 50 PHP using PaymentIntents API (₱1 for most methods)

// Document prices (in PHP) - Base prices that barangay receives
const DOCUMENT_PRICES = {
    'indigency': 0, // Free for indigent residents
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

/**
 * Calculate total amount including PayMongo commission
 * @param {number} basePrice - Base price that barangay receives
 * @returns {number} Total amount customer pays (including commission)
 */
const calculateTotalWithCommission = (basePrice) => {
    if (basePrice === 0) return 0; // Free documents remain free
    
    // Add 2.5% commission on top of base price
    let totalAmount = basePrice * (1 + PAYMONGO_COMMISSION_RATE);
    
    // Ensure minimum payment of 50 PHP
    if (totalAmount < MINIMUM_PAYMENT_AMOUNT) {
        totalAmount = MINIMUM_PAYMENT_AMOUNT;
    }
    
    // Round to 2 decimal places
    return Math.round(totalAmount * 100) / 100;
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

        // Calculate the base price and total with commission
        const basePrice = documentRequest.fees > 0 
            ? documentRequest.fees 
            : DOCUMENT_PRICES[documentRequest.documentType] || 0;
        
        const totalAmount = calculateTotalWithCommission(basePrice);
        const commission = totalAmount - basePrice;

        res.status(200).json({
            success: true,
            data: {
                requestId: documentRequest._id,
                documentType: documentRequest.documentType,
                documentLabel: DOCUMENT_LABELS[documentRequest.documentType] || documentRequest.documentType,
                status: documentRequest.status,
                paymentStatus: documentRequest.paymentStatus,
                paymentReference: documentRequest.paymentReference,
                baseAmount: basePrice,
                commission: commission,
                amount: totalAmount,
                isFree: basePrice === 0,
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

        // Calculate the base price and total with commission
        const basePrice = documentRequest.fees > 0 
            ? documentRequest.fees 
            : DOCUMENT_PRICES[documentRequest.documentType] || 0;

        // If free, mark as waived
        if (basePrice === 0) {
            documentRequest.paymentStatus = 'waived';
            await documentRequest.save();
            
            return res.status(200).json({
                success: true,
                message: 'Document is free of charge',
                isFree: true,
                paymentStatus: 'waived'
            });
        }

        const totalAmount = calculateTotalWithCommission(basePrice);
        const commission = totalAmount - basePrice;
        const amount = Math.round(totalAmount * 100); // Convert to centavos
        const documentLabel = DOCUMENT_LABELS[documentRequest.documentType] || documentRequest.documentType;
        const description = `${documentLabel} (₱${basePrice} + ₱${commission.toFixed(2)} fee)`;

        // Create PaymentIntent instead of Link (allows ₱1 minimum vs ₱100 for Links)
        const payload = {
            data: {
                attributes: {
                    amount: amount,
                    currency: 'PHP',
                    description: description,
                    statement_descriptor: documentLabel.substring(0, 22),
                    payment_method_allowed: ['gcash', 'paymaya', 'grab_pay', 'card'],
                    metadata: {
                        requestId: documentRequest._id.toString(),
                        documentType: documentRequest.documentType,
                        userId: documentRequest.applicant._id.toString(),
                    }
                }
            }
        };

        const paymentIntentResponse = await axios.post(
            `${PAYMONGO_API_URL}/payment_intents`,
            payload,
            { headers: getHeaders() }
        );

        const paymentIntentId = paymentIntentResponse.data.data.id;
        const clientKey = paymentIntentResponse.data.data.attributes.client_key;

        // Create a checkout session from the payment intent
        const checkoutPayload = {
            data: {
                attributes: {
                    cancel_url: `${FRONTEND_URL}/services?tab=my-requests`,
                    billing: {
                        name: `${documentRequest.firstName} ${documentRequest.lastName}`,
                        email: documentRequest.emailAddress || documentRequest.applicant?.email,
                        phone: documentRequest.contactNumber || documentRequest.applicant?.phoneNumber,
                    },
                    description: description,
                    line_items: [
                        {
                            amount: amount,
                            currency: 'PHP',
                            description: description,
                            name: documentLabel,
                            quantity: 1,
                        }
                    ],
                    payment_method_types: ['gcash', 'paymaya', 'card', 'grab_pay'],
                    success_url: `${FRONTEND_URL}/payment/${requestId}?status=success`,
                }
            }
        };

        const checkoutResponse = await axios.post(
            `${PAYMONGO_API_URL}/checkout_sessions`,
            checkoutPayload,
            { headers: getHeaders() }
        );

        const checkoutUrl = checkoutResponse.data.data.attributes.checkout_url;
        const checkoutId = checkoutResponse.data.data.id;

        // Save the checkout session ID as payment reference
        documentRequest.paymentReference = checkoutId;
        documentRequest.paymentIntentId = paymentIntentId; // Store payment intent separately
        await documentRequest.save();

        await logAction(
            LOGCONSTANTS.actions.records?.PAYMENT_INITIATED || 'PAYMENT_INITIATED',
            `Payment checkout created for request: ${requestId}`,
            req.user
        );

        res.status(200).json({
            success: true,
            paymentLink: checkoutUrl,
            paymentIntentId: paymentIntentId,
            clientKey: clientKey,
            referenceNumber: checkoutId,
            baseAmount: basePrice,
            commission: commission,
            totalAmount: totalAmount,
            amount: totalAmount, // For backward compatibility
            description: description
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
                // Check Checkout Session status
                const response = await axios.get(
                    `${PAYMONGO_API_URL}/checkout_sessions/${documentRequest.paymentReference}`,
                    { headers: getHeaders() }
                );

                const sessionStatus = response.data.data.attributes.payment_intent?.attributes?.status;
                
                // PaymentIntent statuses: awaiting_payment_method, awaiting_next_action, processing, succeeded, failed
                if (sessionStatus === 'succeeded') {
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

        // Handle checkout session completed events
        if (event.data?.attributes?.type === 'checkout_session.payment.paid') {
            const sessionData = event.data?.attributes?.data;
            const checkoutId = sessionData?.id;

            if (checkoutId) {
                const documentRequest = await DocumentRequest.findOne({ 
                    paymentReference: checkoutId 
                });

                if (documentRequest) {
                    documentRequest.paymentStatus = 'paid';
                    documentRequest.paidAt = new Date();
                    await documentRequest.save();
                }
            }
        }

        // Handle PaymentIntent success events (fallback)
        if (event.data?.attributes?.type === 'payment.paid') {
            const paymentData = event.data?.attributes?.data;
            const paymentIntentId = paymentData?.attributes?.payment_intent_id;

            if (paymentIntentId) {
                const documentRequest = await DocumentRequest.findOne({ 
                    paymentIntentId: paymentIntentId 
                });

                if (documentRequest) {
                    documentRequest.paymentStatus = 'paid';
                    documentRequest.paidAt = new Date();
                    await documentRequest.save();
                }
            }
        }

        // Also handle payment_intent.succeeded event
        if (event.data?.attributes?.type === 'payment_intent.succeeded') {
            const intentData = event.data?.attributes?.data;
            const paymentIntentId = intentData?.id;

            if (paymentIntentId) {
                const documentRequest = await DocumentRequest.findOne({ 
                    paymentIntentId: paymentIntentId 
                });

                if (documentRequest) {
                    documentRequest.paymentStatus = 'paid';
                    documentRequest.paidAt = new Date();
                    await documentRequest.save();
                }
            }
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ message: 'Webhook processing failed' });
    }
};
