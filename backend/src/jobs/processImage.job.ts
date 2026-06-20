import { PrismaClient } from '@prisma/client';
import path from 'path';
import { runValidationPipeline } from '../services/validation.service';
import { storageService } from '../services/storage.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * processImageJob — runs the validation pipeline for a single image.
 *
 * Triggered via setImmediate after the upload response is sent.
 * This gives the user an immediate PROCESSING response while validation
 * happens asynchronously in the background.
 *
 * Production note: Replace setImmediate with a BullMQ queue backed by Redis.
 * Benefits:
 *   - Persistent jobs (survive server restarts)
 *   - Retries with exponential backoff
 *   - Concurrency control
 *   - Job monitoring dashboard (Bull Board)
 *   - Horizontal scaling — multiple worker processes
 *
 * For a real product, the flow would be:
 *   Upload API → SQS/BullMQ → Worker Lambda/Container → DB update → WebSocket push
 */
export function enqueueProcessImage(imageId: string, filePath: string): void {
  setImmediate(async () => {
    await processImage(imageId, filePath);
  });
}

async function processImage(imageId: string, filePath: string): Promise<void> {
  logger.info(`[Job] Starting validation for image: ${imageId}`);

  try {
    const result = await runValidationPipeline(filePath, imageId);

    let processedUrl: string | undefined;

    if (result.accepted && result.processedPath) {
      // A processed version was created (e.g., HEIC → JPEG)
      const relativePath = path.relative(path.join(process.cwd(), 'uploads'), result.processedPath);
      processedUrl = storageService.getPublicUrl(relativePath);
    }

    await prisma.image.update({
      where: { id: imageId },
      data: {
        status: result.accepted ? 'ACCEPTED' : 'REJECTED',
        rejectionReason: result.rejectionReason ?? undefined,
        width: result.width ?? undefined,
        height: result.height ?? undefined,
        format: result.format ?? undefined,
        hash: result.hash ?? undefined,
        processedUrl: processedUrl ?? undefined,
      },
    });

    logger.info(
      `[Job] Completed ${imageId}: ${result.accepted ? 'ACCEPTED' : `REJECTED (${result.rejectionReason})`}`
    );
  } catch (err) {
    logger.error(`[Job] Error processing image ${imageId}`, err);

    // Mark as rejected so it doesn't stay stuck in PROCESSING forever
    await prisma.image
      .update({
        where: { id: imageId },
        data: {
          status: 'REJECTED',
          rejectionReason: 'Processing failed due to an internal error',
        },
      })
      .catch((updateErr) => {
        logger.error(`[Job] Failed to update error status for ${imageId}`, updateErr);
      });
  }
}
