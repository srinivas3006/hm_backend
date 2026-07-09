# Frontend API Guide

Base URL: `http://localhost:5000` in development.

Authentication: send `Authorization: Bearer <jwt>` for endpoints marked Bearer, Author/Admin, or Admin.

## GET /health

Purpose: Health check.

Authentication: Public.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/health`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/health', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/health', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `System`.

## POST /api/auth/register

Purpose: Register user.

Authentication: Public.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: Uses schema `RegisterRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/auth/register`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/auth/register', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/auth/register', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Authentication`.

## POST /api/auth/login

Purpose: Login user.

Authentication: Public.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: Uses schema `LoginRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/auth/login`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/auth/login', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/auth/login', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Authentication`.

## GET /api/auth/me

Purpose: Get current user.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/auth/me`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/auth/me', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/auth/me', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Authentication`.

## GET /api/books

Purpose: List books.

Authentication: Public.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- `page`: optional query parameter.
- `limit`: optional query parameter.
- `category`: optional query parameter.
- `search`: optional query parameter.
- `sort`: optional query parameter.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/books`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/books', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/books', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Books`.

## GET /api/books/{slug}

Purpose: Get book by slug.

Authentication: Public.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `slug`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/books/:slug`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/books/:slug', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/books/:slug', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Books`.

## GET /api/books/{slug}/related

Purpose: Get related books.

Authentication: Public.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `slug`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/books/:slug/related`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/books/:slug/related', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/books/:slug/related', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Books`.

## GET /api/books/{slug}/reviews

Purpose: Get book reviews.

Authentication: Public.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `slug`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/books/:slug/reviews`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/books/:slug/reviews', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/books/:slug/reviews', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Books`.

## GET /api/search

Purpose: Search books.

Authentication: Public.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- `q`: optional query parameter.
- `page`: optional query parameter.
- `limit`: optional query parameter.
- `category`: optional query parameter.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/search`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/search', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/search', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Books`.

## POST /api/orders

Purpose: Create order with payment, inventory, QR bridge.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: Uses schema `OrderCreateRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/orders`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/orders', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/orders', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Orders`.

## PUT /api/orders/{id}/verify-payment

Purpose: Verify order payment reference.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: Uses schema `PaymentVerificationRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/orders/:id/verify-payment`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'PUT', url: '/api/orders/:id/verify-payment', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/orders/:id/verify-payment', options: Options(method: 'PUT', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Orders`.

## DELETE /api/orders/{id}

Purpose: Cancel order.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/orders/:id`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'DELETE', url: '/api/orders/:id', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/orders/:id', options: Options(method: 'DELETE', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Orders`.

## GET /api/orders/{id}/shipment

Purpose: Get order shipment.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/orders/:id/shipment`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/orders/:id/shipment', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/orders/:id/shipment', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Orders`.

## GET /api/orders/{id}/tracking

Purpose: Get order tracking.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/orders/:id/tracking`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/orders/:id/tracking', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/orders/:id/tracking', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Orders`.

## GET /api/orders/track/{orderNumber}

Purpose: Track order by order number.

Authentication: Public.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `orderNumber`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/orders/track/:orderNumber`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/orders/track/:orderNumber', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/orders/track/:orderNumber', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Orders`.

## POST /api/uploads/image

Purpose: Upload image.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: Uses schema `MultipartImageRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/uploads/image`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/uploads/image', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/uploads/image', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Uploads`.

## POST /api/uploads/document

Purpose: Upload document.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: Uses schema `MultipartDocumentRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/uploads/document`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/uploads/document', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/uploads/document', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Uploads`.

## GET /api/users/{id}/stats

Purpose: Get user stats.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/users/:id/stats`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/users/:id/stats', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/users/:id/stats', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Users`.

## PUT /api/users/{id}

Purpose: Update user profile.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: Uses schema `UserUpdateRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/users/:id`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'PUT', url: '/api/users/:id', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/users/:id', options: Options(method: 'PUT', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Users`.

## GET /api/users/{id}/orders

