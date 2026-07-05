const express = require('express');
const router = express.Router();
const { getBooks, getBookBySlug, getRelatedBooks, getBookReviews } = require('../controllers/bookController');

router.get('/', getBooks);
router.get('/:slug', getBookBySlug);
router.get('/:slug/related', getRelatedBooks);
router.get('/:slug/reviews', getBookReviews);

module.exports = router;
