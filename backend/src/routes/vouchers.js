const express = require('express');
const router = express.Router();
const db = require('../models/database');
const { v4: uuidv4 } = require('uuid');

// GET /api/vouchers - Get all available vouchers
router.get('/', (req, res) => {
  try {
    const vouchers = db.getAvailableVouchers();
    res.json({
      success: true,
      data: vouchers,
      count: vouchers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vouchers',
      error: error.message
    });
  }
});

// POST /api/vouchers/generate - Generate new voucher
router.post('/generate', (req, res) => {
  try {
    const { duration, price, dataLimit } = req.body;
    
    if (!duration || !price) {
      return res.status(400).json({
        success: false,
        message: 'Duration and price are required'
      });
    }

    const voucher = db.createVoucher({
      duration: parseInt(duration),
      price: parseInt(price),
      dataLimit: dataLimit || '1GB'
    });

    res.status(201).json({
      success: true,
      message: 'Voucher generated successfully',
      data: voucher
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate voucher',
      error: error.message
    });
  }
});

// POST /api/vouchers/validate - Validate voucher code
router.post('/validate', (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Voucher code is required'
      });
    }

    const voucher = db.getVoucherByCode(code);
    
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Invalid voucher code'
      });
    }

    if (voucher.isUsed) {
      return res.status(400).json({
        success: false,
        message: 'Voucher has already been used'
      });
    }

    if (voucher.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Voucher is not active'
      });
    }

    if (new Date() > new Date(voucher.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'Voucher has expired'
      });
    }

    res.json({
      success: true,
      message: 'Voucher is valid',
      data: {
        code: voucher.code,
        duration: voucher.duration,
        dataLimit: voucher.dataLimit,
        expiresAt: voucher.expiresAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to validate voucher',
      error: error.message
    });
  }
});

// POST /api/vouchers/redeem - Redeem voucher
router.post('/redeem', (req, res) => {
  try {
    const { code, userInfo } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Voucher code is required'
      });
    }

    const voucher = db.getVoucherByCode(code);
    
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Invalid voucher code'
      });
    }

    if (voucher.isUsed) {
      return res.status(400).json({
        success: false,
        message: 'Voucher has already been used'
      });
    }

    if (new Date() > new Date(voucher.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'Voucher has expired'
      });
    }

    // Redeem voucher
    const updatedVoucher = db.updateVoucher(voucher.id, {
      isUsed: true,
      usedAt: new Date(),
      userId: userInfo?.userId || null,
      userInfo: userInfo || null
    });

    // Create session for hotspot access
    const session = db.createSession({
      voucherId: voucher.id,
      userId: userInfo?.userId || null,
      duration: voucher.duration,
      dataLimit: voucher.dataLimit,
      startTime: new Date(),
      endTime: new Date(Date.now() + (voucher.duration * 60 * 60 * 1000))
    });

    res.json({
      success: true,
      message: 'Voucher redeemed successfully',
      data: {
        session: session,
        voucher: {
          code: updatedVoucher.code,
          duration: updatedVoucher.duration,
          dataLimit: updatedVoucher.dataLimit
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to redeem voucher',
      error: error.message
    });
  }
});

// GET /api/vouchers/:id - Get specific voucher
router.get('/:id', (req, res) => {
  try {
    const voucher = db.getVoucherById(req.params.id);
    
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Voucher not found'
      });
    }

    res.json({
      success: true,
      data: voucher
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch voucher',
      error: error.message
    });
  }
});

module.exports = router;