Purpose: Get user orders.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/users/:id/orders`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/users/:id/orders', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/users/:id/orders', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Users`.

## GET /api/users/{id}/wishlist

Purpose: Get user wishlist.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/users/:id/wishlist`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/users/:id/wishlist', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/users/:id/wishlist', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Users`.

## GET /api/users/{id}/library

Purpose: Get user library.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/users/:id/library`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/users/:id/library', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/users/:id/library', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Users`.

## POST /api/users/{id}/wishlist

Purpose: Add book to wishlist.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: Uses schema `WishlistRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/users/:id/wishlist`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/users/:id/wishlist', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/users/:id/wishlist', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Users`.

## DELETE /api/users/{id}/wishlist/{bookId}

Purpose: Remove book from wishlist.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.
- `bookId`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/users/:id/wishlist/:bookId`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'DELETE', url: '/api/users/:id/wishlist/:bookId', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/users/:id/wishlist/:bookId', options: Options(method: 'DELETE', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Users`.

## GET /api/authors

Purpose: List authors.

Authentication: Public.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/authors`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/authors', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/authors', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Authors`.

## GET /api/authors/{id}

Purpose: Get author.

Authentication: Public.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/authors/:id`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/authors/:id', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/authors/:id', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Authors`.

## GET /api/authors/{id}/books

Purpose: Get author books.

Authentication: Public.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/authors/:id/books`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/authors/:id/books', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/authors/:id/books', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Authors`.

## GET /api/authors/{id}/stats

Purpose: Get author stats.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/authors/:id/stats`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/authors/:id/stats', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/authors/:id/stats', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Authors`.

## GET /api/authors/{id}/analytics

Purpose: Get author analytics alias.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/authors/:id/analytics`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/authors/:id/analytics', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/authors/:id/analytics', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Authors`.

## GET /api/authors/{id}/royalties/history

Purpose: Get author royalty history.

Authentication: Bearer.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/authors/:id/royalties/history`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/authors/:id/royalties/history', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/authors/:id/royalties/history', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Authors`.

## POST /api/publish-requests

Purpose: Create publish request.

Authentication: Author/Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: Uses schema `PublishRequestCreate`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/publish-requests`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/publish-requests', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/publish-requests', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Publishing`.

## GET /api/publish-packages

Purpose: List publish packages.

Authentication: Public.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/publish-packages`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/publish-packages', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/publish-packages', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Publishing`.

## GET /api/admin/analytics

Purpose: Admin analytics summary.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/analytics`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/analytics', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/analytics', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Core`.

## GET /api/admin/stats

Purpose: Admin stats alias.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/stats`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/stats', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/stats', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Core`.

## GET /api/admin/orders

Purpose: List orders.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/orders`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/orders', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/orders', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Core`.

## PUT /api/admin/orders/{id}/status

Purpose: Update order status.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: Uses schema `StatusUpdateRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/orders/:id/status`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'PUT', url: '/api/admin/orders/:id/status', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/orders/:id/status', options: Options(method: 'PUT', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Core`.

## GET /api/admin/publish-requests

Purpose: List publish requests.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/publish-requests`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/publish-requests', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/publish-requests', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Core`.

## PUT /api/admin/publish-requests/{id}/status

Purpose: Update publish request status.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: Uses schema `StatusUpdateRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/publish-requests/:id/status`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'PUT', url: '/api/admin/publish-requests/:id/status', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/publish-requests/:id/status', options: Options(method: 'PUT', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Core`.

## POST /api/admin/books

Purpose: Create book.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: Uses schema `BookCreateRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/books`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/admin/books', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/books', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Core`.

## PUT /api/admin/books/{id}

Purpose: Update book.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: Uses schema `BookUpdateRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/books/:id`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'PUT', url: '/api/admin/books/:id', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/books/:id', options: Options(method: 'PUT', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Core`.

## DELETE /api/admin/books/{id}

Purpose: Delete book.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/books/:id`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'DELETE', url: '/api/admin/books/:id', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/books/:id', options: Options(method: 'DELETE', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Core`.

