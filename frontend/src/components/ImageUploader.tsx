import { useCallback, useRef, useState } from 'react';
import type { DragEvent } from 'react';

interface ImageUploaderProps {
  onFiles: (files: FileList | File[]) => void;
}

export function ImageUploader({ onFiles }: ImageUploaderProps) {
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
      const files = e.dataTransfer.files;
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files?.length) {
        onFiles(files);
        // Reset input so same file can be re-uploaded
        e.target.value = '';
      }
    },
    [onFiles]
  );

  return (
    <div
      id="upload-dropzone"
      className={`upload-dropzone ${isDragging ? 'upload-dropzone--dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload images — click or drag and drop"
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
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

      <div className="upload-dropzone__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
      </div>

      <p className="upload-dropzone__title">
        {isDragging ? 'Drop to upload' : 'Drag & drop photos here'}
      </p>
      <p className="upload-dropzone__subtitle">
        or <span className="upload-dropzone__link">browse files</span>
      </p>
      <p className="upload-dropzone__formats">JPEG · PNG · HEIC · up to 10MB</p>
    </div>
  );
}
