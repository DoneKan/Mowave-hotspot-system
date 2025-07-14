const crypto = require('crypto');
const db = require('../models/database');

class PaymentService {
  constructor() {
    this.mockDelay = 3000; // 3 second delay to simulate real API
    this.mtnSuccessRate = 0.85; // 85% success rate for MTN
    this.airtelSuccessRate = 0.80; // 80% success rate for Airtel
  }

  // Generate transaction reference
  generateReference() {
    return `MW-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  // Generate transaction ID
  generateTransactionId(provider) {
    return `${provider.toUpperCase()}_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  }

  // Simulate network delay
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Mock MTN MoMo Collection API
  async processMTNMoMoPayment(paymentData) {
    const { amount, phoneNumber, reference, voucherId } = paymentData;
    
    console.log(`🔄 Processing MTN MoMo payment: ${reference}`);
    console.log(`📱 Phone: ${phoneNumber}, Amount: ${amount} UGX`);
    
    // Simulate API call delay
    await this.delay(this.mockDelay);
    
    // Mock different response scenarios
    const random = Math.random();
    const isSuccess = random < this.mtnSuccessRate;
    
    if (isSuccess) {
      const transactionId = this.generateTransactionId('MTN');
      
      const response = {
        success: true,
        provider: 'MTN_MOMO',
        transactionId,
        reference,
        amount,
        phoneNumber,
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
        message: 'Payment completed successfully',
        providerResponse: {
          externalId: transactionId,
          amount: amount.toString(),
          currency: 'UGX',
          payer: {
            partyIdType: 'MSISDN',
            partyId: phoneNumber
          },
          payerMessage: `MoWave Hotspot Voucher - ${amount} UGX`,
          payeeNote: 'Hotspot voucher purchase',
          requestId: reference,
          deliveryNotification: false,
          notificationUrl: null,
          callbackUrl: null
        }
      };
      
      console.log(`✅ MTN MoMo payment successful: ${transactionId}`);
      return response;
      
    } else {
      // Different failure scenarios
      const failureScenarios = [
        { error: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance in your MTN MoMo account' },
        { error: 'INVALID_PHONE_NUMBER', message: 'Phone number is not registered for MTN MoMo' },
        { error: 'TRANSACTION_DECLINED', message: 'Transaction was declined by MTN MoMo' },
        { error: 'ACCOUNT_BLOCKED', message: 'Your MTN MoMo account is temporarily blocked' },
        { error: 'NETWORK_ERROR', message: 'Network error occurred. Please try again' }
      ];
      
      const scenario = failureScenarios[Math.floor(Math.random() * failureScenarios.length)];
      
      const errorResponse = {
        success: false,
        provider: 'MTN_MOMO',
        reference,
        amount,
        phoneNumber,
        status: 'FAILED',
        timestamp: new Date().toISOString(),
        error: scenario.error,
        message: scenario.message,
        providerResponse: {
          code: scenario.error,
          message: scenario.message,
          requestId: reference
        }
      };
      
      console.log(`❌ MTN MoMo payment failed: ${reference} - ${scenario.error}`);
      return errorResponse;
    }
  }

  // Mock Airtel Money API
  async processAirtelMoneyPayment(paymentData) {
    const { amount, phoneNumber, reference, voucherId } = paymentData;
    
    console.log(`🔄 Processing Airtel Money payment: ${reference}`);
    console.log(`📱 Phone: ${phoneNumber}, Amount: ${amount} UGX`);
    
    // Simulate API call delay (slightly longer for Airtel)
    await this.delay(this.mockDelay + 1000);
    
    // Mock different response scenarios
    const random = Math.random();
    const isSuccess = random < this.airtelSuccessRate;
    
    if (isSuccess) {
      const transactionId = this.generateTransactionId('AIRTEL');
      
      const response = {
        success: true,
        provider: 'AIRTEL_MONEY',
        transactionId,
        reference,
        amount,
        phoneNumber,
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
        message: 'Payment processed successfully',
        providerResponse: {
          transaction_id: transactionId,
          transaction_reference: reference,
          amount: amount.toString(),
          currency: 'UGX',
          subscriber_msisdn: phoneNumber,
          transaction_status: 'SUCCESS',
          transaction_message: 'Transaction completed successfully',
          airtel_money_id: `AM${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        }
      };
      
      console.log(`✅ Airtel Money payment successful: ${transactionId}`);
      return response;
      
    } else {
      // Different failure scenarios for Airtel
      const failureScenarios = [
        { error: 'INSUFFICIENT_BALANCE', message: 'Insufficient balance in your Airtel Money account' },
        { error: 'INVALID_SUBSCRIBER', message: 'Invalid Airtel Money subscriber' },
        { error: 'TRANSACTION_LIMIT_EXCEEDED', message: 'Transaction limit exceeded' },
        { error: 'SERVICE_UNAVAILABLE', message: 'Airtel Money service is temporarily unavailable' },
        { error: 'PIN_BLOCKED', message: 'Your Airtel Money PIN is blocked' }
      ];
      
      const scenario = failureScenarios[Math.floor(Math.random() * failureScenarios.length)];
      
      const errorResponse = {
        success: false,
        provider: 'AIRTEL_MONEY',
        reference,
        amount,
        phoneNumber,
        status: 'FAILED',
        timestamp: new Date().toISOString(),
        error: scenario.error,
        message: scenario.message,
        providerResponse: {
          error_code: scenario.error,
          error_message: scenario.message,
          transaction_reference: reference,
          transaction_status: 'FAILED'
        }
      };
      
      console.log(`❌ Airtel Money payment failed: ${reference} - ${scenario.error}`);
      return errorResponse;
    }
  }

  // Main payment processing method
  async processPayment(paymentData) {
    const { paymentMethod } = paymentData;
    
    try {
      let result;
      
      switch (paymentMethod) {
        case 'mtn_momo':
          result = await this.processMTNMoMoPayment(paymentData);
          break;
        case 'airtel_money':
          result = await this.processAirtelMoneyPayment(paymentData);
          break;
        default:
          throw new Error(`Unsupported payment method: ${paymentMethod}`);
      }
      
      // Update payment in database
      const payment = db.getPaymentById(paymentData.paymentId);
      if (payment) {
        const updateData = {
          status: result.success ? 'success' : 'failed',
          transactionId: result.transactionId || null,
          providerResponse: result.providerResponse,
          completedAt: new Date()
        };
        
        if (!result.success) {
          updateData.failureReason = result.message;
          updateData.errorCode = result.error;
        }
        
        db.updatePayment(paymentData.paymentId, updateData);
        
        // If successful, mark voucher as used
        if (result.success && paymentData.voucherId) {
          db.updateVoucher(paymentData.voucherId, {
            isUsed: true,
            usedAt: new Date(),
            userId: paymentData.userId || null
          });
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('Payment processing error:', error);
      
      // Update payment as failed
      db.updatePayment(paymentData.paymentId, {
        status: 'failed',
        failureReason: error.message,
        errorCode: 'PROCESSING_ERROR'
      });
      
      return {
        success: false,
        provider: paymentMethod.toUpperCase(),
        reference: paymentData.reference,
        status: 'FAILED',
        error: 'PROCESSING_ERROR',
        message: 'Payment processing failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Check payment status
  async checkPaymentStatus(reference) {
    const payments = db.getAllPayments();
    const payment = payments.find(p => p.reference === reference);
    
    if (!payment) {
      return {
        success: false,
        error: 'PAYMENT_NOT_FOUND',
        message: 'Payment not found'
      };
    }
    
    return {
      success: true,
      data: {
        reference: payment.reference,
        status: payment.status,
        transactionId: payment.transactionId,
        amount: payment.amount,
        phoneNumber: payment.phoneNumber,
        paymentMethod: payment.paymentMethod,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt,
        failureReason: payment.failureReason
      }
    };
  }

  // Get payment statistics
  getPaymentStats() {
    const payments = db.getAllPayments();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return {
      total: payments.length,
      successful: payments.filter(p => p.status === 'success').length,
      failed: payments.filter(p => p.status === 'failed').length,
      pending: payments.filter(p => p.status === 'pending').length,
      todayCount: payments.filter(p => new Date(p.createdAt) >= today).length,
      totalRevenue: payments
        .filter(p => p.status === 'success')
        .reduce((sum, p) => sum + p.amount, 0),
      averageAmount: payments.length > 0 
        ? payments.reduce((sum, p) => sum + p.amount, 0) / payments.length 
        : 0,
      providerBreakdown: {
        mtn_momo: {
          total: payments.filter(p => p.paymentMethod === 'mtn_momo').length,
          successful: payments.filter(p => p.paymentMethod === 'mtn_momo' && p.status === 'success').length
        },
        airtel_money: {
          total: payments.filter(p => p.paymentMethod === 'airtel_money').length,
          successful: payments.filter(p => p.paymentMethod === 'airtel_money' && p.status === 'success').length
        }
      }
    };
  }
}

module.exports = new PaymentService();