## GET /api/admin/operations/dashboard

Purpose: Operations dashboard.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/dashboard`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/operations/dashboard', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/dashboard', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## GET /api/admin/operations/search

Purpose: Global operations search.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- `q`: optional query parameter.
- `type`: optional query parameter.
- `page`: optional query parameter.
- `limit`: optional query parameter.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/search`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/operations/search', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/search', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## GET /api/admin/operations/payments

Purpose: List payments.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- `status`: optional query parameter.
- `page`: optional query parameter.
- `limit`: optional query parameter.
- `from`: optional query parameter.
- `to`: optional query parameter.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/payments`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/operations/payments', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/payments', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## GET /api/admin/operations/payments/{id}

Purpose: Payment detail.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/payments/:id`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/operations/payments/:id', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/payments/:id', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## POST /api/admin/operations/payments/{id}/approve

Purpose: Approve payment.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/payments/:id/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/admin/operations/payments/:id/approve', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/payments/:id/approve', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## POST /api/admin/operations/payments/{id}/reject

Purpose: Reject payment.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: Uses schema `RejectPaymentRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/payments/:id/reject`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/admin/operations/payments/:id/reject', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/payments/:id/reject', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## POST /api/admin/operations/payments/{id}/cancel

Purpose: Cancel payment intent.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/payments/:id/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/admin/operations/payments/:id/cancel', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/payments/:id/cancel', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## POST /api/admin/operations/payments/{id}/expire

Purpose: Expire payment intent.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/payments/:id/expire`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/admin/operations/payments/:id/expire', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/payments/:id/expire', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## POST /api/admin/operations/payments/{id}/retry-verification

Purpose: Retry payment verification.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/payments/:id/retry-verification`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/admin/operations/payments/:id/retry-verification', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/payments/:id/retry-verification', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## POST /api/admin/operations/payments/{id}/recreate-qr

Purpose: Recreate payment QR.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/payments/:id/recreate-qr`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/admin/operations/payments/:id/recreate-qr', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/payments/:id/recreate-qr', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## GET /api/admin/operations/inventory/reservations

Purpose: List inventory reservations.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/inventory/reservations`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/operations/inventory/reservations', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/inventory/reservations', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## GET /api/admin/operations/inventory/low-stock

Purpose: List low stock books.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/inventory/low-stock`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/operations/inventory/low-stock', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/inventory/low-stock', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## GET /api/admin/operations/ledger/payments

Purpose: List payment ledger.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/ledger/payments`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/operations/ledger/payments', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/ledger/payments', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## GET /api/admin/operations/ledger/inventory

Purpose: List inventory ledger.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/ledger/inventory`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/operations/ledger/inventory', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/ledger/inventory', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## GET /api/admin/operations/ledger/timeline

Purpose: Combined ledger timeline.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/operations/ledger/timeline`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/operations/ledger/timeline', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/operations/ledger/timeline', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Operations`.

## GET /api/admin/invoices/search

Purpose: Search invoices.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/invoices/search`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/invoices/search', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/invoices/search', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Invoices`.

## GET /api/admin/invoices

Purpose: List invoices.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/invoices`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/invoices', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/invoices', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Invoices`.

## GET /api/admin/invoices/{id}/download

Purpose: Download invoice document.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/invoices/:id/download`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/invoices/:id/download', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/invoices/:id/download', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Invoices`.

## GET /api/admin/invoices/{id}

Purpose: Get invoice.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/invoices/:id`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/invoices/:id', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/invoices/:id', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Invoices`.

## GET /api/admin/notifications/search

Purpose: Search notifications.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/notifications/search`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/notifications/search', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/notifications/search', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Notifications`.

## GET /api/admin/notifications

Purpose: List notifications.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/notifications`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/notifications', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/notifications', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Notifications`.

## GET /api/admin/notifications/{id}

Purpose: Get notification.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/notifications/:id`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/notifications/:id', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/notifications/:id', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Notifications`.

## POST /api/admin/notifications/{id}/retry

Purpose: Retry failed notification.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/notifications/:id/retry`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/admin/notifications/:id/retry', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/notifications/:id/retry', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Notifications`.

## GET /api/admin/shipments/search

Purpose: Search shipments.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/shipments/search`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/shipments/search', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/shipments/search', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Shipments`.

## GET /api/admin/shipments

Purpose: List shipments.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/shipments`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/shipments', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/shipments', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Shipments`.

## GET /api/admin/shipments/{id}/tracking

Purpose: Get shipment tracking.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/shipments/:id/tracking`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/shipments/:id/tracking', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/shipments/:id/tracking', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Shipments`.

## GET /api/admin/shipments/{id}

Purpose: Get shipment.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/shipments/:id`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/shipments/:id', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/shipments/:id', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Shipments`.

## POST /api/admin/shipments/{id}/assign-courier

Purpose: Assign courier.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: Uses schema `CourierAssignRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/shipments/:id/assign-courier`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/admin/shipments/:id/assign-courier', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/shipments/:id/assign-courier', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Shipments`.

