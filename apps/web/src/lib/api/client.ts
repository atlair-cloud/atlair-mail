export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const API_VERSION = '1'

type ErrorBody = { statusCode?: number; code?: string; error?: string; message?: string }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message)
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}/service/panel${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Api-Version': API_VERSION,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  if (response.status === 204) return undefined as T

  const body = (await response.json().catch(() => null)) as unknown
  if (!response.ok) {
    const error = (body ?? {}) as ErrorBody
    throw new ApiError(response.status, error.code ?? null, error.message ?? 'Something went wrong')
  }
  return body as T
}
