const express = require('express');
const router = express.Router();
const { 
  getUserStats, 
  updateUserProfile, 
  getUserOrders, 
  getUserWishlist, 
  getUserLibrary, 
  addToWishlist, 
  removeFromWishlist 
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/:id/stats', getUserStats);
router.put('/:id', updateUserProfile);
router.get('/:id/orders', getUserOrders);
router.get('/:id/wishlist', getUserWishlist);
router.get('/:id/library', getUserLibrary);
router.post('/:id/wishlist', addToWishlist);
router.delete('/:id/wishlist/:bookId', removeFromWishlist);

module.exports = router;
