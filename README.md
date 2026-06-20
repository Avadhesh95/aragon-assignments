# Aragon.ai — AI Portrait Validator

An image upload and validation platform that validates portrait photos for quality, face detection, resolution, uniqueness, and blur.

## Architecture

```
React + TypeScript (Vite)
        ↓
ImageUploader Component (drag & drop)
        ↓
Frontend Validation (mime type, file size)
        ↓
POST /api/images (multipart/form-data)
        ↓
Express API → multer middleware
        ↓
Local Storage (S3-interface pattern)
        ↓
PostgreSQL via Prisma (status = PROCESSING)
        ↓
setImmediate → Async Validation Pipeline
        ↓
  ┌─────────────────────────────────┐
  │ 1. Format check (cheapest)      │
  │ 2. Resolution check (sharp)     │
  │ 3. HEIC → JPEG convert          │
  │ 4. Blur detection (Laplacian)   │
  │ 5. Similarity (dHash + Hamming) │
  │ 6. Face detection (skin-tone)   │
  └─────────────────────────────────┘
        ↓
DB Update → ACCEPTED / REJECTED
        ↓
Frontend polls GET /api/images every 2s
```

## Quick Start

### Prerequisites

- Node.js ≥ 18
- PostgreSQL (local via Homebrew or Docker)

### 1. Database Setup

```bash
# If using Homebrew PostgreSQL:
brew services start postgresql@14
createdb aragon_images

# Or using Docker:
docker run --name aragon-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
docker exec -it aragon-pg createdb -U postgres aragon_images
```

### 2. Backend

```bash
cd backend
cp .env.example .env  # Edit DATABASE_URL if needed
npm install
npx prisma migrate dev
npm run dev
# Server starts on http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# App opens at http://localhost:5173
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | Vanilla CSS (dark glassmorphism design) |
| Backend | Node.js, Express, TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Storage | Local filesystem (S3-interface pattern) |
| Image Processing | sharp |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/images` | Upload image(s) via multipart/form-data |
| `GET` | `/api/images` | List images (paginated, filterable by status) |
| `GET` | `/api/images/:id` | Get single image details |
| `DELETE` | `/api/images/:id` | Delete image and files |
| `GET` | `/api/health` | Health check |

## Validation Pipeline

Stages are ordered by computational cost (fail fast):

1. **Format** — JPEG, PNG, HEIC only
2. **Resolution** — Minimum 512×512px
3. **HEIC Conversion** — Converts to JPEG via sharp/heic-convert
4. **Blur Detection** — Laplacian variance (sharp grayscale convolution)
5. **Similarity** — dHash perceptual hashing + Hamming distance (< 10 = duplicate)
6. **Face Detection** — Skin-tone region analysis with connected-component labeling

## Key Design Decisions

### Storage Abstraction
`StorageService` interface allows swapping local disk for S3 by changing a single file. The URL structure (`uploads/original/`, `uploads/processed/`) mirrors S3 key patterns.

### Async Processing
Uses `setImmediate` for async validation. The upload API returns immediately with `status: PROCESSING`. Frontend polls for updates.

**Production upgrade**: BullMQ + Redis for persistent job queues with retries, monitoring, and horizontal scaling.

### State Management
React hooks only — no Redux/Zustand. Upload state is local to the page with no cross-route sharing needs.

### Face Detection Approach
Uses skin-tone region analysis (RGB + YCbCr heuristics) with connected-component labeling. No native binary dependencies.

**Production upgrade**: AWS Rekognition or `@vladmandic/face-api` when canvas build tools are available.

### Similarity Detection
dHash perceptual hashing computed via sharp (9×8 grayscale resize → gradient comparison → 64-bit hash). O(n) linear scan.

**Production upgrade**: CLIP embeddings stored in pgvector for O(log n) cosine similarity search.

## Production Improvements

- **Job Queue**: BullMQ + Redis (persistent, retryable, monitorable)
- **Storage**: AWS S3 + CloudFront CDN
- **Real-time**: WebSockets/SSE instead of polling
- **Similarity**: CLIP embeddings + pgvector
- **Rate Limiting**: express-rate-limit per IP
- **Auth**: JWT/session-based authentication
- **Monitoring**: Structured logging (Pino) + APM (Datadog/Sentry)
- **Direct Upload**: Presigned S3 URLs — client uploads directly, bypassing API server
- **Event-Driven**: Upload → SQS → Worker Lambda → Validation → DB Update → WebSocket push

## Security

- File size limit: 10MB (multer)
- MIME type whitelist
- UUID filenames (no path traversal)
- Files are read-only after write
- No file execution
