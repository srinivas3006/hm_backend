# Environment Configuration

This document is generated from actual environment references in `server.js`, `src/**`, `scripts/**`, and `tests/**`. It intentionally excludes variables that are not read by the source code.

## Runtime Inventory

| Variable | Required | Default | Used in | Purpose | Production recommendation | Example placeholder | Sensitive |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | Optional | non-production behavior when unset | `server.js`, `src/utils/logger.js` | Controls server startup, stack traces, and logger transports. | Set to `production` in production. | `production` | No |
| `PORT` | Optional | `5000` | `server.js` | HTTP server port. | Set explicitly behind PM2/Nginx/container runtime. | `5000` | No |
| `MONGODB_URI` | Required | None | `src/config/database.js` | MongoDB connection string. | Use a production MongoDB replica set/Atlas URI with credentials from a secret manager. | `mongodb://localhost:27017/hm_backend` | Yes |
| `JWT_SECRET` | Required for production | `secret123` fallback exists | `src/utils/tokenUtils.js`, `src/middleware/authMiddleware.js`, tests | Signs and verifies JWTs. | Must be a long random secret; never use fallback in production. | `CHANGE_ME_TO_A_LONG_RANDOM_PRODUCTION_SECRET` | Yes |
| `JWT_EXPIRE` | Optional | `30d` | `src/utils/tokenUtils.js` | JWT expiry duration. | Use short expiry aligned to frontend session policy. | `7d` | No |
| `MERCHANT_UPI_ID` | Required for QR payment generation | None | `src/config/payment.js`, tests | Merchant UPI VPA for dynamic QR generation. | Configure a valid production merchant VPA. | `merchant@upi` | No |
| `MERCHANT_NAME` | Required for QR payment generation | None | `src/config/payment.js`, tests | Merchant display name in UPI QR payload. | Use the legal payment receiver name. | `Harglim Publishers` | No |
| `MERCHANT_CODE` | Optional | None | `src/config/payment.js` | Optional UPI merchant category/code. | Set only if required by payment operations. | `0000` | No |
| `PAYMENT_CURRENCY` | Optional | `INR` | `src/config/payment.js` | Payment currency for QR config. | Keep `INR` for current UPI flow. | `INR` | No |
| `QR_EXPIRY_MINUTES` | Optional | `15` | `src/config/payment.js` | Dynamic QR expiry window. | Use a short window, commonly `10` to `15`. | `15` | No |
| `RESEND_API_KEY` | Optional | email sending disabled when absent | `src/utils/emailService.js` | Enables Resend email delivery. | Store in secret manager; leave empty only for local/stub environments. | `re_CHANGE_ME` | Yes |
| `FROM_EMAIL` | Optional | `onboarding@resend.dev` | `src/utils/emailService.js` | Sender address for Resend emails. | Use a verified production sender/domain. | `noreply@example.com` | No |
| `CLOUDINARY_CLOUD_NAME` | Required for Cloudinary uploads | None | `src/config/cloudinary.js` | Cloudinary account name. | Required if `/api/uploads/*` image/document upload routes are used. | `your_cloud_name` | No |
| `CLOUDINARY_API_KEY` | Required for Cloudinary uploads | None | `src/config/cloudinary.js` | Cloudinary API key. | Store securely. | `CHANGE_ME` | Yes |
| `CLOUDINARY_API_SECRET` | Required for Cloudinary uploads | None | `src/config/cloudinary.js` | Cloudinary API secret. | Store securely. | `CHANGE_ME` | Yes |
| `AWS_ACCESS_KEY_ID` | Optional feature dependency | None | `src/controllers/uploadsController.js` | AWS S3 access key for the legacy/orphan uploads controller. | Configure only if that controller is mounted or reused. | `CHANGE_ME` | Yes |
| `AWS_SECRET_ACCESS_KEY` | Optional feature dependency | None | `src/controllers/uploadsController.js` | AWS S3 secret key for the legacy/orphan uploads controller. | Configure only if that controller is mounted or reused. | `CHANGE_ME` | Yes |
| `AWS_S3_REGION` | Optional feature dependency | `us-east-1` | `src/controllers/uploadsController.js` | AWS S3 region. | Use the bucket region if S3 upload path is enabled. | `us-east-1` | No |
| `AWS_S3_BUCKET` | Optional feature dependency | None | `src/controllers/uploadsController.js` | AWS S3 bucket name. | Configure only if S3 upload path is enabled. | `your-bucket-name` | No |
| `MONGOMS_DOWNLOAD_DIR` | Test-only | mongodb-memory-server default | tests | Cache directory for mongodb-memory-server binaries. | Keep out of production runtime env. | `node_modules/.cache/mongodb-binaries` | No |

