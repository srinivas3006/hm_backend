const mongoose = require('mongoose');
const Payment = require('../models/Payment');

class PaymentRepositoryError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class InvalidPaymentIdError extends PaymentRepositoryError {
  constructor(value, field = 'id') {
    super(`Invalid payment ${field}`, 'INVALID_PAYMENT_ID', { field, value });
  }
}

class PaymentNotFoundError extends PaymentRepositoryError {
  constructor(criteria = {}) {
    super('Payment not found', 'PAYMENT_NOT_FOUND', { criteria });
  }
}

class DuplicatePaymentReferenceError extends PaymentRepositoryError {
  constructor(message, details = {}) {
    super(message, 'DUPLICATE_PAYMENT_REFERENCE', details);
  }
}

class DuplicateSuccessfulPaymentError extends PaymentRepositoryError {
  constructor(order) {
    super('Order already has a successful payment', 'DUPLICATE_SUCCESSFUL_PAYMENT', { order });
  }
}

class DuplicateActivePaymentIntentError extends PaymentRepositoryError {
  constructor(order) {
    super('Order already has an active payment intent', 'DUPLICATE_ACTIVE_PAYMENT_INTENT', { order });
  }
}

class PaymentDatabaseError extends PaymentRepositoryError {
  constructor(message, details = {}) {
    super(message, 'PAYMENT_DATABASE_ERROR', details);
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const ACTIVE_INTENT_STATUSES = ['INTENT_CREATED', 'QR_PENDING', 'QR_GENERATED', 'PAYMENT_PENDING', 'PENDING'];
const PENDING_VERIFICATION_STATUSES = ['PAYMENT_SUBMITTED', 'SUBMITTED', 'VERIFICATION_PENDING'];
const FAILED_PAYMENT_STATUSES = [
  'PAYMENT_FAILED',
  'PAYMENT_REJECTED',
  'FAILED',
  'PAYMENT_EXPIRED',
  'EXPIRED',
  'PAYMENT_CANCELLED',
  'CANCELLED'
];

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeObjectId = (value, field) => {
  if (!isObjectId(value)) {
    throw new InvalidPaymentIdError(value, field);
  }

  return value;
};

const normalizePagination = ({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || DEFAULT_PAGE, 1);
  const limitNumber = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  return {
    page: pageNumber,
    limit: limitNumber,
    skip: (pageNumber - 1) * limitNumber
  };
};

const applyReadOptions = (query, options = {}) => {
  if (options.session) query.session(options.session);
  if (options.projection) query.select(options.projection);
  if (options.includeSensitive) query.select('+providerSignature +qrPayload +qrCodeDataUrl +gatewayResponse');
  if (options.populate) query.populate(options.populate);
  if (options.lean !== false) query.lean();

  return query;
};

const toRepositoryError = (error) => {
  if (error instanceof PaymentRepositoryError) {
    return error;
  }

  if (error && error.name === 'CastError') {
    return new InvalidPaymentIdError(error.value, error.path || 'id');
  }

  if (error && error.code === 11000) {
    const keys = Object.keys(error.keyPattern || {});
    const values = error.keyValue || {};

    if (keys.includes('utr')) {
      return new DuplicatePaymentReferenceError('Duplicate UTR value', { field: 'utr', value: values.utr });
    }

    if (keys.includes('order') && keys.includes('successfulPayment')) {
      return new DuplicateSuccessfulPaymentError(values.order);
    }

    if (keys.includes('order') && keys.includes('activeIntent')) {
      return new DuplicateActivePaymentIntentError(values.order);
    }

    if (keys.includes('providerPaymentId')) {
      return new DuplicatePaymentReferenceError('Duplicate provider payment id', {
        field: 'providerPaymentId',
        provider: values.provider,
        value: values.providerPaymentId
      });
    }

    if (keys.includes('providerOrderId')) {
      return new DuplicatePaymentReferenceError('Duplicate provider order id', {
        field: 'providerOrderId',
        provider: values.provider,
        value: values.providerOrderId
      });
    }

    return new DuplicatePaymentReferenceError('Duplicate payment reference', { keys, values });
  }

  return new PaymentDatabaseError('Payment database operation failed', {
    message: error && error.message
  });
};

const execute = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    throw toRepositoryError(error);
  }
};

class PaymentRepository {
  constructor(paymentModel = Payment) {
    this.Payment = paymentModel;
  }

