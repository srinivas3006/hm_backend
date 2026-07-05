// @desc    Upload an image
// @route   POST /api/uploads/image
// @access  Private
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file' });
    }
    
    res.status(200).json({
      success: true,
      data: {
        url: req.file.path // Cloudinary returns the secure URL in path
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload a document/manuscript
// @route   POST /api/uploads/document
// @access  Private (Author/Admin)
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a document file' });
    }
    
    res.status(200).json({
      success: true,
      data: {
        url: req.file.path // Cloudinary returns the secure URL in path
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  uploadImage,
  uploadDocument
};
