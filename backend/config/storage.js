const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

/**
 * Storage Module - Supports multiple storage backends
 * - Local filesystem (default)
 * - AWS S3 (configurable)
 * - Firebase Storage (configurable)
 */

class StorageService {
  constructor() {
    this.storageType = process.env.STORAGE_TYPE || 'local';
    this.uploadDir = path.join(__dirname, '../uploads');
    
    // Ensure upload directory exists for local storage
    if (this.storageType === 'local' && !fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Get multer configuration based on storage type
   */
  getMulterConfig() {
    if (this.storageType === 'local') {
      return this.getLocalStorage();
    } else if (this.storageType === 's3') {
      return this.getS3Storage();
    } else if (this.storageType === 'firebase') {
      return this.getFirebaseStorage();
    }
    
    // Default to local
    return this.getLocalStorage();
  }

  /**
   * Local filesystem storage
   */
  getLocalStorage() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
      },
      fileFilter: this.fileFilter
    });
  }

  /**
   * AWS S3 storage (placeholder - requires @aws-sdk/client-s3 and multer-s3)
   */
  getS3Storage() {
    console.warn('S3 storage not yet implemented, using local storage');
    // TODO: Implement S3 storage
    // const multerS3 = require('multer-s3');
    // const { S3Client } = require('@aws-sdk/client-s3');
    
    return this.getLocalStorage();
  }

  /**
   * Firebase Storage (placeholder - requires firebase-admin)
   */
  getFirebaseStorage() {
    console.warn('Firebase storage not yet implemented, using local storage');
    // TODO: Implement Firebase storage
    
    return this.getLocalStorage();
  }

  /**
   * File filter to validate upload file types
   */
  fileFilter(req, file, cb) {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,webp,gif').split(',');
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    
    // For mobile apps, prioritize file extension over MIME type
    // Accept if extension is valid, regardless of MIME type
    if (ext && allowedTypes.includes(ext)) {
      cb(null, true);
      return;
    }
    
    // Also accept if MIME type is image/* and has valid extension
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    
    // Reject if neither condition is met
    cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`), false);
  }

  /**
   * Get public URL for uploaded file
   */
  getFileUrl(filename) {
    if (this.storageType === 'local') {
      return `/uploads/${filename}`;
    } else if (this.storageType === 's3') {
      // return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
      return `/uploads/${filename}`;
    } else if (this.storageType === 'firebase') {
      // return Firebase Storage URL
      return `/uploads/${filename}`;
    }
    
    return `/uploads/${filename}`;
  }

  /**
   * Delete file from storage
   */
  async deleteFile(filename) {
    if (this.storageType === 'local') {
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    }
    // TODO: Implement delete for S3 and Firebase
    return false;
  }
}

module.exports = new StorageService();

