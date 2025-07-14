const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);
router.use(requireAdmin);


// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// ==================== DASHBOARD ====================
// GET /admin/dashboard - Get comprehensive dashboard statistics
router.get('/dashboard', async (req, res) => {
  try {
    const stats = db.getStats();
    
    // Get all payments and vouchers for detailed analysis
    const payments = db.getAllPayments();
    const vouchers = db.getAllVouchers();
    const users = Array.from(db.users.values());
    
    // Recent payments (last 5)
    const recentPayments = payments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        paymentMethod: p.paymentMethod,
        phoneNumber: p.phoneNumber,
        createdAt: p.createdAt,
        reference: p.reference
      }));
    
    // Recent vouchers (last 5)
    const recentVouchers = vouchers
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(v => ({
        id: v.id,
        code: v.code,
        duration: v.duration,
        price: v.price,
        dataLimit: v.dataLimit,
        isUsed: v.isUsed,
        createdAt: v.createdAt,
        usedAt: v.usedAt
      }));
    
    // Revenue by payment method
    const revenueByMethod = payments
      .filter(p => p.status === 'success')
      .reduce((acc, p) => {
        acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + p.amount;
        return acc;
      }, {});
    
    // Monthly revenue (last 12 months)
    const monthlyRevenue = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthPayments = payments.filter(p => {
        const pDate = new Date(p.createdAt);
        return pDate.getMonth() === date.getMonth() && 
               pDate.getFullYear() === date.getFullYear() &&
               p.status === 'success';
      });
      
      monthlyRevenue.push({
        month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: monthlyRevenue.reduce((sum, p) => sum + p.amount, 0),
        transactions: monthPayments.length
      });
    }
    
    // Payment status breakdown
    const paymentStats = {
      total: payments.length,
      pending: payments.filter(p => p.status === 'pending').length,
      success: payments.filter(p => p.status === 'success').length,
      failed: payments.filter(p => p.status === 'failed').length,
      cancelled: payments.filter(p => p.status === 'cancelled').length
    };
    
    // Voucher usage by duration
    const vouchersByDuration = vouchers.reduce((acc, v) => {
      const key = `${v.duration}h`;
      if (!acc[key]) acc[key] = { total: 0, used: 0, revenue: 0 };
      acc[key].total++;
      if (v.isUsed) {
        acc[key].used++;
        acc[key].revenue += v.price;
      }
      return acc;
    }, {});
    
    // Top performing vouchers
    const topVouchers = Object.entries(vouchersByDuration)
      .map(([duration, data]) => ({
        duration,
        ...data,
        usageRate: data.total > 0 ? ((data.used / data.total) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);
    
    // Recent user registrations
    const recentUsers = users
      .filter(u => u.role !== 'admin')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        isActive: u.isActive
      }));
    
    res.json({
      success: true,
      data: {
        overview: {
          ...stats,
          successRate: paymentStats.total > 0 ? ((paymentStats.success / paymentStats.total) * 100).toFixed(1) : 0,
          averageTransactionValue: paymentStats.success > 0 ? (stats.totalRevenue / paymentStats.success).toFixed(0) : 0
        },
        recentPayments,
        recentVouchers,
        recentUsers,
        analytics: {
          revenueByMethod,
          monthlyRevenue,
          paymentStats,
          topVouchers,
          vouchersByDuration
        }
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== USER MANAGEMENT ====================
// GET /admin/users - Get all users with pagination and filtering
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, role, status, search } = req.query;
    
    let users = Array.from(db.users.values());
    
    // Apply filters
    if (role) {
      users = users.filter(u => u.role === role);
    }
    
    if (status) {
      const isActive = status === 'active';
      users = users.filter(u => u.isActive === isActive);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(u => 
        u.email.toLowerCase().includes(searchLower) ||
        u.id.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by creation date (newest first)
    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Pagination
    const skip = (page - 1) * limit;
    const paginatedUsers = users.slice(skip, skip + parseInt(limit));
    
    // Remove passwords from response
    const safeUsers = paginatedUsers.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt
    }));
    
    res.json({
      success: true,
      data: safeUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: users.length,
        pages: Math.ceil(users.length / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /admin/users - Create new user
router.post('/users', async (req, res) => {
  try {
    const { email, password, role = 'user' } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Check if user already exists
    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = db.createUser({
      email,
      password: hashedPassword,
      role
    });
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /admin/users/:id - Update user
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role, isActive, password } = req.body;
    
    const user = db.getUserById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent admin from deactivating themselves
    if (id === req.user.userId && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'Cannot deactivate your own account'
      });
    }
    
    // Update user data
    const updateData = {};
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    
    // Update user in database
    Object.assign(user, updateData);
    db.users.set(id, user);
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /admin/users/:id - Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = db.getUserById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent admin from deleting themselves
    if (id === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    // Delete user
    db.users.delete(id);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== VOUCHER MANAGEMENT ====================
// GET /admin/vouchers - Get all vouchers with pagination and filtering
router.get('/vouchers', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, duration, used } = req.query;
    
    let vouchers = db.getAllVouchers();
    
    // Apply filters
    if (status) {
      vouchers = vouchers.filter(v => v.status === status);
    }
    
    if (duration) {
      vouchers = vouchers.filter(v => v.duration === parseInt(duration));
    }
    
    if (used !== undefined) {
      const isUsed = used === 'true';
      vouchers = vouchers.filter(v => v.isUsed === isUsed);
    }
    
    // Sort by creation date (newest first)
    vouchers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Pagination
    const skip = (page - 1) * limit;
    const paginatedVouchers = vouchers.slice(skip, skip + parseInt(limit));
    
    res.json({
      success: true,
      data: paginatedVouchers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: vouchers.length,
        pages: Math.ceil(vouchers.length / limit)
      }
    });
  } catch (error) {
    console.error('Get vouchers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vouchers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /admin/vouchers - Create new voucher
router.post('/vouchers', async (req, res) => {
  try {
    const { duration, price, dataLimit, quantity = 1 } = req.body;
    
    if (!duration || !price || !dataLimit) {
      return res.status(400).json({
        success: false,
        message: 'Duration, price, and dataLimit are required'
      });
    }
    
    const createdVouchers = [];
    
    // Create multiple vouchers if quantity > 1
    for (let i = 0; i < quantity; i++) {
      const voucher = db.createVoucher({
        duration: parseInt(duration),
        price: parseInt(price),
        dataLimit
      });
      createdVouchers.push(voucher);
    }
    
    res.status(201).json({
      success: true,
      message: `${quantity} voucher(s) created successfully`,
      data: createdVouchers
    });
  } catch (error) {
    console.error('Create voucher error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create voucher',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /admin/vouchers/:id - Update voucher
router.put('/vouchers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { duration, price, dataLimit, status } = req.body;
    
    const voucher = db.getVoucherById(id);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Voucher not found'
      });
    }
    
    // Prevent updating used vouchers
    if (voucher.isUsed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update used voucher'
      });
    }
    
    const updateData = {};
    if (duration !== undefined) updateData.duration = parseInt(duration);
    if (price !== undefined) updateData.price = parseInt(price);
    if (dataLimit !== undefined) updateData.dataLimit = dataLimit;
    if (status !== undefined) updateData.status = status;
    
    // Update expiration if duration changed
    if (duration !== undefined) {
      updateData.expiresAt = new Date(Date.now() + (parseInt(duration) * 60 * 60 * 1000));
    }
    
    const updatedVoucher = db.updateVoucher(id, updateData);
    
    res.json({
      success: true,
      message: 'Voucher updated successfully',
      data: updatedVoucher
    });
  } catch (error) {
    console.error('Update voucher error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update voucher',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /admin/vouchers/:id - Delete voucher
router.delete('/vouchers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const voucher = db.getVoucherById(id);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Voucher not found'
      });
    }
    
    // Check if voucher is used
    if (voucher.isUsed) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete used voucher'
      });
    }
    
    // Delete voucher
    db.vouchers.delete(id);
    
    res.json({
      success: true,
      message: 'Voucher deleted successfully'
    });
  } catch (error) {
    console.error('Delete voucher error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete voucher',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== PAYMENT MANAGEMENT ====================
// GET /admin/payments - Get all payments with advanced filtering
router.get('/payments', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      paymentMethod, 
      startDate, 
      endDate,
      minAmount,
      maxAmount
    } = req.query;
    
    let payments = db.getAllPayments();
    
    // Apply filters
    if (status) {
      payments = payments.filter(p => p.status === status);
    }
    
    if (paymentMethod) {
      payments = payments.filter(p => p.paymentMethod === paymentMethod);
    }
    
    if (startDate) {
      const start = new Date(startDate);
      payments = payments.filter(p => new Date(p.createdAt) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      payments = payments.filter(p => new Date(p.createdAt) <= end);
    }
    
    if (minAmount) {
      payments = payments.filter(p => p.amount >= parseInt(minAmount));
    }
    
    if (maxAmount) {
      payments = payments.filter(p => p.amount <= parseInt(maxAmount));
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
      message: 'Failed to fetch payments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /admin/payments/:id - Update payment status
router.put('/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, failureReason, notes } = req.body;
    
    const payment = db.getPaymentById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    const validStatuses = ['pending', 'success', 'failed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status'
      });
    }
    
    const updateData = {};
    if (status) updateData.status = status;
    if (failureReason) updateData.failureReason = failureReason;
    if (notes) updateData.adminNotes = notes;
    
    // Handle voucher status based on payment status
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
    } else if (status === 'failed' && payment.status === 'success') {
      // If changing from success to failed, free up the voucher
      const voucher = db.getVoucherById(payment.voucherId);
      if (voucher && voucher.isUsed) {
        db.updateVoucher(payment.voucherId, {
          isUsed: false,
          usedAt: null,
          userId: null
        });
      }
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

// ==================== ANALYTICS ====================
// GET /admin/analytics/revenue - Get revenue analytics
router.get('/analytics/revenue', async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    
    const payments = db.getAllPayments().filter(p => p.status === 'success');
    
    let filteredPayments = payments;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filteredPayments = payments.filter(p => {
        const date = new Date(p.createdAt);
        return date >= start && date <= end;
      });
    }
    
    // Group by period
    const groupedData = {};
    filteredPayments.forEach(payment => {
      const date = new Date(payment.createdAt);
      let key;
      
      switch (period) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = date.getFullYear().toString();
          break;
        default:
          key = date.toISOString().split('T')[0];
      }
      
      if (!groupedData[key]) {
        groupedData[key] = { revenue: 0, transactions: 0 };
      }
      
      groupedData[key].revenue += payment.amount;
      groupedData[key].transactions += 1;
    });
    
    // Convert to array and sort
    const chartData = Object.entries(groupedData)
      .map(([period, data]) => ({
        period,
        revenue: data.revenue,
        transactions: data.transactions
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
    
    const totalRevenue = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalTransactions = filteredPayments.length;
    const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    
    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalTransactions,
          averageTransaction: Math.round(averageTransaction),
          period
        },
        chartData
      }
    });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /admin/analytics/vouchers - Get voucher analytics
router.get('/analytics/vouchers', async (req, res) => {
  try {
    const vouchers = db.getAllVouchers();
    
    // Usage by duration
    const usageByDuration = vouchers.reduce((acc, v) => {
      const key = `${v.duration}h`;
      if (!acc[key]) acc[key] = { total: 0, used: 0 };
      acc[key].total++;
      if (v.isUsed) acc[key].used++;
      return acc;
    }, {});
    
    // Usage by price range
    const usageByPrice = vouchers.reduce((acc, v) => {
      let range;
      if (v.price < 5000) range = 'Under 5K';
      else if (v.price < 15000) range = '5K - 15K';
      else if (v.price < 30000) range = '15K - 30K';
      else range = 'Over 30K';
      
      if (!acc[range]) acc[range] = { total: 0, used: 0 };
      acc[range].total++;
      if (v.isUsed) acc[range].used++;
      return acc;
    }, {});
    
    // Daily usage trends (last 30 days)
    const dailyUsage = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayVouchers = vouchers.filter(v => {
        if (!v.usedAt) return false;
        const usedDate = new Date(v.usedAt).toISOString().split('T')[0];
        return usedDate === dateStr;
      });
      
      dailyUsage.push({
        date: dateStr,
        used: dayVouchers.length,
        revenue: dayVouchers.reduce((sum, v) => sum + v.price, 0)
      });
    }
    
    res.json({
      success: true,
      data: {
        summary: {
          total: vouchers.length,
          used: vouchers.filter(v => v.isUsed).length,
          active: vouchers.filter(v => v.status === 'active').length,
          usageRate: vouchers.length > 0 ? ((vouchers.filter(v => v.isUsed).length / vouchers.length) * 100).toFixed(1) : 0
        },
        usageByDuration,
        usageByPrice,
        dailyUsage
      }
    });
  } catch (error) {
    console.error('Voucher analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch voucher analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== BULK OPERATIONS ====================
// POST /admin/bulk/vouchers - Bulk create vouchers
router.post('/bulk/vouchers', async (req, res) => {
  try {
    const { vouchers } = req.body;

    if (!Array.isArray(vouchers) || vouchers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vouchers array is required'
      });
    }

    const createdVouchers = [];
    const errors = [];

    vouchers.forEach((voucherData, index) => {
      try {
        const { duration, price, dataLimit, quantity = 1 } = voucherData;

        if (!duration || !price || !dataLimit) {
          errors.push(`Voucher ${index + 1}: Duration, price, and dataLimit are required`);
          return;
        }

        for (let i = 0; i < quantity; i++) {
          const voucher = db.createVoucher({
            duration: parseInt(duration),
            price: parseInt(price),
            dataLimit
          });
          createdVouchers.push(voucher);
        }
      } catch (error) {
        errors.push(`Voucher ${index + 1}: ${error.message}`);
      }
    });

    res.status(201).json({
      success: true,
      message: `${createdVouchers.length} voucher(s) created successfully`,
      data: createdVouchers,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Bulk voucher creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process bulk voucher creation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
