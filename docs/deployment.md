# Deployment Guide

Environment variables:

- `NODE_ENV`
- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRE`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_REGION`, `AWS_S3_BUCKET`
- `MERCHANT_UPI_ID`, `MERCHANT_NAME`, `MERCHANT_CODE`, `PAYMENT_CURRENCY`, `QR_EXPIRY_MINUTES`
- `RESEND_API_KEY`, `FROM_EMAIL`

Production build: run `npm install --omit=dev`, configure environment, then `npm start`.

PM2: run `pm2 start server.js --name hm-backend`.

Nginx: proxy HTTPS traffic to `localhost:PORT` and forward `Authorization` headers.

Health checks: use `GET /health`.

Backup: take MongoDB backups before deployments touching models or indexes.

Rollback checklist:

1. Stop new deployment.
2. Restore previous package and environment.
3. Restart process manager.
4. Verify `/health`, `/api/docs`, auth, checkout, payment verification, and admin dashboard.
