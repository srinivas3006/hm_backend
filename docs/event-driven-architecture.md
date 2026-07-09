# Event-Driven Architecture

Sprint 6 introduces the internal event and job infrastructure used by future notifications, invoices, shipping, analytics, webhooks, and service extraction work.

No external broker is required in this sprint. The implementation is intentionally broker-ready while remaining in-process for the current backend.

## Existing Infrastructure Audit

The project did not have existing Redis, Bull, Agenda, cron, RabbitMQ, Kafka, SQS, worker, scheduler, or message bus infrastructure.

Existing related code:

- Global API rate limiting through `express-rate-limit`.
- Email helper in `src/utils/emailService.js`, currently called directly by order creation.
- Future job references in payment docs, but no runtime scheduler.

## Architecture

```text
Domain Services
  -> Event Bus
    -> Subscribers
      -> Job Queue
        -> Workers
          -> Services
```

Controllers do not process jobs and workers do not call controllers.

## Event Catalog

The canonical catalog lives in `src/events/eventCatalog.js`.

Current events:

- `PaymentIntentCreated`
- `QRCodeGenerated`
- `PaymentSubmitted`
- `PaymentVerified`
- `PaymentRejected`
- `PaymentExpired`
- `PaymentCancelled`
- `PaymentFailed`
- `OrderCreated`
- `OrderCancelled`
- `InventoryReserved`
- `InventoryReleased`
- `InventoryDeducted`
- `InventoryExpired`
- `LedgerCreated`
- `AdminApprovedPayment`
- `AdminRejectedPayment`
- `AdminCancelledPayment`
- `AdminExpiredPayment`
- `AdminRecreatedQR`

## Event Bus

The event bus lives in `src/events/eventBus.js`.

Capabilities:

- `publish(eventName, payload, options)`
- `subscribe(eventName, handler, options)`
- `unsubscribe(eventName, subscriptionId)`
- Session-aware deferred publishing
- Replay-ready event envelope
- Event ids
- Correlation ids
- Causation ids
- Idempotency keys
- Structured logging
- Basic in-memory metrics

Event envelope:

```json
{
  "eventId": "uuid",
  "eventName": "PaymentVerified",
  "payload": {},
  "correlationId": "uuid",
  "causationId": "optional",
  "idempotencyKey": "optional",
  "replayable": true,
  "metadata": {},
  "occurredAt": "ISO date"
}
```

## Transaction Rules

If `publish()` receives an active MongoDB session, the event is buffered on that session.

Session owners must:

- Call `eventBus.flushSession(session)` after a successful commit.
- Call `eventBus.discardSession(session)` after rollback or early abort.

This prevents subscribers from seeing events for work that later rolls back.

Current session owners updated:

- `OrderPaymentBridgeService`
- `AdminOperationsService`
- `orderController.cancelOrder`

## Queue Design

The queue abstraction lives in `src/jobs/jobQueue.js`.

Capabilities:

- In-memory queue
- Priority
- Retries
- Backoff
- Dead letter storage
- Scheduling through `runAt` or `delayMs`
- Idempotency keys
- Structured logs
- Processing, retry, failure, duplicate, and dead-letter metrics

This interface can later be backed by Redis/BullMQ, RabbitMQ, Kafka, or SQS without changing publisher code.

## Worker Design

The worker abstraction lives in `src/workers/eventWorker.js`.

Workers:

- Pull jobs from a queue.
- Resolve handlers by job type.
- Call service-level handlers only.
- Log duration, failures, and correlation ids.
- Never call controllers.

## Placeholder Consumers

Placeholder consumers live in `src/events/placeholderConsumers.js`.

Consumer groups:

- `notifications`
- `invoices`
- `shipping`
- `analytics`
- `audit`

They currently log event receipt only. No notification, invoice, shipping, analytics, or webhook behavior is implemented in Sprint 6.

## Published Events

Payment events are published from `PaymentService` after successful state changes and ledger writes.

Inventory events are published from `InventoryService` after successful reservation, release, deduction, and ledger writes.

Order events are published from `OrderPaymentBridgeService` after checkout or cancellation orchestration.

Admin events are published from `AdminOperationsService` after admin approve, reject, cancel, expire, or QR recreation orchestration.

## Subscriber Rules

- Subscribers must be idempotent.
- Subscribers should prefer queue-backed execution for long-running work.
- Subscribers must not mutate HTTP response state.
- Subscribers must not call controllers.
- Subscribers must preserve and pass correlation ids.

## Retry Strategy

Default queue behavior:

- `maxAttempts`: 3
- `backoffMs`: 100 unless specified
- Exhausted jobs move to dead letter storage
- Duplicate idempotency keys are ignored after successful processing

Future production backing should persist jobs and dead letters outside process memory.

## Failure Strategy

- Direct subscriber failures are logged and surfaced to the publisher.
- Queue worker failures are retried until attempts are exhausted.
- Dead-lettered jobs remain inspectable through `getDeadLetters()`.
- Failure, retry, duplicate, and dead-letter counts are exposed through `getMetrics()`.

## Future Integrations

The current abstractions prepare the codebase for:

- Customer notifications from payment/order/inventory events.
- Invoice generation after payment verification.
- Shipping workflow after payment verification and inventory deduction.
- Analytics projections from immutable event streams.
- Webhook dispatch and retry handling.
- Multi-service architecture with Redis, RabbitMQ, Kafka, SQS, or another broker.
