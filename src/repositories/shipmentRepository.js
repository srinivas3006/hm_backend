const mongoose = require('mongoose');
const Shipment = require('../models/Shipment');

class ShipmentRepositoryError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class InvalidShipmentIdError extends ShipmentRepositoryError {
  constructor(value, field = 'id') {
    super(`Invalid shipment ${field}`, 'INVALID_SHIPMENT_ID', { field, value });
  }
}

class ShipmentNotFoundError extends ShipmentRepositoryError {
  constructor(criteria = {}) {
    super('Shipment not found', 'SHIPMENT_NOT_FOUND', { criteria });
  }
}

class DuplicateShipmentError extends ShipmentRepositoryError {
  constructor(details = {}) {
    super('Shipment already exists', 'DUPLICATE_SHIPMENT', details);
  }
}

class DuplicateTrackingNumberError extends ShipmentRepositoryError {
  constructor(details = {}) {
    super('Tracking number already exists', 'DUPLICATE_TRACKING_NUMBER', details);
  }
}

class ShipmentDatabaseError extends ShipmentRepositoryError {
  constructor(message = 'Shipment database operation failed', details = {}) {
    super(message, 'SHIPMENT_DATABASE_ERROR', details);
  }
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const normalizePagination = ({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) => {
  const pageNumber = Math.max(parseInt(page, 10) || DEFAULT_PAGE, 1);
  const limitNumber = Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  return { page: pageNumber, limit: limitNumber, skip: (pageNumber - 1) * limitNumber };
};

const normalizeObjectId = (value, field = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(value)) throw new InvalidShipmentIdError(value, field);
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
  if (error instanceof ShipmentRepositoryError) return error;
  if (error && error.name === 'CastError') return new InvalidShipmentIdError(error.value, error.path || 'id');
  if (error && error.code === 11000) {
    const keys = Object.keys(error.keyPattern || {});
    if (keys.includes('trackingNumber')) return new DuplicateTrackingNumberError({ keyValue: error.keyValue });
    return new DuplicateShipmentError({ keyValue: error.keyValue });
  }
  return new ShipmentDatabaseError('Shipment database operation failed', { message: error && error.message });
};

const execute = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    throw toRepositoryError(error);
  }
};

class ShipmentRepository {
  constructor(shipmentModel = Shipment) {
    this.Shipment = shipmentModel;
  }

  createShipment(data, options = {}) {
    return execute(async () => {
      const documents = await this.Shipment.create([data], { session: options.session });
      return documents[0];
    });
  }

  assignCourier(id, courierData = {}, options = {}) {
    return this.updateById(id, {
      $set: {
        courier: {
          provider: courierData.provider,
          serviceName: courierData.serviceName,
          assignedAt: courierData.assignedAt || new Date(),
          assignedBy: courierData.assignedBy
        },
        trackingNumber: courierData.trackingNumber,
        trackingUrl: courierData.trackingUrl,
        estimatedDelivery: courierData.estimatedDelivery,
        status: 'COURIER_ASSIGNED',
        'audit.updatedBy': courierData.assignedBy
      },
      $push: {
        trackingHistory: {
          status: 'COURIER_ASSIGNED',
          description: courierData.description || 'Courier assigned',
          occurredAt: courierData.assignedAt || new Date(),
          metadata: { provider: courierData.provider }
        }
      }
    }, options);
  }

  updateTracking(id, trackingData = {}, options = {}) {
    return this.updateById(id, {
      $set: {
        trackingNumber: trackingData.trackingNumber,
        trackingUrl: trackingData.trackingUrl,
        estimatedDelivery: trackingData.estimatedDelivery,
        'audit.updatedBy': trackingData.updatedBy
      }
    }, options);
  }

  updateStatus(id, statusData = {}, options = {}) {
    const now = statusData.occurredAt || new Date();
    const set = {
      status: statusData.status,
      'audit.updatedBy': statusData.actor
    };
    if (statusData.status === 'PICKED_UP' || statusData.status === 'IN_TRANSIT') set.dispatchDate = statusData.dispatchDate || now;
    if (statusData.status === 'DELIVERED' || statusData.status === 'COMPLETED') set.deliveryDate = statusData.deliveryDate || now;
    if (statusData.status === 'CANCELLED') {
      set.cancelledAt = now;
      set.cancelledBy = statusData.actor;
      set.cancellationReason = statusData.reason;
      set.active = false;
    }

    return this.updateById(id, {
      $set: set,
      $push: {
        trackingHistory: {
          status: statusData.status,
          location: statusData.location,
          description: statusData.description || statusData.reason,
          occurredAt: now,
          metadata: statusData.metadata || {}
        }
      }
    }, options);
  }

