# Payment Repository

## Purpose

`src/repositories/paymentRepository.js` is the database access layer for the `Payment` model. It contains no payment business rules. Future services should call this repository instead of importing `Payment` directly.

The repository preserves backward compatibility because it is not wired into existing controllers, routes, or order logic yet.

## Public Methods

| Method | Purpose | Returns | Exceptions | Performance |
| --- | --- | --- | --- | --- |
| `create(paymentData, options)` | Create one payment attempt. | Mongoose document | duplicate reference, database write errors | Uses model validation and indexes on write. |
| `createIntent(intentData, options)` | Create one active payment intent. | Mongoose document | duplicate active intent, duplicate reference, database write errors | Partial unique `{ order, activeIntent }` index. |
| `updateById(id, update, options)` | Update a payment by `_id`. | Mongoose document | invalid id, missing payment, duplicate reference | `_id` lookup. |
| `findById(id, options)` | Find one payment by `_id`. | payment or `null` | invalid id | `_id` lookup. |
| `getById(id, options)` | Find one payment by `_id`, requiring a result. | payment | invalid id, missing payment | `_id` lookup. |
| `findByOrder(orderId, options)` | List all attempts for one order. | array | invalid order id | `{ order, createdAt }` index. |
| `findActivePaymentIntent(orderId, options)` | Find latest non-expired active intent for an order. | payment or `null` | invalid order id | Uses `{ order, createdAt }`, then filters active statuses and expiry for one order. |
| `findActiveIntent(orderId, options)` | Alias for active intent lookup. | payment or `null` | invalid order id | Uses active intent indexes. |
| `findIntentByOrder(orderId, pagination, options)` | Paginated intent/payment attempts for an order. | `{ items, pagination }` | invalid order id | `{ order, createdAt }` index. |
| `expireActiveIntent(orderId, options)` | Expire active intent for an order before replacement. | Mongo update result | invalid order id, database write errors | Partial active intent index and status filters. |
| `findExpiredIntents(cutoffDate, pagination, options)` | Find active intents past expiry for future cleanup jobs. | `{ items, pagination }` | database errors | `{ status, expiresAt }` and active intent filters. |
| `saveQRCodeMetadata(id, qrMetadata, options)` | Save QR URI, image, timestamps, metadata, and QR status. | Mongoose document | invalid id, missing payment, database write errors | `_id` lookup. |
| `findLatestQRCode(paymentId, options)` | Read latest QR metadata for a payment. | payment or `null` | invalid id, database errors | `_id` lookup plus QR timestamp guard. |
| `submitUTR(id, utrData, options)` | Persist a submitted UTR and move an active payment attempt to verification pending. | Mongoose document | invalid id, missing/changed payment, duplicate UTR, database write errors | Conditional `_id`, `activeIntent`, `status`, and empty `utr` filter prevents concurrent overwrite. |
| `verifyPayment(id, verificationData, options)` | Persist successful verification audit fields. | Mongoose document | invalid id, missing/changed payment, duplicate successful payment, database write errors | Conditional `_id`, `activeIntent`, and pending status filter plus partial successful-payment index. |
| `rejectPayment(id, rejectionData, options)` | Persist rejected verification audit fields. | Mongoose document | invalid id, missing/changed payment, database write errors | Conditional `_id`, `activeIntent`, and pending status filter prevents double rejection/verification. |
| `findByVerificationStatus(statuses, pagination, options)` | Paginate verification queue by status. | `{ items, pagination }` | database errors | `{ status, createdAt }` index; optional `activeIntent` filter narrows active queue. |
| `findPendingVerification(paymentId, options)` | Find a specific active payment awaiting verification. | payment or `null` | invalid id, database errors | `_id` lookup with status and active intent guards. |
| `lockPaymentForVerification(paymentId, options)` | Optional atomic marker for future admin claiming flows. | Mongoose document | invalid id, missing/changed payment, database write errors | Conditional `_id`, `activeIntent`, and pending status update. |
| `findByUTR(utr, options)` | Find manual UPI payment by UTR. | payment or `null` | database errors | Unique partial `utr` index. |
| `findByProviderPaymentId(provider, providerPaymentId, options)` | Find gateway payment by provider payment id. | payment or `null` | database errors | `{ provider, providerPaymentId }` sparse index. |
| `findByProviderOrderId(provider, providerOrderId, options)` | Find gateway payment by provider order id. | payment or `null` | database errors | `{ provider, providerOrderId }` sparse index. |
| `findSuccessfulPayment(orderId, options)` | Find the successful payment for an order. | payment or `null` | invalid order id | Partial unique `{ order, successfulPayment }` index. |
| `listPaymentAttempts(orderId, pagination, options)` | Paginated attempts for one order. | `{ items, pagination }` | invalid order id | `{ order, createdAt }` index. |
| `listPendingVerifications(pagination, options)` | Admin queue for submitted/manual verification payments. | `{ items, pagination }` | database errors | `{ status, createdAt }` index. |
| `listFailedPayments(pagination, options)` | Failed/expired/cancelled payment list. | `{ items, pagination }` | database errors | `{ status, createdAt }` index. |
| `findPaymentsByStatus(statuses, pagination, options)` | List payments by status. | `{ items, pagination }` | database errors | `{ status, createdAt }` index. |
| `findPaymentsByUser(userId, pagination, options)` | Paginated user payment history. | `{ items, pagination }` | invalid user id | `{ user, createdAt }` index. |
| `findPaymentsByDateRange(dateRange, pagination, options)` | Payment report window. | `{ items, pagination }` | database errors | `{ createdAt }` index. |
| `findPaymentsForReconciliation(filters, pagination, options)` | Provider/payment reconciliation search. | `{ items, pagination }` | invalid ids, database errors | Uses provider/status/date indexes depending on filters. |
| `findPaymentsForAdminDashboard(filters, pagination, options)` | Admin dashboard payment search. | `{ items, pagination }` | invalid ids, database errors | Uses indexed filter combinations where supplied. |
| `count(filters, options)` | Count payments by filters. | number | invalid ids, database errors | Uses `buildFilter`; indexed if filters are indexed. |
| `existsByUTR(utr, options)` | Efficient duplicate UTR check. | boolean | database errors | Unique partial `utr` index and `_id` projection. |
| `existsSuccessfulPayment(orderId, options)` | Efficient success check for one order. | boolean | invalid order id | Partial unique `{ order, successfulPayment }` index and `_id` projection. |
| `markExpiredPayments(cutoffDate, options)` | Bulk-expire active intents past expiry. | Mongo update result | database write errors | `{ status, expiresAt }` index. |
| `search(filters, options)` | Soft search with pagination. | `{ items, pagination }` | invalid ids, database errors | Uses indexed fields when filters include order/user/status/provider/date/reference fields. |
| `buildFilter(filters)` | Build a MongoDB query object from safe filters. | object | invalid ids | Utility used by search/count. |

