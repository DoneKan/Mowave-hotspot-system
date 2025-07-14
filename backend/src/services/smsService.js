// backend/services/smsService.js
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

class SMSService {
  constructor() {
    this.smsLogs = new Map(); // In-memory SMS logs
    this.mockMode = process.env.SMS_MOCK_MODE !== 'false'; // Default to mock mode
    this.enableTwilio = process.env.ENABLE_TWILIO === 'true';
    this.twilioClient = null;
    
    // Initialize Twilio if enabled
    if (this.enableTwilio) {
      try {
        const twilio = require('twilio');
        this.twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        console.log('📱 Twilio SMS service initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Twilio:', error.message);
        this.enableTwilio = false;
      }
    }

    console.log(`📱 SMS Service initialized in ${this.mockMode ? 'MOCK' : 'LIVE'} mode`);
  }

  /**
   * Send SMS message
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} message - SMS message content
   * @param {string} type - SMS type (voucher, payment, otp, etc.)
   * @param {string} userId - Optional user ID for logging
   * @returns {Promise<Object>} SMS send result
   */
  async sendSMS(phoneNumber, message, type = 'general', userId = null) {
    try {
      // Validate phone number
      if (!this.validatePhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      // Log the SMS attempt
      const smsLog = this.createSMSLog(phoneNumber, message, type, userId);

      if (this.mockMode) {
        // Mock mode - simulate SMS sending
        const result = await this.sendMockSMS(phoneNumber, message, smsLog.id);
        this.updateSMSLog(smsLog.id, { status: 'sent', sentAt: new Date() });
        return result;
      } else if (this.enableTwilio && this.twilioClient) {
        // Live mode - send via Twilio
        const result = await this.sendTwilioSMS(phoneNumber, message, smsLog.id);
        this.updateSMSLog(smsLog.id, { 
          status: 'sent', 
          sentAt: new Date(),
          externalId: result.sid 
        });
        return result;
      } else {
        throw new Error('SMS service not properly configured');
      }
    } catch (error) {
      console.error('❌ SMS sending failed:', error.message);
      throw error;
    }
  }

  /**
   * Send voucher code via SMS
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} voucherCode - Voucher code
   * @param {string} userId - User ID
   * @returns {Promise<Object>} SMS send result
   */
  async sendVoucherSMS(phoneNumber, voucherCode, userId) {
    const message = `🎫 Your MoWave voucher code: ${voucherCode}. Use this code to access internet. Valid for limited time. Thanks!`;
    return await this.sendSMS(phoneNumber, message, 'voucher', userId);
  }

  /**
   * Send payment confirmation SMS
   * @param {string} phoneNumber - Recipient phone number
   * @param {Object} paymentData - Payment information
   * @param {string} userId - User ID
   * @returns {Promise<Object>} SMS send result
   */
  async sendPaymentConfirmationSMS(phoneNumber, paymentData, userId) {
    const message = `✅ Payment confirmed! Amount: UGX ${paymentData.amount}. Transaction ID: ${paymentData.id}. Thank you for using MoWave!`;
    return await this.sendSMS(phoneNumber, message, 'payment', userId);
  }

  /**
   * Send OTP via SMS
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} otp - One-time password
   * @param {string} userId - User ID
   * @returns {Promise<Object>} SMS send result
   */
  async sendOTPSMS(phoneNumber, otp, userId = null) {
    const message = `🔐 Your MoWave verification code: ${otp}. This code expires in 10 minutes. Do not share this code.`;
    return await this.sendSMS(phoneNumber, message, 'otp', userId);
  }

  /**
   * Send welcome SMS
   * @param {string} phoneNumber - Recipient phone number
   * @param {string} userName - User name
   * @param {string} userId - User ID
   * @returns {Promise<Object>} SMS send result
   */
  async sendWelcomeSMS(phoneNumber, userName, userId) {
    const message = `🎉 Welcome to MoWave, ${userName}! Your account is now active. Purchase vouchers to get started with high-speed internet.`;
    return await this.sendSMS(phoneNumber, message, 'welcome', userId);
  }

  /**
   * Send mock SMS (for testing)
   * @private
   */
  async sendMockSMS(phoneNumber, message, logId) {
    console.log(`📱 [MOCK SMS] To: ${phoneNumber}`);
    console.log(`📱 [MOCK SMS] Message: ${message}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      messageId: `mock_${logId}`,
      status: 'sent',
      to: phoneNumber,
      message: message,
      timestamp: new Date()
    };
  }

  /**
   * Send SMS via Twilio
   * @private
   */
  async sendTwilioSMS(phoneNumber, message, logId) {
    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      console.log(`📱 [TWILIO SMS] Sent to: ${phoneNumber}, SID: ${result.sid}`);
      
      return {
        success: true,
        messageId: result.sid,
        status: result.status,
        to: result.to,
        message: message,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('❌ Twilio SMS error:', error.message);
      throw new Error(`Twilio SMS failed: ${error.message}`);
    }
  }

  /**
   * Create SMS log entry
   * @private
   */
  createSMSLog(phoneNumber, message, type, userId) {
    const smsLog = {
      id: uuidv4(),
      phoneNumber,
      message,
      type,
      userId,
      status: 'pending',
      createdAt: new Date(),
      sentAt: null,
      externalId: null,
      error: null
    };

    this.smsLogs.set(smsLog.id, smsLog);
    return smsLog;
  }

  /**
   * Update SMS log entry
   * @private
   */
  updateSMSLog(logId, updates) {
    const log = this.smsLogs.get(logId);
    if (log) {
      Object.assign(log, updates);
      this.smsLogs.set(logId, log);
    }
  }

  /**
   * Validate phone number format
   * @private
   */
  validatePhoneNumber(phoneNumber) {
    // Basic validation for international format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Format phone number for Uganda
   * @param {string} phoneNumber - Phone number to format
   * @returns {string} Formatted phone number
   */
  formatUgandaPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Handle different Uganda phone number formats
    if (cleaned.startsWith('256')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0')) {
      return `+256${cleaned.substring(1)}`;
    } else if (cleaned.length === 9) {
      return `+256${cleaned}`;
    }
    
    return phoneNumber; // Return as-is if format is unclear
  }

  /**
   * Get SMS logs
   * @param {Object} filters - Filter options
   * @returns {Array} Array of SMS logs
   */
  getSMSLogs(filters = {}) {
    let logs = Array.from(this.smsLogs.values());

    // Apply filters
    if (filters.userId) {
      logs = logs.filter(log => log.userId === filters.userId);
    }
    if (filters.type) {
      logs = logs.filter(log => log.type === filters.type);
    }
    if (filters.status) {
      logs = logs.filter(log => log.status === filters.status);
    }

    // Sort by creation date (newest first)
    logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return logs;
  }

  /**
   * Get SMS statistics
   * @returns {Object} SMS statistics
   */
  getSMSStats() {
    const logs = Array.from(this.smsLogs.values());
    const totalSent = logs.length;
    const successful = logs.filter(log => log.status === 'sent').length;
    const failed = logs.filter(log => log.status === 'failed').length;
    const pending = logs.filter(log => log.status === 'pending').length;

    // Group by type
    const typeStats = logs.reduce((acc, log) => {
      acc[log.type] = (acc[log.type] || 0) + 1;
      return acc;
    }, {});

    return {
      totalSent,
      successful,
      failed,
      pending,
      successRate: totalSent > 0 ? (successful / totalSent * 100).toFixed(2) : 0,
      typeStats,
      isMockMode: this.mockMode,
      twilioEnabled: this.enableTwilio
    };
  }

  /**
   * Test SMS service
   * @param {string} phoneNumber - Test phone number
   * @returns {Promise<Object>} Test result
   */
  async testSMS(phoneNumber) {
    try {
      const testMessage = `🧪 Test message from MoWave SMS service. Time: ${new Date().toLocaleString()}`;
      const result = await this.sendSMS(phoneNumber, testMessage, 'test');
      return {
        success: true,
        message: 'Test SMS sent successfully',
        result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Test SMS failed',
        error: error.message
      };
    }
  }

  /**
   * Generate OTP
   * @param {number} length - OTP length (default: 6)
   * @returns {string} Generated OTP
   */
  generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  /**
   * Clear old SMS logs (cleanup)
   * @param {number} daysOld - Days old to clear (default: 30)
   */
  clearOldLogs(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let cleared = 0;
    for (const [id, log] of this.smsLogs.entries()) {
      if (log.createdAt < cutoffDate) {
        this.smsLogs.delete(id);
        cleared++;
      }
    }

    console.log(`🧹 Cleared ${cleared} old SMS logs`);
    return cleared;
  }
}

// Export singleton instance
const smsService = new SMSService();

module.exports = smsService;