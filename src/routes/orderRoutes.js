const express = require('express');
const router = express.Router();
const { createOrder, trackOrder, verifyPayment, cancelOrder } = require('../controllers/orderController');
const { getOrderShipment, getOrderTracking } = require('../controllers/orderShipmentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createOrder);
router.put('/:id/verify-payment', protect, verifyPayment);
router.delete('/:id', protect, cancelOrder);
router.get('/:id/shipment', protect, getOrderShipment);
router.get('/:id/tracking', protect, getOrderTracking);
router.get('/track/:orderNumber', trackOrder);

module.exports = router;
