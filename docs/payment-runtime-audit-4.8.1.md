# Payment Runtime Audit 4.8.1

## Runtime Payment State Locations

| Area | File | Payment State Action | Owner |
| --- | --- | --- | --- |
| Checkout controller | `src/controllers/orderController.js` | Delegates order checkout to bridge service. | HTTP only |
| UTR controller | `src/controllers/orderController.js` | Delegates UTR submission to bridge service. | HTTP only |
| Order cancel controller | `src/controllers/orderController.js` | Mutates `Order.status = CANCELLED`. Does not yet cancel Payment intent. | Legacy order behavior |
| Admin order controller | `src/controllers/adminController.js` | Mutates `Order.status` only. | Legacy order behavior |
| Bridge service | `src/services/orderPaymentBridgeService.js` | Creates order, creates payment intent, generates QR, stores `Order.payment`, syncs `Order.utr`, `Order.paymentMethod`, `Order.isPaid`, `Order.paidAt`. | Runtime integration |
| Payment service | `src/services/paymentService.js` | Owns payment business rules, QR generation, UTR validation, verification, status transitions, ledger hooks. | Payment source of truth |
| Payment repository | `src/repositories/paymentRepository.js` | Persists Payment reads/writes only. | Persistence |
| Ledger repository | `src/repositories/paymentLedgerRepository.js` | Appends and reads ledger entries only. | Audit persistence |

## Duplicate Logic Report

| Logic | Current Status | Recommendation |
| --- | --- | --- |
| QR generation | Centralized in `src/payments/qr/upiQRCodeService.js`; controller no longer imports `qrcode`. | No action. |
| UTR validation | Centralized in `PaymentService.validateUTR()` and Payment schema validation. | Keep service validation as runtime guard; schema is persistence guard. |
| Payment transitions | Centralized in `PaymentService.validatePaymentTransition()`. | No action. |
| Payment verification | Centralized in `PaymentService.verifyPayment()`; order bridge delegates. | No action. |
| Order total calculation | Exists in `OrderPaymentBridgeService.buildOrderItems()`. | Keep until inventory/pricing service exists. |
| Stock decrement | Replaced by reservation-based inventory in Story 4.9. | No action. |

## Legacy Code Classification

| Item | Classification | Notes |
| --- | --- | --- |
| `Order.utr` | Keep for Compatibility | Synced from Payment until runtime cleanup. |
| `Order.paymentMethod` | Keep for Compatibility | Synced from Payment. |
| `Order.isPaid` | Keep for Compatibility | Synced from verified Payment. |
| `Order.paidAt` | Keep for Compatibility | Synced from verified Payment timestamp. |
| `Order.status` | Keep for Compatibility | Not changed by payment integration yet. |
| `Order.payment` | Keep | New bridge reference to Payment. |
| `cancelOrder()` not cancelling Payment | Needs Refactoring | Avoid in 4.8.1 because it changes behavior. |
| `adminController.updateOrderStatus()` not payment-aware | Investigate Further | Admin dashboard story should decide how order status and payment state interact. |
| Legacy response fields `upiUrl`, `qrCodeDataUrl`, `amount` | Keep for Compatibility | Mapped from PaymentService QR response. |

## Transaction Audit

| Flow | Transaction Coverage | Risk |
| --- | --- | --- |
| Checkout | Order, stock decrement, Payment intent, QR metadata, Payment ledger, `Order.payment` commit together. | Low |
| UTR submission | Payment UTR, ledger entries, Order compatibility fields, tracking update commit together. | Low |
| Internal verification sync | Payment verified, ledger, Order compatibility fields commit together via bridge. | Low |
| Order cancellation | Order status changes without Payment cancellation. | Medium |
| Admin order status update | Order status changes without Payment checks. | Medium |

## Performance Audit

