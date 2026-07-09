# Payment Ledger

## Purpose

`Payment` stores the current payment state. `PaymentLedger` stores the immutable financial history. Every important payment lifecycle event should append a new ledger entry instead of rewriting an old one.

Story 4.7 does not add accounting, invoices, royalties, order updates, webhooks, controllers, or routes.

## Architecture

```text
PaymentService
  -> PaymentLedgerRepository
  -> PaymentLedger
```

Business rules remain in `PaymentService`. The ledger repository only creates and reads ledger records.

## Event Model

Supported event types include:

- `INTENT_CREATED`
- `QR_GENERATED`
- `PAYMENT_SUBMITTED`
- `VERIFICATION_PENDING`
- `PAYMENT_VERIFIED`
- `PAYMENT_REJECTED`
- `PAYMENT_FAILED`
- `PAYMENT_EXPIRED`
- `PAYMENT_CANCELLED`
- `REFUND_REQUESTED`
- `REFUND_APPROVED`
- `REFUNDED`

The model validates event names with an extensible uppercase event pattern so future provider or accounting events can be added without a schema redesign.

## Ledger Fields

- `ledgerId`
- `eventKey`
- `paymentId`
- `orderId`
- `userId`
- `eventType`
- `previousStatus`
- `currentStatus`
- `amount`
- `currency`
- `provider`
- `reference`
- `actor`
- `actorType`
- `reason`
- `metadata`
- `createdAt`

`eventKey` is optional. When supplied, it is unique and prevents duplicate ledger entries for the same idempotent event.

## Append-Only Rules

- Ledger entries can be created only once.
- Existing ledger entries cannot be updated.
- Existing ledger entries cannot be deleted.
- Repository writes use `createEntry()` only.
- Query middleware blocks update/delete operations on the model.
- Service hooks pass MongoDB sessions so ledger writes can roll back with payment writes.

## Repository Methods

| Method | Purpose | Performance |
| --- | --- | --- |
| `createEntry(entryData, options)` | Append one ledger entry. | Uses unique `ledgerId` and optional unique `eventKey`. |
| `listByPayment(paymentId, pagination, options)` | Full audit trail for one payment. | `{ paymentId, createdAt }` index. |
| `listByOrder(orderId, pagination, options)` | Full financial history for one order. | `{ orderId, createdAt }` index. |
| `listByUser(userId, pagination, options)` | User payment history. | `{ userId, createdAt }` index. |
| `listByEvent(eventType, pagination, options)` | Event reporting. | `{ eventType, createdAt }` index. |
| `listByDateRange(dateRange, pagination, options)` | Date-window reporting. | `{ createdAt }` index. |
| `search(filters, options)` | Paginated indexed search. | Uses supplied indexed dimensions. |

## Service Hooks

`PaymentService` appends ledger entries for:

- payment intent creation
- active intent replacement expiry
- dynamic QR generation
- UTR submission
- verification pending
- payment verification
- payment rejection
- payment expiry
- payment cancellation
- payment failure
- manual success marking

The service logs `payment_ledger.entry_created` with masked references only.

## Future Compatibility

Story 4.8 can use `PAYMENT_VERIFIED` ledger events to drive order payment state. Story 4.9 can use verified/rejected entries to coordinate inventory reservation or release. Story 4.10 can send notifications from ledger-backed events. Story 4.11 can build admin audit views from `listByPayment()`, `listByOrder()`, and `listByEvent()`.
