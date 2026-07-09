# Authentication Guide

JWT authentication is implemented through `src/middleware/authMiddleware.js`.

Flow:

1. Register with `POST /api/auth/register`.
2. Login with `POST /api/auth/login`.
3. Store the returned JWT on the client.
4. Send `Authorization: Bearer <token>` on protected requests.
5. Use `GET /api/auth/me` to hydrate the current user.

Refresh tokens and logout endpoints are not implemented in the current backend.

Admin authorization is enforced by `authorize('admin')` in `src/routes/adminRoutes.js`. Publishing creation accepts `author` and `admin`.

Token expiry is controlled by `JWT_EXPIRE`.