  updateById(id, update, options = {}) {
    return execute(async () => {
      normalizeObjectId(id);
      const shipment = await this.Shipment.findByIdAndUpdate(id, update, {
        returnDocument: 'after',
        runValidators: true,
        session: options.session
      });
      if (!shipment) throw new ShipmentNotFoundError({ id });
      return shipment;
    });
  }

  findById(id, options = {}) {
    return execute(async () => applyReadOptions(this.Shipment.findById(normalizeObjectId(id)), options));
  }

  getById(id, options = {}) {
    return execute(async () => {
      const shipment = await applyReadOptions(this.Shipment.findById(normalizeObjectId(id)), options);
      if (!shipment) throw new ShipmentNotFoundError({ id });
      return shipment;
    });
  }

  findByOrder(orderId, options = {}) {
    return execute(async () => applyReadOptions(
      this.Shipment.findOne({ order: normalizeObjectId(orderId, 'order'), ...(options.activeOnly === false ? {} : { active: true }) }).sort({ createdAt: -1 }),
      options
    ));
  }

  findByTrackingNumber(trackingNumber, options = {}) {
    return execute(async () => applyReadOptions(
      this.Shipment.findOne({ trackingNumber: String(trackingNumber).trim().toUpperCase() }),
      options
    ));
  }

  listShipments(filters = {}, pagination = {}, options = {}) {
    return this.searchShipments(filters, pagination, options);
  }

  searchShipments(filters = {}, pagination = {}, options = {}) {
    const { page, limit, skip } = normalizePagination(pagination);
    const sort = options.sort || filters.sort || { createdAt: -1 };
    return execute(async () => {
      const query = this.buildFilter(filters);
      const itemsQuery = applyReadOptions(this.Shipment.find(query).sort(sort).skip(skip).limit(limit), options);
      const totalQuery = this.Shipment.countDocuments(query).session(options.session || null);
      const items = options.session ? await itemsQuery : null;
      const total = options.session ? await totalQuery : null;
      const [parallelItems, parallelTotal] = options.session ? [items, total] : await Promise.all([itemsQuery, totalQuery]);
      return { items: parallelItems, pagination: { total: parallelTotal, page, limit, pages: Math.ceil(parallelTotal / limit) } };
    });
  }

  buildFilter(filters = {}) {
    const query = {};
    if (filters.order) query.order = normalizeObjectId(filters.order, 'order');
    if (filters.payment) query.payment = normalizeObjectId(filters.payment, 'payment');
    if (filters.invoice) query.invoice = normalizeObjectId(filters.invoice, 'invoice');
    if (filters.customer) query.customer = normalizeObjectId(filters.customer, 'customer');
    if (filters.status) query.status = String(filters.status).trim().toUpperCase();
    if (filters.courier) query['courier.provider'] = String(filters.courier).trim().toLowerCase();
    if (filters.trackingNumber) query.trackingNumber = String(filters.trackingNumber).trim().toUpperCase();
    if (filters.active !== undefined) query.active = filters.active === true || filters.active === 'true';
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
    }
    if (filters.search) {
      const term = String(filters.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { shipmentId: new RegExp(term, 'i') },
        { trackingNumber: new RegExp(term, 'i') },
        { 'shippingAddress.fullName': new RegExp(term, 'i') },
        { 'shippingAddress.city': new RegExp(term, 'i') }
      ];
    }
    return query;
  }
}

module.exports = new ShipmentRepository();
module.exports.ShipmentRepository = ShipmentRepository;
module.exports.ShipmentRepositoryError = ShipmentRepositoryError;
module.exports.InvalidShipmentIdError = InvalidShipmentIdError;
module.exports.ShipmentNotFoundError = ShipmentNotFoundError;
module.exports.DuplicateShipmentError = DuplicateShipmentError;
module.exports.DuplicateTrackingNumberError = DuplicateTrackingNumberError;
module.exports.ShipmentDatabaseError = ShipmentDatabaseError;
