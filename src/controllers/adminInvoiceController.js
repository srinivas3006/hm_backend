const invoiceService = require('../services/invoiceService');

const sendSuccess = (res, data, status = 200) => res.status(status).json({ success: true, data });

const statusFromError = (error) => {
  if (error.statusCode) return error.statusCode;
  if (['INVOICE_NOT_FOUND', 'INVALID_INVOICE_ID'].includes(error.code)) return 404;
  if (['INVOICE_DUPLICATE', 'DUPLICATE_INVOICE'].includes(error.code)) return 409;
  if (error.code && error.code.startsWith('INVOICE_')) return 400;
  return 500;
};

const sendError = (res, error) => res.status(statusFromError(error)).json({
  success: false,
  message: error.message
});

const normalizePagination = (query = {}) => ({
  page: query.page,
  limit: query.limit
});

const listInvoices = async (req, res) => {
  try {
    sendSuccess(res, await invoiceService.listInvoices(req.query, normalizePagination(req.query), {
      populate: [
        { path: 'order', select: 'orderNumber status totalPrice' },
        { path: 'payment', select: 'status amount paymentMethod provider verifiedAt' },
        { path: 'customer', select: 'name email role' }
      ]
    }));
  } catch (error) {
    sendError(res, error);
  }
};

const searchInvoices = async (req, res) => {
  try {
    sendSuccess(res, await invoiceService.searchInvoices({
      ...req.query,
      search: req.query.q || req.query.search
    }, normalizePagination(req.query), {
      populate: [
        { path: 'order', select: 'orderNumber status totalPrice' },
        { path: 'payment', select: 'status amount paymentMethod provider verifiedAt' },
        { path: 'customer', select: 'name email role' }
      ]
    }));
  } catch (error) {
    sendError(res, error);
  }
};

const getInvoice = async (req, res) => {
  try {
    sendSuccess(res, await invoiceService.getInvoice(req.params.id, {
      populate: [
        { path: 'order', select: 'orderNumber status subtotal tax shippingPrice totalPrice' },
        { path: 'payment', select: 'status amount paymentMethod provider verifiedAt utr' },
        { path: 'customer', select: 'name email role' },
        { path: 'items.book', select: 'title slug isbn' }
      ]
    }));
  } catch (error) {
    sendError(res, error);
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const document = await invoiceService.getInvoiceDocument(req.params.id);
    res.setHeader('Content-Type', document.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName || 'invoice.pdf'}"`);
    res.send(document.buffer);
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  listInvoices,
  searchInvoices,
  getInvoice,
  downloadInvoice
};
