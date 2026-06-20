import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { Buffer } from 'buffer';
import heicConvert from 'heic-convert';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { detectBlur } from './blur.service';
import { computeHash, checkSimilarity } from './similarity.service';
import { detectFaces } from './face.service';

const MIN_DIMENSION = 512; // Minimum width or height in pixels

const ALLOWED_FORMATS = new Set(['jpeg', 'jpg', 'png', 'heic', 'heif']);

export interface ValidationResult {
  accepted: boolean;
  rejectionReason?: string;
  processedPath?: string;
  hash?: string;
  width?: number;
  height?: number;
  format?: string;
}

/**
 * Validation Pipeline
 *
 * Stages run in order of computational cost (cheapest first = fail fast):
 *   1. Format check  — free (metadata only)
 *   2. Resolution    — cheap (sharp metadata)
 *   3. HEIC convert  — medium (I/O + decode)
 *   4. Blur detect   — medium (convolution on grayscale buffer)
 *   5. Similarity    — medium (hash + DB query)
 *   6. Face detect   — expensive (neural network inference)
 */
export async function runValidationPipeline(
  filePath: string,
  imageId: string
): Promise<ValidationResult> {

  // ── Stage 1: Format Validation ────────────────────────────────────────────
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(filePath).metadata();
  } catch {
    // sharp couldn't even read the file — bad format
    return { accepted: false, rejectionReason: 'Invalid or corrupt image file' };
  }

  const format = (metadata.format ?? '').toLowerCase();

  // For HEIC files, sharp may report 'heif'
  const normalizedFormat = format === 'heif' ? 'heic' : format;

  if (!ALLOWED_FORMATS.has(normalizedFormat)) {
    return {
      accepted: false,
      rejectionReason: `Unsupported format: ${format || 'unknown'}. Allowed: JPEG, PNG, HEIC`,
    };
  }

  // ── Stage 2: Resolution Check ─────────────────────────────────────────────
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return {
      accepted: false,
      rejectionReason: `Resolution too low (${width}×${height}px). Minimum: ${MIN_DIMENSION}×${MIN_DIMENSION}px`,
      width,
      height,
      format: normalizedFormat,
    };
  }

  // ── Stage 3: HEIC → JPEG Conversion ──────────────────────────────────────
  let workingPath = filePath;
  let finalFormat = normalizedFormat;

  if (normalizedFormat === 'heic') {
    try {
      workingPath = await convertHeicToJpeg(filePath);
      finalFormat = 'jpeg';
      logger.info(`Converted HEIC → JPEG: ${workingPath}`);
    } catch (err) {
      logger.error('HEIC conversion failed', err);
      return { accepted: false, rejectionReason: 'Failed to convert HEIC image' };
    }
  }

  // ── Stage 4: Blur Detection ───────────────────────────────────────────────
  const { isBlurry, score } = await detectBlur(workingPath);
  logger.debug(`Blur score: ${score}`);

  if (isBlurry) {
    return {
      accepted: false,
      rejectionReason: `Image is too blurry (sharpness score: ${score.toFixed(0)})`,
      width,
      height,
      format: finalFormat,
    };
  }

  // ── Stage 5: Similarity Check ─────────────────────────────────────────────
  const hash = await computeHash(workingPath);
  const { isSimilar, similarImageId, distance } = await checkSimilarity(hash, imageId);

  if (isSimilar) {
    return {
      accepted: false,
      rejectionReason: `Too similar to an existing upload (image: ${similarImageId}, distance: ${distance})`,
      width,
      height,
      format: finalFormat,
      hash,
    };
  }

  // ── Stage 6: Face Detection ───────────────────────────────────────────────
  const faceResult = await detectFaces(workingPath, width, height);

  if (faceResult.rejectionReason) {
    return {
      accepted: false,
      rejectionReason: faceResult.rejectionReason,
      width,
      height,
      format: finalFormat,
      hash,
    };
  }

  // ── All checks passed ─────────────────────────────────────────────────────
  return {
    accepted: true,
    processedPath: workingPath !== filePath ? workingPath : undefined,
    width,
    height,
    format: finalFormat,
    hash,
  };
}

/**
 * Convert a HEIC file to JPEG and save in the processed directory.
 * Returns the path to the new JPEG file.
 */
async function convertHeicToJpeg(heicPath: string): Promise<string> {
  const processedDir = path.join(process.cwd(), 'uploads', 'processed');
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  const outputFilename = `${uuidv4()}.jpg`;
  const outputPath = path.join(processedDir, outputFilename);

  const inputBuffer = fs.readFileSync(heicPath);

  const outputBuffer = await heicConvert({
    buffer: inputBuffer,
    format: 'JPEG',
    quality: 0.92,
  });

  fs.writeFileSync(outputPath, Buffer.from(outputBuffer));
  return outputPath;
}
