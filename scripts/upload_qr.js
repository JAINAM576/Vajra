const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
const path = require('path');

// Load env variables
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const qrPath = path.join(__dirname, '../images/Qr_Code.png');

console.log('Uploading QR code from:', qrPath);

cloudinary.uploader.upload(qrPath, {
  folder: 'lockapp_qr',
  public_id: 'qr_code_download',
  overwrite: true,
  resource_type: 'image'
}, (error, result) => {
  if (error) {
    console.error('Upload failed:', error);
  } else {
    console.log('Upload success!');
    console.log('Secure URL:', result.secure_url);
  }
});
