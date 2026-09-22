import type {
  Board,
  BoardMode,
  ExerciseCategory,
  ImportResponse,
  Meta,
  OfficeResponse,
  UserResponse,
  UsersResponse,
} from './types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is it still running?');
  }

  const text = await res.text();
  const data: unknown = text ? safeParse(text) : null;

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export interface UserInput {
  name: string;
  age: string | number | null;
  weightKg: string | number;
  note?: string;
  pbAbsolute?: string | number | null;
  pbDate?: string;
}

export interface AttemptInput {
  categoryId?: string;
  reps: string | number;
  date: string;
  weightKg?: string | number | null;
  note?: string;
}

export const api = {
  categories: () => request<{ categories: ExerciseCategory[] }>('/categories'),
  meta: (category?: string) => request<Meta>(`/meta${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  board: (mode: BoardMode, category?: string) =>
    request<Board>(`/leaderboard?mode=${mode}${category ? `&category=${encodeURIComponent(category)}` : ''}`),
  office: () => request<OfficeResponse>('/office'),
  users: (category?: string) =>
    request<UsersResponse>(`/users${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  user: (id: string, category?: string) =>
    request<UserResponse>(`/users/${id}${category ? `?category=${encodeURIComponent(category)}` : ''}`),

  createUser: (input: UserInput) =>
    request<UserResponse>('/users', { method: 'POST', body: JSON.stringify(input) }),
  updateUser: (id: string, input: Partial<UserInput>) =>
    request<UserResponse>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  deleteUser: (id: string) => request<{ ok: true }>(`/users/${id}`, { method: 'DELETE' }),

  addAttempt: (userId: string, input: AttemptInput) =>
    request<UserResponse>(`/users/${userId}/sessions`, { method: 'POST', body: JSON.stringify(input) }),
  deleteAttempt: (attemptId: string) => request<{ ok: true }>(`/sessions/${attemptId}`, { method: 'DELETE' }),
  importCsv: (userId: string, csv: string, categoryId?: string) =>
    request<ImportResponse>(`/users/${userId}/import`, {
      method: 'POST',
      body: JSON.stringify({ csv, categoryId }),
    }),
  verifyPassword: (password: string) =>
    request<{ valid: boolean }>('/verify-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
};
