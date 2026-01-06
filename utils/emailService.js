const SibApiV3Sdk = require('sib-api-v3-sdk');
const Settings = require('../models/Settings');

// Check if email notifications are enabled
const isEmailEnabled = async () => {
  try {
    const settings = await Settings.getSettings();
    return settings?.system?.emailNotificationsEnabled !== false; // Default to true if not set
  } catch (error) {
    console.error('Error checking email settings:', error);
    return true; // Default to enabled if error
  }
};

// Configure Brevo API client
const configureBrevoClient = () => {
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  const apiKey = defaultClient.authentications['api-key'];
  apiKey.apiKey = process.env.BREVO_API_KEY;
  return new SibApiV3Sdk.TransactionalEmailsApi();
};

// Generic email sender
const sendEmail = async (email, subject, html) => {
  try {
    // Check if email notifications are enabled
    const emailEnabled = await isEmailEnabled();
    if (!emailEnabled) {
      console.log('Email notifications are disabled. Skipping email to:', email);
      return { success: true, skipped: true, reason: 'Email notifications disabled' };
    }

    const apiInstance = configureBrevoClient();
    
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.sender = { 
      name: process.env.BREVO_SENDER_NAME || 'Barangay Culiat',
      email: process.env.BREVO_SENDER_EMAIL 
    };
    sendSmtpEmail.to = [{ email: email }];

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email sent via Brevo:', response.messageId);
    return { success: true, messageId: response.messageId };
  } catch (error) {
    console.error('Error sending email via Brevo:', error);
    throw error;
  }
};

// Send PSA profile completion reminder
const sendPsaCompletionReminder = async (email, firstName, daysLeft, reminderType) => {
  let subject, urgencyText, actionText;
  
  switch (reminderType) {
    case 'first':
      subject = 'Reminder: Complete Your PSA Profile Information';
      urgencyText = `You have <strong>${daysLeft} days</strong> remaining to complete your profile.`;
      actionText = 'Please take a moment to fill in your birth certificate information.';
      break;
    case 'second':
      subject = 'Important: PSA Profile Completion Deadline Approaching';
      urgencyText = `<span style="color: #f59e0b;">Only <strong>${daysLeft} days</strong> remaining!</span>`;
      actionText = 'Your deadline is approaching. Please complete your profile as soon as possible.';
      break;
    case 'final':
      subject = 'URGENT: Final Notice - Complete Your PSA Profile Now';
      urgencyText = `<span style="color: #ef4444;"><strong>URGENT: Only ${daysLeft} days remaining!</strong></span>`;
      actionText = 'This is your final reminder. Please complete your profile immediately to avoid service restrictions.';
      break;
    default:
      subject = 'Reminder: Complete Your PSA Profile Information';
      urgencyText = `You have <strong>${daysLeft} days</strong> remaining.`;
      actionText = 'Please complete your birth certificate information.';
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #3B82F6; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Barangay Culiat</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hello ${firstName},</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          ${actionText}
        </p>
        <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="font-size: 18px; margin: 0;">
            ${urgencyText}
          </p>
        </div>
        <p style="color: #4b5563; line-height: 1.6;">
          To complete your profile, you need to provide the following information from your PSA Birth Certificate:
        </p>
        <ul style="color: #4b5563; line-height: 1.8;">
          <li>Certificate Number & Registry Number</li>
          <li>Date Issued & Place of Registration</li>
          <li>Father's Information</li>
          <li>Mother's Maiden Information</li>
          <li>Upload a copy of your PSA Birth Certificate</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile" 
             style="background-color: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Complete My Profile
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          If you have any questions, please contact the Barangay office.
        </p>
      </div>
      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          Barangay Culiat Management System<br>
          Quezon City, Metro Manila
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, subject, html);
};