## POST /api/admin/shipments/{id}/update-status

Purpose: Update shipment status.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: Uses schema `StatusUpdateRequest`.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/shipments/:id/update-status`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/admin/shipments/:id/update-status', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/shipments/:id/update-status', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Shipments`.

## POST /api/admin/shipments/{id}/cancel

Purpose: Cancel shipment.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- `id`: path parameter.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/shipments/:id/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'POST', url: '/api/admin/shipments/:id/cancel', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/shipments/:id/cancel', options: Options(method: 'POST', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Shipments`.

## GET /api/admin/analytics/dashboard

Purpose: Analytics dashboard.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/analytics/dashboard`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/analytics/dashboard', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/analytics/dashboard', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Analytics`.

## GET /api/admin/analytics/revenue

Purpose: Revenue report.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/analytics/revenue`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/analytics/revenue', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/analytics/revenue', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Analytics`.

## GET /api/admin/analytics/books

Purpose: Book sales report.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/analytics/books`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/analytics/books', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/analytics/books', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Analytics`.

## GET /api/admin/analytics/payments

Purpose: Payment metrics.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/analytics/payments`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/analytics/payments', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/analytics/payments', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Analytics`.

## GET /api/admin/analytics/inventory

Purpose: Inventory metrics.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/analytics/inventory`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/analytics/inventory', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/analytics/inventory', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Analytics`.

## GET /api/admin/analytics/shipments

Purpose: Shipment metrics.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/analytics/shipments`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/analytics/shipments', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/analytics/shipments', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Analytics`.

## GET /api/admin/analytics/customers

Purpose: Customer metrics.

Authentication: Admin.

Headers: `Authorization: Bearer <token>` when protected; `Content-Type: application/json` unless multipart upload.

Path Parameters:
- None.

Query Parameters:
- None.

Request Body: No request body.

Validation Rules: See `docs/openapi.yaml` request body schema and runtime validators/controllers.

Success Response:
```json
{ "success": true, "data": {} }
```

Error Response:
```json
{ "success": false, "message": "Error message" }
```

Status Codes: 200, 201 where created, 400, 401, 403, 404, 429, 500.

Frontend Integration Notes: Keep the response envelope checks defensive because some legacy auth errors return `status: "error"`.

Example Fetch Request:
```js
await fetch(`${API_BASE_URL}/api/admin/analytics/customers`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
```

Example Axios Request:
```js
await axios.request({ method: 'GET', url: '/api/admin/analytics/customers', headers: { Authorization: `Bearer ${token}` } });
```

Example Flutter Dio Request:
```dart
await dio.request('/api/admin/analytics/customers', options: Options(method: 'GET', headers: {'Authorization': 'Bearer $token'}));
```

Common Mistakes: Missing bearer token on protected endpoints, sending invalid ObjectId values, or assuming admin endpoints are customer-accessible.

Related APIs: See endpoints with tag `Admin Analytics`.
