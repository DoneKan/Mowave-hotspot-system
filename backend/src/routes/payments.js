// backend/routes/payments.js - Enhanced version
const express = require('express');
const router = express.Router();
const db = require('../models/database');
const paymentService = require('../services/paymentService');
const smsService = require('../services/smsService'); // We'll create this next
const { v4: uuidv4 } = require('uuid');

// Simple auth check - you'll need to implement proper middleware
const authenticateToken = (req, res, next) => {
  // Skip auth for demo - implement proper JWT verification
  next();
};

// Enhanced validation middleware
const validatePaymentData = (req, res, next) => {
  const { amount, phoneNumber, paymentMethod, voucherId } = req.body;
  
  if (!amount || amount < 1000 || amount > 50000) {
    return res.status(400).json({
      success: false,
      message: 'Amount must be between 1000 and 50000 UGX'
    });
  }
  
  // Enhanced phone number validation for both MTN and Airtel
  const mtnPrefixes = ['256070', '256077', '256078', '256039'];
  const airtelPrefixes = ['256070', '256075', '256074', '256020'];
  
  if (!phoneNumber || !/^256[0-9]{9}$/.test(phoneNumber)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid phone number format. Use 256XXXXXXXXX'
    });
  }
  
  // Validate payment method matches phone number prefix
  if (paymentMethod === 'mtn_momo') {
    const isMTN = mtnPrefixes.some(prefix => phoneNumber.startsWith(prefix));
    if (!isMTN) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is not compatible with MTN MoMo'
      });
    }
  } else if (paymentMethod === 'airtel_money') {
    const isAirtel = airtelPrefixes.some(prefix => phoneNumber.startsWith(prefix));
    if (!isAirtel) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is not compatible with Airtel Money'
      });
    }
  }
  
  if (!paymentMethod || !['mtn_momo', 'airtel_money'].includes(paymentMethod)) {
    return res.status(400).json({
      success: false,
      message: 'Payment method must be mtn_momo or airtel_money'
    });
  }
  
  if (!voucherId) {
    return res.status(400).json({
      success: false,
      message: 'Voucher ID is required'
    });
  }
  
  next();
};

