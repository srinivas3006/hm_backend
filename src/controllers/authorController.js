const User = require('../models/User');
const Book = require('../models/Book');
const Order = require('../models/Order');

// @desc    Get all authors
// @route   GET /api/authors
// @access  Public
const getAuthors = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 12;
    const skip = (pageNum - 1) * limitNum;

    const authors = await User.find({ role: 'author' })
      .select('name profilePicture bio')
      .skip(skip)
      .limit(limitNum);
      
    // Count books for each author
    const authorsWithCounts = await Promise.all(authors.map(async (author) => {
      const bookCount = await Book.countDocuments({ author: author._id, status: 'published' });
      return { ...author.toObject(), bookCount };
    }));

    const total = await User.countDocuments({ role: 'author' });

    res.json({
      success: true,
      data: authorsWithCounts,
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

// @desc    Get author profile
// @route   GET /api/authors/:id
// @access  Public
const getAuthorById = async (req, res) => {
  try {
    const author = await User.findOne({ _id: req.params.id, role: 'author' }).select('-password');
    if (!author) return res.status(404).json({ success: false, message: 'Author not found' });
    res.json({ success: true, data: author });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get author books
// @route   GET /api/authors/:id/books
// @access  Public
const getAuthorBooks = async (req, res) => {
  try {
    const { page, limit, sort } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 12;
    const skip = (pageNum - 1) * limitNum;

    let sortQuery = '-createdAt';
    if (sort === '-sales') sortQuery = '-sales'; // Assuming we want this later, for now sorting by date

    const books = await Book.find({ author: req.params.id, status: 'published' })
      .populate('category', 'name slug')
      .sort(sortQuery)
      .skip(skip)
      .limit(limitNum);

    const total = await Book.countDocuments({ author: req.params.id, status: 'published' });

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

// @desc    Get author stats
// @route   GET /api/authors/:id/stats
// @access  Private (Author/Admin)
const getAuthorStats = async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const books = await Book.find({ author: req.params.id });
    const bookIds = books.map(b => b._id);

    const orders = await Order.find({ 'items.book': { $in: bookIds }, status: { $in: ['DELIVERED', 'SHIPPED', 'PROCESSING'] } });

    let totalRevenue = 0;
    let totalSales = 0;

    orders.forEach(order => {
      order.items.forEach(item => {
        if (bookIds.some(id => id.equals(item.book))) {
          totalRevenue += item.price * item.quantity;
          totalSales += item.quantity;
        }
      });
    });

    res.json({
      success: true,
      data: {
        totalBooks: books.length,
        totalSales,
        totalRevenue
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get author royalties history
// @route   GET /api/authors/:id/royalties/history
// @access  Private
const getAuthorRoyaltiesHistory = async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const user = await User.findById(req.params.id);
    
    // For now, return a mock or empty history until we implement full payouts
    res.json({
      success: true,
      data: {
        balance: user.royaltiesBalance || 0,
        history: [] 
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAuthors,
  getAuthorById,
  getAuthorBooks,
  getAuthorStats,
  getAuthorRoyaltiesHistory
};
