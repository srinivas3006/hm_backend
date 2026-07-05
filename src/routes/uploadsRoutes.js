const express = require('express');
const router = express.Router();
const { uploadImage, uploadDocument } = require('../controllers/uploadController');
const { upload } = require('../config/cloudinary');
const { protect } = require('../middleware/authMiddleware');

router.post('/image', protect, upload.single('image'), uploadImage);
router.post('/document', protect, upload.single('document'), uploadDocument);

module.exports = router;