// Send profile verification approved email
const sendProfileVerificationApproved = async (email, firstName) => {
  const subject = 'Profile Verification Approved - Barangay Culiat';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #10B981; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">✓ Verification Approved</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Congratulations, ${firstName}!</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          Your PSA Birth Certificate information has been verified and approved by the Barangay administration.
        </p>
        <div style="background-color: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #065f46; margin: 0; font-weight: bold;">
            ✓ Your profile is now complete
          </p>
        </div>
        <p style="color: #4b5563; line-height: 1.6;">
          You now have full access to all Barangay services and can request documents without any restrictions.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/services" 
             style="background-color: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View Services
          </a>
        </div>
      </div>
      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          Barangay Culiat Management System<br>
          Quezon City, Metro Manila
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, subject, html);
};

// Send profile verification rejected email
const sendProfileVerificationRejected = async (email, firstName, rejectionReason) => {
  const subject = 'Profile Verification Rejected - Action Required';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #EF4444; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Verification Rejected</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Hello ${firstName},</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          Unfortunately, your PSA Birth Certificate verification was not approved. Please review the reason below and submit again.
        </p>
        <div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #991b1b; margin: 0;">
            <strong>Reason for Rejection:</strong><br>
            ${rejectionReason || 'The information provided does not match the uploaded document.'}
          </p>
        </div>
        <p style="color: #4b5563; line-height: 1.6;">
          Please review your information carefully and ensure:
        </p>
        <ul style="color: #4b5563; line-height: 1.8;">
          <li>All fields match exactly as shown on your PSA Birth Certificate</li>
          <li>The uploaded document is clear and readable</li>
          <li>The document is a valid PSA Birth Certificate</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile" 
             style="background-color: #EF4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Update My Profile
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          If you believe this is an error, please visit the Barangay office for assistance.
        </p>
      </div>
      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          Barangay Culiat Management System<br>
          Quezon City, Metro Manila
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, subject, html);
};

// Send verification code email
const sendVerificationCode = async (email, code, purpose = 'verification') => {
  try {
    const apiInstance = configureBrevoClient();

    let subject, html;

    switch (purpose) {
      case 'password':
        subject = 'Password Change Verification Code';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Password Change Verification</h2>
            <p>You have requested to change your password. Please use the verification code below:</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #1f2937; letter-spacing: 5px; margin: 0;">${code}</h1>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not request this change, please ignore this email and ensure your account is secure.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">Barangay Culiat Management System</p>
          </div>
        `;
        break;
      case 'email':
        subject = 'Email Change Verification Code';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Email Change Verification</h2>
            <p>You have requested to change your email address. Please use the verification code below:</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #1f2937; letter-spacing: 5px; margin: 0;">${code}</h1>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not request this change, please contact support immediately.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">Barangay Culiat Management System</p>
          </div>
        `;
        break;
      case 'username':
        subject = 'Username Change Verification Code';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Username Change Verification</h2>
            <p>You have requested to change your username. Please use the verification code below:</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #1f2937; letter-spacing: 5px; margin: 0;">${code}</h1>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not request this change, please contact support immediately.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">Barangay Culiat Management System</p>
          </div>
        `;
        break;
      case 'phone':
        subject = 'Phone Number Change Verification Code';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Phone Number Change Verification</h2>
            <p>You have requested to change your phone number. Please use the verification code below:</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #1f2937; letter-spacing: 5px; margin: 0;">${code}</h1>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not request this change, please contact support immediately.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">Barangay Culiat Management System</p>
          </div>
        `;
        break;
      case 'name':
        subject = 'Name Change Verification Code';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Name Change Verification</h2>
            <p>You have requested to change your name. Please use the verification code below:</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #1f2937; letter-spacing: 5px; margin: 0;">${code}</h1>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not request this change, please contact support immediately.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">Barangay Culiat Management System</p>
          </div>
        `;
        break;
      default:
        subject = 'Verification Code';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Verification Code</h2>
            <p>Please use the verification code below:</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #1f2937; letter-spacing: 5px; margin: 0;">${code}</h1>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">Barangay Culiat Management System</p>
          </div>
        `;
    }

    // Create Brevo send email object
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.sender = { 
      name: process.env.BREVO_SENDER_NAME || 'Barangay Culiat',
      email: process.env.BREVO_SENDER_EMAIL 
    };
    sendSmtpEmail.to = [{ email: email }];

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email sent via Brevo:', response.messageId);
    return { success: true, messageId: response.messageId };
  } catch (error) {
    console.error('Error sending email via Brevo:', error);
    throw error;
  }
};

