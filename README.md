# HM Backend API

Production Node.js/Express backend for commerce, publishing, payments, inventory, invoices, notifications, shipping, analytics, and admin operations.

## Features

- JWT authentication and role authorization.
- Book catalog, search, authors, publishing requests.
- Order checkout with UPI payment bridge.
- Payment engine with repository/service separation and immutable ledger.
- Reservation-based inventory engine with ledger.
- Invoice generation and admin download APIs.
- Asynchronous notification engine.
- Shipping and fulfillment engine.
- Analytics/reporting projections.
- Swagger UI at `/api/docs`.

## Technology Stack

Node.js, Express 5, MongoDB, Mongoose, Jest, Supertest, Swagger, Winston, Cloudinary, Resend, QRCode.

## Installation

```bash
npm install
cp .env.example .env # if present, otherwise create .env from docs/deployment.md
npm run dev
```

## Documentation

- Swagger UI: `/api/docs`
- OpenAPI JSON: `docs/openapi.json`
- OpenAPI YAML: `docs/openapi.yaml`
- Postman: `docs/postman_collection.json`
- Frontend guide: `docs/frontend-api-guide.md`
- Architecture: `docs/architecture.md`
- Deployment: `docs/deployment.md`

## Testing

```bash
npm test
```

Known issues: generic parameter route ordering should be reviewed before adding new nested public routes.

## Roadmap

Royalty system, GST/tax extensions, BI dashboards, multi-warehouse inventory, AI insights.

## License

ISC.
