import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { createImageRecord } from '../services/upload.service';
import { enqueueProcessImage } from '../jobs/processImage.job';
import { storageService } from '../services/storage.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * POST /api/images
 * Accepts one or more image files via multipart/form-data.
 * Each file is saved to disk, a DB record created (status=PROCESSING),
 * and an async validation job is enqueued.
 * Returns immediately with the IDs and PROCESSING status.
 */
export async function uploadImages(req: Request, res: Response): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files provided' });
      return;
    }

    const results = await Promise.all(
      files.map(async (file) => {
        const record = await createImageRecord(file);
        // Kick off async processing — doesn't block the response
        enqueueProcessImage(record.id, file.path);
        return record;
      })
    );

    res.status(202).json(results);
  } catch (err) {
    logger.error('Upload error', err);
    res.status(500).json({ error: 'Upload failed' });
  }
}

/**
 * GET /api/images
 * Returns paginated list of all images with their status.
 * Supports ?page=1&limit=20&status=ACCEPTED|REJECTED|PROCESSING
 */
export async function getImages(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;

    const where = status ? { status: status as 'PROCESSING' | 'ACCEPTED' | 'REJECTED' } : {};

    const [images, total] = await Promise.all([
      prisma.image.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          originalName: true,
          originalUrl: true,
          processedUrl: true,
          format: true,
          width: true,
          height: true,
          fileSize: true,
          status: true,
          rejectionReason: true,
          createdAt: true,
        },
      }),
      prisma.image.count({ where }),
    ]);

    res.json({
      data: images,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('Get images error', err);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
}

/**
 * GET /api/images/:id
 * Returns a single image's status and metadata.
 */
export async function getImageById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const image = await prisma.image.findUnique({
      where: { id },
    });

    if (!image) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    res.json(image);
  } catch (err) {
    logger.error('Get image error', err);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
}

/**
 * DELETE /api/images/:id
 * Deletes an image record and its associated files.
 */
export async function deleteImage(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const image = await prisma.image.findUnique({ where: { id } });
    if (!image) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    // Delete DB record
    await prisma.image.delete({ where: { id } });

    // Clean up files from disk
    const originalPath = path.join(process.cwd(), 'uploads', 'original', image.filename);
    await storageService.delete(originalPath);

    if (image.processedUrl) {
      const processedFilename = path.basename(image.processedUrl);
      const processedPath = path.join(process.cwd(), 'uploads', 'processed', processedFilename);
      await storageService.delete(processedPath);
    }

    res.status(204).send();
  } catch (err) {
    logger.error('Delete image error', err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
}
