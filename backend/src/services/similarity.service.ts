import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import sharp from 'sharp';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Similarity Detection Service — Perceptual Hashing
 *
 * Approach: Difference Hash (dHash)
 *   1. Resize image to 9×8 pixels
 *   2. Convert to grayscale
 *   3. For each row, compare adjacent pixels (left vs right)
 *   4. Encode result as a 64-bit binary string → hex hash
 *   5. Compare hashes with Hamming distance
 *
 * Trade-offs:
 *   - dHash is fast, rotation-invariant for small rotations
 *   - Works well for detecting near-duplicate photos
 *   - Not suitable for semantic similarity (different photos of same person)
 *   - Production upgrade: CLIP embeddings + pgvector for cosine similarity
 *
 * Hamming distance < 10 → considered "too similar" (out of 64 bits)
 */

const SIMILARITY_THRESHOLD = 10; // Hamming distance

export async function computeHash(imagePath: string): Promise<string> {
  try {
    // Resize to 9x8 for dHash (9 wide gives 8 comparisons per row)
    const { data } = await sharp(imagePath)
      .resize(9, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let bits = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = data[row * 9 + col];
        const right = data[row * 9 + col + 1];
        bits += left < right ? '1' : '0';
      }
    }

    // Convert binary string to hex
    const hex = BigInt('0b' + bits).toString(16).padStart(16, '0');
    return hex;
  } catch (err) {
    logger.error('Hash computation failed', err);
    // Fall back to a random hash so we don't block the pipeline
    return crypto.randomBytes(8).toString('hex');
  }
}

export function hammingDistance(hash1: string, hash2: string): number {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const b1 = parseInt(hash1[i], 16).toString(2).padStart(4, '0');
    const b2 = parseInt(hash2[i], 16).toString(2).padStart(4, '0');
    for (let j = 0; j < 4; j++) {
      if (b1[j] !== b2[j]) distance++;
    }
  }
  return distance;
}

export async function checkSimilarity(
  hash: string,
  excludeId?: string
): Promise<{ isSimilar: boolean; similarImageId?: string; distance?: number }> {
  try {
    // Fetch all existing accepted images with hashes
    // Production: Use pgvector or a dedicated vector DB for O(log n) search
    // Current: O(n) linear scan — acceptable for small datasets in this demo
    const existingImages = await prisma.image.findMany({
      where: {
        hash: { not: null },
        status: { in: ['ACCEPTED', 'PROCESSING'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, hash: true },
    });

    for (const image of existingImages) {
      if (!image.hash) continue;
      const distance = hammingDistance(hash, image.hash);
      if (distance < SIMILARITY_THRESHOLD) {
        logger.debug(`Similar image found: ${image.id} (distance: ${distance})`);
        return { isSimilar: true, similarImageId: image.id, distance };
      }
    }

    return { isSimilar: false };
  } catch (err) {
    logger.error('Similarity check failed', err);
    return { isSimilar: false };
  }
}
