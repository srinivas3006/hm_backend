const Book = require('../models/Book');
const Category = require('../models/Category');
const Review = require('../models/Review');

// @desc    Get all published books with pagination and filters
// @route   GET /api/books
// @access  Public
const getBooks = async (req, res) => {
  try {
    const { category, minPrice, maxPrice, sort, page, limit, featured, bestseller, newRelease } = req.query;

    // Build query
    let query = { status: 'published' };

    if (featured) query.isFeatured = true;
    if (bestseller) query.isBestseller = true;
    if (newRelease) query.isNewRelease = true;

    if (category) {
      const categoryDoc = await Category.findOne({ slug: category });
      if (categoryDoc) {
        query.category = categoryDoc._id;
      } else {
        // If category slug doesn't exist, return empty
        return res.json({ success: true, data: [], pagination: { total: 0, page: 1, pages: 0 } });
      }
    }
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    let sortQuery = '-createdAt';
    if (sort === 'newest') sortQuery = '-createdAt';
    if (sort === 'price_asc') sortQuery = 'price';
    if (sort === 'price_desc') sortQuery = '-price';

    const books = await Book.find(query)
      .populate('author', 'name')
      .populate('category', 'name slug')
      .sort(sortQuery)
      .skip(skip)
      .limit(limitNum);

    const total = await Book.countDocuments(query);

    res.json({
      success: true,
      data: books,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single book by slug
// @route   GET /api/books/:slug
// @access  Public
const getBookBySlug = async (req, res) => {
  try {
    const book = await Book.findOne({ slug: req.params.slug, status: 'published' })
      .populate('author', 'name bio profilePicture')
      .populate('category', 'name slug');

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    res.json({
      success: true,
      data: book
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Search books
// @route   GET /api/search
// @access  Public
const searchBooks = async (req, res) => {
  try {
    const { q, page, limit } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const books = await Book.find(
      { $text: { $search: q }, status: 'published' },
      { score: { $meta: 'textScore' } }
    )
    .populate('author', 'name')
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(limitNum);

    const total = await Book.countDocuments({ $text: { $search: q }, status: 'published' });

    res.json({
      success: true,
      data: books,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get related books
// @route   GET /api/books/:slug/related
// @access  Public
const getRelatedBooks = async (req, res) => {
  try {
    const { limit } = req.query;
    const limitNum = parseInt(limit, 10) || 4;
    
    const book = await Book.findOne({ slug: req.params.slug, status: 'published' });
    if (!book) return res.status(404).json({ success: false, message: 'Book not found' });

    const related = await Book.find({
      category: book.category,
      _id: { $ne: book._id },
      status: 'published'
    })
      .populate('author', 'name')
      .limit(limitNum);
      
    res.json({ success: true, data: related });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get book reviews
// @route   GET /api/books/:slug/reviews
// @access  Public
const getBookReviews = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 5;
    const skip = (pageNum - 1) * limitNum;

    const book = await Book.findOne({ slug: req.params.slug });
    if (!book) return res.status(404).json({ success: false, message: 'Book not found' });

    const reviews = await Review.find({ book: book._id })
      .populate('user', 'name profilePicture')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum);
      
    const total = await Review.countDocuments({ book: book._id });

    res.json({
      success: true,
      data: reviews,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getBooks,
  getBookBySlug,
  searchBooks,
  getRelatedBooks,
  getBookReviews
};
