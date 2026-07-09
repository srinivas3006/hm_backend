# Notification Engine

Sprint 8 adds an asynchronous notification and communication engine.

Domain services do not send notifications directly. They publish domain events. The notification subscriber queues delivery work, and workers call `NotificationService`.

## Architecture

```text
Domain Event
  -> Notification Subscriber
    -> Job Queue
      -> Event Worker
        -> NotificationService
          -> NotificationRepository
          -> Template Renderer
          -> Channel Adapter
            -> Provider
```

## Existing Provider Reuse

The project already had `src/utils/emailService.js`, backed by Resend when `RESEND_API_KEY` is configured. Sprint 8 reuses this through `EmailAdapter`.

No new external email, SMS, WhatsApp, push, or in-app provider was added.

## Notification Model

`Notification` stores:

- `notificationId`
- `idempotencyKey`
- `user`
- `eventType`
- `channel`
- `subject`
- `body`
- `status`
- `retryCount`
- `sentAt`
- `failedAt`
- `lastError`
- `templateKey`
- `recipient`
- `metadata`

The unique `idempotencyKey` prevents duplicate delivery records for the same event and channel.

## Event Subscriptions

The notification subscriber listens to:

- `PaymentVerified`
- `InvoiceGenerated`
- `OrderCancelled`
- `InventoryReleased`
- `PaymentRejected`

Each event is queued as a notification job. The event publisher is not responsible for delivery.

## Repository

`NotificationRepository` contains persistence only.

Methods:

- `create(data, options)`
- `updateStatus(id, statusData, options)`
- `list(filters, pagination, options)`
- `search(filters, pagination, options)`
- `retry(id, options)`
- `markFailed(id, reason, options)`
- `findById(id, options)`
- `getById(id, options)`
- `findByIdempotencyKey(idempotencyKey, options)`

## Service

`NotificationService` owns notification business rules.

Methods:

- `handleDomainEvent(event, options)`
- `createAndSend(event, channel, context, options)`
- `deliver(notification, options)`
- `retryNotification(notificationId, options)`
- `getNotification(id, options)`
- `listNotifications(filters, pagination, options)`
- `searchNotifications(filters, pagination, options)`
- `selectChannels(event, context, options)`
- `buildContext(event)`

Business rules:

- Delivery is idempotent.
- Notification records are created before delivery.
- Failed deliveries store `lastError`, `failedAt`, and retry count.
- Failed notifications can be retried through admin APIs.
- Channel selection defaults to email when a user email exists.

## Channel Adapters

Implemented:

- `EMAIL`: wraps existing `emailService.sendEmail()`.

Placeholders:

- `SMS`
- `WHATSAPP`
- `PUSH`
- `IN_APP`

Placeholder adapters fail cleanly with provider-not-configured errors and can be replaced later.

## Templates

Templates live in `src/notifications/templates/notificationTemplates.js`.

Rendering is separate from sending and supports future localization by event/template key.

Current template events:

- `PaymentVerified`
- `InvoiceGenerated`
- `OrderCancelled`
- `InventoryReleased`
- `PaymentRejected`

## Admin APIs

All endpoints reuse existing admin authentication and authorization.

```text
GET /api/admin/notifications
GET /api/admin/notifications/search
GET /api/admin/notifications/:id
POST /api/admin/notifications/:id/retry
```

Supported filters:

- `user`
- `eventType`
- `channel`
- `status`
- `dateFrom`
- `dateTo`
- `q` or `search`
- `page`
- `limit`

## Retry Strategy

The event job queue supports retries and dead letters.

Notification records also track delivery attempts through `retryCount`. Admin retry reuses the existing record and does not create duplicates.

## Production Notes

- Configure `RESEND_API_KEY` and `FROM_EMAIL` for real email delivery.
- Without `RESEND_API_KEY`, email delivery is recorded as failed by the adapter path.
- Future production queues should persist jobs outside process memory.
- SMS, WhatsApp, push, and in-app adapters are intentionally placeholders.

## Future Integrations

This prepares for:

- Shipping status messages
- Analytics event streams
- Webhooks
- Multi-channel communication preferences
- Mobile push notifications
- In-app notification feeds
