# Payment Verification Workflow

## Scope

Story 4.6 adds the production verification foundation for manual UPI payments. It does not wire controllers, order status updates, notifications, ledgers, gateways, or webhooks.

## Lifecycle

```text
Payment intent
  -> customer pays
  -> customer submits UTR
  -> VERIFICATION_PENDING
  -> admin verifies
  -> PAYMENT_VERIFIED

or

VERIFICATION_PENDING
  -> admin rejects
  -> PAYMENT_REJECTED
```

## UTR Rules

- UTR/reference values are trimmed and uppercased.
- Accepted format: `A-Z`, `0-9`, and `-`, length 6-64.
- A UTR can belong to exactly one payment record.
- A payment attempt can accept only one UTR.
- UTR values are masked in logs.

## Service Ownership

`PaymentService` owns verification business rules:

- active intent required
- unexpired payment required
- cancelled, expired, verified, rejected, and failed payments cannot be verified
- authorized verifier/rejector actor required
- one successful payment per order
- duplicate UTR rejected before persistence
- all status transitions pass through the centralized state machine

The old manual method names remain as compatibility aliases:

- `submitManualUTR()` delegates to `submitUTR()`
- `verifyManualPayment()` delegates to `verifyPayment()`
- `rejectManualPayment()` delegates to `rejectPayment()`

## Repository Ownership

`PaymentRepository` persists verification state only:

- `submitUTR()`
- `verifyPayment()`
- `rejectPayment()`
- `findByVerificationStatus()`
- `findPendingVerification()`
- `lockPaymentForVerification()`

Conditional writes protect against concurrent UTR overwrite and double admin verification.

## Audit Trail

Payment records now capture:

- `submittedAt`
- `verifiedAt`
- `verifiedBy`
- `rejectedAt`
- `rejectedBy`
- `failureReason`
- `statusHistory`

Story 4.7 attaches ledger entries from these status transitions without changing controller contracts.

## Future Gateway Compatibility

Gateway integrations can reuse the same verification states. Webhook handlers should call service methods instead of mutating `Payment` directly, and provider-specific payload checks should live outside the repository.