## Options

Read and write methods accept:

| Option | Purpose |
| --- | --- |
| `session` | Optional MongoDB session for transactions. |
| `projection` | Limits returned fields. |
| `lean` | Defaults to `true` for reads. Set `false` for Mongoose documents. |
| `populate` | Optional population for service/reporting use cases. |
| `includeSensitive` | Explicitly includes fields excluded by default, such as gateway raw response or QR payload. |

## Repository Exceptions

The repository maps MongoDB/Mongoose errors into repository-level exceptions:

| Exception | Code | Typical Cause |
| --- | --- | --- |
| `InvalidPaymentIdError` | `INVALID_PAYMENT_ID` | Invalid `_id`, order id, or user id. |
| `PaymentNotFoundError` | `PAYMENT_NOT_FOUND` | Required payment does not exist. |
| `DuplicatePaymentReferenceError` | `DUPLICATE_PAYMENT_REFERENCE` | Duplicate UTR or provider reference. |
| `DuplicateSuccessfulPaymentError` | `DUPLICATE_SUCCESSFUL_PAYMENT` | A second successful payment for one order was attempted. |
| `DuplicateActivePaymentIntentError` | `DUPLICATE_ACTIVE_PAYMENT_INTENT` | A second active intent for one order was attempted. |
| `PaymentDatabaseError` | `PAYMENT_DATABASE_ERROR` | Other database read/write failures. |

Raw MongoDB errors should not escape this repository.

## Query and Index Notes

| Query | Index |
| --- | --- |
| Attempts by order | `{ order: 1, createdAt: -1 }` |
| User payment history | `{ user: 1, createdAt: -1 }` |
| Pending/failed lists | `{ status: 1, createdAt: -1 }` |
| Verification queue | `{ status: 1, createdAt: -1 }` with `activeIntent` filter |
| Date-range reports | `{ createdAt: -1 }` |
| Provider dashboards | `{ provider: 1, status: 1, createdAt: -1 }` |
| Expiry sweeps | `{ status: 1, expiresAt: 1 }` |
| Manual UPI lookup | unique partial `{ utr: 1 }` |
| Gateway payment lookup | `{ provider: 1, providerPaymentId: 1 }` |
| Gateway order lookup | `{ provider: 1, providerOrderId: 1 }` |
| Successful payment by order | unique partial `{ order: 1, successfulPayment: 1 }` |
| Active intent by order | unique partial `{ order: 1, activeIntent: 1 }` |

With millions of payment records, admin and reconciliation queries should always include at least one indexed dimension such as `status`, `provider`, `user`, `order`, `utr`, `providerPaymentId`, or a bounded `createdAt` range.

## Transaction Support

All write methods accept `options.session`. This prepares Story 4.3+ for transaction flows such as:

```text
Order transaction
  -> create payment
  -> reserve inventory
  -> update order
  -> commit
```

This repository does not start or commit transactions. Services own transaction boundaries.
