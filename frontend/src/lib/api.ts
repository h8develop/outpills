/**
 * API-клиент.
 *  - серверные компоненты ходят по внутренней сети Docker (API_INTERNAL_URL);
 *  - клиентские — на публичный NEXT_PUBLIC_API_URL, с cookie (credentials).
 */

const SERVER_BASE = process.env.API_INTERNAL_URL || 'http://localhost:4000/api';
const CLIENT_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export function apiBase(): string {
  return typeof window === 'undefined' ? SERVER_BASE : CLIENT_BASE;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    let body: any = {};
    try {
      body = await res.json();
    } catch {
      /* пустое тело */
    }
    const message = Array.isArray(body.message) ? body.message.join('; ') : body.message || res.statusText;
    throw new ApiError(res.status, message, body.details);
  }
  return res.json() as Promise<T>;
}

/** Формат цены: копейки → «3 900 ₽» */
export function formatPrice(kopecks: number): string {
  return `${Math.round(kopecks / 100).toLocaleString('ru-RU')} ₽`;
}
