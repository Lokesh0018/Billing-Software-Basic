import axios, { AxiosError } from 'axios';
import { localAdapter } from '../data/localApi';

const TOKEN_KEY = 'tiffinflow.token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (t: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* storage unavailable */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
  },
};

/** Every call is answered in the browser by the local data store; there is no backend server. */
export const api = axios.create({ adapter: localAdapter, baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Called when the session is no longer valid. Set by AuthProvider. */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) onUnauthorized?.();
    return Promise.reject(err);
  },
);

interface ApiErrorBody {
  message?: string;
  details?: { field: string; message: string }[] | unknown;
}

/** Turns any API/network error into a single human-readable message. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return fallback;
    const body = err.response.data as ApiErrorBody | Blob | undefined;
    if (body && !(body instanceof Blob)) {
      if (Array.isArray(body.details) && body.details.length) {
        return body.details.map((d: { message: string }) => d.message).join('. ');
      }
      if (body.message) return body.message;
    }
    return `${fallback} (HTTP ${err.response.status})`;
  }
  return err instanceof Error ? err.message : fallback;
}

/** Field-level validation errors from the API, keyed by field name. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!axios.isAxiosError(err)) return {};
  const details = (err.response?.data as ApiErrorBody | undefined)?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.map((d: { field: string; message: string }) => [d.field, d.message]));
}
