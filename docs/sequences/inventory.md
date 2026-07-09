# Inventory Sequence

```mermaid
sequenceDiagram
  OrderPaymentBridgeService->>InventoryService: reserve stock
  InventoryService->>InventoryRepository: create reservation
  PaymentService->>InventoryService: deduct or release
  InventoryService->>InventoryLedgerRepository: append event
```