  create(paymentData, options = {}) {
    return execute(async () => {
      const documents = await this.Payment.create([paymentData], { session: options.session });
      return documents[0];
    });
  }

  createIntent(intentData, options = {}) {
    return this.create({
      ...intentData,
      activeIntent: true,
      status: intentData.status || 'INTENT_CREATED'
    }, options);
  }

  updateById(id, update, options = {}) {
    return execute(async () => {
      normalizeObjectId(id);
      const query = this.Payment.findByIdAndUpdate(id, update, {
        returnDocument: 'after',
        runValidators: true,
        session: options.session
      });

      if (options.projection) query.select(options.projection);
      if (options.includeSensitive) query.select('+providerSignature +qrPayload +qrCodeDataUrl +gatewayResponse');

      const payment = await query;

      if (!payment) {
        throw new PaymentNotFoundError({ id });
      }

      return payment;
    });
  }

  saveQRCodeMetadata(id, qrMetadata, options = {}) {
    return this.updateById(id, {
      $set: {
        qrPayload: qrMetadata.qrPayload,
        qrCodeDataUrl: qrMetadata.qrCodeDataUrl,
        qrGeneratedAt: qrMetadata.qrGeneratedAt,
        qrExpiresAt: qrMetadata.qrExpiresAt,
        qrMetadata: qrMetadata.metadata || {},
        status: qrMetadata.status,
        activeIntent: qrMetadata.activeIntent
      },
      $push: {
        statusHistory: {
          status: qrMetadata.status,
          changedBy: qrMetadata.changedBy,
          reason: qrMetadata.reason || 'QR generated',
          metadata: qrMetadata.historyMetadata || {}
        }
      }
    }, {
      ...options,
      includeSensitive: true
    });
  }

  submitUTR(id, utrData = {}, options = {}) {
    const now = utrData.submittedAt || options.now || new Date();

    return execute(async () => {
      normalizeObjectId(id);
      const payment = await this.Payment.findOneAndUpdate(
        {
          _id: id,
          activeIntent: true,
          status: { $in: ['INTENT_CREATED', 'QR_PENDING', 'QR_GENERATED', 'PAYMENT_PENDING', 'PENDING'] },
          $or: [
            { utr: { $exists: false } },
            { utr: null },
            { utr: '' }
          ]
        },
        {
          $set: {
            utr: String(utrData.utr).trim().toUpperCase(),
            status: 'VERIFICATION_PENDING',
            activeIntent: true,
            submittedAt: now
          },
          $push: {
            statusHistory: {
              $each: [
                {
                  status: 'PAYMENT_SUBMITTED',
                  changedBy: utrData.submittedBy,
                  reason: utrData.submissionReason || 'Manual UTR submitted',
                  changedAt: now
                },
                {
                  status: 'VERIFICATION_PENDING',
                  changedBy: utrData.submittedBy,
                  reason: utrData.verificationReason || 'Manual UTR awaiting verification',
                  changedAt: now
                }
              ]
            }
          }
        },
        {
          returnDocument: 'after',
          runValidators: true,
          session: options.session
        }
      );

      if (!payment) {
        throw new PaymentNotFoundError({ id, operation: 'submitUTR' });
      }

      return payment;
    });
  }

  verifyPayment(id, verificationData = {}, options = {}) {
    const now = verificationData.verifiedAt || options.now || new Date();
    const statusHistory = [];

    if (verificationData.includeVerificationPending) {
      statusHistory.push({
        status: 'VERIFICATION_PENDING',
        changedBy: verificationData.verifiedBy,
        reason: verificationData.verificationReason || 'Payment moved to verification',
        changedAt: now
      });
    }

    statusHistory.push({
      status: 'PAYMENT_VERIFIED',
      changedBy: verificationData.verifiedBy,
      reason: verificationData.reason || 'Payment verified',
      changedAt: now
    });

    return execute(async () => {
      normalizeObjectId(id);
      const payment = await this.Payment.findOneAndUpdate(
        {
          _id: id,
          activeIntent: true,
          status: { $in: ['PAYMENT_SUBMITTED', 'SUBMITTED', 'VERIFICATION_PENDING'] }
        },
        {
          $set: {
            status: 'PAYMENT_VERIFIED',
            successfulPayment: true,
            activeIntent: false,
            verifiedAt: now,
            verifiedBy: verificationData.verifiedBy
          },
          $push: {
            statusHistory: {
              $each: statusHistory
            }
          }
        },
        {
          returnDocument: 'after',
          runValidators: true,
          session: options.session
        }
      );

      if (!payment) {
        throw new PaymentNotFoundError({ id, operation: 'verifyPayment' });
      }

      return payment;
    });
  }

