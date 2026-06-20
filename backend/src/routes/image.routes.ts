import { Router, Request, Response, NextFunction } from 'express';
import { upload } from '../middleware/upload.middleware';
import {
  uploadImages,
  getImages,
  getImageById,
  deleteImage,
} from '../controllers/image.controller';

export const imageRoutes = Router();

/**
 * POST /api/images
 * Accepts up to 10 images via multipart/form-data field name "images"
 */
imageRoutes.post(
  '/',
  (req: Request, res: Response, next: NextFunction) => {
    const uploadMiddleware = upload.array('images', 10);
    uploadMiddleware(req, res, (err) => {
      if (err) {
        // Handle multer-specific errors (file size, type, etc.)
        res.status(400).json({
          error: err.message || 'File upload error',
        });
        return;
      }
      next();
    });
  },
  uploadImages
);

/**
 * GET /api/images
 * List all images with optional pagination and status filter
 */
imageRoutes.get('/', getImages);

/**
 * GET /api/images/:id
 * Get a single image by ID
 */
imageRoutes.get('/:id', getImageById);

/**
 * DELETE /api/images/:id
 * Delete an image and its files
 */
imageRoutes.delete('/:id', deleteImage);
