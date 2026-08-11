export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
export const FEEDBACK_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export type ApiResponse<T> = Omit<Response, 'json'> & {
  json(): Promise<T>;
};

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

export function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  return fetch(apiUrl(path), init) as Promise<ApiResponse<T>>;
}

export function apiFetchUrl<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiResponse<T>> {
  return fetch(input, init) as Promise<ApiResponse<T>>;
}
