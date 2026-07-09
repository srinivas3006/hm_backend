const eventBus = require('./eventBus');
const jobQueue = require('../jobs/jobQueue');
const eventWorker = require('../workers/eventWorker');
const notificationService = require('../services/notificationService');
const { DOMAIN_EVENTS } = require('./eventCatalog');

const NOTIFICATION_EVENTS = [
  DOMAIN_EVENTS.PAYMENT_VERIFIED,
  DOMAIN_EVENTS.INVOICE_GENERATED,
  DOMAIN_EVENTS.ORDER_CANCELLED,
  DOMAIN_EVENTS.INVENTORY_RELEASED,
  DOMAIN_EVENTS.PAYMENT_REJECTED
  , DOMAIN_EVENTS.SHIPMENT_CREATED
  , DOMAIN_EVENTS.COURIER_ASSIGNED
  , DOMAIN_EVENTS.SHIPMENT_DISPATCHED
  , DOMAIN_EVENTS.SHIPMENT_DELIVERED
  , DOMAIN_EVENTS.SHIPMENT_CANCELLED
];

let registered = false;

const jobTypeFor = (eventName) => `notification.${eventName}`;

const registerNotificationSubscriber = ({
  bus = eventBus,
  queue = jobQueue,
  worker = eventWorker,
  service = notificationService
} = {}) => {
  if (registered) return [];

  const subscriptions = [];
  for (const eventName of NOTIFICATION_EVENTS) {
    worker.register(jobTypeFor(eventName), async (event) => service.handleDomainEvent(event));
    subscriptions.push(bus.subscribe(eventName, async (event) => {
      await queue.add(jobTypeFor(eventName), event, {
        idempotencyKey: `notification:${event.eventId}`,
        correlationId: event.correlationId,
        maxAttempts: 3,
        backoffMs: 250
      });
    }, {
      id: `notification:${eventName}`
    }));
  }

  registered = true;
  return subscriptions;
};

const resetNotificationSubscriberRegistration = () => {
  registered = false;
};

module.exports = {
  NOTIFICATION_EVENTS,
  registerNotificationSubscriber,
  resetNotificationSubscriberRegistration
};
