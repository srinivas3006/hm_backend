const crypto = require('crypto');
const logger = require('../utils/logger');

const SESSION_EVENTS = Symbol('domainEvents');

const normalizeId = (value) => (value && value.toString ? value.toString() : String(value));

class EventBusError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

class EventBus {
  constructor({ serviceLogger = logger } = {}) {
    this.logger = serviceLogger;
    this.subscribers = new Map();
    this.processedEventIds = new Set();
    this.processedIdempotencyKeys = new Set();
    this.metrics = {
      published: 0,
      deferred: 0,
      delivered: 0,
      failed: 0,
      duplicates: 0
    };
  }

  subscribe(eventName, handler, options = {}) {
    if (!eventName || typeof handler !== 'function') {
      throw new EventBusError('eventName and handler are required');
    }

    const subscription = {
      id: options.id || `${eventName}:${crypto.randomUUID()}`,
      eventName,
      handler,
      queue: options.queue,
      priority: options.priority || 0
    };

    const handlers = this.subscribers.get(eventName) || [];
    handlers.push(subscription);
    handlers.sort((a, b) => b.priority - a.priority);
    this.subscribers.set(eventName, handlers);

    return subscription.id;
  }

  unsubscribe(eventName, subscriptionId) {
    const handlers = this.subscribers.get(eventName) || [];
    const nextHandlers = handlers.filter((handler) => handler.id !== subscriptionId);
    this.subscribers.set(eventName, nextHandlers);
    return handlers.length !== nextHandlers.length;
  }

  async publish(eventName, payload = {}, options = {}) {
    const event = this.createEvent(eventName, payload, options);

    if (options.session && options.session.inTransaction && options.session.inTransaction()) {
      this.defer(options.session, event);
      this.metrics.deferred += 1;
      this.logger.info('event.deferred', {
        eventId: event.eventId,
        eventName,
        correlationId: event.correlationId
      });
      return event;
    }

    return this.dispatch(event);
  }

  async flushSession(session) {
    const events = this.takeSessionEvents(session);
    const results = [];

    for (const event of events) {
      results.push(await this.dispatch(event));
    }

    return results;
  }

  discardSession(session) {
    const count = this.getSessionEvents(session).length;
    session[SESSION_EVENTS] = [];
    return count;
  }

  createEvent(eventName, payload = {}, options = {}) {
    return {
      eventId: options.eventId || crypto.randomUUID(),
      eventName,
      payload,
      correlationId: options.correlationId || payload.correlationId || crypto.randomUUID(),
      causationId: options.causationId,
      idempotencyKey: options.idempotencyKey,
      replayable: options.replayable !== false,
      metadata: options.metadata || {},
      occurredAt: options.occurredAt || new Date()
    };
  }

  async dispatch(event) {
    if (this.isDuplicate(event)) {
      this.metrics.duplicates += 1;
      this.logger.warn('event.duplicate_ignored', {
        eventId: event.eventId,
        eventName: event.eventName,
        idempotencyKey: event.idempotencyKey
      });
      return event;
    }

    this.markProcessed(event);
    this.metrics.published += 1;
    this.logger.info('event.published', {
      eventId: event.eventId,
      eventName: event.eventName,
      correlationId: event.correlationId
    });

    const handlers = this.subscribers.get(event.eventName) || [];

    for (const subscription of handlers) {
      const startedAt = Date.now();
      try {
        if (subscription.queue) {
          await subscription.queue.add(event.eventName, event, {
            idempotencyKey: `${subscription.id}:${event.eventId}`,
            correlationId: event.correlationId,
            priority: subscription.priority
          });
        } else {
          await subscription.handler(event);
        }
        this.metrics.delivered += 1;
        this.logger.info('event.subscriber_completed', {
          eventId: event.eventId,
          eventName: event.eventName,
          subscriptionId: subscription.id,
          durationMs: Date.now() - startedAt
        });
      } catch (error) {
        this.metrics.failed += 1;
        this.logger.error('event.subscriber_failed', {
          eventId: event.eventId,
          eventName: event.eventName,
          subscriptionId: subscription.id,
          durationMs: Date.now() - startedAt,
          message: error.message
        });
        throw error;
      }
    }

    return event;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  reset() {
    this.subscribers.clear();
    this.processedEventIds.clear();
    this.processedIdempotencyKeys.clear();
    this.metrics = {
      published: 0,
      deferred: 0,
      delivered: 0,
      failed: 0,
      duplicates: 0
    };
  }

  defer(session, event) {
    const events = this.getSessionEvents(session);
    events.push(event);
    session[SESSION_EVENTS] = events;
  }

  getSessionEvents(session) {
    return session[SESSION_EVENTS] || [];
  }

  takeSessionEvents(session) {
    const events = this.getSessionEvents(session);
    session[SESSION_EVENTS] = [];
    return events;
  }

  isDuplicate(event) {
    if (this.processedEventIds.has(event.eventId)) return true;
    if (event.idempotencyKey && this.processedIdempotencyKeys.has(event.idempotencyKey)) return true;
    return false;
  }

  markProcessed(event) {
    this.processedEventIds.add(event.eventId);
    if (event.idempotencyKey) {
      this.processedIdempotencyKeys.add(event.idempotencyKey);
    }
  }
}

module.exports = new EventBus();
module.exports.EventBus = EventBus;
module.exports.EventBusError = EventBusError;
module.exports.normalizeId = normalizeId;
