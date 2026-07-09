const mongoose = require('mongoose');
const shipmentRepository = require('../repositories/shipmentRepository');
const shipmentLedgerRepository = require('../repositories/shipmentLedgerRepository');
const paymentRepository = require('../repositories/paymentRepository');
const invoiceRepository = require('../repositories/invoiceRepository');
const Order = require('../models/Order');
const courierAdapters = require('../shipping/couriers');
const eventBus = require('../events/eventBus');
const { DOMAIN_EVENTS } = require('../events/eventCatalog');
const logger = require('../utils/logger');

const STATUS_EVENTS = {
  CREATED: 'SHIPMENT_CREATED',
  COURIER_ASSIGNED: 'COURIER_ASSIGNED',
  PICKUP_SCHEDULED: 'PICKUP_SCHEDULED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

const ALLOWED_TRANSITIONS = {
  CREATED: ['COURIER_ASSIGNED', 'CANCELLED'],
  COURIER_ASSIGNED: ['PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'CANCELLED'],
  PICKUP_SCHEDULED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  RETURN_REQUESTED: ['RETURNED'],
  RETURNED: []
};

class ShipmentServiceError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class ShipmentCreationNotAllowedError extends ShipmentServiceError {
  constructor(message = 'Shipment cannot be created', details = {}) {
    super(message, 'SHIPMENT_CREATION_NOT_ALLOWED', details);
  }
}

class ShipmentTransitionError extends ShipmentServiceError {
  constructor(fromStatus, toStatus) {
    super('Invalid shipment status transition', 'INVALID_SHIPMENT_TRANSITION', { fromStatus, toStatus });
  }
}

class ShipmentDataAccessError extends ShipmentServiceError {
  constructor(message = 'Shipment data access failed', details = {}) {
    super(message, 'SHIPMENT_DATA_ACCESS_ERROR', details);
  }
}

const normalizeId = (value) => (value && value.toString ? value.toString() : String(value));

class ShipmentService {
  constructor({
    repository = shipmentRepository,
    ledgerRepository = shipmentLedgerRepository,
    payments = paymentRepository,
    invoices = invoiceRepository,
    orderModel = Order,
    adapters = courierAdapters,
    serviceLogger = logger
  } = {}) {
    this.repository = repository;
    this.ledgerRepository = ledgerRepository;
    this.paymentRepository = payments;
    this.invoiceRepository = invoices;
    this.Order = orderModel;
    this.adapters = adapters;
    this.logger = serviceLogger;
  }

  async createShipmentForInvoice(invoiceId, options = {}) {
    return this.execute('createShipmentForInvoice', async () => {
      const invoice = await this.invoiceRepository.getById(invoiceId, { session: options.session });
      const existing = await this.repository.findByOrder(invoice.order, { session: options.session });
      if (existing) return existing;

      const [payment, order] = await Promise.all([
        this.paymentRepository.getById(invoice.payment, { session: options.session, lean: true }),
        this.Order.findById(invoice.order).session(options.session || null)
      ]);

      this.assertCanCreateShipment({ payment, invoice, order });

      let shipment;
      try {
        shipment = await this.repository.createShipment({
          order: order._id,
          payment: payment._id,
          invoice: invoice._id,
          customer: order.user,
          shippingAddress: order.shippingAddress,
          status: 'CREATED',
          packages: [{
            items: order.items.map((item) => ({ book: item.book, quantity: item.quantity }))
          }],
          trackingHistory: [{
            status: 'CREATED',
            description: 'Shipment created after invoice generation'
          }],
          metadata: options.metadata || {},
          audit: {
            createdBy: options.actor && options.actor.userId
          }
        }, { session: options.session });
      } catch (error) {
        if (error && error.code === 'DUPLICATE_SHIPMENT') {
          const duplicate = await this.repository.findByOrder(invoice.order, { session: options.session });
          if (duplicate) return duplicate;
        }
        throw error;
      }

      await this.recordLedgerEvent(shipment, 'SHIPMENT_CREATED', {
        previousStatus: null,
        actor: options.actor,
        actorType: options.actorType || 'SYSTEM',
        reason: 'Shipment created',
        session: options.session
      });
      await this.publishShipmentEvent(DOMAIN_EVENTS.SHIPMENT_CREATED, shipment, options);

      this.logger.info('shipment.created', {
        shipmentId: shipment.shipmentId,
        orderId: normalizeId(shipment.order)
      });

      return shipment;
    });
  }

  async createFromInvoiceGeneratedEvent(event) {
    return this.createShipmentForInvoice(event.payload.invoiceObjectId, {
      correlationId: event.correlationId,
      metadata: {
        sourceEventId: event.eventId,
        sourceEventName: event.eventName
      }
    });
  }

  async assignCourier(shipmentId, courierData = {}, options = {}) {
    return this.execute('assignCourier', async () => {
      const shipment = await this.repository.getById(shipmentId, { session: options.session, lean: true });
      this.validateTransition(shipment.status, 'COURIER_ASSIGNED');
      const provider = String(courierData.provider || 'manual').trim().toLowerCase();
      const adapter = this.adapters[provider];
      if (!adapter) throw new ShipmentCreationNotAllowedError(`Courier provider ${provider} is not supported`);

      const assignment = await adapter.assign(shipment, courierData);
      const updated = await this.repository.assignCourier(shipment._id, {
        ...assignment,
        provider,
        assignedBy: options.actor && options.actor.userId,
        assignedAt: options.now || new Date()
      }, { session: options.session });

      await this.recordLedgerEvent(updated, 'COURIER_ASSIGNED', {
        previousStatus: shipment.status,
        actor: options.actor,
        actorType: options.actorType || 'ADMIN',
        reason: 'Courier assigned',
        metadata: { provider },
        session: options.session
      });
      await this.publishShipmentEvent(DOMAIN_EVENTS.COURIER_ASSIGNED, updated, {
        ...options,
        previousStatus: shipment.status
      });
      return updated;
    });
  }

  async updateStatus(shipmentId, statusData = {}, options = {}) {
    return this.execute('updateStatus', async () => {
      const nextStatus = String(statusData.status || '').trim().toUpperCase();
      const shipment = await this.repository.getById(shipmentId, { session: options.session, lean: true });
      this.validateTransition(shipment.status, nextStatus);

      const updated = await this.repository.updateStatus(shipment._id, {
        ...statusData,
        status: nextStatus,
        actor: options.actor && options.actor.userId,
        occurredAt: statusData.occurredAt || options.now || new Date()
      }, { session: options.session });
      await this.syncOrderForShipment(updated, options);
      await this.recordLedgerEvent(updated, STATUS_EVENTS[nextStatus] || nextStatus, {
        previousStatus: shipment.status,
        actor: options.actor,
        actorType: options.actorType || 'ADMIN',
        reason: statusData.reason || statusData.description,
        session: options.session
      });
      await this.publishShipmentEvent(this.eventForStatus(nextStatus), updated, {
        ...options,
        previousStatus: shipment.status
      });
      return updated;
    });
  }

  async cancelShipment(shipmentId, actor = {}, options = {}) {
    return this.execute('cancelShipment', async () => {
      const shipment = await this.repository.getById(shipmentId, { session: options.session, lean: true });
      if (['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'].includes(shipment.status)) {
        throw new ShipmentTransitionError(shipment.status, 'CANCELLED');
      }
      const updated = await this.repository.updateStatus(shipment._id, {
        status: 'CANCELLED',
        actor: actor.userId || actor._id,
        reason: options.reason || 'Shipment cancelled',
        description: options.reason || 'Shipment cancelled'
      }, { session: options.session });
      await this.recordLedgerEvent(updated, 'CANCELLED', {
        previousStatus: shipment.status,
        actor: { userId: actor.userId || actor._id },
        actorType: options.actorType || 'ADMIN',
        reason: options.reason || 'Shipment cancelled',
        session: options.session
      });
      await this.publishShipmentEvent(DOMAIN_EVENTS.SHIPMENT_CANCELLED, updated, {
        ...options,
        actor: { userId: actor.userId || actor._id },
        previousStatus: shipment.status
      });
      return updated;
    });
  }

  async cancelByOrder(orderId, actor = {}, options = {}) {
    const shipment = await this.repository.findByOrder(orderId, { session: options.session });
    if (!shipment || shipment.status === 'CANCELLED') return shipment;
    return this.cancelShipment(shipment._id, actor, options);
  }

  async getShipment(id, options = {}) {
    return this.execute('getShipment', () => this.repository.getById(id, options));
  }

  async getShipmentByOrder(orderId, options = {}) {
    return this.execute('getShipmentByOrder', () => this.repository.findByOrder(orderId, options));
  }

  async getTracking(shipmentId, options = {}) {
    return this.execute('getTracking', async () => {
      const shipment = await this.repository.getById(shipmentId, options);
      const ledger = await this.ledgerRepository.listByShipment(shipment._id || shipmentId, {}, options);
      return { shipment, trackingHistory: shipment.trackingHistory || [], ledger: ledger.items };
    });
  }

  async listShipments(filters = {}, pagination = {}, options = {}) {
    return this.execute('listShipments', () => this.repository.listShipments(filters, pagination, options));
  }

  async searchShipments(filters = {}, pagination = {}, options = {}) {
    return this.execute('searchShipments', () => this.repository.searchShipments(filters, pagination, options));
  }

  assertCanCreateShipment({ payment, invoice, order }) {
    if (!payment || payment.status !== 'PAYMENT_VERIFIED' || !payment.successfulPayment) {
      throw new ShipmentCreationNotAllowedError('Shipment requires verified payment');
    }
    if (!invoice || invoice.status !== 'GENERATED') {
      throw new ShipmentCreationNotAllowedError('Shipment requires generated invoice');
    }
    if (!order || order.status === 'CANCELLED') {
      throw new ShipmentCreationNotAllowedError('Shipment requires an active order');
    }
  }

  validateTransition(fromStatus, toStatus) {
    const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
    if (!allowed.includes(toStatus)) throw new ShipmentTransitionError(fromStatus, toStatus);
  }

  async syncOrderForShipment(shipment, options = {}) {
    const order = await this.Order.findById(shipment.order).session(options.session || null);
    if (!order) return null;
    if (['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(shipment.status)) order.status = 'SHIPPED';
    if (['DELIVERED', 'COMPLETED'].includes(shipment.status)) order.status = 'DELIVERED';
    order.trackingUpdates.push({
      status: shipment.status,
      description: `Shipment status updated to ${shipment.status}`,
      timestamp: new Date()
    });
    await order.save({ session: options.session });
    return order;
  }

  async recordLedgerEvent(shipment, eventType, options = {}) {
    const ledger = await this.ledgerRepository.createEntry({
      eventKey: `${normalizeId(shipment._id)}:${eventType}:${options.previousStatus || ''}:${shipment.status}`,
      shipment: shipment._id,
      order: shipment.order,
      payment: shipment.payment,
      invoice: shipment.invoice,
      customer: shipment.customer,
      eventType,
      previousStatus: options.previousStatus,
      currentStatus: shipment.status,
      actor: options.actor && (options.actor.userId || options.actor._id),
      actorType: options.actorType || 'UNKNOWN',
      reason: options.reason,
      metadata: options.metadata || {}
    }, { session: options.session });
    return ledger;
  }

  async publishShipmentEvent(eventName, shipment, options = {}) {
    if (!eventName) return null;
    return eventBus.publish(eventName, {
      shipmentId: normalizeId(shipment._id),
      shipmentPublicId: shipment.shipmentId,
      orderId: normalizeId(shipment.order),
      paymentId: normalizeId(shipment.payment),
      invoiceId: normalizeId(shipment.invoice),
      customerId: normalizeId(shipment.customer),
      status: shipment.status,
      previousStatus: options.previousStatus,
      trackingNumber: shipment.trackingNumber,
      courier: shipment.courier
    }, {
      session: options.session,
      correlationId: options.correlationId,
      idempotencyKey: `${eventName}:${normalizeId(shipment._id)}:${shipment.status}`
    });
  }

  eventForStatus(status) {
    if (['PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(status)) return DOMAIN_EVENTS.SHIPMENT_DISPATCHED;
    if (['DELIVERED', 'COMPLETED'].includes(status)) return DOMAIN_EVENTS.SHIPMENT_DELIVERED;
    if (status === 'CANCELLED') return DOMAIN_EVENTS.SHIPMENT_CANCELLED;
    if (status === 'COURIER_ASSIGNED') return DOMAIN_EVENTS.COURIER_ASSIGNED;
    return null;
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

  mapRepositoryError(error, operation) {
    if (error instanceof ShipmentServiceError) return error;
    if (error && error.code && error.code.startsWith('SHIPMENT_')) {
      return new ShipmentDataAccessError(error.message, { operation, repositoryCode: error.code, ...error.details });
    }
    return error;
  }

  async execute(operation, handler) {
    try {
      return await handler();
    } catch (error) {
      const mapped = this.mapRepositoryError(error, operation);
      if (mapped instanceof ShipmentServiceError) {
        this.logger.warn('shipment.service_error', { operation, code: mapped.code });
      }
      throw mapped;
    }
  }
}

module.exports = new ShipmentService();
module.exports.ShipmentService = ShipmentService;
module.exports.ShipmentServiceError = ShipmentServiceError;
module.exports.ShipmentCreationNotAllowedError = ShipmentCreationNotAllowedError;
module.exports.ShipmentTransitionError = ShipmentTransitionError;
module.exports.ShipmentDataAccessError = ShipmentDataAccessError;
