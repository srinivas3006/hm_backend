const jobQueue = require('../jobs/jobQueue');
const logger = require('../utils/logger');

class EventWorker {
  constructor({ queue = jobQueue, serviceLogger = logger } = {}) {
    this.queue = queue;
    this.logger = serviceLogger;
    this.handlers = new Map();
  }

  register(eventName, handler) {
    this.handlers.set(eventName, handler);
  }

  async process(options = {}) {
    return this.queue.process(async (job) => {
      const handler = this.handlers.get(job.type);
      if (!handler) {
        this.logger.info('worker.noop', {
          eventName: job.type,
          jobId: job.jobId,
          correlationId: job.correlationId
        });
        return null;
      }

      const startedAt = Date.now();
      const result = await handler(job.payload);
      this.logger.info('worker.event_processed', {
        eventName: job.type,
        jobId: job.jobId,
        correlationId: job.correlationId,
        durationMs: Date.now() - startedAt
      });
      return result;
    }, options);
  }

  reset() {
    this.handlers.clear();
  }
}

module.exports = new EventWorker();
module.exports.EventWorker = EventWorker;
