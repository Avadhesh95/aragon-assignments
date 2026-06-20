interface UploadStatusProps {
  total: number;
  accepted: number;
  rejected: number;
  processing: number;
}

export function UploadStatus({ total, accepted, rejected, processing }: UploadStatusProps) {
  if (total === 0) return null;

  return (
    <div className="upload-status" role="status" aria-live="polite">
      <div className="upload-status__stat">
        <span className="upload-status__value upload-status__value--total">{total}</span>
        <span className="upload-status__label">Total</span>
      </div>
      <div className="upload-status__divider" aria-hidden="true" />
      <div className="upload-status__stat">
        <span className="upload-status__value upload-status__value--accepted">{accepted}</span>
        <span className="upload-status__label">Accepted</span>
      </div>
      <div className="upload-status__divider" aria-hidden="true" />
      <div className="upload-status__stat">
        <span className="upload-status__value upload-status__value--rejected">{rejected}</span>
        <span className="upload-status__label">Rejected</span>
      </div>
      {processing > 0 && (
        <>
          <div className="upload-status__divider" aria-hidden="true" />
          <div className="upload-status__stat">
            <span className="upload-status__value upload-status__value--processing">{processing}</span>
            <span className="upload-status__label">Processing</span>
          </div>
        </>
      )}
    </div>
  );
}
