const aws = require('aws-sdk');
const crypto = require('crypto');

const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_REGION || 'us-east-1',
});

// @desc    Get Presigned URL for direct S3 upload
// @route   GET /api/uploads/presigned-url
// @access  Private (Author/Admin)
const getPresignedUrl = async (req, res) => {
  try {
    const { fileType, fileName } = req.query;
    if (!fileType || !fileName) {
      return res.status(400).json({ success: false, message: 'fileName and fileType are required' });
    }

    const extension = fileName.split('.').pop();
    const key = `uploads/${crypto.randomUUID()}.${extension}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Expires: 300, // URL expires in 5 minutes
      ContentType: fileType,
      ACL: 'public-read'
    };

    const presignedUrl = await s3.getSignedUrlPromise('putObject', params);
    const publicUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_S3_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    res.json({
      success: true,
      data: {
        presignedUrl,
        publicUrl,
        key
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPresignedUrl
};
