import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * StorageService — abstraction layer over file storage.
 *
 * Current implementation: local disk.
 * Production swap: replace with S3StorageService implementing the same interface.
 *
 * In production we would:
 *   1. Upload to S3 with presigned PUT URLs
 *   2. Store the S3 key/URL in Postgres (not a local path)
 *   3. Serve via CloudFront CDN
 */
export interface IStorageService {
  getPublicUrl(relativePath: string): string;
  ensureDirectory(dir: string): void;
  delete(filePath: string): Promise<void>;
}

export class LocalStorageService implements IStorageService {
  private readonly uploadsDir: string;
  private readonly baseUrl: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.baseUrl = `http://localhost:${process.env.PORT || 3001}`;
  }

  /**
   * Converts a relative path (from uploads root) to a publicly accessible URL.
   * e.g. "original/abc.jpg" → "http://localhost:3001/uploads/original/abc.jpg"
   */
  getPublicUrl(relativePath: string): string {
    return `${this.baseUrl}/uploads/${relativePath}`;
  }

  ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      logger.error(`Failed to delete file: ${filePath}`, err);
    }
  }
}

export const storageService = new LocalStorageService();
