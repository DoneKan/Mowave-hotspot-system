const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

// Simple auth check - you'll need to implement proper middleware
const authenticateToken = (req, res, next) => {
  // Skip auth for demo - implement proper JWT verification
  next();
};

// Validation middleware
const validatePaymentData = (req, res, next) => {
  const { amount, phoneNumber, paymentMethod, voucherId } = req.body;
  
  if (!amount || amount < 1000 || amount > 50000) {
    return res.status(400).json({
      success: false,
      message: 'Amount must be between 1000 and 50000 UGX'
    });
  }
  
  if (!phoneNumber || !/^256[0-9]{9}$/.test(phoneNumber)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid phone number format. Use 256XXXXXXXXX'
    });
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

// CREATE - Initiate a new payment
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
      reference: `MW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        voucherCode: voucher.code,
        dataLimit: voucher.dataLimit,
        duration: voucher.duration
      }
    };
    
    const payment = db.createPayment(paymentData);
    
    // TODO: Integrate with actual payment provider (MTN MoMo or Airtel Money)
    // For now, simulate payment initiation
    setTimeout(() => {
      // Simulate payment processing
      const isSuccess = Math.random() > 0.3; // 70% success rate for demo
      
      if (isSuccess) {
        // Update payment status
        db.updatePayment(payment.id, {
          status: 'success',
          transactionId: `TXN-${Date.now()}`,
          completedAt: new Date()
        });
        
        // Mark voucher as used
        db.updateVoucher(voucherId, {
          isUsed: true,
          usedAt: new Date(),
          userId: userId || null
        });
        
        console.log(`✅ Payment ${payment.id} completed successfully`);
      } else {
        db.updatePayment(payment.id, {
          status: 'failed',
          failureReason: 'Payment declined by provider'
        });
        
        console.log(`❌ Payment ${payment.id} failed`);
      }
    }, 5000); // Simulate 5-second processing time
    
    res.status(201).json({
      success: true,
      message: 'Payment initiated successfully',
      data: {
        paymentId: payment.id,
        reference: payment.reference,
        status: payment.status,
        amount: payment.amount,
        phoneNumber: payment.phoneNumber,
        paymentMethod: payment.paymentMethod
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

// READ - Get payment by ID
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
    
    res.json({
      success: true,
      data: payment
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

// READ - Get all payments with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      status, 
      paymentMethod, 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate,
      userId 
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

// UPDATE - Update payment status (mainly for admin use)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, transactionId, failureReason } = req.body;
    
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
    
    // If marking as successful, also mark voucher as used
    if (status === 'success' && payment.status !== 'success') {
      const voucher = db.getVoucherById(payment.voucherId);
      if (voucher && !voucher.isUsed) {
        db.updateVoucher(payment.voucherId, {
          isUsed: true,
          usedAt: new Date(),
          userId: payment.userId
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

// DELETE - Cancel payment (soft delete)
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

// Get payment statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const payments = db.getAllPayments();
    
    const stats = {
      total: payments.length,
      pending: payments.filter(p => p.status === 'pending').length,
      successful: payments.filter(p => p.status === 'success').length,
      failed: payments.filter(p => p.status === 'failed').length,
      cancelled: payments.filter(p => p.status === 'cancelled').length,
      totalRevenue: payments
        .filter(p => p.status === 'success')
        .reduce((sum, p) => sum + p.amount, 0),
      averageAmount: payments.length > 0 
        ? payments.reduce((sum, p) => sum + p.amount, 0) / payments.length 
        : 0,
      paymentMethods: {
        mtn_momo: payments.filter(p => p.paymentMethod === 'mtn_momo').length,
        airtel_money: payments.filter(p => p.paymentMethod === 'airtel_money').length
      }
    };
    
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

// Verify payment status (for client polling)
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
    
    res.json({
      success: true,
      data: {
        id: payment.id,
        status: payment.status,
        reference: payment.reference,
        transactionId: payment.transactionId,
        completedAt: payment.completedAt,
        failureReason: payment.failureReason
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

module.exports = router;