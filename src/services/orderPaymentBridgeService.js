const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Book = require('../models/Book');
const paymentService = require('./paymentService');
const inventoryService = require('./inventoryService');
const eventBus = require('../events/eventBus');
const { DOMAIN_EVENTS } = require('../events/eventCatalog');

const DEFAULT_PAYMENT_METHOD = 'UPI';

class OrderPaymentBridgeError extends Error {
  constructor(message, statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
  }
}

class OrderValidationError extends OrderPaymentBridgeError {
  constructor(message, details = {}) {
    super(message, 400, details);
  }
}

class OrderNotFoundError extends OrderPaymentBridgeError {
  constructor(message = 'Order not found', details = {}) {
    super(message, 404, details);
  }
}

class OrderAuthorizationError extends OrderPaymentBridgeError {
  constructor(message = 'Not authorized to update this order', details = {}) {
    super(message, 403, details);
  }
}

const normalizeId = (value) => (value && value.toString ? value.toString() : String(value));

class OrderPaymentBridgeService {
  constructor({
    orderModel = Order,
    bookModel = Book,
    paymentEngine = paymentService,
    inventoryEngine = inventoryService
  } = {}) {
    this.Order = orderModel;
    this.Book = bookModel;
    this.paymentService = paymentEngine;
    this.inventoryService = inventoryEngine;
  }

  async createOrderWithPaymentIntent({ user, items, shippingAddress, paymentMethod }, options = {}) {
    if (!items || items.length === 0) {
      throw new OrderValidationError('No order items');
    }

    const session = options.session || await mongoose.startSession();
    const ownsSession = !options.session;

    try {
      if (ownsSession) session.startTransaction();

      const orderTotals = await this.buildOrderItems(items, session);
      const orderNumber = this.generateOrderNumber();
      const order = new this.Order({
        orderNumber,
        user: user._id,
        items: orderTotals.orderItems,
        shippingAddress,
        subtotal: orderTotals.subtotal,
        tax: orderTotals.tax,
        shippingPrice: orderTotals.shippingPrice,
        totalPrice: orderTotals.totalPrice,
        paymentMethod: paymentMethod || DEFAULT_PAYMENT_METHOD,
        status: 'PENDING'
      });

      const createdOrder = await order.save({ session });
      const intent = await this.paymentService.createPaymentIntent({
        order: createdOrder._id,
        user: user._id,
        amount: createdOrder.totalPrice,
        currency: 'INR',
        paymentMethod: createdOrder.paymentMethod || DEFAULT_PAYMENT_METHOD,
        provider: 'manual_upi'
      }, {
        session,
        orderAmount: createdOrder.totalPrice,
        orderStatus: createdOrder.status,
        actor: { userId: user._id },
        actorType: 'CUSTOMER',
        reason: 'Order checkout payment intent created'
      });

      await this.inventoryService.reserveOrderItems({
        order: createdOrder,
        payment: intent,
        items: createdOrder.items
      }, {
        session,
        actor: { userId: user._id },
        actorType: 'CUSTOMER',
        expiresAt: intent.expiresAt,
        reason: 'Inventory reserved for order checkout'
      });

      const qr = await this.paymentService.generateQRCode(intent._id, {
        session,
        orderId: createdOrder._id,
        userId: user._id,
        amount: createdOrder.totalPrice,
        orderReference: createdOrder.orderNumber,
        transactionNote: `Order ${createdOrder.orderNumber}`,
        actor: { userId: user._id },
        actorType: 'CUSTOMER'
      });

      createdOrder.payment = intent._id;
      createdOrder.paymentMethod = intent.paymentMethod || createdOrder.paymentMethod || DEFAULT_PAYMENT_METHOD;
      await createdOrder.save({ session });
      await this.publishOrderEvent(DOMAIN_EVENTS.ORDER_CREATED, createdOrder, {
        session,
        user,
        payment: intent
      });

      if (ownsSession) {
        await session.commitTransaction();
        await eventBus.flushSession(session);
      }

      return {
        order: createdOrder,
        payment: this.toLegacyPaymentResponse(qr, createdOrder.totalPrice)
      };
    } catch (error) {
      if (ownsSession) {
        await session.abortTransaction();
        eventBus.discardSession(session);
      }
      throw error;
    } finally {
      if (ownsSession) session.endSession();
    }
  }

