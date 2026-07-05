const express = require('express');
const router = express.Router();
const { getAdminAnalytics, createBook, updateBook, deleteBook, getOrders, updateOrderStatus, getPublishRequests, updatePublishRequestStatus } = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// All routes here require admin access
router.use(protect);
router.use(authorize('admin'));

router.get('/analytics', getAdminAnalytics);
router.get('/stats', getAdminAnalytics); // alias for frontend compatibility
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
