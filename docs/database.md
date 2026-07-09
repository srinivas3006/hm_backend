# Database Documentation

Collections documented: 17

- `analyticsevents`
- `books`
- `categories`
- `counters`
- `inventoryledgers`
- `inventoryreservations`
- `invoices`
- `notifications`
- `orders`
- `payments`
- `paymentledgers`
- `publishpackages`
- `publishrequests`
- `reviews`
- `shipments`
- `shipmentledgers`
- `users`

Primary relationships:

- User -> Orders, Payments, Notifications, Shipments, Analytics events.
- Order -> Payment attempts, Inventory reservations, Invoice, Shipment.
- Payment -> PaymentLedger entries and Invoice.
- InventoryReservation -> InventoryLedger entries.
- Shipment -> ShipmentLedger entries.

Transactions are used by payment, inventory, invoice, order bridge, and shipping service paths where atomic writes are required.

```mermaid
erDiagram
  User ||--o{ Order : places
  User ||--o{ Payment : owns
  Order ||--o{ Payment : has_attempts
  Payment ||--o{ PaymentLedger : records
  Order ||--o{ InventoryReservation : reserves
  InventoryReservation ||--o{ InventoryLedger : records
  Order ||--o| Invoice : produces
  Order ||--o| Shipment : fulfills
  Shipment ||--o{ ShipmentLedger : records
  User ||--o{ Notification : receives
  Book ||--o{ Order : purchased
```
