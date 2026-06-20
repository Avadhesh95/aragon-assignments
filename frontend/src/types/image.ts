export type ImageStatus = 'PROCESSING' | 'ACCEPTED' | 'REJECTED';

export interface ImageRecord {
  id: string;
  originalName: string;
  originalUrl: string;
  processedUrl: string | null;
  format: string;
  width: number | null;
  height: number | null;
  fileSize: number;
  status: ImageStatus;
  rejectionReason: string | null;
  createdAt: string;
}

export interface UploadResponse {
  id: string;
  status: 'PROCESSING';
  originalUrl: string;
}

export interface PaginatedResponse {
  data: ImageRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/** Client-side state for a file being uploaded or already uploaded */
export interface UploadItem {
  /** Local file reference for preview before upload completes */
  localFile?: File;
  /** Local object URL for preview */
  previewUrl?: string;
  /** Server-assigned ID (available once upload request completes) */
  imageId?: string;
  /** Current display status */
  status: ImageStatus | 'UPLOADING' | 'FRONTEND_REJECTED';
  /** Human-readable rejection message */
  rejectionReason?: string;
  /** Full record from server (available after polling completes) */
  record?: ImageRecord;
}
