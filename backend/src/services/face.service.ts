import sharp from 'sharp';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * Face Detection Service
 *
 * Implementation Strategy:
 * We use a skin-tone region detection heuristic via sharp's pixel analysis.
 * This avoids native binary dependencies (canvas, TensorFlow native bindings)
 * while still providing useful face detection capabilities.
 *
 * The approach:
 *   1. Convert image to RGB buffer
 *   2. Scan for skin-tone pixels (using HSV-range heuristics)
 *   3. Cluster skin regions to estimate face locations
 *   4. Apply rules based on cluster count and area
 *
 * Trade-offs:
 *   - No native binaries required → zero install friction
 *   - Works well for frontal portraits with good lighting
 *   - Less accurate than CNN-based detectors for edge cases (dark skin, odd lighting)
 *
 * Production replacement:
 *   - AWS Rekognition DetectFaces API (managed, highly accurate, scales to millions)
 *   - OR: @vladmandic/face-api.js with canvas (when canvas build tools available)
 *   - OR: Run Python FastAPI microservice with face_recognition library as sidecar
 *
 * The architecture here is intentionally designed so the face detection
 * implementation is completely swappable — the ValidationService only calls
 * detectFaces(path, w, h) → FaceDetectionResult, and doesn't care how it works.
 */

export interface FaceDetectionResult {
  faceCount: number;    // -1 = detection skipped/failed (fail-open)
  rejectionReason?: string;
}

const FACE_AREA_THRESHOLD = 0.08; // Face must occupy at least 8% of image area

export async function detectFaces(
  imagePath: string,
  imageWidth: number,
  imageHeight: number
): Promise<FaceDetectionResult> {
  try {
    // Downscale for performance — we don't need full resolution for region detection
    const TARGET_SIZE = 256;
    const scale = Math.min(TARGET_SIZE / imageWidth, TARGET_SIZE / imageHeight, 1);
    const scaledW = Math.round(imageWidth * scale);
    const scaledH = Math.round(imageHeight * scale);

    const { data } = await sharp(imagePath)
      .resize(scaledW, scaledH, { fit: 'fill' })
      .toColorspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true });

    // ── Skin Pixel Detection ───────────────────────────────────────────────
    // Uses RGB ranges calibrated for a wide range of skin tones
    const skinMask = new Uint8Array(scaledW * scaledH);
    let skinPixelCount = 0;

    for (let i = 0; i < scaledW * scaledH; i++) {
      const r = data[i * 3];
      const g = data[i * 3 + 1];
      const b = data[i * 3 + 2];

      if (isSkinPixel(r, g, b)) {
        skinMask[i] = 1;
        skinPixelCount++;
      }
    }

    const skinRatio = skinPixelCount / (scaledW * scaledH);
    logger.debug(`Skin pixel ratio: ${(skinRatio * 100).toFixed(1)}%`);

    // Very low skin ratio → no face
    if (skinRatio < 0.01) {
      return { faceCount: 0, rejectionReason: 'No face detected' };
    }

    // ── Cluster Skin Regions (simple row-scan segmentation) ────────────────
    const clusters = findSkinClusters(skinMask, scaledW, scaledH);
    logger.debug(`Skin clusters found: ${clusters.length}`);

    if (clusters.length === 0) {
      return { faceCount: 0, rejectionReason: 'No face detected' };
    }

    // Multiple distinct skin clusters → likely multiple faces
    if (clusters.length > 2) {
      return { faceCount: clusters.length, rejectionReason: 'Multiple faces detected' };
    }

    // Check face area as fraction of original image area
    const largestCluster = clusters.reduce((a, b) => (a.size > b.size ? a : b));
    const clusterAreaFraction = largestCluster.size / (scaledW * scaledH);
    const scaledFaceAreaFraction = clusterAreaFraction; // Scale-invariant since we downsampled proportionally

    logger.debug(`Largest cluster area fraction: ${(scaledFaceAreaFraction * 100).toFixed(1)}%`);

    if (scaledFaceAreaFraction < FACE_AREA_THRESHOLD) {
      return {
        faceCount: 1,
        rejectionReason: `Face too small (${(scaledFaceAreaFraction * 100).toFixed(1)}% of image)`,
      };
    }

    return { faceCount: 1 };
  } catch (err) {
    logger.error('Face detection error — failing open', err);
    return { faceCount: -1 }; // Fail open: don't reject on detection error
  }
}

/**
 * Skin pixel detection using multi-model RGB/YCbCr heuristics.
 * Handles a range of skin tones across ethnicities.
 *
 * References:
 *   - Kovac et al. (2003): "Human Skin Color Clustering for Face Detection"
 *   - Chai & Ngan (1999): "Face Segmentation Using Skin-Color Map"
 */
function isSkinPixel(r: number, g: number, b: number): boolean {
  // Basic RGB range
  const rgbSkin =
    r > 95 && g > 40 && b > 20 &&
    r > g && r > b &&
    Math.abs(r - g) > 15 &&
    r - b > 15;

  // YCbCr color space check (more robust across lighting conditions)
  const yy = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
  const cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

  const ycbcrSkin = yy > 80 && cb >= 85 && cb <= 135 && cr >= 135 && cr <= 180;

  return rgbSkin || ycbcrSkin;
}

interface Cluster {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  size: number;
}

/**
 * Simple connected-component labeling for skin mask.
 * Uses row-scan union-find to merge adjacent skin regions.
 * Returns distinct clusters above a minimum size threshold.
 */
function findSkinClusters(mask: Uint8Array, width: number, height: number): Cluster[] {
  const labels = new Int32Array(mask.length).fill(-1);
  let nextLabel = 0;
  const parent: number[] = [];

  function find(x: number): number {
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  // First pass: label pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx]) continue;

      const leftIdx = x > 0 ? y * width + x - 1 : -1;
      const topIdx = y > 0 ? (y - 1) * width + x : -1;

      const leftLabel = leftIdx >= 0 && mask[leftIdx] ? labels[leftIdx] : -1;
      const topLabel = topIdx >= 0 && mask[topIdx] ? labels[topIdx] : -1;

      if (leftLabel === -1 && topLabel === -1) {
        labels[idx] = nextLabel;
        parent[nextLabel] = nextLabel;
        nextLabel++;
      } else if (leftLabel !== -1 && topLabel === -1) {
        labels[idx] = leftLabel;
      } else if (topLabel !== -1 && leftLabel === -1) {
        labels[idx] = topLabel;
      } else {
        labels[idx] = leftLabel;
        union(leftLabel, topLabel);
      }
    }
  }

  // Second pass: resolve labels and build bounding boxes
  const clusterMap = new Map<number, Cluster>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (labels[idx] === -1) continue;

      const root = find(labels[idx]);
      if (!clusterMap.has(root)) {
        clusterMap.set(root, { minX: x, maxX: x, minY: y, maxY: y, size: 0 });
      }

      const c = clusterMap.get(root)!;
      c.minX = Math.min(c.minX, x);
      c.maxX = Math.max(c.maxX, x);
      c.minY = Math.min(c.minY, y);
      c.maxY = Math.max(c.maxY, y);
      c.size++;
    }
  }

  // Filter tiny clusters (noise) — must be at least 0.5% of image pixels
  const minSize = width * height * 0.005;
  return Array.from(clusterMap.values()).filter((c) => c.size >= minSize);
}
