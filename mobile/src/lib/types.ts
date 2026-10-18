// Shapes returned by the task tracker API (bot/api/server.js).

export type Status = 'pending' | 'done' | 'missed' | 'ignored' | 'excused' | 'void';
export type Action = 'done' | 'missed' | 'excused' | 'undo' | 'progress';
export type DayState = 'none' | 'future' | 'open' | 'perfect' | 'partial' | 'miss' | 'bad';
export type Owner = 'li' | 'zen' | 'lizen';

export interface User {
  telegramId: string;
  name: string;
}

export interface Occurrence {
  _id: string;
  taskId: string;
  userId: string;
  date: string;
  status: Status;
  progress: number;
  target: number;
  unit: string;
  penalty: number;
  taskName: string;
  time?: string;
  mode: 'each' | 'pooled';
  area: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface Member {
  userId: string;
  name: string;
  done: number;
  total: number;
  items: Occurrence[];
  level: number;
  weeklyXp: number;
  excusesLeft: number;
  pendingRewards: string[];
  topStreak: { taskId: string; days: number } | null;
  yesterdayPending: Occurrence[];
}

export interface Goal {
  _id: string;
  name: string;
  target: number;
  unit: string;
  current: number;
  percent: number;
  byMember: Record<string, number>;
}

export interface Deadline {
  taskId: string;
  name: string;
  date: string;
  time?: string;
  daysLeft: number;
  assignedTo: string[];
}

export interface DaySummary {
  date: string;
  members: Record<string, { state: DayState; done: number; total: number; failed: number; pending: number; penalty: number }>;
}

export interface FeedItem extends Occurrence {
  name: string;
}

export interface WeekResult {
  weekKey: string;
  winner?: string;
  loser?: string;
  isTie: boolean;
  reward?: string;
  scores: { userId: string; name: string; xp: number }[];
}

export interface Rules {
  startXp: number;
  penalty: { missed: number; ignored: number };
  excusesPerWeek: number;
  closeHour: number;
}

export interface Board {
  today: string;
  now: string;
  weekKey: string;
  daysLeftInWeek: number;
  rules: Rules;
  members: Member[];
  sharedStreak: number;
  goals: Goal[];
  deadlines: Deadline[];
  feed: FeedItem[];
  lastWeek: WeekResult | null;
  weekDays: DaySummary[];
}

export interface Task {
  _id: string;
  name: string;
  description: string;
  type: 'daily' | 'weekly' | 'custom' | 'one-time' | 'flexible';
  schedule: { time?: string; days?: number[]; date?: string };
  assignedTo: string[];
  target: number;
  unit: string;
  mode: 'each' | 'pooled';
  area: string;
  item: string;
}

export interface StructureArea {
  owner: Owner;
  area: string;
  items: string[];
}

export interface WeekReport {
  weekKey: string;
  result: WeekResult | null;
  members: { userId: string; name: string; xp: number; excusesLeft: number; penalties: Occurrence[] }[];
}

export interface RangeReport {
  today: string;
  members: { userId: string; name: string }[];
  days: DaySummary[];
}
