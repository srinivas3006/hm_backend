# Analytics & Reporting Engine

Sprint 10 adds an event-driven analytics projection and admin reporting APIs.

## Architecture

```text
Domain Events
  -> Analytics Subscriber
    -> AnalyticsService
      -> AnalyticsRepository
        -> AnalyticsEvent projection
      -> ReportGenerator
        -> Admin Analytics APIs
```

Analytics logic is not placed inside Payment, Inventory, Invoice, Notification, or Shipping services.

## Data Flow

The analytics subscriber consumes existing events and stores read-optimized `AnalyticsEvent` documents. Reports aggregate from this projection instead of repeatedly scanning operational collections.

Consumed events:

- `OrderCreated`
- `PaymentVerified`
- `PaymentRejected`
- `InvoiceGenerated`
- `InventoryReserved`
- `InventoryReleased`
- `InventoryDeducted`
- `ShipmentCreated`
- `ShipmentDelivered`

`NotificationSent` is documented as a future source; it is not emitted by the current Notification Engine.

## Aggregation Strategy

`AnalyticsEvent` stores normalized dimensions:

- event type
- occurred date
- day bucket
- order
- payment
- invoice
- shipment
- user
- book
- amount
- quantity
- status

Indexes support event/date, book/event, user/event, and date-window reporting.

## Repository

Methods:

- `recordEvent()`
- `getRevenueSummary()`
- `getBookSales()`
- `getPaymentMetrics()`
- `getShipmentMetrics()`
- `getInventoryMetrics()`
- `getCustomerMetrics()`

## Service

Methods:

- `processEvent()`
- `dashboard()`
- `revenue()`
- `books()`
- `payments()`
- `inventory()`
- `shipments()`
- `customers()`

Reports are export-ready objects with `type`, `generatedAt`, `filters`, and `data`.

## APIs

All routes reuse existing admin auth:

```text
GET /api/admin/analytics/dashboard
GET /api/admin/analytics/revenue
GET /api/admin/analytics/books
GET /api/admin/analytics/payments
GET /api/admin/analytics/inventory
GET /api/admin/analytics/shipments
GET /api/admin/analytics/customers
```

Common filters:

- `dateFrom`
- `dateTo`
- `period`: `daily`, `weekly`, `monthly`, `yearly`
- `page`
- `limit`
- `book`
- `user`

## Future BI Compatibility

The projection model can later be streamed into a warehouse, BI tool, or durable event lake without changing business services.

Future extensions:

- Royalty system inputs
- Recommendation engine signals
- AI insights
- Executive dashboards
- Notification delivery analytics once `NotificationSent` is emitted
