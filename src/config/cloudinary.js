const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Determine folder and resource_type based on the upload type
    let folderName = 'harglim/images';
    let resourceType = 'image';
    let format = undefined;

    // Check if it is a document/manuscript
    if (file.originalname.match(/\.(pdf|doc|docx)$/i)) {
      folderName = 'harglim/manuscripts';
      resourceType = 'raw';
    } else if (file.mimetype.startsWith('image/')) {
      folderName = 'harglim/images';
    }

    return {
      folder: folderName,
      resource_type: resourceType,
      public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '')}`,
    };
  }
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