  rejectPayment(id, rejectionData = {}, options = {}) {
    const now = rejectionData.rejectedAt || options.now || new Date();

    return execute(async () => {
      normalizeObjectId(id);
      const payment = await this.Payment.findOneAndUpdate(
        {
          _id: id,
          activeIntent: true,
          status: { $in: ['PAYMENT_SUBMITTED', 'SUBMITTED', 'VERIFICATION_PENDING'] }
        },
        {
          $set: {
            status: 'PAYMENT_REJECTED',
            successfulPayment: false,
            activeIntent: false,
            rejectedAt: now,
            rejectedBy: rejectionData.rejectedBy,
            failureReason: rejectionData.reason || 'Payment verification rejected'
          },
          $push: {
            statusHistory: {
              status: 'PAYMENT_REJECTED',
              changedBy: rejectionData.rejectedBy,
              reason: rejectionData.reason || 'Payment verification rejected',
              changedAt: now
            }
          }
        },
        {
          returnDocument: 'after',
          runValidators: true,
          session: options.session
        }
      );

      if (!payment) {
        throw new PaymentNotFoundError({ id, operation: 'rejectPayment' });
      }

      return payment;
    });
  }

  lockPaymentForVerification(paymentId, options = {}) {
    return execute(async () => {
      normalizeObjectId(paymentId);
      const payment = await this.Payment.findOneAndUpdate(
        {
          _id: paymentId,
          activeIntent: true,
          status: { $in: options.statuses || PENDING_VERIFICATION_STATUSES }
        },
        {
          $set: {
            'metadata.verificationLockedAt': options.now || new Date(),
            'metadata.verificationLockedBy': options.lockedBy
          }
        },
        {
          returnDocument: 'after',
          runValidators: true,
          session: options.session
        }
      );

      if (!payment) {
        throw new PaymentNotFoundError({ id: paymentId, operation: 'lockPaymentForVerification' });
      }

      return payment;
    });
  }

  findByVerificationStatus(statuses = PENDING_VERIFICATION_STATUSES, pagination = {}, options = {}) {
    return this.search({
      statuses: Array.isArray(statuses) ? statuses : [statuses],
      activeIntent: options.activeIntent,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { submittedAt: 1, createdAt: 1 }
    }, options);
  }

  findPendingVerification(paymentId, options = {}) {
    return execute(async () => {
      normalizeObjectId(paymentId);
      return applyReadOptions(
        this.Payment.findOne({
          _id: paymentId,
          activeIntent: true,
          status: { $in: options.statuses || PENDING_VERIFICATION_STATUSES }
        }),
        options
      );
    });
  }

  findLatestQRCode(paymentId, options = {}) {
    return execute(async () => {
      normalizeObjectId(paymentId);
      return applyReadOptions(
        this.Payment.findOne({
          _id: paymentId,
          qrGeneratedAt: { $exists: true, $ne: null }
        }).sort({ qrGeneratedAt: -1 }),
        {
          ...options,
          includeSensitive: true
        }
      );
    });
  }

  findById(id, options = {}) {
    return execute(async () => {
      normalizeObjectId(id);
      return applyReadOptions(this.Payment.findById(id), options);
    });
  }

  getById(id, options = {}) {
    return execute(async () => {
      normalizeObjectId(id);
      const payment = await applyReadOptions(this.Payment.findById(id), options);

      if (!payment) {
        throw new PaymentNotFoundError({ id });
      }

      return payment;
    });
  }

  findByOrder(orderId, options = {}) {
    return execute(async () => applyReadOptions(
      this.Payment.find({ order: normalizeObjectId(orderId, 'order') }).sort({ createdAt: -1 }),
      options
    ));
  }

  findActivePaymentIntent(orderId, options = {}) {
    return execute(async () => {
      const normalizedOrderId = normalizeObjectId(orderId, 'order');
      const now = options.now || new Date();
      const query = {
        order: normalizedOrderId,
        activeIntent: true,
        status: { $in: options.statuses || ACTIVE_INTENT_STATUSES },
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: now } }
        ]
      };

