import sharp from 'sharp';
import { logger } from '../utils/logger';

/**
 * Blur Detection Service
 *
 * Uses the Laplacian variance method:
 *   1. Convert image to grayscale
 *   2. Apply a Laplacian convolution kernel (edge detection)
 *   3. Compute variance of the result
 *   4. Low variance = smooth = blurry
 *
 * The Laplacian highlights rapid intensity changes (edges).
 * A sharp image has many strong edges → high variance.
 * A blurry image has few/soft edges → low variance.
 *
 * Trade-off: This is a simplified CPU-based approach.
 * Production alternative: Run OpenCV's Laplacian on a worker thread
 * or use a pre-trained ML model for more robust blur classification.
 */

const BLUR_THRESHOLD = 80; // Variance below this → blurry

// 3×3 Laplacian kernel
const LAPLACIAN_KERNEL = [
  0, 1, 0,
  1, -4, 1,
  0, 1, 0,
];

export async function detectBlur(imagePath: string): Promise<{ isBlurry: boolean; score: number }> {
  try {
    const { data, info } = await sharp(imagePath)
      .grayscale()
      .resize({ width: 512, height: 512, fit: 'inside' }) // Normalize for consistent scoring
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;
    const pixels = new Float32Array(data);

    // Apply 3×3 Laplacian convolution
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let laplacianValue = 0;
        let ki = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIdx = (y + ky) * width + (x + kx);
            laplacianValue += pixels[pixelIdx] * LAPLACIAN_KERNEL[ki++];
          }
        }

        sum += laplacianValue;
        sumSq += laplacianValue * laplacianValue;
        count++;
      }
    }

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    const score = Math.round(variance * 100) / 100;

    logger.debug(`Blur score for ${imagePath}: ${score} (threshold: ${BLUR_THRESHOLD})`);

    return {
      isBlurry: score < BLUR_THRESHOLD,
      score,
    };
  } catch (err) {
    logger.error('Blur detection failed', err);
    // Fail open — don't reject if blur detection itself errors
    return { isBlurry: false, score: 999 };
  }
}
