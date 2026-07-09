const express = require('express');
const router = express.Router();
const { getAdminAnalytics, createBook, updateBook, deleteBook, getOrders, updateOrderStatus, getPublishRequests, updatePublishRequestStatus } = require('../controllers/adminController');
const adminOperationsController = require('../controllers/adminOperationsController');
const adminInvoiceController = require('../controllers/adminInvoiceController');
const adminNotificationController = require('../controllers/adminNotificationController');
const adminShipmentController = require('../controllers/adminShipmentController');
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// All routes here require admin access
router.use(protect);
router.use(authorize('admin'));

router.get('/analytics', getAdminAnalytics);
router.get('/stats', getAdminAnalytics); // alias for frontend compatibility
router.get('/analytics/dashboard', adminAnalyticsController.dashboard);
router.get('/analytics/revenue', adminAnalyticsController.revenue);
router.get('/analytics/books', adminAnalyticsController.books);
router.get('/analytics/payments', adminAnalyticsController.payments);
router.get('/analytics/inventory', adminAnalyticsController.inventory);
router.get('/analytics/shipments', adminAnalyticsController.shipments);
router.get('/analytics/customers', adminAnalyticsController.customers);
router.get('/operations/dashboard', adminOperationsController.dashboardSummary);
router.get('/operations/search', adminOperationsController.globalSearch);
router.get('/operations/payments', adminOperationsController.listPayments);
router.get('/operations/payments/:id', adminOperationsController.getPaymentDetail);
router.post('/operations/payments/:id/approve', adminOperationsController.approvePayment);
router.post('/operations/payments/:id/reject', adminOperationsController.rejectPayment);
router.post('/operations/payments/:id/cancel', adminOperationsController.cancelPaymentIntent);
router.post('/operations/payments/:id/expire', adminOperationsController.expirePayment);
router.post('/operations/payments/:id/retry-verification', adminOperationsController.retryVerification);
router.post('/operations/payments/:id/recreate-qr', adminOperationsController.recreateQR);
router.get('/operations/inventory/reservations', adminOperationsController.listReservations);
router.get('/operations/inventory/low-stock', adminOperationsController.listLowStock);
router.get('/operations/ledger/payments', adminOperationsController.listPaymentLedger);
router.get('/operations/ledger/inventory', adminOperationsController.listInventoryLedger);
router.get('/operations/ledger/timeline', adminOperationsController.combinedTimeline);
router.get('/invoices/search', adminInvoiceController.searchInvoices);
router.get('/invoices', adminInvoiceController.listInvoices);
router.get('/invoices/:id/download', adminInvoiceController.downloadInvoice);
router.get('/invoices/:id', adminInvoiceController.getInvoice);
router.get('/notifications/search', adminNotificationController.searchNotifications);
router.get('/notifications', adminNotificationController.listNotifications);
router.get('/notifications/:id', adminNotificationController.getNotification);
router.post('/notifications/:id/retry', adminNotificationController.retryNotification);
router.get('/shipments/search', adminShipmentController.searchShipments);
router.get('/shipments', adminShipmentController.listShipments);
router.get('/shipments/:id/tracking', adminShipmentController.getTracking);
router.get('/shipments/:id', adminShipmentController.getShipment);
router.post('/shipments/:id/assign-courier', adminShipmentController.assignCourier);
router.post('/shipments/:id/update-status', adminShipmentController.updateStatus);
router.post('/shipments/:id/cancel', adminShipmentController.cancelShipment);
router.get('/orders', getOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.get('/publish-requests', getPublishRequests);
router.put('/publish-requests/:id/status', updatePublishRequestStatus);

router.route('/books')
  .post(createBook);
router.route('/books/:id')
  .put(updateBook)
  .delete(deleteBook);

module.exports = router;
