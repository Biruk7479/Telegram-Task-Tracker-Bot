import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Writes need the logged-in member's token; reads work without it.
const TOKEN_KEY = 'taskTrackerToken';
const USER_KEY = 'taskTrackerUser';

export interface AuthUser {
  telegramId: string;
  name: string;
}

export const auth = {
  getToken: (): string | null => (typeof window === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY)),
  getUser: (): AuthUser | null => {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  },
  save: (token: string, user: AuthUser) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  },
};

api.interceptors.request.use((request) => {
  const token = auth.getToken();
  if (token) request.headers.Authorization = `Bearer ${token}`;
  return request;
});

export interface User {
  telegramId: string;
  username: string;
  xp: number;
  weeklyXp: number;
  level: number;
  streaks: Record<string, number>;
  lastCompletions: Record<string, string>;
}

export interface Task {
  _id: string;
  name: string;
  description: string;
  type: string;
  schedule: {
    time?: string;
    days?: number[];
    date?: string;
  };
  xpReward: number;
  active: boolean;
  createdBy: string;
  assignedTo?: string[]; // Array of user IDs
}

export interface Completion {
  _id: string;
  taskId: Task;
  userId: string;
  completed: boolean;
  xpEarned: number;
  streakCount: number;
  completedAt: string;
}

// The plan from the notebook: owner → area → items. See /plan.
export interface StructureArea {
  _id?: string;
  owner: 'li' | 'zen' | 'lizen';
  area: string;
  items: string[];
  sort?: number;
}

export interface CalendarDay {
  date: string;
  completions: {
    taskName: string;
    completed: boolean;
    xpEarned: number;
    streakCount: number;
  }[];
  scheduledTasks: {
    _id: string;
    name: string;
    time: string;
    xpReward: number;
    // pending | done | missed | ignored | excused, or 'scheduled' for future days
    status: string;
    progress: number;
    target: number;
    penalty: number;
    completed: boolean | null;
    missedConfirmation: boolean;
  }[];
  totalXp: number;
  tasksCompleted: number;
  tasksFailed: number;
}

export const apiService = {
  // Log in as one member; the token is attached to every later request.
  login: async (password: string): Promise<AuthUser> => {
    const response = await api.post('/api/auth/login', { password });
    auth.save(response.data.token, response.data.user);
    return response.data.user;
  },

  // The plan: who owns which area, and what is inside each
  getStructure: async (): Promise<StructureArea[]> => {
    const response = await api.get('/api/structure');
    return response.data;
  },

  // Get all users
  getUsers: async (): Promise<User[]> => {
    const response = await api.get('/api/users');
    return response.data;
  },

  // Get user by telegram ID
  getUser: async (telegramId: string): Promise<User> => {
    const response = await api.get(`/api/users/${telegramId}`);
    return response.data;
  },

  // Get all tasks
  getTasks: async (): Promise<Task[]> => {
    const response = await api.get('/api/tasks');
    return response.data;
  },

  // Get completions
  getCompletions: async (params?: {
    userId?: string;
    taskId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Completion[]> => {
    const response = await api.get('/api/completions', { params });
    return response.data;
  },

  // Get calendar data
  getCalendar: async (
    telegramId: string,
    year: number,
    month: number
  ): Promise<CalendarDay[]> => {
    const response = await api.get(`/api/calendar/${telegramId}`, {
      params: { year, month },
    });
    return response.data;
  },

  // Get stats summary
  getStatsSummary: async () => {
    const response = await api.get('/api/stats/summary');
    return response.data;
  },

  // Create a new task
  createTask: async (taskData: {
    name: string;
    description?: string;
    type: string;
    schedule?: {
      time?: string;
      days?: number[];
      date?: string;
    };
    createdBy: string;
    assignedTo?: string[];
    xpReward?: number;
  }): Promise<Task> => {
    const response = await api.post('/api/tasks', taskData);
    return response.data;
  },

  // Update a task
  updateTask: async (taskId: string, updates: Partial<Task>): Promise<Task> => {
    const response = await api.put(`/api/tasks/${taskId}`, updates);
    return response.data;
  },

  // Delete a task
  deleteTask: async (taskId: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/api/tasks/${taskId}`);
    return response.data;
  },

  // Mark task as complete/incomplete
  markTaskComplete: async (
    taskId: string,
    userId: string,
    completed: boolean,
    scheduledFor?: string
  ): Promise<Completion> => {
    const response = await api.post(`/api/tasks/${taskId}/complete`, {
      userId,
      completed,
      scheduledFor,
    });
    return response.data;
  },

  // Get task by ID
  getTaskById: async (taskId: string): Promise<Task> => {
    const response = await api.get(`/api/tasks/${taskId}`);
    return response.data;
  },

  // Get Google Calendar OAuth URL
  getGoogleAuthUrl: async (): Promise<{ authUrl: string }> => {
    const response = await api.get('/api/auth/google/url');
    return response.data;
  },
};

