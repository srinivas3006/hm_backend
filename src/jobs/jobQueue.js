const crypto = require('crypto');
const logger = require('../utils/logger');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class JobQueue {
  constructor({ name = 'default', serviceLogger = logger } = {}) {
    this.name = name;
    this.logger = serviceLogger;
    this.jobs = [];
    this.deadLetterJobs = [];
    this.processedIdempotencyKeys = new Set();
    this.metrics = {
      enqueued: 0,
      processed: 0,
      failed: 0,
      retried: 0,
      duplicates: 0,
      deadLettered: 0
    };
  }

  async add(type, payload, options = {}) {
    if (options.idempotencyKey && this.processedIdempotencyKeys.has(options.idempotencyKey)) {
      this.metrics.duplicates += 1;
      this.logger.warn('job.duplicate_ignored', {
        queue: this.name,
        type,
        idempotencyKey: options.idempotencyKey
      });
      return null;
    }

    const job = {
      jobId: options.jobId || crypto.randomUUID(),
      type,
      payload,
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: options.maxAttempts || options.retries || 3,
      backoffMs: options.backoffMs || 100,
      runAt: options.runAt ? new Date(options.runAt) : new Date(Date.now() + (options.delayMs || 0)),
      idempotencyKey: options.idempotencyKey,
      correlationId: options.correlationId || crypto.randomUUID(),
      createdAt: new Date()
    };

    this.jobs.push(job);
    this.jobs.sort((a, b) => b.priority - a.priority || a.runAt - b.runAt);
    this.metrics.enqueued += 1;
    this.logger.info('job.enqueued', {
      queue: this.name,
      jobId: job.jobId,
      type,
      correlationId: job.correlationId
    });

    return job;
  }

  async process(handler, options = {}) {
    const now = options.now || new Date();
    const readyJobs = this.jobs
      .filter((job) => job.runAt <= now)
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt);

    const limit = options.limit || readyJobs.length;
    const results = [];

    for (const job of readyJobs.slice(0, limit)) {
      this.removeJob(job.jobId);
      results.push(await this.processJob(job, handler));
    }

    return results;
  }

  async processJob(job, handler) {
    const startedAt = Date.now();

    if (job.idempotencyKey && this.processedIdempotencyKeys.has(job.idempotencyKey)) {
      this.metrics.duplicates += 1;
      return { job, status: 'duplicate' };
    }

    try {
      job.attempts += 1;
      const result = await handler(job);
      if (job.idempotencyKey) {
        this.processedIdempotencyKeys.add(job.idempotencyKey);
      }
      this.metrics.processed += 1;
      this.logger.info('job.processed', {
        queue: this.name,
        jobId: job.jobId,
        type: job.type,
        attempts: job.attempts,
        durationMs: Date.now() - startedAt
      });
      return { job, status: 'processed', result };
    } catch (error) {
      this.metrics.failed += 1;
      this.logger.error('job.failed', {
        queue: this.name,
        jobId: job.jobId,
        type: job.type,
        attempts: job.attempts,
        durationMs: Date.now() - startedAt,
        message: error.message
      });

      if (job.attempts < job.maxAttempts) {
        this.metrics.retried += 1;
        job.runAt = new Date(Date.now() + job.backoffMs * job.attempts);
        this.jobs.push(job);
        this.jobs.sort((a, b) => b.priority - a.priority || a.runAt - b.runAt);
        if (job.backoffMs && job.backoffMs < 20) {
          await delay(job.backoffMs);
        }
        return { job, status: 'retry', error };
      }

      this.deadLetterJobs.push({ ...job, failedAt: new Date(), error: error.message });
      this.metrics.deadLettered += 1;
      return { job, status: 'dead-lettered', error };
    }
  }

  removeJob(jobId) {
    this.jobs = this.jobs.filter((job) => job.jobId !== jobId);
  }

  getDeadLetters() {
    return [...this.deadLetterJobs];
  }

  getMetrics() {
    return { ...this.metrics };
  }

  size() {
    return this.jobs.length;
  }

  reset() {
    this.jobs = [];
    this.deadLetterJobs = [];
    this.processedIdempotencyKeys.clear();
    this.metrics = {
      enqueued: 0,
      processed: 0,
      failed: 0,
      retried: 0,
      duplicates: 0,
      deadLettered: 0
    };
  }
}

module.exports = new JobQueue({ name: 'domain-events' });
module.exports.JobQueue = JobQueue;
