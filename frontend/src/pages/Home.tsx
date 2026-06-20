import { useState, useEffect, useCallback, useRef } from 'react';
import { useImageUpload } from '../hooks/useImageUpload';
import { PhotoTile } from '../components/PhotoTile';
import { SidebarDropzone } from '../components/SidebarDropzone';

const MAX_PHOTOS = 10;
const MIN_ACCEPTED = 6;

/** Collapsible section wrapper */
function Accordion({
  id,
  icon,
  title,
  defaultOpen = true,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="accordion" id={id}>
      <button
        className="accordion__header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${id}-body`}
      >
        <span className="accordion__status-icon">{icon}</span>
        <span className="accordion__title">{title}</span>
        <svg
          className={`accordion__chevron ${open ? 'accordion__chevron--open' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && <div className="accordion__body" id={`${id}-body`}>{children}</div>}
    </div>
  );
}

/** Toast component */
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="toast" role="status" aria-live="polite">
      <svg className="toast__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>
      <span className="toast__text">{message}</span>
      <button className="toast__close" onClick={onClose} aria-label="Dismiss">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}

export function Home() {
  const { allItems, accepted, rejected, processing, handleFiles, handleDelete } = useImageUpload();
  const [toast, setToast] = useState<string | null>(null);
  const prevAcceptedCount = useRef(0);

  // Show toast when newly accepted photos appear
  useEffect(() => {
    if (accepted.length > prevAcceptedCount.current) {
      setToast('Your photos have been successfully uploaded!');
    }
    prevAcceptedCount.current = accepted.length;
  }, [accepted.length]);

  const handleDismissToast = useCallback(() => setToast(null), []);

  const acceptedPct = MAX_PHOTOS > 0 ? (accepted.length / MAX_PHOTOS) * 100 : 0;

  const isUploading = processing.length > 0;

  return (
    <div className="app">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="sidebar" aria-label="Upload panel">
        {/* Top bar */}
        <div className="sidebar__topbar" style={{ position: 'relative', overflow: 'hidden' }}>
          <div className="sidebar__progress-strip" aria-hidden="true" />
          <div className="sidebar__logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
              <circle cx="8" cy="9" r="1.5" fill="white" stroke="none" />
            </svg>
          </div>
          <span className="sidebar__brand-name">Aragon.ai</span>
        </div>

        <div className="sidebar__body">


          {/* Title */}
          <div className="sidebar__upload-header">
            <svg className="sidebar__upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <h1 className="sidebar__upload-title">Upload photos</h1>
            <p className="sidebar__upload-desc">
              Now the fun begins! Select at least <strong>{MIN_ACCEPTED} of your best photos</strong>.
              Uploading a mix of close-ups, selfies and mid-range shots can help the AI better
              capture your face and body type.
            </p>
          </div>

          {/* Drop zone */}
          <SidebarDropzone onFiles={handleFiles} isUploading={isUploading} />

          {/* File list — shown while any items are uploading OR processing */}
          {allItems.filter((i) => i.status === 'UPLOADING' || i.status === 'PROCESSING').length > 0 && (
            <>
              <p className="sidebar__timing-note">It can take up to 1 minute to upload</p>
              <div className="sidebar__file-list" aria-label="Uploading files">
                {allItems
                  .filter((i) => i.status === 'UPLOADING' || i.status === 'PROCESSING')
                  .map((item) => (
                    <div key={item.key} className="sidebar__file-item">
                      <div className="sidebar__file-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path strokeLinecap="round" d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                      <span className="sidebar__file-name" title={item.localFile?.name ?? 'Image'}>
                        {item.localFile?.name ?? item.record?.originalName ?? 'Image'}
                      </span>
                      <div className="sidebar__file-spinner" aria-label="Uploading" />
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ── Main panel ──────────────────────────────────────────────── */}
      <main className="main" id="main-content">
        {/* Sticky header */}
        <div className="main__header">
          <div className="main__header-row">
            <h2 className="main__title">Uploaded Images</h2>
            <span className="main__count" aria-live="polite">
              {allItems.length} of {MAX_PHOTOS}
            </span>
          </div>

          {/* Green progress bar for accepted count */}
          <div
            className="main__progress-bar-wrap"
            role="progressbar"
            aria-valuenow={accepted.length}
            aria-valuemin={0}
            aria-valuemax={MAX_PHOTOS}
            aria-label={`${accepted.length} of ${MAX_PHOTOS} photos accepted`}
          >
            <div
              className="main__progress-bar"
              style={{ width: `${acceptedPct}%` }}
            />
          </div>
        </div>

        <div className="main__body">
          {/* Empty state — only when nothing uploaded at all yet */}
          {allItems.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon" aria-hidden="true">
                <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="8" y="8" width="48" height="48" rx="8" />
                  <circle cx="22" cy="24" r="4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 44l14-14 8 8 8-10 14 16" />
                </svg>
              </div>
              <h3 className="empty-state__title">No photos yet</h3>
              <p className="empty-state__desc">
                Upload your portrait photos from the panel on the left to get started.
              </p>
            </div>
          )}

          {/*
           * STATE: PROCESSING
           * Files have been uploaded to the server and are being validated.
           * Show "Hang tight" accordion with blurred thumbnails + delete buttons.
           * UPLOADING items (no server ID yet) are NOT shown in main panel.
           */}
          {processing.length > 0 && (
            <Accordion
              id="processing-section"
              defaultOpen={true}
              icon={
                <svg
                  viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"
                  style={{ width: 20, height: 20, color: '#D97706', animation: 'spin 1.2s linear infinite' }}
                >
                  <circle cx="10" cy="10" r="7" strokeOpacity="0.25" />
                  <path strokeLinecap="round" d="M10 3a7 7 0 017 7" />
                </svg>
              }
              title="Hang tight – we're checking your photos"
            >
              <p className="accordion__subtitle">
                You're almost there! We're just verifying the quality of your uploads to make sure you get the best results.
              </p>
              <div className="photo-grid" role="list" aria-label="Processing photos">
                {processing.map((item) => (
                  <div key={item.key} role="listitem">
                    <PhotoTile item={item} onDelete={handleDelete} />
                  </div>
                ))}
              </div>
            </Accordion>
          )}

          {/* STATE: ACCEPTED */}
          {accepted.length > 0 && (
            <Accordion
              id="accepted-section"
              defaultOpen={true}
              icon={
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20, color: '#16A34A' }}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              }
              title="Accepted Photos"
            >
              <p className="accordion__subtitle">
                These images passed our scoring test and will all be used to generate your AI photos.
              </p>
              <div className="photo-grid" role="list" aria-label="Accepted photos">
                {accepted.map((item) => (
                  <div key={item.key} role="listitem">
                    <PhotoTile item={item} onDelete={handleDelete} />
                  </div>
                ))}
              </div>
            </Accordion>
          )}

          {/* Rejected Photos accordion */}
          {rejected.length > 0 && (
            <Accordion
              id="rejected-section"
              defaultOpen={true}
              icon={
                <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20, color: '#DC2626' }}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
              }
              title="Some Photos Didn't Meet Our Guidelines"
            >
              <p className="accordion__subtitle">
                {accepted.length >= MIN_ACCEPTED
                  ? `You can move to the next step as you've uploaded ${accepted.length} good photos. Replacing these is optional.`
                  : `Upload at least ${MIN_ACCEPTED} accepted photos to continue.`}
              </p>
              <div className="photo-grid photo-grid--rejected" role="list" aria-label="Rejected photos">
                {rejected.map((item) => (
                  <div key={item.key} role="listitem">
                    <PhotoTile item={item} onDelete={handleDelete} showRejectionLabel />
                  </div>
                ))}
              </div>
            </Accordion>
          )}

          {/* Photo Requirements accordion */}
          <Accordion
            id="requirements-section"
            defaultOpen={false}
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20, color: '#16A34A' }}>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            }
            title="Photo Requirements"
          >
            <ul className="req-list">
              {[
                'Clear, sharp face visible',
                'High resolution (minimum 512×512px)',
                'Good lighting on the face',
                'Single person in frame',
                'Natural, forward-facing pose',
                'JPEG, PNG, or HEIC format',
                'File size under 10MB',
              ].map((req) => (
                <li key={req} className="req-list__item req-list__item--ok">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  {req}
                </li>
              ))}
            </ul>
          </Accordion>

          {/* Photo Restrictions accordion */}
          <Accordion
            id="restrictions-section"
            defaultOpen={false}
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20, color: '#DC2626' }}>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1.5-9.75a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            }
            title="Photo Restrictions"
          >
            <ul className="req-list">
              {[
                'No sunglasses or heavy face coverings',
                'No group photos with multiple faces',
                'Avoid heavily filtered or edited images',
                'No blurry or out-of-focus photos',
                'No duplicate or very similar photos',
                'Face must not be too far from camera',
              ].map((req) => (
                <li key={req} className="req-list__item req-list__item--bad">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  {req}
                </li>
              ))}
            </ul>
          </Accordion>
        </div>
      </main>

      {/* Toast */}
      {toast && <Toast message={toast} onClose={handleDismissToast} />}
    </div>
  );
}
