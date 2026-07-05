const User = require('../models/User');
const Order = require('../models/Order');
const Book = require('../models/Book');

// @desc    Get user stats
// @route   GET /api/users/:id/stats
// @access  Private
const getUserStats = async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const totalOrders = await Order.countDocuments({ user: user._id });
    const wishlistCount = user.wishlist.length;
    const libraryCount = user.library.length;

    res.json({
      success: true,
      data: {
        totalOrders,
        wishlistCount,
        libraryCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/:id
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { name, bio, profilePicture } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name) user.name = name;
    if (profilePicture) user.profilePicture = profilePicture;
    // bio is not in User schema yet, but can be added later if needed. Assuming it exists or just skipping.

    await user.save();

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user orders
// @route   GET /api/users/:id/orders
// @access  Private
const getUserOrders = async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { page, limit, status } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    let query = { user: req.params.id };
    if (status && status !== 'all') {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('items.book', 'title coverImage price')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: orders,
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

// @desc    Get user wishlist
// @route   GET /api/users/:id/wishlist
// @access  Private
const getUserWishlist = async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const user = await User.findById(req.params.id).populate({
      path: 'wishlist',
      select: 'title coverImage price discountPrice author ratings reviewCount',
      populate: { path: 'author', select: 'name' }
    });
    res.json({ success: true, data: user.wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user library
// @route   GET /api/users/:id/library
// @access  Private
const getUserLibrary = async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const user = await User.findById(req.params.id).populate({
      path: 'library',
      select: 'title coverImage format'
    });
    res.json({ success: true, data: user.library });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add to wishlist
// @route   POST /api/users/:id/wishlist
// @access  Private
const addToWishlist = async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const { bookId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user.wishlist.includes(bookId)) {
      user.wishlist.push(bookId);
      await user.save();
    }
    res.json({ success: true, data: user.wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove from wishlist
// @route   DELETE /api/users/:id/wishlist/:bookId
// @access  Private
const removeFromWishlist = async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const user = await User.findById(req.params.id);
    user.wishlist = user.wishlist.filter(id => id.toString() !== req.params.bookId);
    await user.save();
    res.json({ success: true, data: user.wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getUserStats,
  updateUserProfile,
  getUserOrders,
  getUserWishlist,
  getUserLibrary,
  addToWishlist,
  removeFromWishlist
};
