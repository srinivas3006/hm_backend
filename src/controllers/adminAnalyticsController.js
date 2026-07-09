const analyticsService = require('../services/analyticsService');

const sendSuccess = (res, data) => res.json({ success: true, data });
const sendError = (res, error) => res.status(500).json({ success: false, message: error.message });

const dashboard = async (req, res) => {
  try { sendSuccess(res, await analyticsService.dashboard(req.query)); } catch (error) { sendError(res, error); }
};
const revenue = async (req, res) => {
  try { sendSuccess(res, await analyticsService.revenue(req.query)); } catch (error) { sendError(res, error); }
};
const books = async (req, res) => {
  try { sendSuccess(res, await analyticsService.books(req.query)); } catch (error) { sendError(res, error); }
};
const payments = async (req, res) => {
  try { sendSuccess(res, await analyticsService.payments(req.query)); } catch (error) { sendError(res, error); }
};
const inventory = async (req, res) => {
  try { sendSuccess(res, await analyticsService.inventory(req.query)); } catch (error) { sendError(res, error); }
};
const shipments = async (req, res) => {
  try { sendSuccess(res, await analyticsService.shipments(req.query)); } catch (error) { sendError(res, error); }
};
const customers = async (req, res) => {
  try { sendSuccess(res, await analyticsService.customers(req.query)); } catch (error) { sendError(res, error); }
};

module.exports = { dashboard, revenue, books, payments, inventory, shipments, customers };
