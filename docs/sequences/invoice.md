# Invoice Sequence

```mermaid
sequenceDiagram
  EventBus->>InvoiceSubscriber: PaymentVerified
  InvoiceSubscriber->>InvoiceService: generate invoice
  InvoiceService->>InvoiceRepository: create invoice idempotently
  InvoiceService->>EventBus: InvoiceGenerated
```
