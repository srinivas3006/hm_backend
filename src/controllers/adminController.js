const Book = require('../models/Book');
const Order = require('../models/Order');
const User = require('../models/User');
const PublishRequest = require('../models/PublishRequest');
const { sendPublishRequestUpdate } = require('../utils/emailService');

// @desc    Get global analytics for admin dashboard
// @route   GET /api/admin/analytics
// @access  Private (Admin)
const getAdminAnalytics = async (req, res) => {
  try {
    // Total Revenue (Only completed/delivered orders)
    const revenueAgg = await Order.aggregate([
      { $match: { status: { $in: ['DELIVERED', 'SHIPPED', 'PROCESSING'] } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } }
    ]);
    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;

    // Total Orders
    const totalOrders = await Order.countDocuments();

    // Total Books Sold
    const booksSoldAgg = await Order.aggregate([
      { $match: { status: { $in: ['DELIVERED', 'SHIPPED', 'PROCESSING'] } } },
      { $unwind: '$items' },
      { $group: { _id: null, totalBooksSold: { $sum: '$items.quantity' } } }
    ]);
    const totalBooksSold = booksSoldAgg.length > 0 ? booksSoldAgg[0].totalBooksSold : 0;

    // Book Inventory Status
    const totalBooks = await Book.countDocuments();

    const totalUsers = await User.countDocuments();

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        totalBooksSold,
        totalBooks,
        totalUsers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a new book (Inventory Management)
// @route   POST /api/admin/books
// @access  Private (Admin)
const createBook = async (req, res) => {
  try {
    const book = new Book({
      ...req.body,
      author: req.body.author || req.user._id // Default to current user if not specified
    });
    
    const createdBook = await book.save();
    res.status(201).json({ success: true, data: createdBook });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a book
// @route   PUT /api/admin/books/:id
// @access  Private (Admin)
const updateBook = async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    
    res.json({ success: true, data: book });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a book
// @route   DELETE /api/admin/books/:id
// @access  Private (Admin)
const deleteBook = async (req, res) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    
    res.json({ success: true, message: 'Book removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all orders
// @route   GET /api/admin/orders
// @access  Private (Admin)
const getOrders = async (req, res) => {
  try {
    const orders = await Order.find().populate('user', 'name email').sort('-createdAt');
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status
// @route   PUT /api/admin/orders/:id/status
// @access  Private (Admin)
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    order.status = status;
    order.trackingUpdates.push({
      status,
      description: `Order status updated to ${status}`
    });

    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get publish requests
// @route   GET /api/admin/publish-requests
// @access  Private (Admin)
const getPublishRequests = async (req, res) => {
  try {
    const requests = await PublishRequest.find().populate('user', 'name email').populate('packageId', 'name').sort('-createdAt');
    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update publish request status
// @route   PUT /api/admin/publish-requests/:id/status
// @access  Private (Admin)
const updatePublishRequestStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const request = await PublishRequest.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate('user');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    
    if (request.user) {
      sendPublishRequestUpdate(request.user, request, status);
    }
    
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAdminAnalytics,
  createBook,
  updateBook,
  deleteBook,
  getOrders,
  updateOrderStatus,
  getPublishRequests,
  updatePublishRequestStatus
};
