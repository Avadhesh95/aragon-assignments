import { PrismaClient } from '@prisma/client';
import path from 'path';
import { storageService } from './storage.service';

const prisma = new PrismaClient();

export interface UploadResult {
  id: string;
  status: 'PROCESSING';
  originalUrl: string;
}

/**
 * Persists an uploaded file record to the database immediately.
 * Status is PROCESSING — the validation job runs asynchronously.
 */
export async function createImageRecord(file: Express.Multer.File): Promise<UploadResult> {
  const relativePath = path.join('original', file.filename);
  const originalUrl = storageService.getPublicUrl(relativePath);

  const image = await prisma.image.create({
    data: {
      filename: file.filename,
      originalName: file.originalname,
      originalUrl,
      format: file.mimetype.split('/')[1] ?? 'unknown',
      fileSize: file.size,
      status: 'PROCESSING',
    },
  });

  return {
    id: image.id,
    status: 'PROCESSING',
    originalUrl,
  };
}
