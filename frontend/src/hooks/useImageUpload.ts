import { useState, useCallback, useRef, useEffect } from 'react';
import type { UploadItem } from '../types/image';
import { uploadImages, fetchImages, deleteImage } from '../services/imageApi';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif']);
const POLL_INTERVAL_MS = 2000;

/**
 * useImageUpload — central state management hook
 *
 * Why hooks vs Redux/Zustand?
 * Upload state is entirely local to this page — there's no cross-route sharing,
 * no server-cache invalidation complexity, and no concurrent mutations from other
 * tabs. React hooks provide sufficient state management without introducing
 * unnecessary complexity or bundle overhead.
 *
 * For a production app with multiple pages sharing image state, I'd add
 * React Query for server-state caching and TanStack's mutation APIs.
 */
export function useImageUpload() {
  const [items, setItems] = useState<Map<string, UploadItem>>(new Map());
  const pollTimerRef = useRef<number | null>(null);
  const processingIdsRef = useRef<Set<string>>(new Set());

  // ── Helpers ────────────────────────────────────────────────────────────────
  const updateItem = useCallback((key: string, update: Partial<UploadItem>) => {
    setItems((prev) => {
      const next = new Map(prev);
      const existing = next.get(key) ?? { status: 'UPLOADING' };
      next.set(key, { ...existing, ...update });
      return next;
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => {
      const next = new Map(prev);
      // Revoke object URL to free memory
      const item = next.get(key);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      next.delete(key);
      return next;
    });
    processingIdsRef.current.delete(key);
  }, []);

  // ── Frontend Validation ────────────────────────────────────────────────────
  const validateFile = (file: File): string | null => {
    if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      return `Unsupported format: ${file.type || 'unknown'}. Allowed: JPEG, PNG, HEIC`;
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'File too large. Maximum size: 10MB';
    }
    return null;
  };

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const localKeys: string[] = [];

    // Step 1: Validate each file and create preview entries
    for (const file of fileArray) {
      const localKey = `local-${Date.now()}-${Math.random()}`;
      const previewUrl = URL.createObjectURL(file);
      const rejectionReason = validateFile(file);

      if (rejectionReason) {
        setItems((prev) => {
          const next = new Map(prev);
          next.set(localKey, {
            localFile: file,
            previewUrl,
            status: 'FRONTEND_REJECTED',
            rejectionReason,
          });
          return next;
        });
      } else {
        setItems((prev) => {
          const next = new Map(prev);
          next.set(localKey, {
            localFile: file,
            previewUrl,
            status: 'UPLOADING',
          });
          return next;
        });
        validFiles.push(file);
        localKeys.push(localKey);
      }
    }

    if (validFiles.length === 0) return;

    // Step 2: Upload valid files together
    try {
      const responses = await uploadImages(validFiles);

      // Step 3: Transition local keys → server IDs
      for (let i = 0; i < responses.length; i++) {
        const localKey = localKeys[i];
        const response = responses[i];
        const localItem = Array.from(items.values())[0]; // grab preview

        setItems((prev) => {
          const next = new Map(prev);
          const existing = next.get(localKey) ?? {};
          // Replace local key with server ID
          next.delete(localKey);
          next.set(response.id, {
            ...existing,
            imageId: response.id,
            status: 'PROCESSING',
          });
          return next;
        });

        processingIdsRef.current.add(response.id);
      }

      void localItem; // suppress unused warning
      startPolling();
    } catch {
      // Mark all uploading items as failed
      localKeys.forEach((key) => {
        updateItem(key, {
          status: 'FRONTEND_REJECTED',
          rejectionReason: 'Upload failed — please try again',
        });
      });
    }
  }, [items, updateItem]);

  // ── Polling ────────────────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return; // Already polling

    const poll = async () => {
      const pendingIds = processingIdsRef.current;
      if (pendingIds.size === 0) {
        stopPolling();
        return;
      }

      try {
        const { data: records } = await fetchImages(1, 100);

        setItems((prev) => {
          const next = new Map(prev);

          for (const record of records) {
            if (!pendingIds.has(record.id)) continue;

            const existing = next.get(record.id);
            if (!existing) continue;

            if (record.status !== 'PROCESSING') {
              next.set(record.id, {
                ...existing,
                status: record.status,
                rejectionReason: record.rejectionReason ?? undefined,
                record,
              });
              pendingIds.delete(record.id);
            }
          }

          return next;
        });

        if (pendingIds.size === 0) {
          stopPolling();
        }
      } catch {
        // Poll failure is non-fatal — just retry next interval
      }
    };

    pollTimerRef.current = window.setInterval(poll, POLL_INTERVAL_MS);
    // Run immediately
    poll();
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ── Load existing images on mount ──────────────────────────────────────────
  useEffect(() => {
    const loadExisting = async () => {
      try {
        const { data: records } = await fetchImages(1, 100);
        setItems((prev) => {
          const next = new Map(prev);
          for (const record of records) {
            if (!next.has(record.id)) {
              next.set(record.id, {
                imageId: record.id,
                status: record.status,
                rejectionReason: record.rejectionReason ?? undefined,
                record,
              });
              if (record.status === 'PROCESSING') {
                processingIdsRef.current.add(record.id);
              }
            }
          }
          return next;
        });

        if (processingIdsRef.current.size > 0) {
          startPolling();
        }
      } catch {
        // Silently fail — empty state is acceptable
      }
    };

    loadExisting();

    return () => stopPolling();
  }, [startPolling, stopPolling]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (key: string) => {
    const item = items.get(key);
    if (item?.imageId) {
      try {
        await deleteImage(item.imageId);
      } catch {
        // Best-effort delete
      }
    }
    removeItem(key);
  }, [items, removeItem]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const allItems = Array.from(items.entries()).map(([key, item]) => ({ key, ...item }));
  const accepted = allItems.filter((i) => i.status === 'ACCEPTED');
  const rejected = allItems.filter((i) => i.status === 'REJECTED' || i.status === 'FRONTEND_REJECTED');
  const processing = allItems.filter((i) => i.status === 'PROCESSING' || i.status === 'UPLOADING');

  return {
    allItems,
    accepted,
    rejected,
    processing,
    handleFiles,
    handleDelete,
  };
}
