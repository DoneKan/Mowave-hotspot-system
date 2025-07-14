import React, { useState, useEffect } from 'react';
import {
  Wifi,
  CreditCard,
  Smartphone,
  CheckCircle,
  AlertCircle,
  User,
  Settings,
  BarChart3,
  DollarSign,
  Clock,
  Shield,
  LogOut,
  Home,
  Users,
  FileText,
  Eye,
  EyeOff
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

const MoWaveApp = () => {
  const [currentView, setCurrentView] = useState('home');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // API Service
  const apiCall = async (endpoint, options = {}) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(user?.token && { Authorization: `Bearer ${user.token}` })
        },
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  };

  // Show message helper
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // Voucher Entry Component
  const VoucherEntry = () => {
    const [voucherCode, setVoucherCode] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [voucherStatus, setVoucherStatus] = useState(null);

    const handleVoucherCheck = async (e) => {
      e.preventDefault();
      if (!voucherCode.trim()) return;

      setLoading(true);
      try {
        const response = await apiCall(`/vouchers/validate`, {
          method: 'POST',
          body: JSON.stringify({ voucher_code: voucherCode })
        });

        setVoucherStatus(response.data);
        if (response.data.is_valid) {
          showMessage('success', 'Voucher is valid and ready to use!');
        } else {
          showMessage('error', 'Invalid or expired voucher code');
        }
      } catch (error) {
        showMessage('error', 'Error checking voucher. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const handleVoucherRedeem = async () => {
      if (!voucherCode.trim()) return;

      setLoading(true);
      try {
        const response = await apiCall(`/vouchers/redeem`, {
          method: 'POST',
          body: JSON.stringify({ voucher_code: voucherCode })
        });

        showMessage('success', 'Voucher activated successfully! You can now access the internet.');
        setVoucherStatus(response.data);
      } catch (error) {
        showMessage('error', 'Error activating voucher. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center mb-6">
            <Wifi className="w-12 h-12 text-blue-600 mx-auto mb-2" />
            <h2 className="text-2xl font-bold text-gray-800">Enter Voucher Code</h2>
            <p className="text-gray-600">Enter your voucher code to access internet</p>
          </div>

          <form onSubmit={handleVoucherCheck} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voucher Code
              </label>
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                placeholder="Enter voucher code"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Checking...' : 'Check Voucher'}
              </button>

              {voucherStatus?.is_valid && (
                <button
                  type="button"
                  onClick={handleVoucherRedeem}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Activating...' : 'Activate'}
                </button>
              )}
            </div>
          </form>

          {voucherStatus && (
            <div className={`mt-4 p-4 rounded-lg ${voucherStatus.is_valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                {voucherStatus.is_valid ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <div>
                  <h3 className={`font-medium ${voucherStatus.is_valid ? 'text-green-800' : 'text-red-800'}`}>
                    {voucherStatus.is_valid ? 'Valid Voucher' : 'Invalid Voucher'}
                  </h3>
                  {voucherStatus.is_valid && (
                    <div className="text-sm text-green-600 mt-1">
                      <p>Duration: {voucherStatus.duration_hours} hours</p>
                      <p>Price: UGX {voucherStatus.price}</p>
                      <p>Status: {voucherStatus.is_redeemed ? 'Used' : 'Available'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={() => setCurrentView('buy')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Don't have a voucher? Buy one here →
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Payment Component
  const PaymentFlow = () => {
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [paymentStep, setPaymentStep] = useState('plans');

    const pricingPlans = [
      { id: 1, name: '1 Hour', duration: 1, price: 1000, popular: false },
      { id: 2, name: '3 Hours', duration: 3, price: 2500, popular: true },
      { id: 3, name: '6 Hours', duration: 6, price: 4000, popular: false },
      { id: 4, name: '12 Hours', duration: 12, price: 7000, popular: false },
      { id: 5, name: '24 Hours', duration: 24, price: 12000, popular: false }
    ];

    const handlePlanSelect = (plan) => {
      setSelectedPlan(plan);
      setPaymentStep('payment');
    };

    const handlePayment = async (e) => {
      e.preventDefault();
      if (!selectedPlan || !paymentMethod || !phoneNumber) return;

      setLoading(true);
      try {
        const response = await apiCall('/payments/process', {
          method: 'POST',
          body: JSON.stringify({
            plan_id: selectedPlan.id,
            payment_method: paymentMethod,
            phone_number: phoneNumber,
            amount: selectedPlan.price
          })
        });

        if (response.success) {
          showMessage('success', `Payment successful! Your voucher code is: ${response.data.voucher_code}`);
          setPaymentStep('success');
        } else {
          showMessage('error', 'Payment failed. Please try again.');
        }
      } catch (error) {
        showMessage('error', 'Payment processing error. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (paymentStep === 'plans') {
      return (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Choose Your Plan</h2>
            <p className="text-gray-600">Select the perfect internet package for your needs</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pricingPlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-lg shadow-lg p-6 cursor-pointer transition-all hover:shadow-xl ${plan.popular ? 'border-2 border-blue-500' : 'border border-gray-200'
                  }`}
                onClick={() => handlePlanSelect(plan)}
              >
                {plan.popular && (
                  <span className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 text-sm font-medium rounded-bl-lg rounded-tr-lg">
                    Popular
                  </span>
                )}

                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{plan.name}</h3>
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    UGX {plan.price.toLocaleString()}
                  </div>
                  <p className="text-gray-600 mb-4">{plan.duration} hour{plan.duration > 1 ? 's' : ''} access</p>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-600">High-speed internet</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-600">Instant activation</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-600">24/7 support</span>
                    </div>
                  </div>

                  <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                    Select Plan
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (paymentStep === 'payment') {
      return (
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <CreditCard className="w-12 h-12 text-blue-600 mx-auto mb-2" />
              <h2 className="text-2xl font-bold text-gray-800">Complete Payment</h2>
              <p className="text-gray-600">
                {selectedPlan?.name} - UGX {selectedPlan?.price.toLocaleString()}
              </p>
            </div>

            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="payment"
                      value="mtn"
                      checked={paymentMethod === 'mtn'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="text-blue-600"
                    />
                    <Smartphone className="w-5 h-5 text-yellow-500" />
                    <span>MTN Mobile Money</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="payment"
                      value="airtel"
                      checked={paymentMethod === 'airtel'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="text-blue-600"
                    />
                    <Smartphone className="w-5 h-5 text-red-500" />
                    <span>Airtel Money</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="256700000000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentStep('plans')}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Processing...' : 'Pay Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-4">Your voucher has been generated</p>
          <button
            onClick={() => setCurrentView('home')}
            className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Use Voucher Now
          </button>
        </div>
      </div>
    );
  };

  // Login Component
  const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e) => {
      e.preventDefault();

      setLoading(true);
      try {
        const response = await apiCall('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        if (response.success) {
          setUser(response.data.user);
          setCurrentView('admin');
          showMessage('success', 'Login successful!');
        } else {
          showMessage('error', 'Invalid credentials');
        }
      } catch (error) {
        showMessage('error', 'Login failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center mb-6">
            <Shield className="w-12 h-12 text-blue-600 mx-auto mb-2" />
            <h2 className="text-2xl font-bold text-gray-800">Admin Login</h2>
            <p className="text-gray-600">Access the admin dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mowave.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-600">
            Demo credentials: admin@mowave.com / password
          </div>
        </div>
      </div>
    );
  };

  // Admin Dashboard Component
  const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [vouchers, setVouchers] = useState([]);

    useEffect(() => {
      const fetchDashboardData = async () => {
        try {
          const [statsResponse, vouchersResponse] = await Promise.all([
            apiCall('/admin/stats'),
            apiCall('/admin/vouchers')
          ]);

          setStats(statsResponse.data);
          setVouchers(vouchersResponse.data);
        } catch (error) {
          showMessage('error', 'Failed to load dashboard data');
        }
      };

      if (user?.token) {
        fetchDashboardData();
      }
    }, [user]);


    const handleLogout = () => {
      setUser(null);
      setCurrentView('home');
      showMessage('success', 'Logged out successfully');
    };

    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Vouchers</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_vouchers}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Used Vouchers</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.used_vouchers}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">UGX {stats.total_revenue?.toLocaleString()}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Users</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active_users}</p>
                </div>
                <Users className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-800">Recent Vouchers</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-700">Code</th>
                  <th className="text-left p-4 font-medium text-gray-700">Duration</th>
                  <th className="text-left p-4 font-medium text-gray-700">Price</th>
                  <th className="text-left p-4 font-medium text-gray-700">Status</th>
                  <th className="text-left p-4 font-medium text-gray-700">Created</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((voucher) => (
                  <tr key={voucher.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-mono text-sm">{voucher.voucher_code}</td>
                    <td className="p-4">{voucher.duration_hours}h</td>
                    <td className="p-4">UGX {voucher.price.toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${voucher.is_redeemed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {voucher.is_redeemed ? 'Used' : 'Available'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {new Date(voucher.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Navigation
  const Navigation = () => (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <Wifi className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-800">MoWave</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentView('home')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentView === 'home' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              <Home className="w-4 h-4" />
              Home
            </button>

            <button
              onClick={() => setCurrentView('buy')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentView === 'buy' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              <CreditCard className="w-4 h-4" />
              Buy Voucher
            </button>

            {user ? (
              <button
                onClick={() => setCurrentView('admin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentView === 'admin' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-800'
                  }`}
              >
                <Settings className="w-4 h-4" />
                Dashboard
              </button>
            ) : (
              <button
                onClick={() => setCurrentView('login')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentView === 'login' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-800'
                  }`}
              >
                <User className="w-4 h-4" />
                Admin
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );

  // Message Display
  const MessageDisplay = () => {
    if (!message.text) return null;

    return (
      <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
        <div className="flex items-center gap-2">
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
        </div>
      </div>
    );
  };

  // Main render
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <MessageDisplay />

      <div className="max-w-7xl mx-auto p-6">
        {currentView === 'home' && <VoucherEntry />}
        {currentView === 'buy' && <PaymentFlow />}
        {currentView === 'login' && <Login />}
        {currentView === 'admin' && user && <AdminDashboard />}
      </div>
    </div>
  );
};

export default MoWaveApp;