  async submitOrderUTR(orderId, utr, user, options = {}) {
    if (!utr) {
      throw new OrderValidationError('UTR (Transaction ID) is required');
    }

    const session = options.session || await mongoose.startSession();
    const ownsSession = !options.session;

    try {
      if (ownsSession) session.startTransaction();

      const order = await this.Order.findById(orderId).session(session);
      if (!order) {
        throw new OrderNotFoundError();
      }

      if (normalizeId(order.user) !== normalizeId(user._id)) {
        throw new OrderAuthorizationError();
      }

      const payment = await this.resolveOrderPayment(order, session);
      const updatedPayment = await this.paymentService.submitUTR(payment._id, utr, {
        userId: user._id,
        orderId: order._id
      }, {
        session,
        actorType: 'CUSTOMER',
        reason: 'Manual UTR submitted from order API'
      });

      await this.synchronizeOrderPaymentFields(order, updatedPayment, {
        session,
        addTrackingUpdate: {
          status: 'Payment Submitted',
          description: `UTR ${updatedPayment.utr} submitted. Waiting for admin verification.`
        }
      });

      if (ownsSession) {
        await session.commitTransaction();
        await eventBus.flushSession(session);
      }

      return order;
    } catch (error) {
      if (ownsSession) {
        await session.abortTransaction();
        eventBus.discardSession(session);
      }
      throw error;
    } finally {
      if (ownsSession) session.endSession();
    }
  }

  async verifyOrderPayment(orderId, verifier, options = {}) {
    const session = options.session || await mongoose.startSession();
    const ownsSession = !options.session;

    try {
      if (ownsSession) session.startTransaction();

      const order = await this.Order.findById(orderId).session(session);
      if (!order) {
        throw new OrderNotFoundError();
      }

      const payment = await this.resolveOrderPayment(order, session);
      const verifiedPayment = await this.paymentService.verifyPayment(payment._id, {
        userId: verifier.userId || verifier._id
      }, {
        session,
        actorType: options.actorType || 'ADMIN',
        reason: options.reason || 'Manual payment verified for order'
      });
      await this.inventoryService.deductByPayment(verifiedPayment._id, {
        session,
        actor: { userId: verifier.userId || verifier._id },
        actorType: options.actorType || 'ADMIN',
        reason: 'Inventory deducted after payment verification'
      });

      await this.synchronizeOrderPaymentFields(order, verifiedPayment, {
        session,
        addTrackingUpdate: options.addTrackingUpdate
      });

      if (ownsSession) {
        await session.commitTransaction();
        await eventBus.flushSession(session);
      }

      return order;
    } catch (error) {
      if (ownsSession) {
        await session.abortTransaction();
        eventBus.discardSession(session);
      }
      throw error;
    } finally {
      if (ownsSession) session.endSession();
    }
  }

  async releaseOrderInventory(orderId, actor = {}, options = {}) {
    const session = options.session || await mongoose.startSession();
    const ownsSession = !options.session;

    try {
      if (ownsSession) session.startTransaction();

      const order = await this.Order.findById(orderId).session(session);
      if (!order) {
        throw new OrderNotFoundError();
      }

      if (options.cancelPayment !== false) {
        try {
          const payment = await this.resolveOrderPayment(order, session);
          if (['INTENT_CREATED', 'QR_PENDING', 'QR_GENERATED', 'PAYMENT_PENDING', 'PENDING'].includes(payment.status)) {
            await this.paymentService.cancelPayment(payment._id, actor, {
              session,
              actorType: options.actorType || 'SYSTEM',
              reason: options.reason || 'Payment cancelled with order'
            });
          }
        } catch (error) {
          if (error instanceof OrderValidationError) {
            // Legacy orders may not have a Payment record yet.
          } else {
            throw error;
          }
        }
      }

      await this.inventoryService.releaseByOrder(order._id, {
        session,
        actor,
        actorType: options.actorType || 'SYSTEM',
        reason: options.reason || 'Inventory reservation released for order'
      });
      await this.publishOrderEvent(DOMAIN_EVENTS.ORDER_CANCELLED, order, {
        session,
        user: actor
      });

      if (ownsSession) {
        await session.commitTransaction();
        await eventBus.flushSession(session);
      }

      return order;
    } catch (error) {
      if (ownsSession) {
        await session.abortTransaction();
        eventBus.discardSession(session);
      }
      throw error;
    } finally {
      if (ownsSession) session.endSession();
    }
  }

