import { useState, useCallback, useRef, useEffect } from 'react';
import type { UploadItem } from '../types/image';
import { uploadImages, fetchImages, deleteImage } from '../services/imageApi';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
]);
const POLL_INTERVAL_MS = 2000;

/**
 * useImageUpload — central state management hook
 *
 * Why hooks vs Redux/Zustand?
 * Upload state is entirely local to this page — there's no cross-route sharing,
 * no server-cache invalidation complexity, and no concurrent mutations from other
 * tabs. React hooks provide sufficient state management without introducing
 * unnecessary complexity or bundle overhead.
 */
export function useImageUpload() {
  const [items, setItems] = useState<Map<string, UploadItem>>(new Map());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingIdsRef = useRef<Set<string>>(new Set());


  // ── Frontend Validation ────────────────────────────────────────────────────
  const validateFile = useCallback((file: File): string | null => {
    const mimeOk = ALLOWED_MIME_TYPES.has(file.type.toLowerCase());
    if (!mimeOk) {
      // HEIC files often have empty or wrong MIME type in browsers — check extension
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'heic' && ext !== 'heif') {
        return `Unsupported format: ${file.type || file.name.split('.').pop() || 'unknown'}. Allowed: JPEG, PNG, HEIC`;
      }
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'File too large. Maximum size: 10MB';
    }
    return null;
  }, []);

  // ── Polling ────────────────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;

    const poll = async () => {
      const pendingIds = processingIdsRef.current;
      if (pendingIds.size === 0) {
        stopPolling();
        return;
      }

      try {
        const response = await fetchImages(1, 100);
        const records = response.data;

        // Compute resolved IDs OUTSIDE the updater so the updater stays pure.
        const resolvedIds = new Set(
          records
            .filter((r) => pendingIds.has(r.id) && r.status !== 'PROCESSING')
            .map((r) => r.id)
        );

        if (resolvedIds.size > 0) {
          setItems((prev) => {
            const next = new Map(prev);
            for (const record of records) {
              if (!resolvedIds.has(record.id)) continue;
              const existing = next.get(record.id);
              // Fallback to updating or inserting
              next.set(record.id, {
                ...(existing || {}),
                imageId: record.id,
                status: record.status,
                rejectionReason: record.rejectionReason ?? undefined,
                record,
              });
            }
            return next;
          });

          // Mutate the ref AFTER setItems — never inside the updater
          for (const id of resolvedIds) {
            pendingIds.delete(id);
          }
        }

        // Even if some aren't resolved yet, we should update status in real time if any processing changes status
        const processingUpdates = records.filter(r => pendingIds.has(r.id));
        if (processingUpdates.length > 0) {
          setItems((prev) => {
            const next = new Map(prev);
            let changed = false;
            for (const record of processingUpdates) {
              const existing = next.get(record.id);
              if (existing && existing.status !== record.status) {
                next.set(record.id, {
                  ...existing,
                  status: record.status,
                  rejectionReason: record.rejectionReason ?? undefined,
                  record,
                });
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        }

        if (pendingIds.size === 0) {
          stopPolling();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    poll();
  }, [stopPolling]);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // Step 1: Validate ALL files OUTSIDE of setItems (avoid React StrictMode double-call)
      const validated: Array<{
        file: File;
        localKey: string;
        previewUrl: string;
        rejectionReason: string | null;
      }> = [];

      for (const file of fileArray) {
        const localKey = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const previewUrl = URL.createObjectURL(file);
        const rejectionReason = validateFile(file);
        validated.push({ file, localKey, previewUrl, rejectionReason });
      }

      const validEntries = validated.filter((v) => v.rejectionReason === null);
      const rejectedEntries = validated.filter((v) => v.rejectionReason !== null);

      // Step 2: Add all entries to state at once
      setItems((prev) => {
        const next = new Map(prev);

        for (const entry of rejectedEntries) {
          next.set(entry.localKey, {
            localFile: entry.file,
            previewUrl: entry.previewUrl,
            status: 'FRONTEND_REJECTED',
            rejectionReason: entry.rejectionReason!,
          });
        }

        for (const entry of validEntries) {
          next.set(entry.localKey, {
            localFile: entry.file,
            previewUrl: entry.previewUrl,
            status: 'UPLOADING',
          });
        }

        return next;
      });

      if (validEntries.length === 0) return;

      // Step 3: Upload valid files to server
      try {
        const responses = await uploadImages(validEntries.map((e) => e.file));

        // Step 4: Transition local keys → server IDs
        setItems((prev) => {
          const next = new Map(prev);
          for (let i = 0; i < responses.length; i++) {
            const localKey = validEntries[i].localKey;
            const response = responses[i];
            const existing = next.get(localKey);

            if (existing) {
              next.delete(localKey);
              next.set(response.id, {
                ...existing,
                imageId: response.id,
                status: 'PROCESSING',
              });
              processingIdsRef.current.add(response.id);
            }
          }
          return next;
        });

        startPolling();
      } catch (err) {
        console.error('Upload failed:', err);
        // Mark all uploading items as failed
        setItems((prev) => {
          const next = new Map(prev);
          for (const entry of validEntries) {
            const existing = next.get(entry.localKey);
            if (existing) {
              next.set(entry.localKey, {
                ...existing,
                status: 'FRONTEND_REJECTED',
                rejectionReason: 'Upload failed — please try again',
              });
            }
          }
          return next;
        });
      }
    },
    [validateFile, startPolling]
  );

  // ── Load existing images on mount ──────────────────────────────────────────
  useEffect(() => {
    const loadExisting = async () => {
      try {
        const response = await fetchImages(1, 100);
        const records = response.data;

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
  const handleDelete = useCallback(
    async (key: string) => {
      // Read the imageId from state before removing
      let imageId: string | undefined;
      setItems((prev) => {
        const item = prev.get(key);
        imageId = item?.imageId;
        const next = new Map(prev);
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
        next.delete(key);
        return next;
      });
      processingIdsRef.current.delete(key);

      if (imageId) {
        try {
          await deleteImage(imageId);
        } catch {
          // Best-effort
        }
      }
    },
    []
  );

  // ── Derived state ──────────────────────────────────────────────────────────
  const allItems = Array.from(items.entries()).map(([key, item]) => ({
    key,
    ...item,
  }));
  const accepted = allItems.filter((i) => i.status === 'ACCEPTED');
  const rejected = allItems.filter(
    (i) => i.status === 'REJECTED' || i.status === 'FRONTEND_REJECTED'
  );
  const processing = allItems.filter(
    (i) => i.status === 'PROCESSING' || i.status === 'UPLOADING'
  );

  return {
    allItems,
    accepted,
    rejected,
    processing,
    handleFiles,
    handleDelete,
  };
}