| Area | Assessment |
| --- | --- |
| Payment lookups | Indexed by order, user, status, provider references, UTR, active intent, successful payment. |
| Ledger lookups | Indexed by payment, order, user, event type, provider/event, createdAt. |
| Order checkout | One query per order item for Book lookup, followed by atomic InventoryService reservation. |
| Admin/reporting | Payment and ledger repositories paginate. Existing admin order list is unpaginated and should be addressed in dashboard work. |
| Scale | Payment/ledger layer is suitable for 1M payment records if indexed filters are used. Order/admin lists need pagination before high-volume admin usage. |

## Security Audit

| Area | Assessment |
| --- | --- |
| UTR logs | PaymentService masks UTR in logs. |
| Order tracking text | Stores full UTR in customer-visible order tracking for legacy compatibility. |
| Ownership | UTR endpoint enforces order owner before submission. PaymentService also validates order/user ownership. |
| Admin verification | Internal bridge method requires verifier id, but no admin route is wired yet. |
| Sensitive QR/gateway fields | Payment repository hides sensitive fields unless explicitly requested. |
| Response exposure | Checkout response preserves legacy QR fields only. |

## API Compatibility Audit

| Endpoint | Compatibility |
| --- | --- |
| `POST /api/orders` | Request unchanged. Response still returns `{ success, data: { order, payment: { upiUrl, qrCodeDataUrl, amount } } }`. |
| `PUT /api/orders/:id/verify-payment` | Request unchanged: `{ utr }`. Response still returns updated Order. |
| `GET /api/orders/track/:orderNumber` | Unchanged. |
| `DELETE /api/orders/:id` | Unchanged. |

## Code Quality Scores

| Area | Score | Notes |
| --- | --- | --- |
| Service boundaries | 8.5/10 | Payment rules are in PaymentService; order bridge orchestrates runtime. |
| Repository boundaries | 9/10 | Repositories contain persistence-only logic. |
| Controller thinness | 8/10 | Order payment logic removed; cancel remains legacy. |
| Transaction design | 8/10 | Core payment flows atomic; cancel/admin status pending. |
| Security posture | 8/10 | Ownership and masked logs in place; full UTR remains in legacy order tracking. |
| Performance readiness | 8/10 | Payment indexes strong; admin/order listing still needs pagination. |
| Documentation | 8.5/10 | Payment docs are comprehensive and Story 4.8 integration is documented. |
| Test organization | 8.5/10 | Focused suites cover model, repository, service, ledger, QR, order bridge. |

## Technical Debt

| Issue | Severity | Risk | Recommendation | Safe to Fix Now? |
| --- | --- | --- | --- | --- |
| `cancelOrder()` does not cancel active Payment intent | Medium | Customer can submit/pay against a cancelled order if QR remains valid. | In a future cleanup, call `PaymentService.cancelPayment()` or bridge cancellation inside transaction. | No |
| `adminController.updateOrderStatus()` is payment-unaware | Medium | Admin may move unpaid orders to operational states. | Story 4.11 should consume Payment/PaymentLedger. | No |
| Full UTR in order tracking description | Low | Customer-visible and database-stored full UTR. | Mask in future only if frontend accepts the display change. | No |
| Order item queries are per item | Low | Checkout cost grows with cart size. | Future optimization can batch reads before reservation. | No |
| Admin order list unpaginated | Medium | Poor admin performance at scale. | Add pagination in Admin Dashboard story. | No |

## Cleanup Applied

| File | Change | Reason | Safety |
| --- | --- | --- | --- |
| `src/controllers/orderController.js` | Corrected route comment from `/api/orders/checkout` to `/api/orders`. | Documentation/comment accuracy. | Comment-only; runtime unchanged. |

## Readiness Assessment

The Payment Engine is now the source of truth for payment state in the runtime checkout and UTR submission path. Legacy Order fields remain as synchronized compatibility fields.

Inventory Integration can begin with one caution: order cancellation should be payment-aware before broad production rollout. Notification Integration can begin from PaymentService/PaymentLedger events. Admin Dashboard can consume Payment and Ledger, but should avoid relying only on legacy Order payment fields.

Production readiness score for Payment module: 86/100.

Payment Architecture Approved for Inventory Integration.
