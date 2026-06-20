import type { UploadItem } from '../types/image';

interface PhotoTileProps {
  item: UploadItem & { key: string };
  onDelete: (key: string) => void;
  showRejectionLabel?: boolean;
}

export function PhotoTile({ item, onDelete, showRejectionLabel }: PhotoTileProps) {
  const isUploading  = item.status === 'UPLOADING';  // No server ID yet — shown only in sidebar
  const isProcessing = item.status === 'PROCESSING'; // Has server ID — shown blurred in main panel
  const isRejected   = item.status === 'REJECTED' || item.status === 'FRONTEND_REJECTED';

  const previewSrc =
    item.previewUrl ??
    item.record?.processedUrl ??
    item.record?.originalUrl ??
    undefined;

  const filename =
    item.localFile?.name ?? item.record?.originalName ?? 'Image';

  const rejectionReason = item.rejectionReason ?? item.record?.rejectionReason ?? null;

  return (
    <div className={`photo-tile${isRejected ? ' photo-tile--rejected' : ''}`}>
      {/* Image container */}
      <div className={`photo-tile__img-wrap${isProcessing ? ' photo-tile__img-wrap--processing' : ''}`}>
        {previewSrc ? (
          <img
            className={`photo-tile__img${isProcessing ? ' photo-tile__img--blurred' : ''}`}
            src={previewSrc}
            alt={filename}
            loading="lazy"
          />
        ) : (
          <div className="photo-tile__placeholder" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path strokeLinecap="round" d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}



        {/* Delete button — visible even during processing */}
        {!isUploading && (
          <button
            className="photo-tile__delete"
            onClick={() => onDelete(item.key)}
            aria-label={`Remove ${filename}`}
            title="Remove photo"
          >
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {/* Hover tooltip for rejected items */}
        {isRejected && rejectionReason && (
          <div className="photo-tile__tooltip" role="tooltip">
            <div className="photo-tile__tooltip-title">
              <svg
                style={{ width: 14, height: 14, color: '#EF4444', flexShrink: 0 }}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Try again</span>
            </div>
            <div className="photo-tile__tooltip-desc">
              {rejectionReason}
            </div>
          </div>
        )}
      </div>

      {/* Rejection label below tile */}
      {showRejectionLabel && isRejected && rejectionReason && (
        <span className="photo-tile__label" aria-label={`Rejection reason: ${rejectionReason}`}>
          {rejectionReason}
        </span>
      )}
    </div>
  );
}
