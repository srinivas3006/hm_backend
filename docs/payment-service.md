# Payment Service

## Purpose

`src/services/paymentService.js` owns payment business logic. It never imports the `Payment` model directly. All database access goes through `PaymentRepository`.

This service is not wired into controllers or routes in Story 4.3. Existing manual UPI APIs continue using the legacy flow until later stories integrate the service.

## Canonical Statuses

The service uses production `PAYMENT_*` statuses while remaining compatible with older short statuses stored by Story 4.1:

| Legacy | Canonical |
| --- | --- |
| `PENDING` | `PAYMENT_PENDING` |
| `SUBMITTED` | `PAYMENT_SUBMITTED` |
| `VERIFIED` | `PAYMENT_VERIFIED` |
| `FAILED` | `PAYMENT_FAILED` |
| `EXPIRED` | `PAYMENT_EXPIRED` |
| `CANCELLED` | `PAYMENT_CANCELLED` |

## Supported Transitions

```text
INTENT_CREATED -> QR_PENDING -> QR_GENERATED -> PAYMENT_PENDING -> PAYMENT_SUBMITTED -> VERIFICATION_PENDING -> PAYMENT_VERIFIED
PAYMENT_PENDING -> PAYMENT_FAILED
PAYMENT_PENDING -> PAYMENT_EXPIRED
VERIFICATION_PENDING -> PAYMENT_REJECTED
VERIFICATION_PENDING -> PAYMENT_FAILED
PAYMENT_VERIFIED -> REFUND_REQUESTED -> REFUND_APPROVED -> REFUNDED
```

Manual UPI compatibility also allows direct `PAYMENT_SUBMITTED` from early intent states.
Manual UPI rejection is represented by `PAYMENT_REJECTED`; generic processing failures remain `PAYMENT_FAILED`.

## Public Methods

| Method | Purpose | Return Value | Business Rules / Side Effects | Exceptions |
| --- | --- | --- | --- | --- |
| `createPayment(paymentData, options)` | Create a generic payment attempt. | Payment document | Blocks creation if order already has successful payment or supplied order status is terminal. Logs creation. | `PaymentCreationNotAllowedError`, `PaymentAlreadyVerifiedError`, service data errors |
| `createManualPayment(paymentData, options)` | Create manual UPI attempt. | Payment document | Forces `provider = manual_upi`, `paymentMethod = UPI`. | Same as `createPayment` |
| `createGatewayPayment(paymentData, options)` | Create future gateway attempt. | Payment document | Requires provider but does not hardcode provider names. | `PaymentCreationNotAllowedError` |
| `createPaymentIntent(intentData, options)` | Create an active payment intent. | Payment document | Validates amount against order amount, expires previous active intent, blocks cancelled/completed orders and already-paid orders. | `PaymentCreationNotAllowedError`, `PaymentIntentAmountMismatchError` |
| `getActivePaymentIntent(orderId, options)` | Find the active non-expired intent for an order. | Payment or `null` | No mutation. | service-mapped repository errors |
| `validateIntent(intent, expected)` | Validate active intent ownership, expiry, and amount. | `true` | Rejects inactive/expired/wrong-owner/wrong-amount intents. | `PaymentIntentInactiveError`, `PaymentExpiredError`, `PaymentOwnershipError`, `PaymentIntentAmountMismatchError` |
| `canCreateIntent(orderId, options)` | Check whether intent creation is allowed. | boolean | False when future caller supplies terminal order status or order has successful payment. | service data errors |
| `cancelIntent(paymentId, actor, options)` | Cancel an active payment intent. | Updated payment | Clears `activeIntent`, sets `PAYMENT_CANCELLED`. | transition/ownership/expiry errors |
| `generateQRCode(paymentId, options)` | Generate or reuse dynamic UPI QR for an active intent. | QR response object | Validates active intent, amount, expiry, and allowed state; stores QR metadata. | `PaymentQRCodeGenerationError`, `PaymentExpiredError`, `PaymentIntentAmountMismatchError` |
| `regenerateQRCode(paymentId, options)` | Force QR regeneration. | QR response object | Same as `generateQRCode`, but bypasses valid QR reuse. | Same as `generateQRCode` |
| `getQRCode(paymentId, options)` | Read an existing valid QR. | QR response object | Rejects missing, expired, inactive, or wrong-owner QR. | `PaymentQRCodeUnavailableError`, `PaymentExpiredError` |
| `validateQRCodeGeneration(payment, options)` | Validate QR generation rules. | `true` | Active intent only, amount locked, no cancelled/expired/submitted payments. | payment service errors |
| `getPayment(paymentId, options)` | Fetch required payment. | Payment | No business mutation. | service-mapped not-found/invalid-id errors |
| `getPaymentByOrder(orderId, options)` | Fetch payments for order. | Payment array | No business mutation. | service-mapped invalid-id errors |
| `listPaymentAttempts(orderId, pagination, options)` | Paginate order attempts. | `{ items, pagination }` | No business mutation. | service-mapped invalid-id errors |
| `submitUTR(paymentId, utr, actor, options)` | Submit customer UTR for a manual payment attempt. | Updated payment | Validates UTR format, ownership, active intent, expiry, duplicate UTR, one UTR per attempt, and moves to `VERIFICATION_PENDING`. Logs masked UTR only. | `InvalidUTRError`, `DuplicateUTRError`, `PaymentUTRAlreadySubmittedError`, `PaymentExpiredError`, `PaymentOwnershipError`, `InvalidPaymentTransitionError` |
| `submitManualUTR(paymentId, utr, actor, options)` | Backward-compatible alias for manual UPI UTR submission. | Updated payment | Delegates to `submitUTR`. | Same as `submitUTR` |
| `verifyPayment(paymentId, verifier, options)` | Verify a payment after admin/manual review. | Updated payment | Requires actor, active intent, pending verification state, expiry check, and one-successful-payment rule. | `PaymentVerificationAuthorizationError`, `PaymentAlreadyVerifiedError`, `PaymentExpiredError`, `PaymentIntentInactiveError`, `InvalidPaymentTransitionError` |
| `verifyManualPayment(paymentId, verifier, options)` | Backward-compatible alias for manual UPI verification. | Updated payment | Delegates to `verifyPayment`. | Same as `verifyPayment` |
| `rejectPayment(paymentId, rejector, options)` | Reject manual payment verification. | Updated payment | Requires actor, active intent, pending verification state, and records rejection audit data. | `PaymentVerificationRejectedError`, transition errors |
| `rejectManualPayment(paymentId, rejector, options)` | Backward-compatible alias for manual UPI rejection. | Updated payment | Delegates to `rejectPayment`. | Same as `rejectPayment` |
| `validateUTR(utr)` | Validate and normalize UTR/reference. | uppercase string | Accepts 6-64 uppercase letters, numbers, and hyphens after trimming. | `InvalidUTRError` |
| `canVerifyPayment(payment, verifier, options)` | Validate admin verification preconditions. | `true` | Requires authorized actor, active intent, unexpired payment, and submitted/pending status. | verification/transition errors |
| `getPendingVerifications(pagination, options)` | Paginate active payments awaiting verification. | `{ items, pagination }` | No mutation. | service-mapped repository errors |
| `expirePaymentIntent(paymentId, options)` | Expire an active payment. | Updated payment | Uses state machine. | `InvalidPaymentTransitionError` |
| `cancelPayment(paymentId, actor, options)` | Cancel an unpaid payment. | Updated payment | Blocks completed payments. | `PaymentAlreadyCompletedError` |
| `markPaymentFailed(paymentId, actor, options)` | Mark payment failed. | Updated payment | Uses state machine. | `InvalidPaymentTransitionError` |
| `markPaymentSuccessful(paymentId, actor, options)` | Mark payment successful. | Updated payment | Checks expiry, completion, one-successful-payment rule. | `PaymentAlreadyVerifiedError`, `PaymentExpiredError` |
| `findActivePayment(orderId, options)` | Find active payment intent. | Payment or `null` | No mutation. | service-mapped invalid-id errors |
| `canCreatePaymentAttempt(orderId, options)` | Check attempt eligibility. | boolean | False if order status is terminal or successful payment exists. | service data errors |
| `validatePaymentOwnership(payment, expected)` | Check expected order/user ownership. | `true` | Throws if mismatch. | `PaymentOwnershipError` |
| `validatePaymentTransition(currentStatus, nextStatus)` | Central state machine guard. | `true` | No status can mutate without this rule. | `InvalidPaymentTransitionError` |

