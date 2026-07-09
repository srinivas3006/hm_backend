# Inventory Engine

## Purpose

Sprint 4.9 replaces immediate checkout stock deduction with reservation-based inventory management.

`Book.stock` remains the physical stock count for compatibility. `Book.reservedStock` tracks active reservations. Available stock is:

```text
stock - reservedStock
```

## Runtime Flow

```text
Checkout
  -> create Order
  -> create Payment intent
  -> reserve Inventory
  -> generate QR
  -> commit

Payment verified
  -> deduct reserved stock from Book.stock
  -> clear reservedStock
  -> mark reservation DEDUCTED

Payment rejected / expired / order cancelled
  -> release reservation
  -> clear reservedStock
```

## Models

| Model | Purpose |
| --- | --- |
| `Book` | Physical stock and active reserved stock counter. |
| `InventoryReservation` | Reservation per order/payment/book item. |
| `InventoryLedger` | Immutable audit history for inventory events. |

## Reservation Statuses

- `RESERVED`
- `RELEASED`
- `DEDUCTED`
- `EXPIRED`
- `CANCELLED`

## Ledger Events

- `RESERVED`
- `RELEASED`
- `DEDUCTED`
- `RESTORED`
- `ADJUSTED`
- `EXPIRED`

`InventoryLedger` is append-only. Existing records cannot be updated or deleted.

## Repository Methods

`InventoryRepository`:

- `reserveStock()`
- `releaseReservation()`
- `confirmDeduction()`
- `findReservations()`
- `findByOrder()`
- `findByPayment()`
- `findActiveByOrder()`
- `findExpiredReservations()`
- `findLowStock()`
- `searchInventory()`

`InventoryLedgerRepository`:

- `createEntry()`
- `listByReservation()`
- `listByOrder()`
- `listByPayment()`
- `listByBook()`
- `listByEvent()`
- `search()`

## Service Methods

`InventoryService` owns inventory business rules:

- `reserveOrderItems()`
- `releaseByOrder()`
- `releaseByPayment()`
- `releaseReservation()`
- `deductByPayment()`
- `confirmDeduction()`
- `expireReservations()`
- `findReservations()`
- `findLowStock()`
- `searchInventory()`

## Transaction Strategy

Checkout reservation runs in the same MongoDB session as:

```text
Order -> Payment -> InventoryReservation -> InventoryLedger -> QR metadata
```

Verification deduction runs in the same MongoDB session as:

```text
Payment verified -> PaymentLedger -> Inventory deduction -> InventoryLedger -> Order compatibility sync
```

Order cancellation releases reservations in the same session as the order status update.

## Overselling Protection

Reservations atomically increment `Book.reservedStock` only when:

```text
stock - reservedStock >= requested quantity
```

Deduction atomically decrements both `stock` and `reservedStock` only from active reservations.

## Future Compatibility

The current design can add warehouse and print-on-demand dimensions by extending reservations and ledger metadata without changing public order APIs.
