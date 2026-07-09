# Payment Model

## Purpose

The `Payment` model is an additive model introduced for the production payment foundation. It does not replace or remove existing payment fields on `Order`.

Existing `Order` compatibility fields remain authoritative for current clients until later payment integration stories migrate controller/service behavior:

- `Order.status`
- `Order.utr`
- `Order.paymentMethod`
- `Order.isPaid`
- `Order.paidAt`

## Existing Order Payment Fields

`Order` currently stores:

| Field | Purpose |
| --- | --- |
| `isPaid` | Boolean payment completion marker. |
| `paymentMethod` | Existing payment method string, defaulting to `UPI`. |
| `paidAt` | Payment completion timestamp. |
| `utr` | Manual UPI transaction reference submitted by the user. |
| `status` | Order lifecycle status such as `PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`. |

## New Payment Capabilities

The model supports:

- Manual UPI payments through `provider = manual_upi` and `utr`.
- Future payment gateway integrations through generic provider fields.
- Multiple payment attempts per order.
- Only one successful payment per order.
- Only one active payment intent per order.
- Payment status history.
- Refund tracking.
- Sensitive gateway fields excluded from default query selection.

## Payment Relationships

```text
User 1 -> many Payment
Order 1 -> many Payment attempts
Order 1 -> at most one successful Payment
Order 1 -> at most one active Payment Intent
```

The one-successful-payment rule is enforced by a partial unique index on `order` and `successfulPayment`.
The one-active-intent rule is enforced by a partial unique index on `order` and `activeIntent`.

## Provider Extensibility

The `provider` field is a normalized string instead of a hard-coded provider enum. This allows later adapters such as Razorpay, Cashfree, PhonePe, or other gateways without a schema change.

## Migration Notes

This story does not require a data migration because `Payment` is a new collection.

Recommended rollout:

1. Deploy the model with no controller changes.
2. In Story 4.2 and later, write new payment attempts to `Payment` while continuing to update legacy `Order` fields.
3. Backfill historical payments from existing orders only if reporting requires it.
4. Do not remove legacy `Order` fields until all clients and reports are migrated.

## Rollback Notes

Because this is additive, rollback is low risk:

1. Stop importing or writing the `Payment` model.
2. Existing order payment behavior continues to use legacy `Order` fields.
3. The unused `payments` collection can remain in MongoDB until cleanup is explicitly approved.