  async rejectOrderPayment(orderId, rejector, options = {}) {
    const session = options.session || await mongoose.startSession();
    const ownsSession = !options.session;

    try {
      if (ownsSession) session.startTransaction();

      const order = await this.Order.findById(orderId).session(session);
      if (!order) {
        throw new OrderNotFoundError();
      }

      const payment = await this.resolveOrderPayment(order, session);
      const rejectedPayment = await this.paymentService.rejectPayment(payment._id, {
        userId: rejector.userId || rejector._id
      }, {
        session,
        actorType: options.actorType || 'ADMIN',
        reason: options.reason || 'Manual payment rejected for order'
      });
      await this.inventoryService.releaseByPayment(rejectedPayment._id, {
        session,
        actor: { userId: rejector.userId || rejector._id },
        actorType: options.actorType || 'ADMIN',
        reason: 'Inventory reservation released after payment rejection'
      });
      await this.synchronizeOrderPaymentFields(order, rejectedPayment, { session });

      if (ownsSession) {
        await session.commitTransaction();
        await eventBus.flushSession(session);
      }

      return order;
    } catch (error) {
      if (ownsSession) {
        await session.abortTransaction();
        eventBus.discardSession(session);
      }
      throw error;
    } finally {
      if (ownsSession) session.endSession();
    }
  }

  async synchronizeOrderPaymentFields(order, payment, options = {}) {
    order.payment = payment._id;
    order.paymentMethod = payment.paymentMethod || order.paymentMethod || DEFAULT_PAYMENT_METHOD;
    order.utr = payment.utr || order.utr;

    if (payment.status === 'PAYMENT_VERIFIED' || payment.status === 'VERIFIED') {
      order.isPaid = true;
      order.paidAt = payment.verifiedAt || order.paidAt || new Date();
    } else {
      order.isPaid = false;
    }

    if (options.addTrackingUpdate) {
      order.trackingUpdates.push(options.addTrackingUpdate);
    }

    await order.save({ session: options.session });
    return order;
  }

  async resolveOrderPayment(order, session) {
    if (order.payment) {
      return this.paymentService.getPayment(order.payment, { session, lean: true });
    }

    const activePayment = await this.paymentService.findActivePayment(order._id, { session });
    if (activePayment) {
      return activePayment;
    }

    throw new OrderValidationError('Payment intent not found for order', { orderId: normalizeId(order._id) });
  }

  async buildOrderItems(items, session) {
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const bookId = item.bookId || item.book;
      const book = await this.Book.findById(bookId).session(session);

      if (!book) {
        throw new OrderNotFoundError(`Book not found: ${bookId}`, { bookId });
      }

      const availableStock = book.stock - (book.reservedStock || 0);

      if (availableStock < item.quantity) {
        throw new OrderValidationError(`Insufficient stock for book: ${book.title}`, { bookId });
      }

      const itemTotal = book.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        book: book._id,
        quantity: item.quantity,
        price: book.price
      });

    }

    const tax = Number((0.05 * subtotal).toFixed(2));
    const shippingPrice = subtotal > 500 ? 0 : 50;

    return {
      orderItems,
      subtotal,
      tax,
      shippingPrice,
      totalPrice: subtotal + tax + shippingPrice
    };
  }

  toLegacyPaymentResponse(qr, amount) {
    return {
      upiUrl: qr.upiUri,
      qrCodeDataUrl: qr.qrCodeDataUrl || qr.qrImage,
      amount
    };
  }

  generateOrderNumber() {
    return `HM-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
  }

  async publishOrderEvent(eventName, order, options = {}) {
    return eventBus.publish(eventName, {
      orderId: normalizeId(order._id),
      orderNumber: order.orderNumber,
      userId: normalizeId(order.user),
      paymentId: order.payment ? normalizeId(order.payment) : options.payment && normalizeId(options.payment._id),
      totalPrice: order.totalPrice,
      status: order.status
    }, {
      session: options.session,
      correlationId: options.correlationId,
      idempotencyKey: `${eventName}:${normalizeId(order._id)}`
    });
  }
}

module.exports = new OrderPaymentBridgeService();
module.exports.OrderPaymentBridgeService = OrderPaymentBridgeService;
module.exports.OrderPaymentBridgeError = OrderPaymentBridgeError;
module.exports.OrderValidationError = OrderValidationError;
module.exports.OrderNotFoundError = OrderNotFoundError;
module.exports.OrderAuthorizationError = OrderAuthorizationError;