      return applyReadOptions(this.Payment.findOne(query).sort({ createdAt: -1 }), options);
    });
  }

  findActiveIntent(orderId, options = {}) {
    return this.findActivePaymentIntent(orderId, options);
  }

  findIntentByOrder(orderId, pagination = {}, options = {}) {
    return this.listPaymentAttempts(orderId, pagination, options);
  }

  expireActiveIntent(orderId, options = {}) {
    return execute(async () => {
      const now = options.now || new Date();
      return this.Payment.updateMany(
        {
          order: normalizeObjectId(orderId, 'order'),
          activeIntent: true,
          status: { $in: options.statuses || ACTIVE_INTENT_STATUSES }
        },
        {
          $set: {
            status: 'PAYMENT_EXPIRED',
            activeIntent: false,
            successfulPayment: false
          },
          $push: {
            statusHistory: {
              status: 'PAYMENT_EXPIRED',
              reason: options.reason || 'Superseded by a new payment intent',
              changedAt: now
            }
          }
        },
        {
          session: options.session
        }
      );
    });
  }

  findExpiredIntents(cutoffDate = new Date(), pagination = {}, options = {}) {
    return this.search({
      statuses: options.statuses || ACTIVE_INTENT_STATUSES,
      activeIntent: true,
      expiresBefore: cutoffDate,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { expiresAt: 1, createdAt: 1 }
    }, options);
  }

  findByUTR(utr, options = {}) {
    return execute(async () => applyReadOptions(
      this.Payment.findOne({ utr: String(utr).trim().toUpperCase() }),
      options
    ));
  }

  findByProviderPaymentId(provider, providerPaymentId, options = {}) {
    return execute(async () => applyReadOptions(
      this.Payment.findOne({
        provider: String(provider).trim().toLowerCase(),
        providerPaymentId
      }),
      options
    ));
  }

  findByProviderOrderId(provider, providerOrderId, options = {}) {
    return execute(async () => applyReadOptions(
      this.Payment.findOne({
        provider: String(provider).trim().toLowerCase(),
        providerOrderId
      }),
      options
    ));
  }

  findSuccessfulPayment(orderId, options = {}) {
    return execute(async () => applyReadOptions(
      this.Payment.findOne({ order: normalizeObjectId(orderId, 'order'), successfulPayment: true }).sort({ verifiedAt: -1, createdAt: -1 }),
      options
    ));
  }

  listPaymentAttempts(orderId, pagination = {}, options = {}) {
    const { page, limit, skip } = normalizePagination(pagination);

    return execute(async () => {
      const filter = { order: normalizeObjectId(orderId, 'order') };
      const itemsQuery = applyReadOptions(
        this.Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        options
      );
      const totalQuery = this.Payment.countDocuments(filter).session(options.session || null);
      const items = options.session ? await itemsQuery : null;
      const total = options.session ? await totalQuery : null;
      const [parallelItems, parallelTotal] = options.session ? [items, total] : await Promise.all([itemsQuery, totalQuery]);

      return {
        items: parallelItems,
        pagination: {
          total: parallelTotal,
          page,
          limit,
          pages: Math.ceil(parallelTotal / limit)
        }
      };
    });
  }

  listPendingVerifications(pagination = {}, options = {}) {
    return this.search({
      statuses: options.statuses || PENDING_VERIFICATION_STATUSES,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { submittedAt: 1, createdAt: 1 }
    }, options);
  }

  listFailedPayments(pagination = {}, options = {}) {
    return this.search({
      statuses: options.statuses || FAILED_PAYMENT_STATUSES,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { createdAt: -1 }
    }, options);
  }

  findPaymentsByStatus(statuses, pagination = {}, options = {}) {
    return this.search({
      statuses: Array.isArray(statuses) ? statuses : [statuses],
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { createdAt: -1 }
    }, options);
  }

  findPaymentsByUser(userId, pagination = {}, options = {}) {
    return this.search({
      user: userId,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { createdAt: -1 }
    }, options);
  }

  findPaymentsByDateRange(dateRange = {}, pagination = {}, options = {}) {
    return this.search({
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { createdAt: -1 }
    }, options);
  }

  findPaymentsForReconciliation(filters = {}, pagination = {}, options = {}) {
    return this.search({
      ...filters,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { createdAt: -1 }
    }, options);
  }

  findPaymentsForAdminDashboard(filters = {}, pagination = {}, options = {}) {
    return this.search({
      ...filters,
      page: pagination.page,
      limit: pagination.limit,
      sort: options.sort || { createdAt: -1 }
    }, options);
  }

  count(filters = {}, options = {}) {
    return execute(async () => this.Payment.countDocuments(this.buildFilter(filters)).session(options.session || null));
  }

  existsByUTR(utr, options = {}) {
    return execute(async () => {
      const payment = await applyReadOptions(
        this.Payment.findOne({ utr: String(utr).trim().toUpperCase() }).select('_id'),
        options
      );

      return Boolean(payment);
    });
  }

  existsSuccessfulPayment(orderId, options = {}) {
    return execute(async () => {
      const payment = await applyReadOptions(
        this.Payment.findOne({ order: normalizeObjectId(orderId, 'order'), successfulPayment: true }).select('_id'),
        options
      );

      return Boolean(payment);
    });
  }

  markExpiredPayments(cutoffDate = new Date(), options = {}) {
    return execute(async () => this.Payment.updateMany(
      {
        status: { $in: ACTIVE_INTENT_STATUSES },
        expiresAt: { $lte: cutoffDate }
      },
      {
        $set: {
          status: 'PAYMENT_EXPIRED',
          activeIntent: false,
          successfulPayment: false
        },
        $push: {
          statusHistory: {
            status: 'PAYMENT_EXPIRED',
            reason: options.reason || 'Payment intent expired'
          }
        }
      },
      {
        session: options.session
      }
    ));
  }

  search(filters = {}, options = {}) {
    const { page, limit, skip } = normalizePagination(filters);
    const sort = filters.sort || { createdAt: -1 };

    return execute(async () => {
      const query = this.buildFilter(filters);
      const itemsQuery = applyReadOptions(
        this.Payment.find(query).sort(sort).skip(skip).limit(limit),
        options
      );
      const totalQuery = this.Payment.countDocuments(query).session(options.session || null);
      const items = options.session ? await itemsQuery : null;
      const total = options.session ? await totalQuery : null;
      const [parallelItems, parallelTotal] = options.session ? [items, total] : await Promise.all([itemsQuery, totalQuery]);

      return {
        items: parallelItems,
        pagination: {
          total: parallelTotal,
          page,
          limit,
          pages: Math.ceil(parallelTotal / limit)
        }
      };
    });
  }

  buildFilter(filters = {}) {
    const query = {};

    if (filters.id) query._id = normalizeObjectId(filters.id);
    if (filters.order) query.order = normalizeObjectId(filters.order, 'order');
    if (filters.user) query.user = normalizeObjectId(filters.user, 'user');
    if (filters.provider) query.provider = String(filters.provider).trim().toLowerCase();
    if (filters.paymentMethod) query.paymentMethod = String(filters.paymentMethod).trim().toUpperCase();
    if (filters.status) query.status = filters.status;
    if (filters.statuses && filters.statuses.length) query.status = { $in: filters.statuses };
    if (filters.successfulPayment !== undefined) query.successfulPayment = Boolean(filters.successfulPayment);
    if (filters.activeIntent !== undefined) query.activeIntent = Boolean(filters.activeIntent);
    if (filters.utr) query.utr = String(filters.utr).trim().toUpperCase();
    if (filters.providerOrderId) query.providerOrderId = filters.providerOrderId;
    if (filters.providerPaymentId) query.providerPaymentId = filters.providerPaymentId;

    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
    }

    if (filters.expiresBefore || filters.expiresAfter) {
      query.expiresAt = {};
      if (filters.expiresAfter) query.expiresAt.$gte = new Date(filters.expiresAfter);
      if (filters.expiresBefore) query.expiresAt.$lte = new Date(filters.expiresBefore);
    }

    return query;
  }
}

module.exports = new PaymentRepository();
module.exports.PaymentRepository = PaymentRepository;
module.exports.PaymentRepositoryError = PaymentRepositoryError;
module.exports.InvalidPaymentIdError = InvalidPaymentIdError;
module.exports.PaymentNotFoundError = PaymentNotFoundError;
module.exports.DuplicatePaymentReferenceError = DuplicatePaymentReferenceError;
module.exports.DuplicateSuccessfulPaymentError = DuplicateSuccessfulPaymentError;
module.exports.DuplicateActivePaymentIntentError = DuplicateActivePaymentIntentError;
module.exports.PaymentDatabaseError = PaymentDatabaseError;
