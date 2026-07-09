# Admin Operations API

Sprint 5 adds backend-only admin operations endpoints for payment verification, inventory reservations, financial audit trails, dashboard summaries, and global search.

All endpoints are mounted under `/api/admin/operations`.

## Security

- Authentication: `Authorization: Bearer <jwt>`
- Permission: `admin` role only through the existing `protect` and `authorize('admin')` middleware.
- Rate limiting: inherited from the global `/api` limiter.
- Controllers orchestrate requests only. Payment and inventory actions are delegated to `PaymentService`, `InventoryService`, and `OrderPaymentBridgeService`.
- Sensitive values such as UTRs are not logged by the payment service. Admin detail responses may include operational QR and audit data because these endpoints are admin-only.

## Response Shape

Successful responses:

```json
{
  "success": true,
  "data": {}
}
```

Error responses:

```json
{
  "success": false,
  "message": "Business or validation error"
}
```

Paginated list responses return:

```json
{
  "items": [],
  "pagination": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "pages": 0
  }
}
```

## Payment Queue

`GET /api/admin/operations/payments`

Lists payment attempts for the admin verification queue and historical review.

Query parameters:

- `group`: `pending`, `verified`, `rejected`, `failed`, `expired`
- `status`: exact payment status
- `orderNumber`: partial order number
- `customer`: partial customer name or email
- `book`: book id
- `paymentMethod`: payment method, for example `UPI`
- `dateFrom`, `dateTo`: ISO date range on payment creation
- `amountMin`, `amountMax`: numeric amount range
- `page`, `limit`: pagination
- `sort`: field name, prefix with `-` for descending

Business rules:

- Read-only endpoint.
- Uses indexed payment status, order, user, amount, and created date paths where available.

## Payment Detail

`GET /api/admin/operations/payments/:id`

Returns the single admin payment view:

- Payment state
- Payment intent and QR metadata
- Verification history
- Payment ledger
- Order
- Customer
- Books
- Inventory reservations
- Inventory ledger
- Combined audit timeline

Errors:

- `404` when payment does not exist.

## Payment Actions

`POST /api/admin/operations/payments/:id/approve`

Approves a manual payment by delegating to `OrderPaymentBridgeService.verifyOrderPayment()`. This verifies the payment, writes payment ledger entries, deducts reserved inventory, writes inventory ledger entries, and synchronizes legacy order payment fields inside the existing bridge transaction.

Request body:

```json
{
  "reason": "Bank statement matched"
}
```

`POST /api/admin/operations/payments/:id/reject`

Rejects a manual payment by delegating to `OrderPaymentBridgeService.rejectOrderPayment()`. This rejects the payment, writes ledger entries, releases reserved inventory, and updates compatibility order fields.

`POST /api/admin/operations/payments/:id/cancel`

Cancels an active payment intent with `PaymentService.cancelPayment()` and releases active inventory reservations with `InventoryService.releaseByPayment()` in one MongoDB transaction.

`POST /api/admin/operations/payments/:id/expire`

Expires an active payment intent with `PaymentService.expirePaymentIntent()` and releases active inventory reservations with `InventoryService.releaseByPayment()` in one MongoDB transaction.

`POST /api/admin/operations/payments/:id/retry-verification`

Returns the latest payment detail for operational retry review. It does not mutate payment state.

`POST /api/admin/operations/payments/:id/recreate-qr`

Regenerates QR metadata through `PaymentService.regenerateQRCode()`.

Business rules:

- Controllers do not mutate payment or inventory state directly.
- Invalid payment transitions are rejected by `PaymentService`.
- Inventory release and deduction are handled by `InventoryService`.
- Order compatibility fields remain synchronized by `OrderPaymentBridgeService`.

## Inventory Operations

`GET /api/admin/operations/inventory/reservations`

Lists reservations.

Query parameters:

- `status`: `RESERVED`, `RELEASED`, `DEDUCTED`, `EXPIRED`, `CANCELLED`
- `book`: book id
- `category`: category id
- `dateFrom`, `dateTo`: ISO date range
- `page`, `limit`, `sort`

`GET /api/admin/operations/inventory/low-stock`

Lists books whose available stock is below the threshold.

Query parameters:

- `threshold`: available-stock threshold, default `5`
- `page`, `limit`

## Financial Audit

`GET /api/admin/operations/ledger/payments`

Lists payment ledger entries.

Query parameters:

- `paymentId`
- `orderId`
- `userId`
- `eventType`
- `dateFrom`, `dateTo`
- `page`, `limit`, `sort`

`GET /api/admin/operations/ledger/inventory`

Lists inventory ledger entries.

Query parameters:

- `reservation`
- `order`
- `payment`
- `book`
- `eventType`
- `dateFrom`, `dateTo`
- `page`, `limit`, `sort`

`GET /api/admin/operations/ledger/timeline`

Returns an export-ready combined payment and inventory timeline sorted by newest event first.

## Dashboard

`GET /api/admin/operations/dashboard`

Returns:

- Today's orders
- Today's revenue
- Pending payments
- Pending reservations
- Low stock books
- Successful payments
- Failed payments
- Revenue today
- Revenue this month
- Recent activity

The response is optimized with counts, small limits, and aggregate queries.

## Global Search

`GET /api/admin/operations/search?q=<term>`

Searches:

- Orders by order number
- Payments by UTR, provider payment id, provider order id, matching order, or matching customer
- Customers by name or email
- Books by title, slug, or ISBN
- Reservations by matching order or book
- Ledger entries by matching references, orders, or books

Query parameters:

- `q`: required search term
- `limit`: max per collection, capped at `25`

## Deployment Notes

- No customer-facing endpoints are changed.
- No request or response contracts for checkout or legacy order APIs are changed.
- Existing global API rate limiting applies automatically.
- Ensure MongoDB indexes for Payment, PaymentLedger, InventoryReservation, InventoryLedger, Order, User, and Book are built before high-traffic admin use.

## Future Compatibility

This admin operations layer prepares for notifications, shipping workflow, invoices, royalties, analytics, and multi-warehouse inventory by exposing payment, order, inventory, and immutable ledger data through stable admin APIs.
