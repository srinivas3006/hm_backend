const shipmentService = require('../services/shipmentService');

const sendSuccess = (res, data, status = 200) => res.status(status).json({ success: true, data });

const statusFromError = (error) => {
  if (error.statusCode) return error.statusCode;
  if (['SHIPMENT_NOT_FOUND', 'INVALID_SHIPMENT_ID'].includes(error.code)) return 404;
  if (['DUPLICATE_SHIPMENT', 'DUPLICATE_TRACKING_NUMBER'].includes(error.code)) return 409;
  if (error.code && error.code.startsWith('SHIPMENT_')) return 400;
  return 500;
};

const sendError = (res, error) => res.status(statusFromError(error)).json({
  success: false,
  message: error.message
});

const pagination = (query = {}) => ({ page: query.page, limit: query.limit });

const populate = [
  { path: 'order', select: 'orderNumber status totalPrice' },
  { path: 'payment', select: 'status amount paymentMethod provider' },
  { path: 'invoice', select: 'invoiceNumber total status' },
  { path: 'customer', select: 'name email role' }
];

const listShipments = async (req, res) => {
  try {
    sendSuccess(res, await shipmentService.listShipments(req.query, pagination(req.query), { populate }));
  } catch (error) {
    sendError(res, error);
  }
};

const searchShipments = async (req, res) => {
  try {
    sendSuccess(res, await shipmentService.searchShipments({
      ...req.query,
      search: req.query.q || req.query.search
    }, pagination(req.query), { populate }));
  } catch (error) {
    sendError(res, error);
  }
};

const getShipment = async (req, res) => {
  try {
    sendSuccess(res, await shipmentService.getShipment(req.params.id, { populate }));
  } catch (error) {
    sendError(res, error);
  }
};

const assignCourier = async (req, res) => {
  try {
    sendSuccess(res, await shipmentService.assignCourier(req.params.id, req.body, {
      actor: { userId: req.user._id },
      actorType: 'ADMIN'
    }));
  } catch (error) {
    sendError(res, error);
  }
};

const updateStatus = async (req, res) => {
  try {
    sendSuccess(res, await shipmentService.updateStatus(req.params.id, req.body, {
      actor: { userId: req.user._id },
      actorType: 'ADMIN'
    }));
  } catch (error) {
    sendError(res, error);
  }
};

const cancelShipment = async (req, res) => {
  try {
    sendSuccess(res, await shipmentService.cancelShipment(req.params.id, {
      userId: req.user._id
    }, {
      actorType: 'ADMIN',
      reason: req.body && req.body.reason
    }));
  } catch (error) {
    sendError(res, error);
  }
};

const getTracking = async (req, res) => {
  try {
    sendSuccess(res, await shipmentService.getTracking(req.params.id));
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  listShipments,
  searchShipments,
  getShipment,
  assignCourier,
  updateStatus,
  cancelShipment,
  getTracking
};