// Send profile update approval email
const sendProfileUpdateApprovalEmail = async (email, { firstName, updateType }) => {
  const updateTypeLabels = {
    personal_info: 'Personal Information',
    birth_certificate: 'Birth Certificate Information',
    contact_info: 'Contact Information',
    address: 'Address Information',
    emergency_contact: 'Emergency Contact Information',
    full_profile: 'Full Profile',
  };
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #10B981; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Barangay Culiat</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Profile Update Approved! ✅</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          Hello ${firstName},
        </p>
        <p style="color: #4b5563; line-height: 1.6;">
          Great news! Your <strong>${updateTypeLabels[updateType] || updateType}</strong> update request has been reviewed and approved by our administrator.
        </p>
        <div style="background-color: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #065f46; margin: 0; text-align: center;">
            <strong>Your profile has been successfully updated!</strong>
          </p>
        </div>
        <p style="color: #4b5563; line-height: 1.6;">
          The changes you requested are now reflected in your profile. You can log in to view your updated information.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile" 
             style="background-color: #10B981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View My Profile
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Thank you for keeping your information up to date!
        </p>
      </div>
      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          Barangay Culiat Management System<br>
          Quezon City, Metro Manila
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, 'Profile Update Approved - Barangay Culiat', html);
};

// Send profile update rejection email
const sendProfileUpdateRejectionEmail = async (email, { firstName, updateType, rejectionReason }) => {
  const updateTypeLabels = {
    personal_info: 'Personal Information',
    birth_certificate: 'Birth Certificate Information',
    contact_info: 'Contact Information',
    address: 'Address Information',
    emergency_contact: 'Emergency Contact Information',
    full_profile: 'Full Profile',
  };
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #EF4444; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Barangay Culiat</h1>
      </div>
      <div style="padding: 30px; background-color: #f9fafb;">
        <h2 style="color: #1f2937;">Profile Update Not Approved</h2>
        <p style="color: #4b5563; line-height: 1.6;">
          Hello ${firstName},
        </p>
        <p style="color: #4b5563; line-height: 1.6;">
          We regret to inform you that your <strong>${updateTypeLabels[updateType] || updateType}</strong> update request could not be approved at this time.
        </p>
        <div style="background-color: #fee2e2; border: 1px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="color: #991b1b; margin: 0 0 10px 0;"><strong>Reason for Rejection:</strong></p>
          <p style="color: #7f1d1d; margin: 0;">${rejectionReason}</p>
        </div>
        <p style="color: #4b5563; line-height: 1.6;">
          Please review the reason above and submit a new update request with the correct information or required documents.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile" 
             style="background-color: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Update My Profile
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          If you have any questions, please visit the Barangay office or contact us.
        </p>
      </div>
      <div style="background-color: #1f2937; padding: 20px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          Barangay Culiat Management System<br>
          Quezon City, Metro Manila
        </p>
      </div>
    </div>
  `;

  return sendEmail(email, 'Profile Update Rejected - Barangay Culiat', html);
};

module.exports = {
  sendVerificationCode,
  sendEmail,
  sendPsaCompletionReminder,
  sendProfileVerificationApproved,
  sendProfileVerificationRejected,
  sendProfileUpdateApprovalEmail,
  sendProfileUpdateRejectionEmail,
};