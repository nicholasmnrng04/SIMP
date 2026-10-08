import type { ApiErrorResponse } from '../../shared/contracts';

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) { super(message); }
}
export async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...options, credentials: 'same-origin',
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      signal: options.signal ?? AbortSignal.timeout(15000),
    });
  } catch { throw new ApiError(0, 'Layanan belum dapat dihubungi. Periksa koneksi lalu coba kembali.'); }
  if (!response.ok) {
    const data = await response.json().catch(() => null) as ApiErrorResponse | null;
    if (response.status === 401 && !url.startsWith('/api/auth/')) window.dispatchEvent(new Event('simp:session-ended'));
    throw new ApiError(response.status, data?.error?.message ?? 'Permintaan belum dapat diproses. Silakan coba kembali.', data?.error?.fields);
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}
