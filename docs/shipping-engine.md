# Shipping & Fulfillment Engine

Sprint 9 adds a shipment and fulfillment engine integrated with orders, payments, invoices, the event bus, and notifications.

## Architecture

```text
InvoiceGenerated / PaymentVerified / OrderCancelled events
  -> Shipment Subscriber
    -> ShipmentService
      -> ShipmentRepository
      -> ShipmentLedgerRepository
      -> Courier Adapter
      -> Event Bus
```

Controllers are thin. Shipping business rules live in `ShipmentService`. Persistence lives in repositories. Courier-specific behavior lives in adapters.

## Shipment Lifecycle

```text
Payment Verified
  -> Invoice Generated
  -> Shipment Created
  -> Courier Assigned
  -> Pickup Scheduled
  -> Picked Up
  -> In Transit
  -> Out For Delivery
  -> Delivered
  -> Completed
```

Cancellation is supported before dispatch. Return states are scaffolded for future work but not implemented.

## Courier Adapter Design

Working:

- `manual`

Provider-ready placeholders:

- `shiprocket`
- `delhivery`
- `bluedart`
- `dtdc`
- `indiapost`

`ShipmentService` never contains provider-specific courier code.

## Tracking Model

`Shipment` stores:

- tracking number
- tracking URL
- current shipment status
- pickup, dispatch, delivery, and estimated delivery dates
- tracking history
- package scaffolding for future multi-package shipments

Order `trackingUpdates` are synchronized from shipment status changes for backward compatibility.

## Shipment Ledger

`ShipmentLedger` is append-only and records:

- `SHIPMENT_CREATED`
- `COURIER_ASSIGNED`
- `PICKUP_SCHEDULED`
- `PICKED_UP`
- `IN_TRANSIT`
- `OUT_FOR_DELIVERY`
- `DELIVERED`
- `COMPLETED`
- `CANCELLED`
- `RETURNED`

Existing ledger records cannot be updated or deleted.

## Event Flow

Subscribed:

- `PaymentVerified`
- `InvoiceGenerated`
- `OrderCancelled`
- `InventoryReleased`

Published:

- `ShipmentCreated`
- `CourierAssigned`
- `ShipmentDispatched`
- `ShipmentDelivered`
- `ShipmentCancelled`

Shipment events are also available to the Notification Engine.

## Repository

`ShipmentRepository` methods:

- `createShipment()`
- `assignCourier()`
- `updateTracking()`
- `updateStatus()`
- `findByOrder()`
- `findByTrackingNumber()`
- `listShipments()`
- `searchShipments()`

`ShipmentLedgerRepository` methods:

- `createEntry()`
- `listByShipment()`
- `listByOrder()`
- `search()`

## Service

`ShipmentService` methods:

- `createShipmentForInvoice()`
- `createFromInvoiceGeneratedEvent()`
- `assignCourier()`
- `updateStatus()`
- `cancelShipment()`
- `cancelByOrder()`
- `getShipment()`
- `getShipmentByOrder()`
- `getTracking()`
- `listShipments()`
- `searchShipments()`
- `withTransaction()`

Business rules:

- Shipment requires `PAYMENT_VERIFIED`.
- Shipment requires generated invoice.
- One active shipment per order.
- Shipment creation is idempotent.
- Tracking numbers are unique.
- Invalid status transitions are rejected.

## API Reference

Admin:

```text
GET /api/admin/shipments
GET /api/admin/shipments/search
GET /api/admin/shipments/:id
GET /api/admin/shipments/:id/tracking
POST /api/admin/shipments/:id/assign-courier
POST /api/admin/shipments/:id/update-status
POST /api/admin/shipments/:id/cancel
```

Customer:

```text
GET /api/orders/:id/shipment
GET /api/orders/:id/tracking
```

Customer routes enforce order ownership through the existing auth middleware.

## Future Webhook Integration

Courier webhook handlers can map provider payloads into `ShipmentService.updateStatus()` and `ShipmentRepository.updateTracking()` without changing controllers or business services.

## Future Compatibility

The engine prepares for returns, refunds, analytics, royalty distribution triggers, multi-warehouse routing, courier webhooks, and international shipping.
