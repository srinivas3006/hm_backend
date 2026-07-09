const Order = require('../models/Order');
const shipmentService = require('../services/shipmentService');

const loadAuthorizedOrder = async (orderId, user) => {
  const order = await Order.findById(orderId).lean();
  if (!order) {
    const error = new Error('Order not found');
    error.statusCode = 404;
    throw error;
  }
  if (String(order.user) !== String(user._id) && user.role !== 'admin') {
    const error = new Error('Not authorized');
    error.statusCode = 403;
    throw error;
  }
  return order;
};

const sendError = (res, error) => res.status(error.statusCode || (error.code === 'SHIPMENT_NOT_FOUND' ? 404 : 500)).json({
  success: false,
  message: error.message
});

const getOrderShipment = async (req, res) => {
  try {
    await loadAuthorizedOrder(req.params.id, req.user);
    const shipment = await shipmentService.getShipmentByOrder(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
    res.json({ success: true, data: shipment });
  } catch (error) {
    sendError(res, error);
  }
};

const getOrderTracking = async (req, res) => {
  try {
    await loadAuthorizedOrder(req.params.id, req.user);
    const shipment = await shipmentService.getShipmentByOrder(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found' });
    res.json({ success: true, data: await shipmentService.getTracking(shipment._id) });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  getOrderShipment,
  getOrderTracking
};
