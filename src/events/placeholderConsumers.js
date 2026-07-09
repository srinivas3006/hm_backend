const { DOMAIN_EVENTS } = require('./eventCatalog');
const eventBus = require('./eventBus');
const jobQueue = require('../jobs/jobQueue');
const eventWorker = require('../workers/eventWorker');
const logger = require('../utils/logger');

const CONSUMER_GROUPS = [
  'notifications',
  'invoices',
  'shipping',
  'analytics',
  'audit'
];

const DEFAULT_EVENTS = Object.values(DOMAIN_EVENTS);

const registerPlaceholderConsumers = ({
  bus = eventBus,
  queue = jobQueue,
  worker = eventWorker,
  serviceLogger = logger,
  events = DEFAULT_EVENTS
} = {}) => {
  const subscriptions = [];

  for (const group of CONSUMER_GROUPS) {
    for (const eventName of events) {
      worker.register(`${group}.${eventName}`, async (event) => {
        serviceLogger.info('consumer.placeholder_received', {
          consumer: group,
          eventName: event.eventName,
          eventId: event.eventId,
          correlationId: event.correlationId
        });
      });

      subscriptions.push(bus.subscribe(eventName, async (event) => {
        await queue.add(`${group}.${eventName}`, event, {
          idempotencyKey: `${group}:${event.eventId}`,
          correlationId: event.correlationId,
          maxAttempts: 3,
          backoffMs: 250
        });
      }, {
        id: `${group}:${eventName}`
      }));
    }
  }

  return subscriptions;
};

module.exports = {
  registerPlaceholderConsumers,
  CONSUMER_GROUPS
};
