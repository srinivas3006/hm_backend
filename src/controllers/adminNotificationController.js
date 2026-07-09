const notificationService = require('../services/notificationService');

const sendSuccess = (res, data, status = 200) => res.status(status).json({ success: true, data });

const statusFromError = (error) => {
  if (error.statusCode) return error.statusCode;
  if (['NOTIFICATION_NOT_FOUND', 'INVALID_NOTIFICATION_ID'].includes(error.code)) return 404;
  if (error.code === 'NOTIFICATION_RETRY_LIMIT_REACHED') return 409;
  if (error.code && error.code.startsWith('NOTIFICATION_')) return 400;
  return 500;
};

const sendError = (res, error) => res.status(statusFromError(error)).json({
  success: false,
  message: error.message
});

const pagination = (query = {}) => ({
  page: query.page,
  limit: query.limit
});

const listNotifications = async (req, res) => {
  try {
    sendSuccess(res, await notificationService.listNotifications(req.query, pagination(req.query), {
      populate: [{ path: 'user', select: 'name email role' }]
    }));
  } catch (error) {
    sendError(res, error);
  }
};

const searchNotifications = async (req, res) => {
  try {
    sendSuccess(res, await notificationService.searchNotifications({
      ...req.query,
      search: req.query.q || req.query.search
    }, pagination(req.query), {
      populate: [{ path: 'user', select: 'name email role' }]
    }));
  } catch (error) {
    sendError(res, error);
  }
};

const getNotification = async (req, res) => {
  try {
    sendSuccess(res, await notificationService.getNotification(req.params.id, {
      populate: [{ path: 'user', select: 'name email role' }]
    }));
  } catch (error) {
    sendError(res, error);
  }
};

const retryNotification = async (req, res) => {
  try {
    sendSuccess(res, await notificationService.retryNotification(req.params.id, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  listNotifications,
  searchNotifications,
  getNotification,
  retryNotification
};
