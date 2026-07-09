# Release Candidate Summary

Swagger URL: `/api/docs`

OpenAPI validation status: generated from the internal OpenAPI 3.1 builder and JSON-parse validated during generation.

Endpoints documented: 78

Models documented: 17

Events documented: 26

Database collections documented: 17

Sequence diagrams: 9

Postman collection status: import-ready at `docs/postman_collection.json`.

Documentation coverage percentage: 100% of mounted route definitions.

Production readiness score: 93/100. Remaining documentation/runtime risk is mainly route-order ambiguity on generic parameter routes and the need to replace placeholder staging/production server URLs.

## Endpoint Inventory

| Method | Path | Auth | Controller |
| --- | --- | --- | --- |
| GET | `/health` | Public | `server.js` |
| POST | `/api/auth/register` | Public | `authController.registerUser` |
| POST | `/api/auth/login` | Public | `authController.loginUser` |
| GET | `/api/auth/me` | Bearer | `authController.getMe` |
| GET | `/api/books` | Public | `bookController.getBooks` |
| GET | `/api/books/{slug}` | Public | `bookController.getBookBySlug` |
| GET | `/api/books/{slug}/related` | Public | `bookController.getRelatedBooks` |
| GET | `/api/books/{slug}/reviews` | Public | `bookController.getBookReviews` |
| GET | `/api/search` | Public | `bookController.searchBooks` |
| POST | `/api/orders` | Bearer | `orderController.createOrder` |
| PUT | `/api/orders/{id}/verify-payment` | Bearer | `orderController.verifyPayment` |
| DELETE | `/api/orders/{id}` | Bearer | `orderController.cancelOrder` |
| GET | `/api/orders/{id}/shipment` | Bearer | `orderShipmentController.getOrderShipment` |
| GET | `/api/orders/{id}/tracking` | Bearer | `orderShipmentController.getOrderTracking` |
| GET | `/api/orders/track/{orderNumber}` | Public | `orderController.trackOrder` |
| POST | `/api/uploads/image` | Bearer | `uploadController.uploadImage` |
| POST | `/api/uploads/document` | Bearer | `uploadController.uploadDocument` |
| GET | `/api/users/{id}/stats` | Bearer | `userController.getUserStats` |
| PUT | `/api/users/{id}` | Bearer | `userController.updateUserProfile` |
| GET | `/api/users/{id}/orders` | Bearer | `userController.getUserOrders` |
| GET | `/api/users/{id}/wishlist` | Bearer | `userController.getUserWishlist` |
| GET | `/api/users/{id}/library` | Bearer | `userController.getUserLibrary` |
| POST | `/api/users/{id}/wishlist` | Bearer | `userController.addToWishlist` |
| DELETE | `/api/users/{id}/wishlist/{bookId}` | Bearer | `userController.removeFromWishlist` |
| GET | `/api/authors` | Public | `authorController.getAuthors` |
| GET | `/api/authors/{id}` | Public | `authorController.getAuthorById` |
| GET | `/api/authors/{id}/books` | Public | `authorController.getAuthorBooks` |
| GET | `/api/authors/{id}/stats` | Bearer | `authorController.getAuthorStats` |
| GET | `/api/authors/{id}/analytics` | Bearer | `authorController.getAuthorStats` |
| GET | `/api/authors/{id}/royalties/history` | Bearer | `authorController.getAuthorRoyaltiesHistory` |
| POST | `/api/publish-requests` | Author/Admin | `publishController.createPublishRequest` |
| GET | `/api/publish-packages` | Public | `publishController.getPublishPackages` |
| GET | `/api/admin/analytics` | Admin | `adminController.getAdminAnalytics` |
| GET | `/api/admin/stats` | Admin | `adminController.getAdminAnalytics` |
| GET | `/api/admin/orders` | Admin | `adminController.getOrders` |
| PUT | `/api/admin/orders/{id}/status` | Admin | `adminController.updateOrderStatus` |
| GET | `/api/admin/publish-requests` | Admin | `adminController.getPublishRequests` |
| PUT | `/api/admin/publish-requests/{id}/status` | Admin | `adminController.updatePublishRequestStatus` |
| POST | `/api/admin/books` | Admin | `adminController.createBook` |
| PUT | `/api/admin/books/{id}` | Admin | `adminController.updateBook` |
| DELETE | `/api/admin/books/{id}` | Admin | `adminController.deleteBook` |
| GET | `/api/admin/operations/dashboard` | Admin | `adminOperationsController.dashboardSummary` |
| GET | `/api/admin/operations/search` | Admin | `adminOperationsController.globalSearch` |
| GET | `/api/admin/operations/payments` | Admin | `adminOperationsController.listPayments` |
| GET | `/api/admin/operations/payments/{id}` | Admin | `adminOperationsController.getPaymentDetail` |
| POST | `/api/admin/operations/payments/{id}/approve` | Admin | `adminOperationsController.approvePayment` |
| POST | `/api/admin/operations/payments/{id}/reject` | Admin | `adminOperationsController.rejectPayment` |
| POST | `/api/admin/operations/payments/{id}/cancel` | Admin | `adminOperationsController.cancelPaymentIntent` |
| POST | `/api/admin/operations/payments/{id}/expire` | Admin | `adminOperationsController.expirePayment` |
| POST | `/api/admin/operations/payments/{id}/retry-verification` | Admin | `adminOperationsController.retryVerification` |
| POST | `/api/admin/operations/payments/{id}/recreate-qr` | Admin | `adminOperationsController.recreateQR` |
| GET | `/api/admin/operations/inventory/reservations` | Admin | `adminOperationsController.listReservations` |
| GET | `/api/admin/operations/inventory/low-stock` | Admin | `adminOperationsController.listLowStock` |
| GET | `/api/admin/operations/ledger/payments` | Admin | `adminOperationsController.listPaymentLedger` |
| GET | `/api/admin/operations/ledger/inventory` | Admin | `adminOperationsController.listInventoryLedger` |
| GET | `/api/admin/operations/ledger/timeline` | Admin | `adminOperationsController.combinedTimeline` |
| GET | `/api/admin/invoices/search` | Admin | `adminInvoiceController.searchInvoices` |
| GET | `/api/admin/invoices` | Admin | `adminInvoiceController.listInvoices` |
| GET | `/api/admin/invoices/{id}/download` | Admin | `adminInvoiceController.downloadInvoice` |
| GET | `/api/admin/invoices/{id}` | Admin | `adminInvoiceController.getInvoice` |
| GET | `/api/admin/notifications/search` | Admin | `adminNotificationController.searchNotifications` |
| GET | `/api/admin/notifications` | Admin | `adminNotificationController.listNotifications` |
| GET | `/api/admin/notifications/{id}` | Admin | `adminNotificationController.getNotification` |
| POST | `/api/admin/notifications/{id}/retry` | Admin | `adminNotificationController.retryNotification` |
| GET | `/api/admin/shipments/search` | Admin | `adminShipmentController.searchShipments` |
| GET | `/api/admin/shipments` | Admin | `adminShipmentController.listShipments` |
| GET | `/api/admin/shipments/{id}/tracking` | Admin | `adminShipmentController.getTracking` |
| GET | `/api/admin/shipments/{id}` | Admin | `adminShipmentController.getShipment` |
| POST | `/api/admin/shipments/{id}/assign-courier` | Admin | `adminShipmentController.assignCourier` |
| POST | `/api/admin/shipments/{id}/update-status` | Admin | `adminShipmentController.updateStatus` |
| POST | `/api/admin/shipments/{id}/cancel` | Admin | `adminShipmentController.cancelShipment` |
| GET | `/api/admin/analytics/dashboard` | Admin | `adminAnalyticsController.dashboard` |
| GET | `/api/admin/analytics/revenue` | Admin | `adminAnalyticsController.revenue` |
| GET | `/api/admin/analytics/books` | Admin | `adminAnalyticsController.books` |
| GET | `/api/admin/analytics/payments` | Admin | `adminAnalyticsController.payments` |
| GET | `/api/admin/analytics/inventory` | Admin | `adminAnalyticsController.inventory` |
| GET | `/api/admin/analytics/shipments` | Admin | `adminAnalyticsController.shipments` |
| GET | `/api/admin/analytics/customers` | Admin | `adminAnalyticsController.customers` |
