# Dynamic UPI QR Generation

## Purpose

Story 4.5 adds provider-agnostic dynamic QR generation for active payment intents. It does not verify payment, update orders, call gateways, or expose any new routes.

## Architecture

```text
Future Controller
  -> PaymentService
  -> QR Service
  -> QR Provider
  -> qrcode renderer
```

Current implementation:

| Layer | File | Responsibility |
| --- | --- | --- |
| Business rules | `src/services/paymentService.js` | Checks active intent, expiry, amount lock, cancellation, reuse/regeneration. |
| Persistence | `src/repositories/paymentRepository.js` | Saves and reads QR metadata. |
| QR provider contract | `src/payments/qr/qrCodeProvider.js` | Base provider interface. |
| UPI provider | `src/payments/qr/upiQRCodeService.js` | Builds UPI URI and QR data URL. |
| Config | `src/config/payment.js` | Reads merchant/payment env config. |

## Configuration

| Environment Variable | Purpose |
| --- | --- |
| `MERCHANT_UPI_ID` | Required UPI VPA, such as `merchant@upi`. |
| `MERCHANT_NAME` | Required payee display name. |
| `MERCHANT_CODE` | Optional UPI merchant category/code. |
| `PAYMENT_CURRENCY` | Optional currency, defaults to `INR`. |
| `QR_EXPIRY_MINUTES` | Optional default QR expiry duration. |

## UPI Payload

The UPI URI uses:

| UPI Parameter | Source |
| --- | --- |
| `pa` | Merchant UPI ID |
| `pn` | Merchant/payee name |
| `am` | Locked payment intent amount |
| `cu` | Currency, usually `INR` |
| `tn` | Transaction note |
| `tr` | Payment transaction reference |
| `mc` | Optional merchant code |

Example shape:

```text
upi://pay?pa=merchant%40upi&pn=Harglim+Publishers&am=499.00&cu=INR&tn=Order+HM-123&tr=PAY-...
```

## Service Methods

| Method | Purpose |
| --- | --- |
| `generateQRCode(paymentId, options)` | Generates or reuses a dynamic UPI QR for an active payment intent. |
| `regenerateQRCode(paymentId, options)` | Forces QR regeneration when business rules allow it. |
| `getQRCode(paymentId, options)` | Returns an existing valid QR. |
| `validateQRCodeGeneration(payment, options)` | Validates active intent, expiry, amount, and allowed state. |

## Repository Methods

| Method | Purpose |
| --- | --- |
| `saveQRCodeMetadata(paymentId, qrMetadata, options)` | Persists raw UPI URI, QR data URL, timestamps, metadata, and status. |
| `findLatestQRCode(paymentId, options)` | Reads the latest QR metadata for a payment. |

## QR Response Shape

```json
{
  "paymentId": "...",
  "order": "...",
  "status": "QR_GENERATED",
  "amount": 499,
  "currency": "INR",
  "upiUri": "upi://pay?...",
  "qrImage": "data:image/png;base64,...",
  "qrCodeDataUrl": "data:image/png;base64,...",
  "qrGeneratedAt": "2026-07-08T10:00:00.000Z",
  "qrExpiresAt": "2026-07-08T10:15:00.000Z",
  "metadata": {
    "provider": "manual_upi",
    "type": "DYNAMIC_UPI_QR",
    "orderReference": "HM-123",
    "intentId": "...",
    "transactionReference": "PAY-..."
  }
}
```

## Business Rules

- QR generation is allowed only for active payment intents.
- QR amount must match the locked payment intent amount.
- Expired or cancelled intents cannot generate QR.
- Existing valid QR metadata is reused by default.
- Explicit regeneration is supported through `regenerateQRCode()`.
- QR expiry never exceeds intent expiry.
- Full UPI URI is stored for frontend use but is not logged.

## Future Compatibility

Future providers can implement the same QR provider interface:

- Razorpay QR
- PhonePe QR
- Cashfree QR
- Static QR
- Other gateway QR providers

`PaymentService` should not need provider-specific branching when those adapters are added.
