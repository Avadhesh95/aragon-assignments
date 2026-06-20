import type { UploadItem } from '../types/image';

interface ImageCardProps {
  item: UploadItem & { key: string };
  onDelete: (key: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: UploadItem['status'] }) {
  const config = {
    ACCEPTED: { label: 'Accepted', cls: 'badge--accepted' },
    REJECTED: { label: 'Rejected', cls: 'badge--rejected' },
    FRONTEND_REJECTED: { label: 'Invalid', cls: 'badge--rejected' },
    PROCESSING: { label: 'Processing', cls: 'badge--processing' },
    UPLOADING: { label: 'Uploading', cls: 'badge--uploading' },
  }[status];

  return (
    <span className={`badge ${config.cls}`}>
      {status === 'PROCESSING' || status === 'UPLOADING' ? (
        <span className="badge__spinner" aria-hidden="true" />
      ) : null}
      {config.label}
    </span>
  );
}

export function ImageCard({ item, onDelete }: ImageCardProps) {
  const previewSrc =
    item.previewUrl ??
    item.record?.processedUrl ??
    item.record?.originalUrl ??
    undefined;

  const filename =
    item.localFile?.name ??
    item.record?.originalName ??
    'Image';

  const fileSize =
    item.localFile?.size ??
    item.record?.fileSize ??
    null;

  const dimensions =
    item.record?.width && item.record?.height
      ? `${item.record.width}×${item.record.height}`
      : null;

  const isSettled = item.status === 'ACCEPTED' || item.status === 'REJECTED' || item.status === 'FRONTEND_REJECTED';

  return (
    <article
      className={`image-card image-card--${item.status.toLowerCase().replace('_', '-')}`}
      aria-label={`${filename} — ${item.status}`}
    >
      {/* Preview */}
      <div className="image-card__preview">
        {previewSrc ? (
          <img src={previewSrc} alt={filename} loading="lazy" />
        ) : (
          <div className="image-card__preview-placeholder" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}

        {/* Status overlay for processing */}
        {(item.status === 'PROCESSING' || item.status === 'UPLOADING') && (
          <div className="image-card__overlay" aria-hidden="true">
            <div className="image-card__loader" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="image-card__info">
        <div className="image-card__header">
          <p className="image-card__filename" title={filename}>
            {filename.length > 28 ? filename.slice(0, 25) + '…' : filename}
          </p>
          <StatusBadge status={item.status} />
        </div>

        <div className="image-card__meta">
          {fileSize && <span>{formatBytes(fileSize)}</span>}
          {dimensions && <span>{dimensions}</span>}
          {item.record?.format && (
            <span>{item.record.format.toUpperCase()}</span>
          )}
        </div>

        {/* Rejection reason */}
        {(item.status === 'REJECTED' || item.status === 'FRONTEND_REJECTED') &&
          item.rejectionReason && (
            <p className="image-card__rejection-reason" role="alert">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4a.75.75 0 01-1.5 0v-4A.75.75 0 0110 5zm0 8a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              {item.rejectionReason}
            </p>
          )}
      </div>

      {/* Actions */}
      {isSettled && (
        <button
          className="image-card__delete"
          onClick={() => onDelete(item.key)}
          aria-label={`Remove ${filename}`}
          title="Remove"
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
    </article>
  );
}
