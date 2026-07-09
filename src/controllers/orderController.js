const Order = require('../models/Order');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { sendOrderConfirmation } = require('../utils/emailService');
const orderPaymentBridgeService = require('../services/orderPaymentBridgeService');
const eventBus = require('../events/eventBus');

// @desc    Create new order and return UPI QR code (Uses MongoDB Transactions)
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;

    const { order: createdOrder, payment } = await orderPaymentBridgeService.createOrderWithPaymentIntent({
      user: req.user,
      items,
      shippingAddress,
      paymentMethod
    });

    logger.info(`Order created successfully: ${createdOrder.orderNumber}`);
    
    // Send order confirmation email asynchronously
    sendOrderConfirmation(req.user, createdOrder);

    res.status(201).json({
      success: true,
      data: {
        order: createdOrder,
        payment
      }
    });
  } catch (error) {
    logger.error(`Order creation failed: ${error.message}`);
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
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

    const order = await orderPaymentBridgeService.submitOrderUTR(req.params.id, utr, req.user);

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel Order
// @route   DELETE /api/orders/:id
// @access  Private
const cancelOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const order = await Order.findById(req.params.id).session(session);
    if (!order) {
      await session.abortTransaction();
      eventBus.discardSession(session);
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      await session.abortTransaction();
      eventBus.discardSession(session);
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (order.status !== 'PENDING') {
      await session.abortTransaction();
      eventBus.discardSession(session);
      return res.status(400).json({ success: false, message: 'Can only cancel pending orders' });
    }

    order.status = 'CANCELLED';
    order.trackingUpdates.push({
      status: 'Cancelled',
      description: 'Order cancelled by user',
    });
    
    await order.save({ session });
    await orderPaymentBridgeService.releaseOrderInventory(order._id, {
      userId: req.user._id
    }, {
      session,
      actorType: req.user.role === 'admin' ? 'ADMIN' : 'CUSTOMER',
      reason: 'Inventory reservation released after order cancellation'
    });

    await session.commitTransaction();
    await eventBus.flushSession(session);
    res.json({ success: true, data: order });
  } catch (error) {
    await session.abortTransaction();
    eventBus.discardSession(session);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

module.exports = {
  createOrder,
  trackOrder,
  verifyPayment,
  cancelOrder
};
