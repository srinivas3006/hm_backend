const notificationRepository = require('../repositories/notificationRepository');
const channelAdapters = require('../notifications/channels');
const templateRenderer = require('../notifications/templates/notificationTemplates');
const logger = require('../utils/logger');
const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const InventoryReservation = require('../models/InventoryReservation');
const Shipment = require('../models/Shipment');

const DEFAULT_RETRY_LIMIT = 3;

class NotificationServiceError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class NotificationDeliveryError extends NotificationServiceError {
  constructor(message = 'Notification delivery failed', details = {}) {
    super(message, 'NOTIFICATION_DELIVERY_ERROR', details);
  }
}

class NotificationRetryLimitError extends NotificationServiceError {
  constructor(details = {}) {
    super('Notification retry limit reached', 'NOTIFICATION_RETRY_LIMIT_REACHED', details);
  }
}

const normalizeId = (value) => (value && value.toString ? value.toString() : String(value));

class NotificationService {
  constructor({
    repository = notificationRepository,
    adapters = channelAdapters,
    renderer = templateRenderer,
    serviceLogger = logger
  } = {}) {
    this.repository = repository;
    this.adapters = adapters;
    this.renderer = renderer;
    this.logger = serviceLogger;
  }

  async handleDomainEvent(event, options = {}) {
    return this.execute('handleDomainEvent', async () => {
      const context = await this.buildContext(event);
      const channels = this.selectChannels(event, context, options);
      const notifications = [];

      for (const channel of channels) {
        notifications.push(await this.createAndSend(event, channel, context, options));
      }

      return notifications;
    });
  }

  async createAndSend(event, channel, context, options = {}) {
    const idempotencyKey = this.buildIdempotencyKey(event, channel);
    const existing = await this.repository.findByIdempotencyKey(idempotencyKey, { session: options.session });
    if (existing) {
      if (existing.status === 'SENT' || existing.retryCount >= (options.retryLimit || DEFAULT_RETRY_LIMIT)) {
        return existing;
      }
      return this.deliver(existing, options);
    }

    const rendered = this.renderer.render(event.eventName, context);
    let notification;

    try {
      notification = await this.repository.create({
        idempotencyKey,
        user: context.user && context.user._id,
        eventType: event.eventName,
        channel,
        subject: rendered.subject,
        body: rendered.body,
        status: 'PENDING',
        templateKey: rendered.templateKey,
        recipient: {
          email: context.user && context.user.email,
          name: context.user && context.user.name
        },
        metadata: {
          eventId: event.eventId,
          correlationId: event.correlationId,
          payload: event.payload
        }
      }, { session: options.session });
    } catch (error) {
      if (error && error.code === 'DUPLICATE_NOTIFICATION') {
        const duplicate = await this.repository.findByIdempotencyKey(idempotencyKey, { session: options.session });
        if (duplicate) return duplicate;
      }
      throw error;
    }

    return this.deliver(notification, options);
  }

  async deliver(notification, options = {}) {
    return this.execute('deliver', async () => {
      const adapter = this.adapters[notification.channel];
      if (!adapter) {
        return this.repository.markFailed(notification._id, `Channel ${notification.channel} is not supported`, {
          session: options.session,
          incrementRetry: true
        });
      }

      const result = await adapter.send(notification);
      if (result.success) {
        return this.repository.updateStatus(notification._id, {
          status: 'SENT',
          sentAt: options.now || new Date(),
          failedAt: null,
          lastError: null
        }, { session: options.session });
      }

      const failed = await this.repository.markFailed(notification._id, result.error || 'Notification adapter failed', {
        session: options.session,
        incrementRetry: true
      });
      throw new NotificationDeliveryError(result.error || 'Notification adapter failed', {
        notificationId: normalizeId(notification._id),
        channel: notification.channel
      });
    });
  }

  async retryNotification(notificationId, options = {}) {
    return this.execute('retryNotification', async () => {
      const notification = await this.repository.getById(notificationId, {
        session: options.session,
        lean: false
      });

      if (notification.retryCount >= (options.retryLimit || DEFAULT_RETRY_LIMIT)) {
        throw new NotificationRetryLimitError({ notificationId: normalizeId(notification._id) });
      }

      const pending = await this.repository.retry(notification._id, { session: options.session });
      return this.deliver(pending, options);
    });
  }

  async getNotification(id, options = {}) {
    return this.execute('getNotification', () => this.repository.getById(id, options));
  }

  async listNotifications(filters = {}, pagination = {}, options = {}) {
    return this.execute('listNotifications', () => this.repository.list(filters, pagination, options));
  }

  async searchNotifications(filters = {}, pagination = {}, options = {}) {
    return this.execute('searchNotifications', () => this.repository.search(filters, pagination, options));
  }

  selectChannels(event, context, options = {}) {
    if (options.channels && options.channels.length) return options.channels;
    if (context.user && context.user.email) return ['EMAIL'];
    return ['IN_APP'];
  }

  buildIdempotencyKey(event, channel) {
    return `${event.eventName}:${event.eventId}:${channel}`;
  }

  async buildContext(event) {
    const payload = event.payload || {};
    const [payment, invoice, reservation, shipment] = await Promise.all([
      payload.paymentId ? Payment.findById(payload.paymentId).lean() : null,
      payload.invoiceObjectId ? Invoice.findById(payload.invoiceObjectId).lean() : null,
      payload.reservationId ? InventoryReservation.findById(payload.reservationId).lean() : null,
      payload.shipmentId ? Shipment.findById(payload.shipmentId).lean() : null
    ]);

    const orderId = payload.orderId || (shipment && shipment.order) || (payment && payment.order) || (invoice && invoice.order) || (reservation && reservation.order);
    const userId = payload.userId || payload.customerId || (shipment && shipment.customer) || (payment && payment.user) || (invoice && invoice.customer);

    const [order, user] = await Promise.all([
      orderId ? Order.findById(orderId).lean() : null,
      userId ? User.findById(userId).select('name email role').lean() : null
    ]);

    return {
      event,
      payload,
      payment,
      invoice,
      reservation,
      shipment,
      order,
      user
    };
  }

  mapRepositoryError(error, operation) {
    if (error instanceof NotificationServiceError) return error;
    if (error && error.code && error.code.startsWith('NOTIFICATION_')) {
      return new NotificationServiceError(error.message, error.code, { operation, ...error.details });
    }
    return error;
  }

  async execute(operation, handler) {
    try {
      return await handler();
    } catch (error) {
      const mapped = this.mapRepositoryError(error, operation);
      if (mapped instanceof NotificationServiceError) {
        this.logger.warn('notification.service_error', {
          operation,
          code: mapped.code
        });
      }
      throw mapped;
    }
  }
}

module.exports = new NotificationService();
module.exports.NotificationService = NotificationService;
module.exports.NotificationServiceError = NotificationServiceError;
module.exports.NotificationDeliveryError = NotificationDeliveryError;
module.exports.NotificationRetryLimitError = NotificationRetryLimitError;
