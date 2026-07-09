# Order Payment Integration

## Scope

Story 4.8 bridges the existing order runtime to the new payment engine without changing public order endpoints, request payloads, or response envelopes.

No authentication, inventory module, publishing, royalty, notification, admin dashboard, accounting, invoice, or gateway integration was added.

## Existing Runtime Reused

The order flow already had:

- `POST /api/orders`
- `PUT /api/orders/:id/verify-payment`
- `DELETE /api/orders/:id`
- `GET /api/orders/track/:orderNumber`
- `Order.status`
- `Order.utr`
- `Order.isPaid`
- `Order.paymentMethod`
- `Order.paidAt`
- order item price lookup from `Book`
- stock availability checks during checkout
- order confirmation email after checkout
- tracking update when UTR is submitted

Those behaviors remain externally compatible.

## New Bridge

`src/services/orderPaymentBridgeService.js` now coordinates:

```text
Existing Order API
  -> OrderPaymentBridgeService
  -> PaymentService
  -> PaymentRepository
  -> Payment
  -> PaymentLedger
```

Controllers keep HTTP request/response behavior. Payment business rules remain in `PaymentService`.

## Checkout Transaction

```text
Start MongoDB session
  -> validate items
  -> read Book prices
  -> reserve inventory
  -> create Order
  -> create Payment intent
  -> generate dynamic UPI QR
  -> store Order.payment reference
  -> commit
```

If payment intent, inventory reservation, or QR generation fails, the transaction rolls back the order, payment, ledger, reservation, and stock counter writes.

## UTR Submission Transaction

```text
Start MongoDB session
  -> load Order
  -> authorize customer ownership
  -> resolve Order.payment or active payment
  -> PaymentService.submitUTR()
  -> sync Order.utr, Order.paymentMethod, Order.isPaid
  -> add legacy tracking update
  -> commit
```

The existing endpoint still returns the updated `Order` object.

## Compatibility Fields

The Payment record is now the source of truth. These Order fields remain compatibility fields:

- `payment`
- `isPaid`
- `paidAt`
- `paymentMethod`
- `utr`
- `status`

`Order.status` remains unchanged by payment integration in this story.

## Response Compatibility

Checkout still returns:

```json
{
  "success": true,
  "data": {
    "order": {},
    "payment": {
      "upiUrl": "upi://pay?...",
      "qrCodeDataUrl": "data:image/png;base64,...",
      "amount": 470
    }
  }
}
```

The `payment` response is produced by `PaymentService.generateQRCode()` but mapped back to the legacy shape.

## Future Cleanup Path

Story 4.12 can deprecate direct use of `Order.utr`, `Order.paymentMethod`, `Order.isPaid`, and `Order.paidAt` once all clients and reports read from Payment/PaymentLedger.
