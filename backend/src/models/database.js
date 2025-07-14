const { v4: uuidv4 } = require('uuid');

// In-memory database for quick prototyping
class Database {
  constructor() {
    this.users = new Map();
    this.vouchers = new Map();
    this.payments = new Map();
    this.sessions = new Map();
    this.init();
  }

  init() {
    // Create default admin user
    const adminId = uuidv4();
    this.users.set(adminId, {
      id: adminId,
      email: 'admin@mowave.com',
      password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
      role: 'admin',
      createdAt: new Date(),
      isActive: true
    });

    // Create sample vouchers
    this.createSampleVouchers();
  }

  createSampleVouchers() {
    const sampleVouchers = [
      { duration: 1, price: 1000, dataLimit: '500MB' },
      { duration: 6, price: 5000, dataLimit: '2GB' },
      { duration: 24, price: 10000, dataLimit: '5GB' },
      { duration: 168, price: 50000, dataLimit: '20GB' }
    ];

    sampleVouchers.forEach(voucher => {
      for (let i = 0; i < 10; i++) {
        const voucherId = uuidv4();
        const code = this.generateVoucherCode();
        
        this.vouchers.set(voucherId, {
          id: voucherId,
          code: code,
          duration: voucher.duration,
          price: voucher.price,
          dataLimit: voucher.dataLimit,
          status: 'active',
          isUsed: false,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + (voucher.duration * 60 * 60 * 1000)),
          usedAt: null,
          userId: null
        });
      }
    });
  }

  generateVoucherCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'MW-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // User operations
  createUser(userData) {
    const id = uuidv4();
    const user = {
      id,
      ...userData,
      createdAt: new Date(),
      isActive: true
    };
    this.users.set(id, user);
    return user;
  }

  getUserById(id) {
    return this.users.get(id);
  }

  getUserByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  // Voucher operations
  createVoucher(voucherData) {
    const id = uuidv4();
    const voucher = {
      id,
      code: this.generateVoucherCode(),
      ...voucherData,
      status: 'active',
      isUsed: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (voucherData.duration * 60 * 60 * 1000)),
      usedAt: null,
      userId: null
    };
    this.vouchers.set(id, voucher);
    return voucher;
  }

  getVoucherById(id) {
    return this.vouchers.get(id);
  }

  getVoucherByCode(code) {
    for (const voucher of this.vouchers.values()) {
      if (voucher.code === code) return voucher;
    }
    return null;
  }

  getAllVouchers() {
    return Array.from(this.vouchers.values());
  }

  getAvailableVouchers() {
    return Array.from(this.vouchers.values()).filter(v => !v.isUsed && v.status === 'active');
  }

  updateVoucher(id, updates) {
    const voucher = this.vouchers.get(id);
    if (voucher) {
      Object.assign(voucher, updates);
      this.vouchers.set(id, voucher);
      return voucher;
    }
    return null;
  }

  // Payment operations
  createPayment(paymentData) {
    const id = uuidv4();
    const payment = {
      id,
      ...paymentData,
      createdAt: new Date(),
      status: 'pending'
    };
    this.payments.set(id, payment);
    return payment;
  }

  getPaymentById(id) {
    return this.payments.get(id);
  }

  updatePayment(id, updates) {
    const payment = this.payments.get(id);
    if (payment) {
      Object.assign(payment, updates);
      this.payments.set(id, payment);
      return payment;
    }
    return null;
  }

  getAllPayments() {
    return Array.from(this.payments.values());
  }

  // Session operations
  createSession(sessionData) {
    const id = uuidv4();
    const session = {
      id,
      ...sessionData,
      createdAt: new Date(),
      isActive: true
    };
    this.sessions.set(id, session);
    return session;
  }

  getSessionById(id) {
    return this.sessions.get(id);
  }

  updateSession(id, updates) {
    const session = this.sessions.get(id);
    if (session) {
      Object.assign(session, updates);
      this.sessions.set(id, session);
      return session;
    }
    return null;
  }

  // Analytics
  getStats() {
    const totalVouchers = this.vouchers.size;
    const usedVouchers = Array.from(this.vouchers.values()).filter(v => v.isUsed).length;
    const totalPayments = this.payments.size;
    const successfulPayments = Array.from(this.payments.values()).filter(p => p.status === 'success').length;
    const totalRevenue = Array.from(this.payments.values())
      .filter(p => p.status === 'success')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      totalVouchers,
      usedVouchers,
      availableVouchers: totalVouchers - usedVouchers,
      totalPayments,
      successfulPayments,
      totalRevenue,
      activeUsers: this.users.size
    };
  }
}

// Export singleton instance
const dbInstance = new Database();

// Add some logging
console.log('📊 Database initialized with:');
console.log(`- ${dbInstance.users.size} users`);
console.log(`- ${dbInstance.vouchers.size} vouchers`);
console.log(`- Admin user: admin@mowave.com / password`);

module.exports = dbInstance;