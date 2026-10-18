// Thin client for the task tracker API. Every call takes the session so the
// same functions work in the app and in the widget's headless task.
import { cacheBoard, normalizeServerUrl, type Session } from './storage';
import type {
  Action, Board, Goal, Occurrence, RangeReport, StructureArea, Task, User, WeekReport,
} from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Base = Pick<Session, 'serverUrl'> & Partial<Pick<Session, 'token'>>;

async function request<T>(base: Base, path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 15000);
  try {
    const res = await fetch(`${normalizeServerUrl(base.serverUrl)}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Client': 'app',
        ...(base.token ? { Authorization: `Bearer ${base.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, controller.signal.aborted ? 'The server took too long to answer' : 'Could not reach the server');
  } finally {
    clearTimeout(timer);
  }
}

export const login = (serverUrl: string, password: string) =>
  request<{ token: string; user: User }>({ serverUrl }, '/api/auth/login', { method: 'POST', body: { password } });

export async function fetchBoard(session: Session, timeoutMs?: number) {
  const board = await request<Board>(session, '/api/board', { timeoutMs });
  await cacheBoard(board);
  return board;
}

export const mark = (session: Session, body: { taskId: string; date?: string; action: Action; amount?: number }) =>
  request<{ occurrence: Occurrence; previousStatus: string }>(session, '/api/occurrences/mark', { method: 'POST', body });

export const fetchRange = (session: Session, from: string, to: string, timeoutMs?: number) =>
  request<RangeReport>(session, `/api/range?from=${from}&to=${to}`, { timeoutMs });

export const fetchDay = (session: Session, date: string) =>
  request<{ date: string; open: boolean; members: { userId: string; name: string; items: Occurrence[] }[] }>(
    session, `/api/day?date=${date}`,
  );

export const fetchWeek = (session: Session, week?: string) =>
  request<WeekReport>(session, `/api/week${week ? `?week=${week}` : ''}`);

export const fetchTasks = (session: Session) => request<Task[]>(session, '/api/tasks');

export type TaskInput = Omit<Task, '_id'> & { startDate?: string };

export const createTask = (session: Session, task: Partial<TaskInput>) =>
  request<Task>(session, '/api/tasks', { method: 'POST', body: task });

export const updateTask = (session: Session, id: string, task: Partial<TaskInput>) =>
  request<Task>(session, `/api/tasks/${id}`, { method: 'PUT', body: task });

export const deleteTask = (session: Session, id: string) =>
  request<{ success: boolean }>(session, `/api/tasks/${id}`, { method: 'DELETE' });

export const fetchStructure = (session: Session) => request<StructureArea[]>(session, '/api/structure');

export const contribute = (session: Session, goalId: string, amount: number, note = '') =>
  request<Goal>(session, `/api/goals/${goalId}/contribute`, { method: 'POST', body: { amount, note } });

// What a single tap on one of your own items does: a counter goes up by one,
// a finished item is undone, anything else is marked done.
export const tapAction = (o: Occurrence): Action => {
  if (o.status === 'done') return 'undo';
  if (o.target > 1) return 'progress';
  return 'done';
};
