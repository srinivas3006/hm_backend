const adminOperationsService = require('../services/adminOperationsService');

const sendSuccess = (res, data, status = 200) => res.status(status).json({ success: true, data });

const statusFromError = (error) => {
  if (error.statusCode) return error.statusCode;
  if (['PAYMENT_NOT_FOUND', 'INVALID_PAYMENT_ID', 'INVENTORY_RESERVATION_NOT_FOUND'].includes(error.code)) return 404;
  if ([
    'DUPLICATE_UTR',
    'PAYMENT_ALREADY_COMPLETED',
    'PAYMENT_ALREADY_VERIFIED',
    'PAYMENT_UTR_ALREADY_SUBMITTED',
    'DUPLICATE_INVENTORY_RESERVATION'
  ].includes(error.code)) return 409;
  if (error.code && (
    error.code.startsWith('PAYMENT_') ||
    error.code.startsWith('INVALID_') ||
    error.code.startsWith('INVENTORY_')
  )) return 400;
  return 500;
};

const sendError = (res, error) => res.status(statusFromError(error)).json({
  success: false,
  message: error.message
});

const listPayments = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.listPayments(req.query));
  } catch (error) {
    sendError(res, error);
  }
};

const getPaymentDetail = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.getPaymentDetail(req.params.id));
  } catch (error) {
    sendError(res, error);
  }
};

const approvePayment = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.approvePayment(req.params.id, req.user, req.body));
  } catch (error) {
    sendError(res, error);
  }
};

const rejectPayment = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.rejectPayment(req.params.id, req.user, req.body));
  } catch (error) {
    sendError(res, error);
  }
};

const cancelPaymentIntent = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.cancelPaymentIntent(req.params.id, req.user, req.body));
  } catch (error) {
    sendError(res, error);
  }
};

const expirePayment = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.expirePayment(req.params.id, req.user, req.body));
  } catch (error) {
    sendError(res, error);
  }
};

const retryVerification = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.retryVerification(req.params.id));
  } catch (error) {
    sendError(res, error);
  }
};

const recreateQR = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.recreateQR(req.params.id, req.user, req.body));
  } catch (error) {
    sendError(res, error);
  }
};

const listReservations = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.listReservations(req.query));
  } catch (error) {
    sendError(res, error);
  }
};

const listLowStock = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.listLowStock(req.query));
  } catch (error) {
    sendError(res, error);
  }
};

const listPaymentLedger = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.listPaymentLedger(req.query));
  } catch (error) {
    sendError(res, error);
  }
};

const listInventoryLedger = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.listInventoryLedger(req.query));
  } catch (error) {
    sendError(res, error);
  }
};

const combinedTimeline = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.combinedTimeline(req.query));
  } catch (error) {
    sendError(res, error);
  }
};

const dashboardSummary = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.dashboardSummary());
  } catch (error) {
    sendError(res, error);
  }
};

const globalSearch = async (req, res) => {
  try {
    sendSuccess(res, await adminOperationsService.globalSearch(req.query.q, req.query));
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  listPayments,
  getPaymentDetail,
  approvePayment,
  rejectPayment,
  cancelPaymentIntent,
  expirePayment,
  retryVerification,
  recreateQR,
  listReservations,
  listLowStock,
  listPaymentLedger,
  listInventoryLedger,
  combinedTimeline,
  dashboardSummary,
  globalSearch
};
