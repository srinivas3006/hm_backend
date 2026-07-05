const express = require('express');
const router = express.Router();
const { 
  createPublishRequest,
  getPublishPackages
} = require('../controllers/publishController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.post('/publish-requests', protect, authorize('author', 'admin'), createPublishRequest);
router.get('/publish-packages', getPublishPackages);

module.exports = router;
