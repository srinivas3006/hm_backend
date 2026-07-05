const PublishRequest = require('../models/PublishRequest');
const PublishPackage = require('../models/PublishPackage');

// @desc    Submit a manuscript publish request
// @route   POST /api/publish-requests
// @access  Private (Author)
const createPublishRequest = async (req, res) => {
  try {
    const { title, genre, wordCount, packageId, fileUrl } = req.body;

    if (!title || !genre || !wordCount || !packageId || !fileUrl) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const publishRequest = await PublishRequest.create({
      user: req.user._id,
      title,
      genre,
      wordCount,
      packageId,
      fileUrl
    });

    res.status(201).json({
      success: true,
      data: {
        publishRequest
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all publish packages
// @route   GET /api/publish-packages
// @access  Public
const getPublishPackages = async (req, res) => {
  try {
    const packages = await PublishPackage.find({ isActive: true });
    res.json({
      success: true,
      data: packages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createPublishRequest,
  getPublishPackages
};
