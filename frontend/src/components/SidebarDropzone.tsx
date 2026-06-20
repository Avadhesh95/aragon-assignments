import { useCallback, useRef, useState } from 'react';
import type { DragEvent } from 'react';

interface SidebarDropzoneProps {
  onFiles: (files: FileList | File[]) => void;
  isUploading: boolean;
}

export function SidebarDropzone({ onFiles, isUploading }: SidebarDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
    },
    [onFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files?.length) {
        onFiles(files);
        e.target.value = '';
      }
    },
    [onFiles]
  );

  return (
    <div
      id="upload-dropzone"
      className={`sidebar__dropzone${isDragging ? ' sidebar__dropzone--dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !isUploading && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload images — click or drag and drop"
      onKeyDown={(e) => e.key === 'Enter' && !isUploading && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        id="file-input"
        accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
        multiple
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      <button
        className={`sidebar__dropzone-btn${isUploading ? ' sidebar__dropzone-btn--uploading' : ''}`}
        tabIndex={-1}
        aria-hidden="true"
      >
        {isUploading ? (
          <>
            <span
              style={{
                width: 12,
                height: 12,
                border: '2px solid rgba(255,255,255,.4)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                display: 'inline-block',
              }}
              aria-hidden="true"
            />
            Uploading...
          </>
        ) : (
          <>
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M9.25 2a.75.75 0 01.75.75V8.5h5.75a.75.75 0 010 1.5H10v5.75a.75.75 0 01-1.5 0V10H2.75a.75.75 0 010-1.5H8.5V2.75A.75.75 0 019.25 2z"
                clipRule="evenodd"
              />
            </svg>
            Upload files
          </>
        )}
      </button>

      <p className="sidebar__dropzone-hint">Click to upload or drag and drop</p>
      <p className="sidebar__dropzone-formats">PNG, JPG, HEIC up to 10MB</p>
    </div>
  );
}
