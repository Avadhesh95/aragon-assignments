import { useImageUpload } from '../hooks/useImageUpload';
import { ImageUploader } from '../components/ImageUploader';
import { ImageCard } from '../components/ImageCard';
import { UploadStatus } from '../components/UploadStatus';

export function Home() {
  const { allItems, accepted, rejected, processing, handleFiles, handleDelete } = useImageUpload();

  return (
    <div className="page">
      {/* Header */}
      <header className="header">
        <div className="header__inner">
          <div className="header__brand">
            <div className="header__logo" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="url(#logoGrad)" />
                <path d="M8 22l6-8 4 5 3-4 5 7H8z" fill="white" opacity="0.9"/>
                <circle cx="22" cy="11" r="2.5" fill="white" opacity="0.9"/>
                <defs>
                  <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6366F1"/>
                    <stop offset="1" stopColor="#8B5CF6"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div>
              <h1 className="header__title">Aragon.ai</h1>
              <p className="header__subtitle">AI Portrait Validator</p>
            </div>
          </div>

          <UploadStatus
            total={allItems.length}
            accepted={accepted.length}
            rejected={rejected.length}
            processing={processing.length}
          />
        </div>
      </header>

      <main className="main" id="main-content">
        {/* Upload Zone */}
        <section className="section" aria-labelledby="upload-heading">
          <h2 id="upload-heading" className="section__title">Upload Photos</h2>
          <ImageUploader onFiles={handleFiles} />
          <p className="section__hint">
            Photos are validated for quality, uniqueness, and face detection
          </p>
        </section>

        {/* Results Grid */}
        {allItems.length > 0 && (
          <div className="results">
            {/* Accepted Column */}
            <section className="results__column" aria-labelledby="accepted-heading">
              <div className="results__column-header results__column-header--accepted">
                <div className="results__column-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
                  </svg>
                </div>
                <h2 id="accepted-heading" className="results__column-title">
                  Accepted
                  <span className="results__count">{accepted.length}</span>
                </h2>
              </div>

              <div className="results__cards" role="list" aria-label="Accepted images">
                {processing.map((item) => (
                  <div key={item.key} role="listitem">
                    <ImageCard item={item} onDelete={handleDelete} />
                  </div>
                ))}
                {accepted.map((item) => (
                  <div key={item.key} role="listitem">
                    <ImageCard item={item} onDelete={handleDelete} />
                  </div>
                ))}
                {accepted.length === 0 && processing.length === 0 && (
                  <div className="results__empty">
                    <p>No accepted images yet</p>
                  </div>
                )}
              </div>
            </section>

            {/* Rejected Column */}
            <section className="results__column" aria-labelledby="rejected-heading">
              <div className="results__column-header results__column-header--rejected">
                <div className="results__column-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd"/>
                  </svg>
                </div>
                <h2 id="rejected-heading" className="results__column-title">
                  Rejected
                  <span className="results__count">{rejected.length}</span>
                </h2>
              </div>

              <div className="results__cards" role="list" aria-label="Rejected images">
                {rejected.map((item) => (
                  <div key={item.key} role="listitem">
                    <ImageCard item={item} onDelete={handleDelete} />
                  </div>
                ))}
                {rejected.length === 0 && (
                  <div className="results__empty">
                    <p>No rejections yet</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Empty state */}
        {allItems.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" fill="url(#emptyGrad)" opacity="0.15"/>
                <path d="M14 34l8-10 5 6 4-5 7 9H14z" stroke="url(#emptyGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="30" cy="19" r="3" stroke="url(#emptyGrad)" strokeWidth="1.5"/>
                <defs>
                  <linearGradient id="emptyGrad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6366F1"/>
                    <stop offset="1" stopColor="#8B5CF6"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h3 className="empty-state__title">Upload your first photo</h3>
            <p className="empty-state__description">
              Upload portrait photos to validate them for quality,
              face detection, uniqueness, and resolution.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
