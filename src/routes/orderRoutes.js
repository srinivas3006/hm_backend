const express = require('express');
const router = express.Router();
const { createOrder, trackOrder, verifyPayment, cancelOrder } = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createOrder);
router.put('/:id/verify-payment', protect, verifyPayment);
router.delete('/:id', protect, cancelOrder);
router.get('/track/:orderNumber', trackOrder);

module.exports = router;
