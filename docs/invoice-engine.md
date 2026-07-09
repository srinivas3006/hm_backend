# Invoice Engine

Sprint 7 adds a production-oriented invoice engine for official financial documents.

Invoices are generated only after successful payment verification and are available to admins for listing, viewing, searching, and download.

## Architecture

```text
PaymentService
  -> PaymentVerified event
    -> InvoiceSubscriber
      -> InvoiceService
        -> InvoiceRepository
          -> Invoice Model
        -> InvoicePdfGenerator
        -> InvoiceGenerated event
```

Controllers remain orchestration-only. Invoice business rules live in `InvoiceService`. Persistence lives in `InvoiceRepository`. PDF generation is isolated behind `InvoicePdfGenerator`.

## Lifecycle

```text
Payment Verified
  -> PaymentVerified event published
  -> Invoice subscriber receives event
  -> InvoiceService validates payment success
  -> Invoice number assigned
  -> Invoice persisted
  -> PDF document generated and stored
  -> InvoiceGenerated event published
  -> Admin can view or download invoice
```

Invoice generation is idempotent. One order and one payment can produce only one invoice.

## Numbering Strategy

Invoice numbers use an atomic monthly counter:

```text
INV-YYYYMM-000001
```

Example:

```text
INV-202607-000001
```

The counter is stored in the reusable `Counter` model with keys such as `invoice:2026:07`. The counter is incremented with `findOneAndUpdate(..., $inc, upsert)` so concurrent invoice generation receives unique sequences.

Gaps are acceptable if a transaction rolls back after a sequence is reserved in a future non-transactional adapter. With MongoDB transactions, counter increments roll back when the transaction is aborted.

## Event Flow

Consumed:

- `PaymentVerified`

Published:

- `InvoiceGenerated`

`InvoiceGenerated` is published only after invoice creation succeeds. When invoice generation runs inside a MongoDB session, the event is deferred through the event bus and flushed only after commit.

## Repository

`InvoiceRepository` contains persistence only.

Methods:

- `createInvoice(invoiceData, options)`
- `nextSequence(key, options)`
- `findById(id, options)`
- `getById(id, options)`
- `findByOrder(orderId, options)`
- `findByPayment(paymentId, options)`
- `findByInvoiceNumber(invoiceNumber, options)`
- `listInvoices(filters, pagination, options)`
- `searchInvoices(filters, pagination, options)`

## Service

`InvoiceService` owns invoice business rules.

Methods:

- `generateForPayment(paymentId, options)`
- `generateFromPaymentVerifiedEvent(event)`
- `regenerateDocument(invoiceId, options)`
- `getInvoice(id, options)`
- `getInvoiceDocument(id, options)`
- `listInvoices(filters, pagination, options)`
- `searchInvoices(filters, pagination, options)`
- `generateInvoiceNumber(options)`
- `withTransaction(handler)`

Business rules:

- Payment must be `PAYMENT_VERIFIED`.
- Payment must have `successfulPayment = true`.
- Existing invoice is returned for duplicate generation requests.
- One invoice per order.
- One invoice per payment.
- Original invoice is not replaced during document regeneration; regeneration metadata is appended.

## PDF Abstraction

`InvoicePdfGenerator` generates a PDF buffer and returns:

- `buffer`
- `contentType`
- `fileName`
- `template`
- `checksum`

The service depends on this abstraction, not a specific PDF library. A future implementation can use PDFKit, Puppeteer, or a template renderer without changing invoice business rules.

## Admin APIs

All routes reuse existing admin authentication and authorization.

```text
GET /api/admin/invoices
GET /api/admin/invoices/search
GET /api/admin/invoices/:id
GET /api/admin/invoices/:id/download
```

Supported list/search filters:

- `invoiceNumber`
- `status`
- `order`
- `payment`
- `customer`
- `dateFrom`
- `dateTo`
- `amountMin`
- `amountMax`
- `q` or `search`
- `page`
- `limit`

Download returns `application/pdf` with an attachment filename.

## Future GST Compatibility

The invoice model includes:

- Item tax amounts
- Invoice tax total
- `taxMetadata`
- Currency
- Regeneration history
- Flexible metadata

Future GST work can add GSTIN, HSN/SAC, place of supply, tax split, reverse charge, and filing references without changing the invoice lifecycle.

## Future Modules

This engine prepares for:

- Customer notifications
- Email invoice delivery
- Shipping documents
- GST/tax extensions
- Analytics
- Financial reporting
