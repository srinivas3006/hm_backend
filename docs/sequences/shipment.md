# Shipment Sequence

```mermaid
sequenceDiagram
  Admin->>AdminShipmentController: create/manage shipment action
  AdminShipmentController->>ShipmentService: orchestrate action
  ShipmentService->>ShipmentRepository: persist shipment
  ShipmentService->>ShipmentLedgerRepository: append status
  ShipmentService->>EventBus: publish shipment event
```
