import axios from 'axios';
import type { PaginatedResponse, ImageRecord, UploadResponse } from '../types/image';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

/**
 * Upload one or more image files.
 * Returns an array of UploadResponse objects (status = PROCESSING).
 */
export async function uploadImages(files: File[]): Promise<UploadResponse[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));

  const { data } = await api.post<UploadResponse[]>('/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data;
}

/**
 * Fetch paginated list of all image records.
 */
export async function fetchImages(page = 1, limit = 50): Promise<PaginatedResponse> {
  const { data } = await api.get<PaginatedResponse>('/images', {
    params: { page, limit },
  });
  return data;
}

/**
 * Fetch a single image by ID — used for polling.
 */
export async function fetchImageById(id: string): Promise<ImageRecord> {
  const { data } = await api.get<ImageRecord>(`/images/${id}`);
  return data;
}

/**
 * Delete an image by ID.
 */
export async function deleteImage(id: string): Promise<void> {
  await api.delete(`/images/${id}`);
}