## Current `.env` Audit

The real `.env` was inspected by key name only; secret values were not printed or copied.

### Present And Used

- `MONGODB_URI`
- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `JWT_EXPIRE`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_REGION`
- `AWS_S3_BUCKET`
- `MERCHANT_UPI_ID`
- `MERCHANT_NAME`
- `MERCHANT_CODE`
- `PAYMENT_CURRENCY`
- `QR_EXPIRY_MINUTES`
- `RESEND_API_KEY`
- `FROM_EMAIL`

### Missing From Current `.env`

- `MONGOMS_DOWNLOAD_DIR` is absent. This is test-only and not required for production runtime.

### Present But Unused

These keys are present in the current `.env` but are not read by the source code:

- `MONGODB_USER`
- `MONGODB_PASSWORD`
- `JWT_EXPIRY`
- `APP_NAME`
- `APP_VERSION`
- `LOG_LEVEL`

### Deprecated Or Incorrect Names

- `JWT_EXPIRY` is not used. The runtime reads `JWT_EXPIRE`.
- `AWS_REGION` is not used. The runtime reads `AWS_S3_REGION`.
- `EMAIL_FROM` is not used. The runtime reads `FROM_EMAIL`.
- `UPI_ID`, `UPI_PAYEE_NAME`, and `PAYMENT_QR_EXPIRES_MINUTES` are not used. The runtime reads `MERCHANT_UPI_ID`, `MERCHANT_NAME`, and `QR_EXPIRY_MINUTES`.

## Required Runtime Values

Required for production startup:

- `MONGODB_URI`
- `JWT_SECRET`

Required for production payment QR usage:

- `MERCHANT_UPI_ID`
- `MERCHANT_NAME`

Required for production Cloudinary upload usage:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Required only if the legacy S3 upload controller is mounted or reused:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET`

## Optional Variables

- `NODE_ENV`
- `PORT`
- `JWT_EXPIRE`
- `MERCHANT_CODE`
- `PAYMENT_CURRENCY`
- `QR_EXPIRY_MINUTES`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `AWS_S3_REGION`
- `MONGOMS_DOWNLOAD_DIR`

## Development Example

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/hm_backend
JWT_SECRET=dev_only_change_me
JWT_EXPIRE=7d
MERCHANT_UPI_ID=merchant@upi
MERCHANT_NAME=Harglim Publishers
PAYMENT_CURRENCY=INR
QR_EXPIRY_MINUTES=15
FROM_EMAIL=onboarding@resend.dev
```

## Staging Example

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://USER:PASSWORD@staging-cluster.example/hm_backend
JWT_SECRET=CHANGE_ME_STAGING_SECRET
JWT_EXPIRE=7d
MERCHANT_UPI_ID=stagingmerchant@upi
MERCHANT_NAME=Harglim Publishers Staging
PAYMENT_CURRENCY=INR
QR_EXPIRY_MINUTES=15
RESEND_API_KEY=CHANGE_ME_STAGING_RESEND_KEY
FROM_EMAIL=noreply-staging@example.com
```

## Production Example

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://USER:PASSWORD@production-cluster.example/hm_backend
JWT_SECRET=CHANGE_ME_LONG_RANDOM_PRODUCTION_SECRET
JWT_EXPIRE=7d
MERCHANT_UPI_ID=merchant@upi
MERCHANT_NAME=Harglim Publishers
MERCHANT_CODE=
PAYMENT_CURRENCY=INR
QR_EXPIRY_MINUTES=15
RESEND_API_KEY=CHANGE_ME_PRODUCTION_RESEND_KEY
FROM_EMAIL=noreply@example.com
CLOUDINARY_CLOUD_NAME=CHANGE_ME
CLOUDINARY_API_KEY=CHANGE_ME
CLOUDINARY_API_SECRET=CHANGE_ME
```

## Security Notes

- Do not commit `.env`; it is ignored by git.
- Rotate `JWT_SECRET` before production if it has ever been shared locally.
- Do not use the code fallback `secret123` in production.
- Store `MONGODB_URI`, `JWT_SECRET`, `RESEND_API_KEY`, `CLOUDINARY_API_SECRET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` in a secret manager.
- The source contains non-secret fallback strings such as `secret123` and `onboarding@resend.dev`; these should be treated as development fallbacks, not production configuration.
- No real API keys or credentials should be placed in `.env.example`.
