const SibApiV3Sdk = require('sib-api-v3-sdk');

// Configure Brevo API client
const configureBrevoClient = () => {
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  const apiKey = defaultClient.authentications['api-key'];
  apiKey.apiKey = process.env.BREVO_API_KEY;
  return new SibApiV3Sdk.TransactionalEmailsApi();
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

module.exports = {
  sendVerificationCode,
};