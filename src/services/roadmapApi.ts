import { apiFetch } from './api';

export const getRoadmaps = <T = unknown>(consumerId: string) => apiFetch<T>(`/api/roadmap/${consumerId}`);
export const getRoadmap = <T = unknown>(consumerId: string, level: string) =>
  apiFetch<T>(`/api/roadmap/${consumerId}?level=${level}`);
export const getModulesProgress = <T = unknown>(consumerId: string, level: string) =>
  apiFetch<T>(`/api/modules-progress?consumer_id=${encodeURIComponent(consumerId)}&level=${level}`);
export const createRoadmap = <T = unknown>(payload: unknown) => apiFetch<T>('/api/roadmap/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
export const deleteRoadmap = (consumerId: string, level: string) =>
  apiFetch(`/api/roadmap/${consumerId}/${level}`, { method: 'DELETE' });
export const updateRoadmapProgress = (payload: unknown) => apiFetch('/api/roadmap/progress', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
