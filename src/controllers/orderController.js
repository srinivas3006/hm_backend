const mongoose = require('mongoose');
const Order = require('../models/Order');
const Book = require('../models/Book');
const crypto = require('crypto');
const QRCode = require('qrcode');
const QRCode = require('qrcode');
const logger = require('../utils/logger');
const { sendOrderConfirmation } = require('../utils/emailService');

// @desc    Create new order and return UPI QR code (Uses MongoDB Transactions)
// @route   POST /api/orders/checkout
// @access  Private
const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, shippingAddress, paymentMethod } = req.body;

    if (!items || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'No order items' });
    }

    let subtotal = 0;
    const orderItems = [];

    // Verify prices from DB, calculate totals, and decrement stock atomically
    for (const item of items) {
      const bId = item.bookId || item.book;
      // Find the book and lock it for this transaction
      const book = await Book.findById(bId).session(session);
      
      if (!book) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: `Book not found: ${bId}` });
      }

      if (book.stock < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: `Insufficient stock for book: ${book.title}` });
      }
      
      const itemTotal = book.price * item.quantity;
      subtotal += itemTotal;
      
      orderItems.push({
        book: book._id,
        quantity: item.quantity,
        price: book.price
      });

      // Decrement stock
      book.stock -= item.quantity;
      await book.save({ session });
    }

    const tax = Number((0.05 * subtotal).toFixed(2)); // Example 5% tax
    const shippingPrice = subtotal > 500 ? 0 : 50; // Free shipping over 500
    const totalPrice = subtotal + tax + shippingPrice;
    const orderNumber = `HM-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

    const order = new Order({
      orderNumber,
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      subtotal,
      tax,
      shippingPrice,
      totalPrice,
      paymentMethod: paymentMethod || 'UPI',
      status: 'PENDING'
    });

    const createdOrder = await order.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Generate UPI QR Code Payload (Post-transaction)
    const upiId = process.env.MERCHANT_UPI_ID || 'merchant@upi';
    const merchantName = process.env.MERCHANT_NAME || 'Harglim Publishers';
    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${totalPrice}&cu=INR&tn=Order%20${orderNumber}`;
    
    // Generate base64 QR code image
    const qrCodeDataUrl = await QRCode.toDataURL(upiUrl);

    logger.info(`Order created successfully: ${orderNumber}`);
    
    // Send order confirmation email asynchronously
    sendOrderConfirmation(req.user, createdOrder);

    res.status(201).json({
      success: true,
      data: {
        order: createdOrder,
        payment: {
          upiUrl,
          qrCodeDataUrl,
          amount: totalPrice
        }
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Order creation failed: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Track Order
// @route   GET /api/orders/track/:orderNumber
// @access  Public
const trackOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate('items.book', 'title coverImage');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        shippingAddress: order.shippingAddress,
        items: order.items,
        trackingUpdates: order.trackingUpdates,
        totalPrice: order.totalPrice
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify Payment (Submit UTR)
// @route   PUT /api/orders/:id/verify-payment
// @access  Private
const verifyPayment = async (req, res) => {
  try {
    const { utr } = req.body;
    
    if (!utr) {
      return res.status(400).json({ success: false, message: 'UTR (Transaction ID) is required' });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Ensure order belongs to user or is admin (omitted complex check for brevity, assuming user matches)
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this order' });
    }

    order.utr = utr;
    order.status = 'PENDING'; // Still pending until admin manually verifies
    
    // Add tracking update
    order.trackingUpdates.push({
      status: 'Payment Submitted',
      description: `UTR ${utr} submitted. Waiting for admin verification.`,
    });

    await order.save();

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel Order
// @route   DELETE /api/orders/:id
// @access  Private
const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Can only cancel pending orders' });
    }

    order.status = 'CANCELLED';
    order.trackingUpdates.push({
      status: 'Cancelled',
      description: 'Order cancelled by user',
    });
    
    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createOrder,
  trackOrder,
  verifyPayment,
  cancelOrder
};