## Options

| Option | Purpose |
| --- | --- |
| `session` | Optional MongoDB session for future Order -> Payment -> Inventory transactions. |
| `now` | Testable clock for expiry decisions. |
| `orderStatus` | Optional order status guard until OrderService integration exists. |
| `reason` | Status history reason. |
| `orderAmount` | Order total used to lock and validate intent amount. |
| `expiryMinutes` | Intent expiry duration, defaulting to 15 minutes. |
| `expiresAt` | Explicit expiry timestamp when a caller needs deterministic expiry. |
| `qrExpiryMinutes` | Optional QR expiry duration. It is capped by intent expiry. |
| `qrExpiresAt` | Explicit QR expiry timestamp. It is capped by intent expiry. |

## Logging

The service logs structured events such as:

- `payment.created`
- `payment_intent.created`
- `payment_ledger.entry_created`
- `payment_intent.expired`
- `payment_intent.cancelled`
- `payment_qr.generated`
- `payment_qr.regenerated`
- `payment_qr.reused`
- `payment_qr.expired`
- `payment.utr_submitted`
- `payment.verification_started`
- `payment.verified`
- `payment.rejected`
- `payment.expired`
- `payment.create_blocked`

UTR values are masked before logging. Gateway payloads and sensitive repository fields are never logged.

## Transaction Boundary

The service accepts `options.session` and forwards it to the payment and ledger repositories. It does not create, commit, or abort transactions. Future orchestration services own transaction boundaries.

## Payment Intent Design

Story 4.4 reuses the `Payment` collection instead of adding a separate `PaymentIntent` model. A payment intent is the earliest active state of a payment attempt:

```text
Order -> Payment(activeIntent = true, status = INTENT_CREATED)
```

Reasons:

- It preserves backward compatibility with the manual UPI flow.
- It avoids splitting one payment attempt across two collections.
- It lets future gateway fields, UTR submission, verification, refunds, and ledgers attach to the same payment record.
- The partial unique index on `activeIntent` enforces one active intent per order.

When a new intent is created for the same order, the service first expires the previous active intent, then creates the replacement intent.
