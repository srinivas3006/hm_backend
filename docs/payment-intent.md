# Payment Intent

## Purpose

A payment intent represents the customer's intention to pay before a payment is submitted or verified.

Story 4.4 uses the existing `Payment` model with `activeIntent = true` instead of introducing a separate `PaymentIntent` model.

## Why Reuse Payment

```text
Order
  -> Payment Intent
  -> QR Generation later
  -> Payment Submission
  -> Verification
  -> Success / Failure
```

All of these states belong to one payment attempt. Keeping them in one `Payment` document avoids duplicate lifecycle records and keeps future gateway integrations provider-agnostic.

## Lifecycle

```text
INTENT_CREATED
  -> QR_PENDING
  -> QR_GENERATED
  -> PAYMENT_PENDING
  -> PAYMENT_SUBMITTED
  -> VERIFICATION_PENDING
  -> PAYMENT_VERIFIED
```

Failure states:

```text
PAYMENT_EXPIRED
PAYMENT_CANCELLED
PAYMENT_FAILED
```

Refund states are scaffolded only:

```text
REFUND_REQUESTED
REFUND_APPROVED
REFUNDED
```

## Business Rules

- One active payment intent per order.
- Creating a new intent expires the previous active intent.
- Intent amount must match the supplied order amount.
- Intent amount is treated as immutable by the service after creation.
- Intent belongs to one order and one user.
- Intent has configurable expiry.
- Expired intents cannot be reused.
- Completed payments block new intent creation.
- Cancelled orders block new intent creation when future callers pass `orderStatus`.
- Failed/expired/cancelled intent records remain for audit/history.

## Repository Methods

| Method | Purpose |
| --- | --- |
| `createIntent()` | Persists an active intent. |
| `expireActiveIntent()` | Expires the current active intent for an order before replacement. |
| `findActiveIntent()` | Finds the current active non-expired intent. |
| `findExpiredIntents()` | Finds expired active intents for future cleanup jobs. |
| `findIntentByOrder()` | Lists intent/payment attempts for one order. |

## Service Methods

| Method | Purpose |
| --- | --- |
| `createPaymentIntent()` | Creates a new active intent after business-rule checks. |
| `getActivePaymentIntent()` | Gets the active intent for an order. |
| `validateIntent()` | Confirms ownership, active status, expiry, and amount. |
| `canCreateIntent()` | Checks whether intent creation is allowed. |
| `cancelIntent()` | Cancels an active intent. |
| `expirePaymentIntent()` | Expires an intent by id. |

## Expiry Strategy

Default expiry is 15 minutes. Callers may pass:

- `expiryMinutes`
- `expiresAt`
- `now` for deterministic testing or orchestrated jobs

No background cleanup job is implemented in Story 4.4. `findExpiredIntents()` and `markExpiredPayments()` prepare for that future job.

## Future Compatibility

The intent is provider-agnostic:

- Manual UPI can submit UTR against the same record.
- Dynamic QR generation can move status to `QR_PENDING` and `QR_GENERATED`.
- Razorpay/Cashfree/PhonePe/Stripe adapters can store provider IDs on the same record.
- Payment verification can mark the same record successful.
- Ledger and order integration can subscribe to the verified transition later.
