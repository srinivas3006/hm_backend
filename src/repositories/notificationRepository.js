const mongoose = require('mongoose');
const Notification = require('../models/Notification');

class NotificationRepositoryError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class NotificationNotFoundError extends NotificationRepositoryError {
  constructor(criteria = {}) {
    super('Notification not found', 'NOTIFICATION_NOT_FOUND', { criteria });
  }
}

class InvalidNotificationIdError extends NotificationRepositoryError {
  constructor(value, field = 'id') {
    super(`Invalid notification ${field}`, 'INVALID_NOTIFICATION_ID', { field, value });
  }
}

class DuplicateNotificationError extends NotificationRepositoryError {
  constructor(details = {}) {
    super('Notification already exists', 'DUPLICATE_NOTIFICATION', details);
  }
}

class NotificationDatabaseError extends NotificationRepositoryError {
  constructor(message = 'Notification database operation failed', details = {}) {
    super(message, 'NOTIFICATION_DATABASE_ERROR', details);
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const normalizePagination = ({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || DEFAULT_PAGE, 1);
  const limitNumber = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  return {
    page: pageNumber,
    limit: limitNumber,
    skip: (pageNumber - 1) * limitNumber
  };
};

const normalizeObjectId = (value, field = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new InvalidNotificationIdError(value, field);
  }
  return value;
};

const applyReadOptions = (query, options = {}) => {
  if (options.session) query.session(options.session);
  if (options.projection) query.select(options.projection);
  if (options.populate) query.populate(options.populate);
  if (options.lean !== false) query.lean();
  return query;
};

const toRepositoryError = (error) => {
  if (error instanceof NotificationRepositoryError) return error;
  if (error && error.name === 'CastError') return new InvalidNotificationIdError(error.value, error.path || 'id');
  if (error && error.code === 11000) return new DuplicateNotificationError({ keyValue: error.keyValue });
  return new NotificationDatabaseError('Notification database operation failed', {
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

class NotificationRepository {
  constructor(notificationModel = Notification) {
    this.Notification = notificationModel;
  }

  create(data, options = {}) {
    return execute(async () => {
      const documents = await this.Notification.create([data], { session: options.session });
      return documents[0];
    });
  }

  updateStatus(id, statusData = {}, options = {}) {
    return execute(async () => {
      normalizeObjectId(id);
      const notification = await this.Notification.findByIdAndUpdate(
        id,
        {
          $set: {
            status: statusData.status,
            sentAt: statusData.sentAt,
            failedAt: statusData.failedAt,
            lastError: statusData.lastError
          },
          ...(statusData.incrementRetry ? { $inc: { retryCount: 1 } } : {})
        },
        {
          returnDocument: 'after',
          runValidators: true,
          session: options.session
        }
      );
      if (!notification) throw new NotificationNotFoundError({ id });
      return notification;
    });
  }

  retry(id, options = {}) {
    return this.updateStatus(id, {
      status: 'PENDING',
      failedAt: null,
      lastError: null
    }, options);
  }

  markFailed(id, reason, options = {}) {
    return this.updateStatus(id, {
      status: 'FAILED',
      failedAt: options.now || new Date(),
      lastError: reason,
      incrementRetry: Boolean(options.incrementRetry)
    }, options);
  }

  findById(id, options = {}) {
    return execute(async () => {
      normalizeObjectId(id);
      return applyReadOptions(this.Notification.findById(id), options);
    });
  }

  getById(id, options = {}) {
    return execute(async () => {
      normalizeObjectId(id);
      const notification = await applyReadOptions(this.Notification.findById(id), options);
      if (!notification) throw new NotificationNotFoundError({ id });
      return notification;
    });
  }

  findByIdempotencyKey(idempotencyKey, options = {}) {
    return execute(async () => applyReadOptions(
      this.Notification.findOne({ idempotencyKey }),
      options
    ));
  }

  list(filters = {}, pagination = {}, options = {}) {
    return this.search(filters, pagination, options);
  }

  search(filters = {}, pagination = {}, options = {}) {
    const { page, limit, skip } = normalizePagination(pagination);
    const sort = options.sort || filters.sort || { createdAt: -1 };

    return execute(async () => {
      const query = this.buildFilter(filters);
      const itemsQuery = applyReadOptions(
        this.Notification.find(query).sort(sort).skip(skip).limit(limit),
        options
      );
      const totalQuery = this.Notification.countDocuments(query).session(options.session || null);
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
    if (filters.user) query.user = normalizeObjectId(filters.user, 'user');
    if (filters.eventType) query.eventType = filters.eventType;
    if (filters.channel) query.channel = String(filters.channel).trim().toUpperCase();
    if (filters.status) query.status = String(filters.status).trim().toUpperCase();
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
    }
    if (filters.search) {
      const term = String(filters.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { subject: new RegExp(term, 'i') },
        { body: new RegExp(term, 'i') },
        { notificationId: new RegExp(term, 'i') },
        { 'recipient.email': new RegExp(term, 'i') },
        { 'recipient.name': new RegExp(term, 'i') }
      ];
    }
    return query;
  }
}

module.exports = new NotificationRepository();
module.exports.NotificationRepository = NotificationRepository;
module.exports.NotificationRepositoryError = NotificationRepositoryError;
module.exports.NotificationNotFoundError = NotificationNotFoundError;
module.exports.InvalidNotificationIdError = InvalidNotificationIdError;
module.exports.DuplicateNotificationError = DuplicateNotificationError;
module.exports.NotificationDatabaseError = NotificationDatabaseError;
