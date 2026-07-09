const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const PaymentLedger = require('../models/PaymentLedger');
const InventoryReservation = require('../models/InventoryReservation');
const InventoryLedger = require('../models/InventoryLedger');
const Order = require('../models/Order');
const User = require('../models/User');
const Book = require('../models/Book');
const paymentService = require('./paymentService');
const inventoryService = require('./inventoryService');
const orderPaymentBridgeService = require('./orderPaymentBridgeService');
const eventBus = require('../events/eventBus');
const { DOMAIN_EVENTS } = require('../events/eventCatalog');

const PAYMENT_STATUS_GROUPS = {
  pending: ['PAYMENT_SUBMITTED', 'SUBMITTED', 'VERIFICATION_PENDING'],
  verified: ['PAYMENT_VERIFIED', 'VERIFIED'],
  rejected: ['PAYMENT_REJECTED'],
  failed: ['PAYMENT_FAILED', 'FAILED'],
  expired: ['PAYMENT_EXPIRED', 'EXPIRED']
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

class AdminOperationsError extends Error {
  constructor(message, statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
  }
}

class AdminNotFoundError extends AdminOperationsError {
  constructor(message = 'Resource not found', details = {}) {
    super(message, 404, details);
  }
}

const normalizePagination = ({ page = 1, limit = DEFAULT_LIMIT } = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const limitNumber = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  return {
    page: pageNumber,
    limit: limitNumber,
    skip: (pageNumber - 1) * limitNumber
  };
};

const buildDateFilter = (from, to) => {
  if (!from && !to) return undefined;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return range;
};

class AdminOperationsService {
  async listPayments(filters = {}) {
    const { page, limit, skip } = normalizePagination(filters);
    const query = await this.buildPaymentFilter(filters);
    const sort = this.buildSort(filters.sort, { createdAt: -1 });

    const [items, total] = await Promise.all([
      Payment.find(query)
        .populate('order', 'orderNumber totalPrice status isPaid paidAt utr paymentMethod')
        .populate('user', 'name email role')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(query)
    ]);

    return this.paginated(items, total, page, limit);
  }

  async getPaymentDetail(paymentId) {
    const payment = await Payment.findById(paymentId)
      .select('+qrPayload +qrCodeDataUrl +gatewayResponse')
      .populate({
        path: 'order',
        populate: [
          { path: 'user', select: 'name email role' },
          { path: 'items.book', select: 'title slug price stock reservedStock category coverImage' }
        ]
      })
      .populate('user', 'name email role')
      .lean();

    if (!payment) {
      throw new AdminNotFoundError('Payment not found', { paymentId });
    }

    const [paymentLedger, inventoryReservations, inventoryLedger] = await Promise.all([
      PaymentLedger.find({ paymentId: payment._id }).sort({ createdAt: 1 }).lean(),
      InventoryReservation.find({ payment: payment._id }).populate('book', 'title slug price stock reservedStock category').sort({ createdAt: 1 }).lean(),
      InventoryLedger.find({ payment: payment._id }).sort({ createdAt: 1 }).lean()
    ]);

    return {
      payment,
      paymentIntent: {
        activeIntent: payment.activeIntent,
        expiresAt: payment.expiresAt,
        qrGeneratedAt: payment.qrGeneratedAt,
        qrExpiresAt: payment.qrExpiresAt
      },
      qr: {
        upiUri: payment.qrPayload,
        qrCodeDataUrl: payment.qrCodeDataUrl,
        qrGeneratedAt: payment.qrGeneratedAt,
        qrExpiresAt: payment.qrExpiresAt,
        metadata: payment.qrMetadata || {}
      },
      verificationHistory: payment.statusHistory || [],
      paymentLedger,
      order: payment.order,
      customer: payment.user,
      books: payment.order ? payment.order.items : [],
      inventoryReservations,
      inventoryLedger,
      auditHistory: this.combineTimeline(paymentLedger, inventoryLedger)
    };
  }

  async approvePayment(paymentId, admin, options = {}) {
    const payment = await paymentService.getPayment(paymentId);
    await orderPaymentBridgeService.verifyOrderPayment(payment.order, {
      userId: admin._id
    }, {
      reason: options.reason || 'Admin payment approved',
      actorType: 'ADMIN'
    });
    await this.publishAdminPaymentEvent(DOMAIN_EVENTS.ADMIN_APPROVED_PAYMENT, paymentId, admin, options);

    return this.getPaymentDetail(paymentId);
  }

  async rejectPayment(paymentId, admin, options = {}) {
    const payment = await paymentService.getPayment(paymentId);
    await orderPaymentBridgeService.rejectOrderPayment(payment.order, {
      userId: admin._id
    }, {
      reason: options.reason || 'Admin payment rejected',
      actorType: 'ADMIN'
    });
    await this.publishAdminPaymentEvent(DOMAIN_EVENTS.ADMIN_REJECTED_PAYMENT, paymentId, admin, options);

    return this.getPaymentDetail(paymentId);
  }

  async cancelPaymentIntent(paymentId, admin, options = {}) {
    await this.withTransaction(async (session) => {
      const payment = await paymentService.cancelPayment(paymentId, { userId: admin._id }, {
        session,
        reason: options.reason || 'Admin cancelled payment intent',
        actorType: 'ADMIN'
      });
      await inventoryService.releaseByPayment(payment._id, {
        session,
        actor: { userId: admin._id },
        actorType: 'ADMIN',
        reason: 'Inventory released after admin payment cancellation'
      });
      await this.publishAdminPaymentEvent(DOMAIN_EVENTS.ADMIN_CANCELLED_PAYMENT, paymentId, admin, {
        ...options,
        session
      });
    });

    return this.getPaymentDetail(paymentId);
  }

  async expirePayment(paymentId, admin, options = {}) {
    await this.withTransaction(async (session) => {
      const payment = await paymentService.expirePaymentIntent(paymentId, {
        session,
        reason: options.reason || 'Admin expired payment intent',
        actor: { userId: admin._id },
        actorType: 'ADMIN'
      });
      await inventoryService.releaseByPayment(payment._id, {
        session,
        actor: { userId: admin._id },
        actorType: 'ADMIN',
        reason: 'Inventory released after admin payment expiry'
      });
      await this.publishAdminPaymentEvent(DOMAIN_EVENTS.ADMIN_EXPIRED_PAYMENT, paymentId, admin, {
        ...options,
        session
      });
    });

    return this.getPaymentDetail(paymentId);
  }

  async retryVerification(paymentId) {
    return this.getPaymentDetail(paymentId);
  }

  async recreateQR(paymentId, admin, options = {}) {
    const payment = await paymentService.getPayment(paymentId);
    const qr = await paymentService.regenerateQRCode(paymentId, {
      orderId: payment.order,
      userId: payment.user,
      amount: payment.amount,
      actor: { userId: admin._id },
      actorType: 'ADMIN',
      reason: options.reason || 'Admin recreated payment QR'
    });
    await this.publishAdminPaymentEvent(DOMAIN_EVENTS.ADMIN_RECREATED_QR, paymentId, admin, options);

    return {
      qr,
      detail: await this.getPaymentDetail(paymentId)
    };
  }

  async listReservations(filters = {}) {
    const { page, limit, skip } = normalizePagination(filters);
    const query = await this.buildReservationFilter(filters);
    const sort = this.buildSort(filters.sort, { createdAt: -1 });
    const [items, total] = await Promise.all([
      InventoryReservation.find(query)
        .populate('order', 'orderNumber status totalPrice')
        .populate('payment', 'status amount paymentMethod provider')
        .populate('book', 'title slug stock reservedStock category')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      InventoryReservation.countDocuments(query)
    ]);

    return this.paginated(items, total, page, limit);
  }

  async listLowStock(filters = {}) {
    return inventoryService.findLowStock(filters.threshold || 5, filters, {});
  }

  async listPaymentLedger(filters = {}) {
    return this.listLedger(PaymentLedger, this.buildPaymentLedgerFilter(filters), filters);
  }

  async listInventoryLedger(filters = {}) {
    return this.listLedger(InventoryLedger, this.buildInventoryLedgerFilter(filters), filters);
  }

  async combinedTimeline(filters = {}) {
    const [paymentLedger, inventoryLedger] = await Promise.all([
      PaymentLedger.find(this.buildPaymentLedgerFilter(filters)).sort({ createdAt: -1 }).limit(Number(filters.limit) || 50).lean(),
      InventoryLedger.find(this.buildInventoryLedgerFilter(filters)).sort({ createdAt: -1 }).limit(Number(filters.limit) || 50).lean()
    ]);

    return this.combineTimeline(paymentLedger, inventoryLedger)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, Number(filters.limit) || 50);
  }

  async dashboardSummary() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todaysOrders,
      pendingPayments,
      pendingReservations,
      lowStock,
      successfulPayments,
      failedPayments,
      revenueTodayAgg,
      revenueMonthAgg,
      recentPayments,
      recentInventory
    ] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: startOfToday } }),
      Payment.countDocuments({ status: { $in: PAYMENT_STATUS_GROUPS.pending } }),
      InventoryReservation.countDocuments({ status: 'RESERVED' }),
      inventoryService.findLowStock(5, { limit: 5 }),
      Payment.countDocuments({ successfulPayment: true }),
      Payment.countDocuments({ status: { $in: ['PAYMENT_FAILED', 'PAYMENT_REJECTED', 'PAYMENT_EXPIRED', 'FAILED', 'EXPIRED'] } }),
      Payment.aggregate([{ $match: { successfulPayment: true, verifiedAt: { $gte: startOfToday } } }, { $group: { _id: null, revenue: { $sum: '$amount' } } }]),
      Payment.aggregate([{ $match: { successfulPayment: true, verifiedAt: { $gte: startOfMonth } } }, { $group: { _id: null, revenue: { $sum: '$amount' } } }]),
      PaymentLedger.find().sort({ createdAt: -1 }).limit(5).lean(),
      InventoryLedger.find().sort({ createdAt: -1 }).limit(5).lean()
    ]);

    return {
      todaysOrders,
      todaysRevenue: revenueTodayAgg[0] ? revenueTodayAgg[0].revenue : 0,
      pendingPayments,
      pendingReservations,
      lowStockBooks: lowStock.items,
      successfulPayments,
      failedPayments,
      revenueToday: revenueTodayAgg[0] ? revenueTodayAgg[0].revenue : 0,
      revenueThisMonth: revenueMonthAgg[0] ? revenueMonthAgg[0].revenue : 0,
      recentActivity: this.combineTimeline(recentPayments, recentInventory)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10)
    };
  }

  async globalSearch(term, filters = {}) {
    const search = String(term || '').trim();
    if (!search) {
      return {
        orders: [],
        payments: [],
        customers: [],
        books: [],
        reservations: [],
        ledger: []
      };
    }

    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const limit = Math.min(Number(filters.limit) || 10, 25);

    const [orders, customers, books] = await Promise.all([
      Order.find({ orderNumber: regex }).limit(limit).lean(),
      User.find({ $or: [{ name: regex }, { email: regex }] }).select('name email role').limit(limit).lean(),
      Book.find({ $or: [{ title: regex }, { slug: regex }, { isbn: regex }] }).limit(limit).lean()
    ]);
    const orderIds = orders.map((order) => order._id);
    const customerIds = customers.map((customer) => customer._id);
    const bookIds = books.map((book) => book._id);

    const [payments, reservations, paymentLedger, inventoryLedger] = await Promise.all([
      Payment.find({
        $or: [
          { utr: regex },
          { providerPaymentId: regex },
          { providerOrderId: regex },
          { order: { $in: orderIds } },
          { user: { $in: customerIds } }
        ]
      }).limit(limit).lean(),
      InventoryReservation.find({
        $or: [
          { order: { $in: orderIds } },
          { book: { $in: bookIds } }
        ]
      }).limit(limit).lean(),
      PaymentLedger.find({ $or: [{ reference: regex }, { orderId: { $in: orderIds } }] }).limit(limit).lean(),
      InventoryLedger.find({ $or: [{ order: { $in: orderIds } }, { book: { $in: bookIds } }] }).limit(limit).lean()
    ]);

    return {
      orders,
      payments,
      customers,
      books,
      reservations,
      ledger: this.combineTimeline(paymentLedger, inventoryLedger)
    };
  }

  async buildPaymentFilter(filters = {}) {
    const query = {};
    const statuses = filters.group ? PAYMENT_STATUS_GROUPS[filters.group] : undefined;
    if (statuses) query.status = { $in: statuses };
    if (filters.status) query.status = filters.status;
    if (filters.paymentMethod) query.paymentMethod = String(filters.paymentMethod).trim().toUpperCase();
    if (filters.amountMin || filters.amountMax) {
      query.amount = {};
      if (filters.amountMin) query.amount.$gte = Number(filters.amountMin);
      if (filters.amountMax) query.amount.$lte = Number(filters.amountMax);
    }
    const dateRange = buildDateFilter(filters.dateFrom, filters.dateTo);
    if (dateRange) query.createdAt = dateRange;

    if (filters.customer) {
      const users = await User.find({
        $or: [
          { name: new RegExp(filters.customer, 'i') },
          { email: new RegExp(filters.customer, 'i') }
        ]
      }).select('_id').lean();
      query.user = { $in: users.map((user) => user._id) };
    }

    if (filters.orderNumber || filters.book) {
      const orderQuery = {};
      if (filters.orderNumber) orderQuery.orderNumber = new RegExp(filters.orderNumber, 'i');
      if (filters.book) orderQuery['items.book'] = filters.book;
      const orders = await Order.find(orderQuery).select('_id').lean();
      query.order = { $in: orders.map((order) => order._id) };
    }

    return query;
  }

  async buildReservationFilter(filters = {}) {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.book) query.book = filters.book;
    const dateRange = buildDateFilter(filters.dateFrom, filters.dateTo);
    if (dateRange) query.createdAt = dateRange;

    if (filters.category) {
      const books = await Book.find({ category: filters.category }).select('_id').lean();
      query.book = { $in: books.map((book) => book._id) };
    }

    return query;
  }

  buildPaymentLedgerFilter(filters = {}) {
    const query = {};
    if (filters.paymentId) query.paymentId = filters.paymentId;
    if (filters.orderId) query.orderId = filters.orderId;
    if (filters.userId) query.userId = filters.userId;
    if (filters.eventType) query.eventType = filters.eventType;
    const dateRange = buildDateFilter(filters.dateFrom, filters.dateTo);
    if (dateRange) query.createdAt = dateRange;
    return query;
  }

  buildInventoryLedgerFilter(filters = {}) {
    const query = {};
    if (filters.reservation) query.reservation = filters.reservation;
    if (filters.order) query.order = filters.order;
    if (filters.payment) query.payment = filters.payment;
    if (filters.book) query.book = filters.book;
    if (filters.eventType) query.eventType = filters.eventType;
    const dateRange = buildDateFilter(filters.dateFrom, filters.dateTo);
    if (dateRange) query.createdAt = dateRange;
    return query;
  }

  async listLedger(model, query, filters = {}) {
    const { page, limit, skip } = normalizePagination(filters);
    const sort = this.buildSort(filters.sort, { createdAt: -1 });
    const [items, total] = await Promise.all([
      model.find(query).sort(sort).skip(skip).limit(limit).lean(),
      model.countDocuments(query)
    ]);
    return this.paginated(items, total, page, limit);
  }

  buildSort(sort, fallback) {
    if (!sort) return fallback;
    const direction = sort.startsWith('-') ? -1 : 1;
    const field = sort.replace(/^-/, '');
    return { [field]: direction };
  }

  combineTimeline(paymentLedger = [], inventoryLedger = []) {
    return [
      ...paymentLedger.map((entry) => ({ type: 'payment', ...entry })),
      ...inventoryLedger.map((entry) => ({ type: 'inventory', ...entry }))
    ];
  }

  paginated(items, total, page, limit) {
    return {
      items,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async withTransaction(handler) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      const result = await handler(session);
      await session.commitTransaction();
      await eventBus.flushSession(session);
      return result;
    } catch (error) {
      await session.abortTransaction();
      eventBus.discardSession(session);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async publishAdminPaymentEvent(eventName, paymentId, admin, options = {}) {
    return eventBus.publish(eventName, {
      paymentId: String(paymentId),
      adminId: admin && admin._id ? String(admin._id) : undefined,
      reason: options.reason
    }, {
      session: options.session,
      correlationId: options.correlationId,
      idempotencyKey: `${eventName}:${paymentId}:${admin && admin._id ? admin._id : 'system'}`
    });
  }
}

module.exports = new AdminOperationsService();
module.exports.AdminOperationsService = AdminOperationsService;
module.exports.AdminOperationsError = AdminOperationsError;
module.exports.AdminNotFoundError = AdminNotFoundError;
