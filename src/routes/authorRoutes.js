const express = require('express');
const router = express.Router();
const { 
  getAuthors, 
  getAuthorById, 
  getAuthorBooks, 
  getAuthorStats, 
  getAuthorRoyaltiesHistory 
} = require('../controllers/authorController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', getAuthors);
router.get('/:id', getAuthorById);
router.get('/:id/books', getAuthorBooks);

router.get('/:id/stats', protect, getAuthorStats);
router.get('/:id/analytics', protect, getAuthorStats); // Mapping analytics to stats for now
router.get('/:id/royalties/history', protect, getAuthorRoyaltiesHistory);

module.exports = router;
