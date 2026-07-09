const mongoose = require('mongoose');
const AnalyticsEvent = require('../models/AnalyticsEvent');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

class AnalyticsRepositoryError extends Error {
  constructor(message = 'Analytics repository operation failed', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = 'ANALYTICS_REPOSITORY_ERROR';
    this.details = details;
  }
}

const normalizePagination = ({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || DEFAULT_PAGE, 1);
  const limitNumber = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  return { page: pageNumber, limit: limitNumber, skip: (pageNumber - 1) * limitNumber };
};

const dateRange = (filters = {}) => {
  const range = {};
  if (filters.dateFrom) range.$gte = new Date(filters.dateFrom);
  if (filters.dateTo) range.$lte = new Date(filters.dateTo);
  return Object.keys(range).length ? range : undefined;
};

const execute = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    throw new AnalyticsRepositoryError(error.message, { message: error.message });
  }
};

class AnalyticsRepository {
  constructor(model = AnalyticsEvent) {
    this.AnalyticsEvent = model;
  }

  recordEvent(data, options = {}) {
    return execute(async () => this.AnalyticsEvent.findOneAndUpdate(
      { eventId: data.eventId },
      { $setOnInsert: data },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
        session: options.session
      }
    ));
  }

  getRevenueSummary(filters = {}) {
    return execute(async () => this.aggregateByPeriod(['PaymentVerified', 'InvoiceGenerated'], filters, '$amount'));
  }

  getBookSales(filters = {}, pagination = {}, options = {}) {
    const { limit } = normalizePagination(pagination);
    const match = this.buildMatch({ ...filters, eventType: 'InventoryDeducted' });
    return execute(async () => this.AnalyticsEvent.aggregate([
      { $match: { ...match, book: { $ne: null } } },
      { $group: { _id: '$book', quantity: { $sum: '$quantity' }, revenue: { $sum: '$amount' } } },
      { $sort: options.sort === 'lowest' ? { quantity: 1 } : { quantity: -1 } },
      { $limit: limit },
      { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
      { $unwind: { path: '$book', preserveNullAndEmptyArrays: true } }
    ]));
  }

  getPaymentMetrics(filters = {}) {
    const match = this.buildMatch(filters);
    return execute(async () => {
      const rows = await this.AnalyticsEvent.aggregate([
        { $match: { ...match, eventType: { $in: ['PaymentVerified', 'PaymentRejected'] } } },
        { $group: { _id: '$eventType', count: { $sum: 1 }, amount: { $sum: '$amount' } } }
      ]);
      const verified = rows.find((row) => row._id === 'PaymentVerified') || { count: 0, amount: 0 };
      const rejected = rows.find((row) => row._id === 'PaymentRejected') || { count: 0, amount: 0 };
      const total = verified.count + rejected.count;
      return {
        successfulPayments: verified.count,
        failedPayments: rejected.count,
        successfulAmount: verified.amount,
        failedAmount: rejected.amount,
        successRate: total ? verified.count / total : 0,
        failureRate: total ? rejected.count / total : 0
      };
    });
  }

  getShipmentMetrics(filters = {}) {
    const match = this.buildMatch(filters);
    return execute(async () => {
      const rows = await this.AnalyticsEvent.aggregate([
        { $match: { ...match, eventType: { $in: ['ShipmentCreated', 'ShipmentDelivered'] } } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } }
      ]);
      return {
        created: (rows.find((row) => row._id === 'ShipmentCreated') || { count: 0 }).count,
        delivered: (rows.find((row) => row._id === 'ShipmentDelivered') || { count: 0 }).count
      };
    });
  }

  getInventoryMetrics(filters = {}) {
    const match = this.buildMatch(filters);
    return execute(async () => this.AnalyticsEvent.aggregate([
      { $match: { ...match, eventType: { $in: ['InventoryReserved', 'InventoryReleased', 'InventoryDeducted'] } } },
      { $group: { _id: '$eventType', quantity: { $sum: '$quantity' }, events: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]));
  }

  getCustomerMetrics(filters = {}, pagination = {}) {
    const { limit } = normalizePagination(pagination);
    const match = this.buildMatch({ ...filters, eventType: 'OrderCreated' });
    return execute(async () => this.AnalyticsEvent.aggregate([
      { $match: { ...match, user: { $ne: null } } },
      { $group: { _id: '$user', orders: { $sum: 1 }, revenue: { $sum: '$amount' } } },
      { $sort: { orders: -1, revenue: -1 } },
      { $limit: limit },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
    ]));
  }

  aggregateByPeriod(eventTypes, filters = {}, amountField = '$amount') {
    const match = this.buildMatch(filters);
    const groupId = this.periodExpression(filters.period || 'daily');
    return this.AnalyticsEvent.aggregate([
      { $match: { ...match, eventType: { $in: eventTypes } } },
      { $group: { _id: groupId, amount: { $sum: amountField }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
  }

  buildMatch(filters = {}) {
    const match = {};
    if (filters.eventType) match.eventType = filters.eventType;
    if (filters.eventTypes) match.eventType = { $in: filters.eventTypes };
    const range = dateRange(filters);
    if (range) match.occurredAt = range;
    if (filters.book && mongoose.Types.ObjectId.isValid(filters.book)) match.book = new mongoose.Types.ObjectId(filters.book);
    if (filters.user && mongoose.Types.ObjectId.isValid(filters.user)) match.user = new mongoose.Types.ObjectId(filters.user);
    return match;
  }

  periodExpression(period) {
    const formats = {
      daily: '%Y-%m-%d',
      weekly: '%G-W%V',
      monthly: '%Y-%m',
      yearly: '%Y'
    };
    return { $dateToString: { format: formats[period] || formats.daily, date: '$occurredAt' } };
  }
}

module.exports = new AnalyticsRepository();
module.exports.AnalyticsRepository = AnalyticsRepository;
module.exports.AnalyticsRepositoryError = AnalyticsRepositoryError;