// CREATE - Initiate a new payment with enhanced mock integration
router.post('/', validatePaymentData, async (req, res) => {
  try {
    const { amount, phoneNumber, paymentMethod, voucherId, userId } = req.body;
    
    // Verify voucher exists and is available
    const voucher = db.getVoucherById(voucherId);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Voucher not found'
      });
    }
    
    if (voucher.isUsed) {
      return res.status(400).json({
        success: false,
        message: 'Voucher already used'
      });
    }
    
    if (voucher.price !== amount) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount does not match voucher price'
      });
    }
    
    // Create payment record
    const paymentData = {
      amount,
      phoneNumber,
      paymentMethod,
      voucherId,
      userId: userId || null,
      status: 'pending',
      transactionId: null,
      reference: paymentService.generateReference(),
      metadata: {
        voucherCode: voucher.code,
        dataLimit: voucher.dataLimit,
        duration: voucher.duration
      }
    };
    
    const payment = db.createPayment(paymentData);
    
    // Log payment initiation
    console.log(`🚀 Payment initiated: ${payment.reference}`);
    console.log(`📱 Phone: ${phoneNumber}, Method: ${paymentMethod}, Amount: ${amount} UGX`);
    
    // Process payment asynchronously with enhanced mock integration
    setImmediate(async () => {
      try {
        const result = await paymentService.processPayment({
          paymentId: payment.id,
          reference: payment.reference,
          amount,
          phoneNumber,
          paymentMethod,
          voucherId,
          userId
        });
        
        // Send SMS notification based on payment result
        if (result.success) {
          await smsService.sendVoucherCode({
            phoneNumber,
            voucherCode: voucher.code,
            dataLimit: voucher.dataLimit,
            duration: voucher.duration,
            paymentReference: payment.reference
          });
        } else {
          await smsService.sendPaymentFailureNotification({
            phoneNumber,
            paymentReference: payment.reference,
            reason: result.message
          });
        }
        
      } catch (error) {
        console.error('Async payment processing error:', error);
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Payment initiated successfully',
      data: {
        paymentId: payment.id,
        reference: payment.reference,
        status: payment.status,
        amount: payment.amount,
        phoneNumber: payment.phoneNumber,
        paymentMethod: payment.paymentMethod,
        estimatedProcessingTime: paymentMethod === 'mtn_momo' ? '3-5 seconds' : '4-6 seconds'
      }
    });
    
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Enhanced payment verification with detailed status
router.get('/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    
    const payment = db.getPaymentById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Get voucher details if payment was successful
    let voucherDetails = null;
    if (payment.status === 'success' && payment.voucherId) {
      const voucher = db.getVoucherById(payment.voucherId);
      if (voucher) {
        voucherDetails = {
          code: voucher.code,
          dataLimit: voucher.dataLimit,
          duration: voucher.duration,
          expiresAt: voucher.expiresAt
        };
      }
    }
    
    res.json({
      success: true,
      data: {
        id: payment.id,
        reference: payment.reference,
        status: payment.status,
        transactionId: payment.transactionId,
        amount: payment.amount,
        phoneNumber: payment.phoneNumber,
        paymentMethod: payment.paymentMethod,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt,
        failureReason: payment.failureReason,
        errorCode: payment.errorCode,
        providerResponse: payment.providerResponse,
        voucher: voucherDetails
      }
    });
    
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Check payment status by reference
router.get('/reference/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    
    const result = await paymentService.checkPaymentStatus(reference);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Payment status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Enhanced payment statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const stats = paymentService.getPaymentStats();
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Payment stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// READ - Get payment by ID (enhanced with provider details)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const payment = db.getPaymentById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Add voucher details
    let voucherDetails = null;
    if (payment.voucherId) {
      const voucher = db.getVoucherById(payment.voucherId);
      if (voucher) {
        voucherDetails = {
          code: voucher.code,
          dataLimit: voucher.dataLimit,
          duration: voucher.duration,
          isUsed: voucher.isUsed,
          usedAt: voucher.usedAt
        };
      }
    }
    
    res.json({
      success: true,
      data: {
        ...payment,
        voucher: voucherDetails
      }
    });
    
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// READ - Get all payments with enhanced filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      status, 
      paymentMethod, 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate,
      userId,
      phoneNumber
    } = req.query;
    
    let payments = db.getAllPayments();
    
    // Apply filters
    if (status) {
      payments = payments.filter(p => p.status === status);
    }
    
    if (paymentMethod) {
      payments = payments.filter(p => p.paymentMethod === paymentMethod);
    }
    
    if (userId) {
      payments = payments.filter(p => p.userId === userId);
    }
    
    if (phoneNumber) {
      payments = payments.filter(p => p.phoneNumber === phoneNumber);
    }
    
    if (startDate) {
      const start = new Date(startDate);
      payments = payments.filter(p => new Date(p.createdAt) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      payments = payments.filter(p => new Date(p.createdAt) <= end);
    }
    
    // Sort by creation date (newest first)
    payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Add voucher details to each payment
    payments = payments.map(payment => {
      let voucherDetails = null;
      if (payment.voucherId) {
        const voucher = db.getVoucherById(payment.voucherId);
        if (voucher) {
          voucherDetails = {
            code: voucher.code,
            dataLimit: voucher.dataLimit,
            duration: voucher.duration
          };
        }
      }
      return {
        ...payment,
        voucher: voucherDetails
      };
    });
    
    // Pagination
    const skip = (page - 1) * limit;
    const paginatedPayments = payments.slice(skip, skip + parseInt(limit));
    
    res.json({
      success: true,
      data: paginatedPayments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: payments.length,
        pages: Math.ceil(payments.length / limit)
      }
    });
    
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// UPDATE - Update payment status (enhanced with provider validation)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionId, failureReason, errorCode } = req.body;
    
    const payment = db.getPaymentById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Validate status
    const validStatuses = ['pending', 'success', 'failed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status'
      });
    }
    
    const updateData = {};
    if (status) updateData.status = status;
    if (transactionId) updateData.transactionId = transactionId;
    if (failureReason) updateData.failureReason = failureReason;
    if (errorCode) updateData.errorCode = errorCode;
    
    // If marking as successful, also mark voucher as used
    if (status === 'success' && payment.status !== 'success') {
      const voucher = db.getVoucherById(payment.voucherId);
      if (voucher && !voucher.isUsed) {
        db.updateVoucher(payment.voucherId, {
          isUsed: true,
          usedAt: new Date(),
          userId: payment.userId
        });
        
        // Send success SMS
        await smsService.sendVoucherCode({
          phoneNumber: payment.phoneNumber,
          voucherCode: voucher.code,
          dataLimit: voucher.dataLimit,
          duration: voucher.duration,
          paymentReference: payment.reference
        });
      }
      updateData.completedAt = new Date();
    }
    
    const updatedPayment = db.updatePayment(id, updateData);
    
    res.json({
      success: true,
      message: 'Payment updated successfully',
      data: updatedPayment
    });
    
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE - Cancel payment (enhanced with provider notification)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const payment = db.getPaymentById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Only allow cancellation of pending payments
    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending payments can be cancelled'
      });
    }
    
    const updatedPayment = db.updatePayment(id, {
      status: 'cancelled',
      cancelledAt: new Date()
    });
    
    // Send cancellation SMS
    await smsService.sendPaymentCancellationNotification({
      phoneNumber: payment.phoneNumber,
      paymentReference: payment.reference
    });
    
    res.json({
      success: true,
      message: 'Payment cancelled successfully',
      data: updatedPayment
    });
    
  } catch (error) {
    console.error('Cancel payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;